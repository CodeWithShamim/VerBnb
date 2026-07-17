"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { getChain } from "@/lib/genLayerClient";

// The active GenLayer network as a viem-compatible chain for Privy. genlayer-js
// already exports viem-shaped chain objects, so we reuse them directly.
const activeChain = getChain() as any;

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

/**
 * Wraps the app in Privy. If no NEXT_PUBLIC_PRIVY_APP_ID is configured the
 * provider is skipped (the app still works via the server-side fallback signer),
 * so the build and pages never break when Privy isn't set up yet.
 */
export default function PrivyAppProvider({ children }: { children: ReactNode }) {
  if (!APP_ID) return <>{children}</>;

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#7b39fc",
          logo: undefined,
          walletChainType: "ethereum-only",
        },
        // Create an embedded wallet for users who log in with email/social.
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        loginMethods: ["wallet", "email", "google"],
        defaultChain: activeChain,
        supportedChains: [activeChain],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
