"use client";

import Reveal from "@/components/Reveal";

const FAQ: { q: string; a: string }[] = [
  {
    q: "How long does a verdict take?",
    a: "Usually 2–6 hours, sometimes up to 24h, depending on validator availability and how much evidence there is to fetch.",
  },
  {
    q: "Can I appeal a verdict?",
    a: "Yes — within 7 days of finalization. Open the verdict page and click \"Appeal\". A larger set of validators then re-evaluates the case.",
  },
  {
    q: "Is my data private?",
    a: "Evidence is stored on IPFS, which is public. Don't upload sensitive personal data — only what's needed to prove your claim.",
  },
  {
    q: "What is GenLayer?",
    a: "A blockchain where AI validators independently read evidence and reach consensus on the meaning of a dispute — not just on identical bytes.",
  },
  {
    q: "How do validators agree?",
    a: "Each validator independently reads the same evidence and asks an LLM for a verdict. They agree when their refund estimates land within 15% of each other.",
  },
  {
    q: "What does it cost?",
    a: "Only the network gas for your dispute transaction. On the Bradbury testnet, grab free GEN from the faucet — there's no platform fee.",
  },
];

/**
 * Home-page FAQ accordion. Native <details> for zero-JS open/close, wrapped in
 * Reveal for the scroll-in animation that the rest of the page uses.
 */
export default function FaqSection() {
  return (
    <div className="mx-auto mt-10 max-w-3xl space-y-3">
      {FAQ.map((f, i) => (
        <Reveal key={f.q} delay={i * 0.03}>
          <details className="card group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-900">
              {f.q}
              <span className="ml-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">{f.a}</p>
          </details>
        </Reveal>
      ))}
    </div>
  );
}
