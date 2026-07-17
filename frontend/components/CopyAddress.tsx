"use client";

import { useState } from "react";
import { toast } from "sonner";
import { explorerAddress } from "@/lib/contracts";

/**
 * A monospace address chip with copy-to-clipboard and (optionally) an explorer
 * link. Reusable across docs, footer, and verdict views. Fires a sonner toast
 * on copy and shows a transient ✓ on the button itself.
 */
export default function CopyAddress({
  value,
  label,
  explorer = true,
  truncate = false,
}: {
  value: string;
  label?: string;
  explorer?: boolean;
  truncate?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const display = truncate && value.length > 16
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`Copied${label ? ` ${label}` : ""} address`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={copy}
        title="Copy address"
        className="group inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface-subtle px-3 py-1.5 font-mono text-xs text-slate-600 transition-colors hover:border-brand/40 hover:text-slate-900"
      >
        <span className="break-all">{display}</span>
        <span className="shrink-0 text-slate-400 group-hover:text-brand">
          {copied ? "✓" : "⧉"}
        </span>
      </button>
      {explorer && value && explorerAddress(value) && (
        <a
          href={explorerAddress(value)}
          target="_blank"
          rel="noopener noreferrer"
          title="View on explorer"
          className="text-xs text-slate-400 transition-colors hover:text-brand"
        >
          ↗
        </a>
      )}
    </span>
  );
}
