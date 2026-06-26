"use client";

import { useState } from "react";
import { newDisputeId } from "@/lib/contracts";
import type { SubmitButtonProps } from "@/components/SubmitButton";

/** Submits via the server route (platform key signs). No wallet required. */
export default function ServerSubmitButton({
  category,
  getValues,
  validate,
  onError,
  onSuccess,
  disabled,
}: SubmitButtonProps) {
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const v = validate();
    if (v) {
      onError(v);
      return;
    }
    onError(null);
    setSubmitting(true);
    const disputeId = newDisputeId(category);
    try {
      const res = await fetch("/api/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, disputeId, ...getValues() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      onSuccess(disputeId, data.specialistTx || "");
    } catch (e: any) {
      onError(e?.message || "Submission failed");
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      className="btn-primary w-full py-3.5 text-base"
      disabled={submitting || disabled}
      onClick={submit}
    >
      {submitting ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Submitting to validators…
        </>
      ) : (
        "Submit dispute"
      )}
    </button>
  );
}
