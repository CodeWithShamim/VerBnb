'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { CATEGORIES, getChainInfo } from '@/lib/contracts';
import ConnectWallet from '@/components/ConnectWallet';
import ThemeToggle from '@/components/ThemeToggle';

const NAV = [
  ...Object.values(CATEGORIES).map((c) => ({
    href: `/${c.slug}`,
    label: c.title,
  })),
  { href: '/activity', label: 'Activity' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/validator', label: 'Validators' },
  { href: '/docs', label: 'Docs' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8));

  const chain = getChainInfo();

  // On the homepage the nav overlays the full-screen hero video (transparent,
  // white text). Elsewhere the pages are light, so the nav gets a solid
  // dark-purple bar so the white UI text stays legible.
  const overHero = pathname === '/';

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`${overHero ? 'absolute' : 'sticky'} inset-x-0 top-0 z-50 transition-all duration-300 ${
        overHero
          ? scrolled
            ? 'bg-black/30 backdrop-blur-md'
            : 'bg-transparent'
          : 'bg-hero-dark shadow-md'
      }`}
    >
      <nav className="flex items-center justify-between gap-4 px-6 py-4 lg:px-[120px]">
        {/* Brand */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-hero-purple font-manrope font-black text-white shadow-md transition-transform duration-300 group-hover:scale-105">
            V
          </span>
          <span className="font-manrope text-lg font-bold tracking-tight text-white">VerBnb</span>
        </Link>

        {/* Center nav — desktop links */}
        <div className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="font-manrope text-[14px] font-medium text-white transition-opacity hover:opacity-80"
              >
                {item.label}
              </Link>
            );
          })}
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

          <ConnectWallet />

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="text-white transition-opacity hover:opacity-80 lg:hidden"
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

      {/* Mobile menu — full-screen black overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 flex flex-col bg-black lg:hidden"
          >
            <div className="flex flex-1 flex-col items-center justify-center gap-8 py-4">
              {NAV.map((item) => {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="font-manrope text-2xl font-medium text-white transition-opacity hover:opacity-80"
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

              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-white/60">
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
