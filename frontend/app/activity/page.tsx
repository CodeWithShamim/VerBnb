import type { Metadata } from 'next';
import Link from 'next/link';
import LiveTransactions from '@/components/LiveTransactions';
import MeshBackground from '@/components/MeshBackground';
import Reveal from '@/components/Reveal';
import PlatformStats from '@/components/PlatformStats';
import { REGISTRY_ADDRESS, explorerAddress, getChainInfo } from '@/lib/contracts';

export const metadata: Metadata = {
  title: 'Live activity - VerBnb',
  description:
    'Live on-chain dispute activity. Status and block are pulled live from the GenLayer network.',
};

export default function ActivityPage() {
  const registryUrl = explorerAddress(REGISTRY_ADDRESS);

  return (
    <div className="bg-grid min-h-screen">
      <section className="relative overflow-hidden">
        <MeshBackground />
        <div className="container-page relative z-10 max-w-4xl pb-10 pt-16 sm:pt-20">
          <Reveal direction="down">
            <span className="chip mx-auto bg-white/70 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live from {getChainInfo().name}
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mx-auto mt-6 max-w-2xl text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              On-chain <span className="gradient-text">activity</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-xl text-center text-slate-600">
              Every dispute you raise, tracked in real time. Status and block are pulled live from
              the chain - no cached snapshots.
            </p>
          </Reveal>

          {registryUrl && (
            <Reveal delay={0.14} className="mt-5 text-center">
              <a
                href={registryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-white/70 px-3.5 py-2 font-mono text-xs text-slate-600 backdrop-blur transition-colors hover:border-brand/40 hover:text-brand"
              >
                Registry contract: {REGISTRY_ADDRESS.slice(0, 10)}…{REGISTRY_ADDRESS.slice(-8)}
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                  <path
                    d="M7 17 17 7M9 7h8v8"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </Reveal>
          )}
        </div>
      </section>

      <div className="container-page max-w-4xl pb-20">
        <Reveal>
          <div className="mb-8">
            <PlatformStats />
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <LiveTransactions />
        </Reveal>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Refreshing every 10 seconds - status and block read straight from GenLayer.
        </p>

        <div className="mt-10 text-center">
          <Link href="/#categories" className="text-sm font-medium text-brand hover:text-brand/80">
            Raise a new dispute →
          </Link>
        </div>
      </div>
    </div>
  );
}
