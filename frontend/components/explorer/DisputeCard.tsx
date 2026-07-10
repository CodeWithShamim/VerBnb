"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CATEGORIES, type Category } from "@/lib/contracts";

/**
 * One dispute as the Explorer displays it — the /api/explorer record shape,
 * plus an optional live tx-status label for locally-tracked submissions.
 */
export interface ExplorerDispute {
  id: string;
  category: string;
  status: "RESOLVED" | "PENDING";
  resolved: boolean;
  submitter: string;
  /** Seconds epoch, when known. */
  timestamp: number | null;
  refundPct: number | null;
  summary: string | null;
  /** Chain tx status (e.g. "Finalized") for browser-local entries. */
  txStatus?: string | null;
}

function shortId(id: string): string {
  return id.length > 26 ? `${id.slice(0, 16)}…${id.slice(-8)}` : id;
}

function shortAddress(addr: string): string {
  if (!addr) return "—";
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function relativeTime(secEpoch?: number | null): string {
  if (!secEpoch) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - secEpoch);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Explorer result card: gradient category badge, copyable id, status pill. */
export default function DisputeCard({ record }: { record: ExplorerDispute }) {
  const [copied, setCopied] = useState(false);
  const meta = CATEGORIES[record.category as Category] ?? null;

  const href = `/dispute/${encodeURIComponent(record.id)}${
    meta ? `?category=${meta.key}` : ""
  }`;

  async function copyId(e: React.MouseEvent) {
    // The whole card is a link — keep the copy click local.
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(record.id);
      setCopied(true);
      toast.success("Copied dispute id");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <Link
      href={href}
      className="card card-hover group block p-5"
      title={record.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${
              meta?.gradient ?? "from-slate-400 to-slate-500"
            } text-sm font-bold text-white`}
          >
            {(meta?.title ?? record.category ?? "?").charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {meta?.title ?? record.category ?? "Unknown"}
            </p>
            <button
              type="button"
              onClick={copyId}
              title="Copy dispute id"
              className="mt-0.5 inline-flex max-w-full items-center gap-1.5 font-mono text-xs text-slate-500 transition-colors hover:text-brand"
            >
              <span className="truncate">{shortId(record.id)}</span>
              <span className="shrink-0">{copied ? "✓" : "⧉"}</span>
            </button>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
            record.resolved
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              record.resolved ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
            }`}
          />
          {record.resolved ? "Resolved" : "Pending"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
        {record.resolved && record.refundPct != null && (
          <span className="font-semibold text-slate-700">
            {record.refundPct}% refund
          </span>
        )}
        {record.summary && (
          <span className="rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
            {record.summary}
          </span>
        )}
        {record.txStatus && (
          <span className="rounded-md bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium">
            tx: {record.txStatus}
          </span>
        )}
        <span className="font-mono" title={record.submitter}>
          by {shortAddress(record.submitter)}
        </span>
        {record.timestamp && (
          <span className="ml-auto text-slate-400">
            {relativeTime(record.timestamp)}
          </span>
        )}
      </div>

      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
        View verdict →
      </span>
    </Link>
  );
}
