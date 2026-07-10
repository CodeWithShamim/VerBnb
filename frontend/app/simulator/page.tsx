import type { Metadata } from "next";
import Link from "next/link";
import SimulatorClient from "@/components/simulator/SimulatorClient";

export const metadata: Metadata = {
  title: "Refund Simulator - VerBnb",
  description:
    "Free, non-binding pre-check: score your draft claim and see how comparable past disputes were refunded before you pay gas to file.",
};

/**
 * /simulator - Refund Simulator. A gas-free rehearsal for filing a dispute:
 * the user drafts their claim, gets a transparent local strength score
 * (lib/claimStrength.ts), and sees real keyword-matched past disputes with
 * their refund outcomes (analytics tracker views via /api/trackers).
 */
export default function SimulatorPage() {
  return (
    <div className="bg-grid">
      <div className="container-page py-10 sm:py-14">
        {/* Breadcrumb - mirrors FormPageShell's voice. */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/" className="transition-colors hover:text-brand">
            Home
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-brand">Refund Simulator</span>
        </nav>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl text-slate-900 sm:text-4xl">
              Rehearse your claim <span className="text-gradient-pop">before you file</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Draft your dispute, get an instant strength assessment, and see how
              comparable past cases were refunded - all free, before you spend gas.
              The real verdict is always decided by independent AI validators.
            </p>
          </div>
          <span className="chip mt-1 shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
            </span>
            No gas · non-binding
          </span>
        </div>

        <div className="mt-8">
          <SimulatorClient />
        </div>
      </div>
    </div>
  );
}
