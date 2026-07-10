"use client";

import { useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

/**
 * Null-rendering probe for the connected wallet address. Privy hooks throw
 * when no PrivyProvider is mounted (app id unset), so this must only be
 * rendered behind a NEXT_PUBLIC_PRIVY_APP_ID gate — same pattern as
 * components/ConnectWallet.tsx. Loaded via next/dynamic so the Privy SDK
 * stays out of the leaderboard route's initial bundle.
 */
export default function WalletProbe({
  onAddress,
}: {
  onAddress: (addr: string) => void;
}) {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets[0]?.address || user?.wallet?.address || "";
  useEffect(() => {
    onAddress(address);
  }, [address, onAddress]);
  return null;
}
