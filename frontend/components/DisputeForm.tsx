"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { uploadEvidence } from "@/lib/uploadEvidence";
import { CATEGORIES, type Category } from "@/lib/contracts";
import SubmitButton from "@/components/SubmitButton";

export type FieldType = "text" | "number" | "url" | "textarea" | "file";

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
  /** For file fields: which field name receives the resulting IPFS URL. */
  target?: string;
}

export default function DisputeForm({
  category,
  fields,
}: {
  category: Category;
  fields: FormField[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [uploadPct, setUploadPct] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = CATEGORIES[category];

  function setField(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function handleFile(field: FormField, file: File | null) {
    if (!file) return;
    const dest = field.target || field.name;
    setError(null);
    setUploading(true);
    setUploadPct((p) => ({ ...p, [field.name]: 0 }));
    try {
      const { url } = await uploadEvidence(file, (pct) =>
        setUploadPct((p) => ({ ...p, [field.name]: pct }))
      );
      setField(dest, url);
    } catch (e: any) {
      setError(e?.message || "Evidence upload failed");
    } finally {
      setUploading(false);
    }
  }

  function validate(): string | null {
    for (const f of fields) {
      if (f.required && !values[f.name]) return `${f.label} is required`;
    }
    return null;
  }

  function onSuccess(disputeId: string, specialistTx: string) {
    const params = new URLSearchParams({ category, tx: specialistTx || "" });
    router.push(`/dispute/${encodeURIComponent(disputeId)}?${params.toString()}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="card overflow-hidden"
    >
      {/* accent header */}
      <div
        className={`relative bg-gradient-to-r ${meta.gradient} px-6 py-7 text-white sm:px-8`}
      >
        <div className="pointer-events-none absolute inset-0 opacity-25 [background:radial-gradient(400px_circle_at_85%_-20%,white,transparent)]" />
        <span className="relative inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur">
          {meta.title} dispute
        </span>
        <h1 className="relative mt-3 text-2xl font-bold">{meta.tagline}</h1>
      </div>

      <div className="space-y-5 p-6 sm:p-8">
        {fields.map((f, i) => (
          <motion.div
            key={f.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 * i }}
          >
            <label className="label" htmlFor={f.name}>
              {f.label}
              {f.required && <span className={meta.text}> *</span>}
            </label>

            {f.type === "textarea" ? (
              <textarea
                id={f.name}
                className="input min-h-[100px] resize-y"
                placeholder={f.placeholder}
                value={values[f.name] || ""}
                onChange={(e) => setField(f.name, e.target.value)}
              />
            ) : f.type === "file" ? (
              <div>
                <label
                  htmlFor={f.name}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-border bg-surface-subtle px-4 py-6 text-center transition-colors hover:border-brand/50 hover:bg-brand-50/40"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    className="h-7 w-7 text-slate-400"
                  >
                    <path
                      d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-sm font-medium text-slate-600">
                    Click to upload evidence
                  </span>
                  <span className="text-xs text-slate-400">
                    Pinned to IPFS via Pinata
                  </span>
                  <input
                    id={f.name}
                    type="file"
                    className="hidden"
                    onChange={(e) =>
                      handleFile(f, e.target.files?.[0] || null)
                    }
                  />
                </label>
                {typeof uploadPct[f.name] === "number" && (
                  <div className="mt-2.5">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadPct[f.name]}%` }}
                        transition={{ ease: "easeOut" }}
                      />
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      {uploadPct[f.name] === 100 ? (
                        <>
                          <span className="text-emerald-500">✓</span> Uploaded to
                          IPFS
                        </>
                      ) : (
                        `Uploading… ${uploadPct[f.name]}%`
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <input
                id={f.name}
                type={f.type === "number" ? "number" : "text"}
                className="input"
                placeholder={f.placeholder}
                value={values[f.name] || ""}
                onChange={(e) => setField(f.name, e.target.value)}
              />
            )}

            {f.help && (
              <p className="mt-1.5 text-xs text-slate-400">{f.help}</p>
            )}
          </motion.div>
        ))}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600"
          >
            {error}
          </motion.div>
        )}

        <SubmitButton
          category={category}
          getValues={() => values}
          validate={validate}
          onError={setError}
          onSuccess={onSuccess}
          disabled={uploading}
        />

        <p className="text-center text-xs text-slate-400">
          Evidence is pinned to IPFS, then validators independently fetch it and
          reach consensus on-chain.
        </p>
      </div>
    </motion.div>
  );
}
