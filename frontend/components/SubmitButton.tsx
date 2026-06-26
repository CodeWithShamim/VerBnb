"use client";

import dynamic from "next/dynamic";
import ServerSubmitButton from "@/components/submit/ServerSubmitButton";
import type { Category } from "@/lib/contracts";

export interface SubmitButtonProps {
  category: Category;
  getValues: () => Record<string, string>;
  validate: () => string | null;
  onError: (msg: string | null) => void;
  onSuccess: (disputeId: string, specialistTx: string) => void;
  disabled?: boolean;
}

const HAS_PRIVY = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

// Lazy-load the wallet path so Privy + the genlayer-js write client are only
// shipped when wallet signing is actually enabled.
const WalletSubmitButton = dynamic(
  () => import("@/components/submit/WalletSubmitButton"),
  {
    ssr: false,
    loading: () => (
      <button className="btn-primary w-full py-3.5 text-base" disabled>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        Loading wallet…
      </button>
    ),
  }
);

/**
 * Picks the submission strategy:
 *  - Privy configured  → user signs with their own wallet (client-side).
 *  - Not configured    → platform key signs via the /api/dispute route.
 *
 * The choice is a build-time env constant (not a hook), so the Privy-using
 * variant is only ever mounted when a PrivyProvider exists above it.
 */
export default function SubmitButton(props: SubmitButtonProps) {
  return HAS_PRIVY ? (
    <WalletSubmitButton {...props} />
  ) : (
    <ServerSubmitButton {...props} />
  );
}
