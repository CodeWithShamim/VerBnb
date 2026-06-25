import Link from "next/link";
import { CATEGORIES } from "@/lib/contracts";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-surface-border bg-white">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-500 font-black text-white">
              V
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              VerBnb
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-slate-500">
            Universal AI-enforced marketplace dispute resolution, settled
            on-chain by GenLayer validator consensus.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-900">Categories</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
            {Object.values(CATEGORIES).map((c) => (
              <li key={c.key}>
                <Link href={`/${c.slug}`} className="hover:text-brand">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-900">Network</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
            <li>GenLayer Bradbury testnet</li>
            <li>Chain ID 4221</li>
            <li>
              <a
                href="https://testnet-faucet.genlayer.foundation"
                target="_blank"
                rel="noreferrer"
                className="hover:text-brand"
              >
                Testnet faucet ↗
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-900">How it works</h4>
          <p className="mt-4 text-sm text-slate-500">
            Validators independently fetch your evidence, apply LLM judgment,
            reach consensus, and settle the outcome on-chain.
          </p>
        </div>
      </div>
      <div className="border-t border-surface-border">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-slate-400 sm:flex-row">
          <span>© {new Date().getFullYear()} VerBnb</span>
          <span>Powered by GenLayer Optimistic Democracy</span>
        </div>
      </div>
    </footer>
  );
}
