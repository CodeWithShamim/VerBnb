'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { CATEGORIES, getChainInfo } from '@/lib/contracts';
import ConnectWallet from '@/components/ConnectWallet';

const NAV = [
  ...Object.values(CATEGORIES).map((c) => ({
    href: `/${c.slug}`,
    label: c.title,
  })),
  { href: '/activity', label: 'Activity' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8));

  const chain = getChainInfo();

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-surface-border bg-white/75 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <nav className="container-page flex h-16 items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-500 font-black text-white shadow-soft transition-transform duration-300 group-hover:scale-105">
            V
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">VerBnb</span>
        </Link>

        {/* Center nav — segmented group */}
        <div className="hidden items-center rounded-full border border-surface-border/70 bg-white/50 p-1 backdrop-blur md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'text-brand' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="relative z-10">{item.label}</span>
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full bg-brand-50 shadow-sm ring-1 ring-brand/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Network indicator */}
          <span
            className="hidden items-center gap-1.5 rounded-full border border-surface-border bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-600 lg:inline-flex"
            title={`${chain.name} · Chain ID ${chain.chainId}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {chain.short}
          </span>

          <Link
            href="/#categories"
            className="hidden btn-primary px-4 py-2 text-sm sm:inline-flex"
          >
            Raise a dispute
          </Link>

          <ConnectWallet />

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-surface-border bg-white text-slate-600 transition-colors hover:border-brand/40 hover:text-brand md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <motion.path
                d={menuOpen ? 'M6 6l12 12' : 'M4 7h16'}
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                animate={{ d: menuOpen ? 'M6 6l12 12' : 'M4 7h16' }}
              />
              {!menuOpen && (
                <path d="M4 12h16M4 17h16" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-surface-border bg-white/95 backdrop-blur-xl md:hidden"
          >
            <div className="container-page space-y-1 py-4">
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-50 text-brand'
                        : 'text-slate-600 hover:bg-surface-subtle hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <Link
                href="/#categories"
                onClick={() => setMenuOpen(false)}
                className="btn-primary mt-2 w-full justify-center py-2.5 text-sm"
              >
                Raise a dispute
              </Link>

              <div className="flex items-center gap-1.5 px-3 pt-3 text-xs font-medium text-slate-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                {chain.name} · Chain {chain.chainId}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
