'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { uploadEvidence } from '@/lib/uploadEvidence';
import { CATEGORIES, type Category } from '@/lib/contracts';
import { recordDispute } from '@/lib/recentDisputes';
import SubmitButton from '@/components/SubmitButton';

export type FieldType = 'text' | 'number' | 'url' | 'textarea' | 'file';

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
  /** For file fields: which field name receives the resulting IPFS URL. */
  target?: string;
  /** Pre-filled value the field starts with (editable by the user). */
  defaultValue?: string;
  /** Section heading this field starts (or continues, when omitted). */
  section?: string;
}

/** Group consecutive fields under their section; unsectioned fields inherit. */
function groupFields(fields: FormField[]) {
  const groups: { section: string | null; fields: FormField[] }[] = [];
  for (const f of fields) {
    const last = groups[groups.length - 1];
    if (last && (f.section === undefined || f.section === last.section)) {
      last.fields.push(f);
    } else {
      groups.push({ section: f.section ?? null, fields: [f] });
    }
  }
  return groups;
}

export default function DisputeForm({
  category,
  fields,
}: {
  category: Category;
  fields: FormField[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      if (f.defaultValue) initial[f.name] = f.defaultValue;
    }
    return initial;
  });
  const [uploadPct, setUploadPct] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = CATEGORIES[category];
  const groups = groupFields(fields);

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
        setUploadPct((p) => ({ ...p, [field.name]: pct })),
      );
      setField(dest, url);
    } catch (e: any) {
      setError(e?.message || 'Evidence upload failed');
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
    // Index this dispute locally so the live activity feed can pick it up and
    // enrich it straight from the chain.
    recordDispute({ id: disputeId, category, tx: specialistTx || undefined });
    const params = new URLSearchParams({ category, tx: specialistTx || '' });
    router.push(`/dispute/${encodeURIComponent(disputeId)}?${params.toString()}`);
  }

  function renderField(f: FormField) {
    if (f.type === 'textarea') {
      return (
        <textarea
          id={f.name}
          className="input min-h-[110px] resize-y"
          placeholder={f.placeholder}
          value={values[f.name] || ''}
          onChange={(e) => setField(f.name, e.target.value)}
        />
      );
    }
    if (f.type === 'file') {
      return (
        <div>
          <label
            htmlFor={f.name}
            className="group flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-surface-border bg-surface-subtle px-5 py-4 transition-colors hover:border-brand/50 hover:bg-brand-50/30"
          >
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${meta.soft} ${meta.text}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                className="h-5 w-5"
              >
                <path
                  d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-700">
                Drop a file or click to browse
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">
                Pinned to IPFS via Pinata - fills the URL field automatically
              </span>
            </span>
            <span className="hidden shrink-0 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors group-hover:border-brand/40 group-hover:text-brand sm:block">
              Browse
            </span>
            <input
              id={f.name}
              type="file"
              className="hidden"
              onChange={(e) => handleFile(f, e.target.files?.[0] || null)}
            />
          </label>
          {typeof uploadPct[f.name] === 'number' && (
            <div className="mt-2.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadPct[f.name]}%` }}
                  transition={{ ease: 'easeOut' }}
                />
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                {uploadPct[f.name] === 100 ? (
                  <>
                    <span className="text-emerald-500">✓</span> Uploaded to IPFS
                  </>
                ) : (
                  `Uploading… ${uploadPct[f.name]}%`
                )}
              </p>
            </div>
          )}
        </div>
      );
    }
    return (
      <input
        id={f.name}
        type={f.type === 'number' ? 'number' : 'text'}
        className="input"
        placeholder={f.placeholder}
        value={values[f.name] || ''}
        onChange={(e) => setField(f.name, e.target.value)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="card flex flex-1 flex-col overflow-hidden"
    >
      {/* Slim category accent strip - identity without a heavy banner. */}
      <div className={`h-1.5 shrink-0 bg-gradient-to-r ${meta.gradient}`} />

      <div className="flex flex-1 flex-col p-6 sm:p-8">
        {/* Fields grow first so the submit section stays pinned to the card's
            bottom when the side panel is the taller column. */}
        <div className="flex-1">
          {groups.map((g, gi) => (
            <motion.section
              key={gi}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 * gi }}
              className={gi > 0 ? 'mt-9' : undefined}
            >
              {g.section && (
                <div className="mb-5 flex items-center gap-3">
                  <span
                    className="font-mono text-xs font-bold tabular-nums"
                    style={{ color: meta.accent }}
                  >
                    {String(gi + 1).padStart(2, '0')}
                  </span>
                  <span className="font-sans text-sm font-semibold uppercase tracking-wider text-slate-700">
                    {g.section}
                  </span>
                  <span className="h-px flex-1 bg-surface-border" />
                </div>
              )}

              <div className="space-y-5">
                {g.fields.map((f) => (
                  <div key={f.name}>
                    <label className="label" htmlFor={f.name}>
                      {f.label}
                      {f.required && <span className={meta.text}> *</span>}
                    </label>
                    {renderField(f)}
                    {f.help && <p className="mt-1.5 text-xs text-slate-400">{f.help}</p>}
                  </div>
                ))}
              </div>
            </motion.section>
          ))}

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600"
            >
              {error}
            </motion.div>
          )}
        </div>

        <div className="mt-8 border-t border-surface-border pt-6">
          <SubmitButton
            category={category}
            getValues={() => values}
            validate={validate}
            onError={setError}
            onSuccess={onSuccess}
            disabled={uploading}
          />
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="h-3.5 w-3.5 shrink-0"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
            </svg>
            Evidence is pinned to IPFS; validators fetch it independently and settle the verdict
            on-chain.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
