"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const HAS_PRIVY = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

function short(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ConnectWallet() {
  // When Privy isn't configured, render nothing (server-key fallback is used).
  if (!HAS_PRIVY) return null;
  return <ConnectWalletInner />;
}

function ConnectWalletInner() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const [open, setOpen] = useState(false);

  const address = wallets[0]?.address || user?.wallet?.address || "";

  if (!ready) {
    return (
      <div className="h-9 w-32 animate-pulse rounded-xl bg-surface-muted" />
    );
  }

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={login}
        className="btn-primary px-4 py-2 text-sm"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path
            d="M3 7a2 2 0 012-2h12a2 2 0 012 2v1h1a1 1 0 011 1v6a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7Zm16 3h-3a2 2 0 100 4h3"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Connect wallet
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand/40"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="font-mono">{short(address)}</span>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-surface-border bg-white p-1.5 shadow-lift"
            >
              <div className="px-3 py-2">
                <p className="text-xs text-slate-400">Connected</p>
                <p className="truncate font-mono text-xs text-slate-700">
                  {address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(address);
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-surface-subtle"
              >
                Copy address
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-500 hover:bg-rose-50"
              >
                Disconnect
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
