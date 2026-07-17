"use client";

import { useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import {
  CATEGORIES,
  REGISTRY_ADDRESS,
  SPECIALIST_BY_CATEGORY,
  type Category,
} from "@/lib/contracts";

const REGISTRY = REGISTRY_ADDRESS;

export interface DisputeSubmission {
  category: Category;
  disputeId: string;
  // category-specific fields (already collected by the form)
  listingUrl?: string;
  evidenceUrl?: string;
  claimedAmount?: string;
  orderId?: string;
  customerClaim?: string;
  expectedAddress?: string;
  brandId?: string;
  claim?: string;
  certificationUrl?: string;
  supplierRegistryUrl?: string;
}

/** Build the ordered args each specialist write method expects. */
function specialistArgs(s: DisputeSubmission): any[] {
  switch (s.category) {
    case "RENTAL":
      return [
        s.disputeId,
        s.listingUrl,
        s.evidenceUrl,
        BigInt(s.claimedAmount || 0),
      ];
    case "PRODUCT":
      return [s.disputeId, s.listingUrl, s.evidenceUrl];
    case "SOURCING":
      // dispute_id lets the specialist persist the evidence URLs so the
      // claim can be appealed on-chain (resolve_appeal) later.
      return [
        s.brandId,
        s.claim,
        s.certificationUrl,
        s.supplierRegistryUrl,
        s.disputeId,
      ];
    case "DELIVERY":
      return [
        s.disputeId,
        s.orderId,
        s.evidenceUrl,
        s.customerClaim,
        s.expectedAddress,
      ];
  }
}

export interface WalletSubmitResult {
  specialistTx: string;
  registryTx: string | null;
  specialist: string;
  signer: string;
}

/**
 * Returns helpers to submit a dispute signed by the user's connected wallet
 * (via Privy → genlayer-js). Falls back to throwing if no wallet is connected;
 * the caller can then use the server route instead.
 */
export function useWalletDispute() {
  const { authenticated, login, logout, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const address = wallet?.address || (user?.wallet?.address ?? "");

  const submit = useCallback(
    async (sub: DisputeSubmission): Promise<WalletSubmitResult> => {
      if (!wallet) throw new Error("No wallet connected");
      if (!REGISTRY) throw new Error("Registry address not configured");

      // Ask the wallet to switch to GenLayer Bradbury (chain 4221) first, so the
      // signing prompt happens on the correct network. External wallets may
      // need to add the chain; embedded Privy wallets switch silently.
      try {
        await (wallet as any).switchChain?.(testnetBradbury.id as number);
      } catch {
        // Non-fatal: client.connect() below re-checks and will throw a clear
        // error if the wallet is still on the wrong chain.
      }

      // EIP-1193 provider from the Privy wallet (embedded or external).
      const provider = await wallet.getEthereumProvider();

      // genlayer-js write client signing through the user's wallet.
      const client = createClient({
        chain: testnetBradbury,
        account: wallet.address as `0x${string}`,
        // provider field accepts a wallet-SDK EIP-1193 provider (per docs)
        provider,
      });

      // Ensure the wallet is on the GenLayer Bradbury network before writing.
      await client.connect("testnetBradbury");

      // 1. Specialist contract from deployments/bradbury.json - the same
      // address set the registry routes to, so no on-chain discovery read.
      const specialist = SPECIALIST_BY_CATEGORY[sub.category];
      if (!specialist)
        throw new Error(`No deployed contract for ${sub.category}`);

      // 2. Raise the dispute on the specialist (user signs).
      const method = CATEGORIES[sub.category].method;
      const specialistTx = (await client.writeContract({
        address: specialist as `0x${string}`,
        functionName: method,
        args: specialistArgs(sub),
        value: 0n,
      })) as string;

      // 3. Register in the registry (user signs; optional - non-fatal on reject).
      let registryTx: string | null = null;
      try {
        registryTx = (await client.writeContract({
          address: REGISTRY,
          functionName: "register_dispute",
          args: [sub.disputeId, sub.category, specialist],
          value: 0n,
        })) as string;
      } catch {
        registryTx = null;
      }

      return { specialistTx, registryTx, specialist, signer: wallet.address };
    },
    [wallet],
  );

  return {
    ready,
    authenticated,
    address,
    connected: Boolean(wallet),
    login,
    logout,
    submit,
  };
}
