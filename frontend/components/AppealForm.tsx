"use client";

import { useState } from "react";

const REASONS = [
  "Validators misunderstood evidence",
  "New evidence discovered",
  "Dispute was misclassified",
  "Validators biased",
  "Other",
];

export interface AppealSubmitPayload {
  reason: string;
  details: string;
  evidenceUrl: string;
}

/**
 * Reusable appeal form. Collects a reason + optional new evidence (uploaded to
 * IPFS via /api/upload) and hands the payload to onSubmit, which is expected to
 * call appeal_manager.create_appeal (e.g. via /api/appeal).
 *
 * Props:
 *   disputeId - the dispute being appealed (shown for context)
 *   onSubmit  - async handler receiving { reason, details, evidenceUrl }
 *   validatorCount - how many validators the new round will use (default 5)
 */
export default function AppealForm({
  disputeId,
  onSubmit,
  validatorCount = 5,
}: {
  disputeId: string;
  onSubmit: (payload: AppealSubmitPayload) => Promise<void>;
  validatorCount?: number;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState(
    "The validators overlooked key evidence in the original round; please re-evaluate with the larger panel."
  );
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: form });
      const d = await r.json();
      if (d.url) setEvidenceUrl(d.url);
      else setError(d.error || "Upload failed");
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ reason, details, evidenceUrl });
    } catch (err: any) {
      setError(err?.message || "Failed to submit appeal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">
          Appeal reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl border border-surface-border bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand focus:outline-none"
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">
          Additional details (optional)
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          placeholder="Explain why the original verdict should be reconsidered…"
          className="w-full rounded-xl border border-surface-border bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">
          New evidence (optional)
        </label>
        <input
          type="file"
          onChange={handleFile}
          className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-subtle file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-surface-muted"
        />
        {uploading && (
          <p className="mt-1 text-xs text-slate-400">Uploading to IPFS…</p>
        )}
        {evidenceUrl && (
          <p className="mt-1 break-all text-xs text-emerald-600">
            ✓ Uploaded: {evidenceUrl}
          </p>
        )}
      </div>

      <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
        This creates a new consensus round with{" "}
        <span className="font-semibold">{validatorCount} validators</span> (vs the
        original 3). The new verdict replaces the original.
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || uploading}
        className="w-full rounded-xl bg-gradient-to-r from-brand to-violet-500 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Submitting appeal…" : `Submit appeal for ${disputeId}`}
      </button>
    </form>
  );
}
