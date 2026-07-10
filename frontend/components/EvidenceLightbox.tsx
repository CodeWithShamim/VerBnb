'use client';

// Fullscreen lightbox for evidence images. Rendered by EvidenceGallery inside
// an <AnimatePresence> so mount/unmount animates. Closes on backdrop click,
// Escape, or the × button; ←/→ navigate when multiple images exist.

import { useEffect } from 'react';
import { motion } from 'framer-motion';

export interface LightboxImage {
  url: string;
  label?: string;
}

export default function EvidenceLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const count = images.length;
  const current = images[Math.min(Math.max(index, 0), count - 1)];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (count > 1 && e.key === 'ArrowLeft') onNavigate((index - 1 + count) % count);
      if (count > 1 && e.key === 'ArrowRight') onNavigate((index + 1) % count);
    }
    window.addEventListener('keydown', onKey);
    // Lock page scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, count, onClose, onNavigate]);

  if (!current) return null;

  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl leading-none text-white backdrop-blur transition-colors hover:bg-white/25';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm font-manrope"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={current.label || 'Evidence image'}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl leading-none text-white backdrop-blur transition-colors hover:bg-white/25"
      >
        ×
      </button>

      {/* Prev / next */}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            className={`${arrowClass} left-3 sm:left-6`}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index - 1 + count) % count);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next image"
            className={`${arrowClass} right-3 sm:right-6`}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index + 1) % count);
            }}
          >
            ›
          </button>
        </>
      )}

      <div
        className="flex max-h-full max-w-[92vw] flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.img
          key={current.url}
          src={current.url}
          alt={current.label || 'Evidence'}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          {current.label && <span className="font-medium text-white/80">{current.label}</span>}
          {count > 1 && (
            <span className="text-white/50">
              {index + 1} / {count}
            </span>
          )}
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white underline-offset-4 transition-colors hover:text-white/80 hover:underline"
          >
            Open original ↗
          </a>
        </div>
      </div>
    </motion.div>
  );
}
