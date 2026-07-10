'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, getChainInfo } from '@/lib/contracts';
import ConnectWallet from '@/components/ConnectWallet';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';

const NAV = [
  ...Object.values(CATEGORIES).map((c) => ({
    href: `/${c.slug}`,
    label: c.title,
  })),
  { href: '/explorer', label: 'Explorer' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/simulator', label: 'Simulator' },
  { href: '/docs', label: 'Docs' },
];

// Secondary pages live in a compact "More" dropdown on desktop (the flat list
// above already fills the bar) and inline in the mobile menu.
const MORE_NAV = [
  { href: '/activity', label: 'Activity' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/validator', label: 'Validators' },
  { href: '/suggestions', label: 'Suggestions' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8));

  // Close the "More" dropdown on outside click / Escape.
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const chain = getChainInfo();

  // On the homepage the nav overlays the full-screen hero canvas (transparent
  // until scrolled, then a frosted bar). Elsewhere it's a sticky frosted bar in
  // light mode and the solid dark-purple bar in dark mode.
  const overHero = pathname === '/';

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`${overHero ? 'absolute' : 'sticky'} inset-x-0 top-0 z-50 transition-all duration-300 ${
        overHero
          ? scrolled
            ? 'bg-[rgba(255,255,255,0.75)] shadow-sm backdrop-blur-md dark:bg-black/30 dark:shadow-none'
            : 'bg-transparent'
          : 'border-b border-surface-border bg-[rgba(255,255,255,0.85)] backdrop-blur-md dark:border-transparent dark:bg-hero-dark dark:shadow-md'
      }`}
    >
      <nav className="flex items-center justify-between gap-4 px-6 py-4 lg:px-[120px]">
        {/* Brand */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-hero-purple font-manrope font-black text-white shadow-md transition-transform duration-300 group-hover:scale-105">
            V
          </span>
          <span className="font-manrope text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            VerBnb
          </span>
        </Link>

        {/* Center nav - desktop links */}
        <div className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="font-manrope text-[14px] font-medium text-slate-700 transition-opacity hover:opacity-80 dark:text-white"
              >
                {item.label}
              </Link>
            );
          })}

          {/* More - new tool pages */}
          <div ref={moreRef} className="relative">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
              className="inline-flex items-center gap-1 font-manrope text-[14px] font-medium text-slate-700 transition-opacity hover:opacity-80 dark:text-white"
            >
              More
              <svg viewBox="0 0 24 24" fill="none" className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`}>
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute left-1/2 top-full z-50 mt-3 w-44 -translate-x-1/2 overflow-hidden rounded-xl border border-surface-border bg-white/95 py-1.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-hero-dark"
                >
                  {MORE_NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="block px-4 py-2 font-manrope text-[14px] font-medium text-slate-700 transition-colors hover:bg-surface-subtle dark:text-white dark:hover:bg-white/10"
                    >
                      {item.label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/#categories"
            className="hidden rounded-lg bg-hero-purple px-4 py-2 font-manrope text-[14px] font-semibold text-[#fafafa] shadow-md shadow-hero-purple/25 transition-colors hover:bg-hero-purple-light sm:inline-flex"
          >
            Get Started
          </Link>

          <ThemeToggle />

          <NotificationBell />

          <ConnectWallet />

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="text-slate-700 transition-opacity hover:opacity-80 dark:text-white lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <motion.path
                d={menuOpen ? 'M6 6l12 12' : 'M4 7h16'}
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                animate={{ d: menuOpen ? 'M6 6l12 12' : 'M4 7h16' }}
              />
              {!menuOpen && (
                <path
                  d="M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu - full-screen black overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-black lg:hidden"
          >
            <div className="flex flex-1 flex-col items-center justify-center gap-8 py-4">
              {[...NAV, ...MORE_NAV].map((item) => {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="font-manrope text-2xl font-medium text-slate-900 transition-opacity hover:opacity-80 dark:text-white"
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="mt-4 flex w-full max-w-xs flex-col gap-3 px-6">
                <Link
                  href="/#categories"
                  onClick={() => setMenuOpen(false)}
                  className="w-full rounded-lg bg-hero-purple px-4 py-3 text-center font-manrope text-[14px] font-semibold text-[#fafafa] shadow-md"
                >
                  Get Started
                </Link>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-white/60">
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
