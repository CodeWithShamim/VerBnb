"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import AppealForm, { type AppealSubmitPayload } from "@/components/AppealForm";
import { CATEGORIES, type Category } from "@/lib/contracts";

const APPEAL_WINDOW_DAYS = 7;

interface DisputeRecord {
  dispute_id: string;
  category: string;
  submitter: string;
  timestamp: number;
  resolved: boolean;
}

interface AppealRecord {
  appeal_id: string;
  appeal_status: string;
  appeal_reason: string;
  appeal_submitted_at: number;
  appeal_verdict: string;
  new_consensus_round: number;
  validators_this_round: number;
  original_refund_pct: number;
  appeal_refund_pct: number;
}

function daysRemaining(verdictAt: number): number {
  if (!verdictAt) return 0;
  const elapsed = Date.now() / 1000 - verdictAt;
  return Math.max(0, APPEAL_WINDOW_DAYS - Math.floor(elapsed / 86400));
}

export default function AppealPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const disputeId = decodeURIComponent(params.id);
  const category = (search.get("category") || "") as Category | "";

  const [record, setRecord] = useState<DisputeRecord | null>(null);
  const [verdict, setVerdict] = useState<any>(null);
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, a] = await Promise.all([
        fetch(
          `/api/verdict/${encodeURIComponent(disputeId)}?category=${encodeURIComponent(
            category
          )}`
        ).then((r) => r.json()),
        fetch(
          `/api/trackers?resource=appeals&disputeId=${encodeURIComponent(disputeId)}`
        ).then((r) => r.json()),
      ]);
      if (v?.record) setRecord(v.record);
      if (v?.verdict) setVerdict(v.verdict);
      setAppeals(Array.isArray(a?.appeals) ? a.appeals : []);
    } finally {
      setLoading(false);
    }
  }, [disputeId, category]);

  useEffect(() => {
    load();
  }, [load]);

  const verdictAt = record?.timestamp ?? 0;
  const remaining = daysRemaining(verdictAt);
  const windowOpen = remaining > 0;
  const originalRefund =
    typeof verdict?.refund_percentage === "number" ? verdict.refund_percentage : 0;

  const existing = appeals.find((a) => a.appeal_status !== "FINALIZED") || appeals[0];

  async function handleSubmit(payload: AppealSubmitPayload) {
    const reason = payload.details
      ? `${payload.reason}: ${payload.details}`
      : payload.reason;
    const res = await fetch("/api/appeal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disputeId,
        appellant: record?.submitter || "",
        originalVerdictAt: verdictAt,
        originalRefundPct: originalRefund,
        partyA: record?.submitter || "",
        partyB: "",
        reason,
        evidenceUrl: payload.evidenceUrl,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setSubmitted(true);
    setTimeout(load, 1500);
  }

  return (
    <div className="bg-grid min-h-screen">
      <div className="container-page max-w-3xl py-12">
        <Link
          href={`/dispute/${encodeURIComponent(disputeId)}?category=${category}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand"
        >
          ← Back to dispute
        </Link>

        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Appeal verdict for{" "}
          <span className="break-all font-mono text-brand">{disputeId}</span>
        </h1>

        {loading && (
          <div className="card mt-6 p-8 text-center text-slate-400">Loading…</div>
        )}

        {!loading && (
          <div className="mt-6 space-y-6">
            {/* Card 1: Original verdict */}
            <div className="card p-6">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">
                Original verdict
              </h2>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Category</span>
                  <span className="font-medium text-slate-800">
                    {record?.category
                      ? CATEGORIES[record.category as Category]?.title ||
                        record.category
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verdict</span>
                  <span className="font-medium text-slate-800">
                    {verdict?.verdict?.replaceAll("_", " ") || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Refund given</span>
                  <span className="font-medium text-slate-800">
                    {originalRefund}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Finalized</span>
                  <span className="font-medium text-slate-800">
                    {verdictAt ? format(new Date(verdictAt * 1000), "MMM d, yyyy") : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Existing appeal status, or appeal form */}
            {existing ? (
              <>
                <div className="card p-6">
                  <h2 className="mb-3 text-sm font-semibold text-slate-700">
                    Appeal status
                  </h2>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Appeal ID</span>
                      <span className="font-mono text-xs text-slate-700">
                        {existing.appeal_id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Submitted</span>
                      <span className="font-medium text-slate-800">
                        {existing.appeal_submitted_at
                          ? format(
                              new Date(existing.appeal_submitted_at * 1000),
                              "MMM d, yyyy HH:mm"
                            )
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          existing.appeal_status === "FINALIZED"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {existing.appeal_status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">New consensus round</span>
                      <span className="font-medium text-slate-800">
                        {existing.validators_this_round} validators (vs original 3)
                      </span>
                    </div>
                  </div>
                </div>

                {existing.appeal_status === "FINALIZED" && (
                  <div className="card p-6">
                    <h2 className="mb-3 text-sm font-semibold text-slate-700">
                      Appeal verdict
                    </h2>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Original refund</span>
                        <span className="font-medium text-slate-800">
                          {existing.original_refund_pct}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Appeal refund</span>
                        <span className="font-medium text-slate-800">
                          {existing.appeal_refund_pct}%
                        </span>
                      </div>
                      <div className="mt-2 rounded-xl bg-surface-subtle px-4 py-3 text-center font-semibold">
                        {existing.appeal_refund_pct !== existing.original_refund_pct
                          ? "✅ Appeal accepted — verdict changed"
                          : "Original verdict upheld"}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Card 2: Appeal window */}
                <div className="card p-6">
                  <h2 className="mb-2 text-sm font-semibold text-slate-700">
                    Appeal window
                  </h2>
                  <p className="text-sm text-slate-500">
                    Days remaining to appeal:{" "}
                    <span
                      className={`font-bold ${
                        windowOpen ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {remaining}/{APPEAL_WINDOW_DAYS}
                    </span>
                  </p>
                  {!windowOpen && (
                    <p className="mt-2 text-sm text-rose-500">
                      The 7-day appeal window has closed for this verdict.
                    </p>
                  )}
                </div>

                {/* Card 3: Appeal form */}
                {windowOpen && (
                  <div className="card p-6">
                    <h2 className="mb-4 text-sm font-semibold text-slate-700">
                      File an appeal
                    </h2>
                    {submitted ? (
                      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        ✓ Appeal submitted. Refreshing status…
                      </p>
                    ) : (
                      <AppealForm
                        disputeId={disputeId}
                        onSubmit={handleSubmit}
                        validatorCount={5}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
