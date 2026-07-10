'use client';

// Inline preview gallery for dispute evidence. Given a list of URLs (IPFS
// uploads, listing pages, PDFs...) it renders a responsive thumbnail grid:
//   - images (by extension, or IPFS gateway URLs) -> <img> preview + lightbox
//   - PDFs -> tile with a document icon, opens in a new tab
//   - anything else -> tile with a link icon + hostname, opens in a new tab
// Renders nothing when no valid URLs are supplied.

import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import EvidenceLightbox from '@/components/EvidenceLightbox';

export interface EvidenceItem {
  url: string;
  label?: string;
}

type PreviewKind = 'image' | 'pdf' | 'link';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function isIpfsUrl(url: string): boolean {
  const host = hostnameOf(url).toLowerCase();
  return (
    url.includes('/ipfs/') ||
    host.includes('pinata') ||
    host.includes('ipfs') ||
    host.endsWith('w3s.link') ||
    host.endsWith('dweb.link')
  );
}

function classify(url: string): PreviewKind {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (IMAGE_EXT.test(path)) return 'image';
  if (path.endsWith('.pdf')) return 'pdf';
  // IPFS uploads from our evidence flow are almost always photos; try an
  // <img> first - the tile falls back to a generic file tile onError.
  if (isIpfsUrl(url)) return 'image';
  return 'link';
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      <path
        d="M8.5 15.5h7M8.5 12.5h7"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
      <path
        d="M10 14a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 1 0-7.07-7.07l-1.06 1.06M14 10a5 5 0 0 0-7.07 0l-2.12 2.12a5 5 0 1 0 7.07 7.07l1.06-1.06"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

/** External-link tile used for PDFs, web pages and images that failed to load. */
function ExternalTile({
  url,
  label,
  kind,
}: {
  url: string;
  label?: string;
  kind: 'pdf' | 'link' | 'file';
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface-subtle px-3 text-slate-400 transition-colors hover:border-brand/50 hover:text-brand"
    >
      {kind === 'pdf' ? <PdfIcon /> : kind === 'link' ? <LinkIcon /> : <FileIcon />}
      <span className="w-full truncate text-center text-xs font-medium text-slate-500 group-hover:text-brand">
        {label || (kind === 'pdf' ? 'PDF document' : 'Attachment')}
      </span>
      <span className="w-full truncate text-center text-[11px] text-slate-400">
        {hostnameOf(url)} ↗
      </span>
    </a>
  );
}

export default function EvidenceGallery({ items }: { items: EvidenceItem[] }) {
  // Dedupe by URL, drop empties / non-http(s) values, keep first label seen.
  const clean = useMemo(() => {
    const seen = new Set<string>();
    const out: (EvidenceItem & { kind: PreviewKind })[] = [];
    for (const item of items || []) {
      const url = (item?.url || '').trim();
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      out.push({ url, label: item.label, kind: classify(url) });
    }
    return out;
  }, [items]);

  // Images that render successfully participate in the lightbox; a failed
  // image is skipped when navigating (it degraded to a plain link tile).
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const images = useMemo(
    () => clean.filter((i) => i.kind === 'image' && !failedUrls.has(i.url)),
    [clean, failedUrls],
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (clean.length === 0) return null;

  return (
    <div className="card p-6 font-manrope">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Evidence
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {clean.map((item) =>
          item.kind === 'image' && !failedUrls.has(item.url) ? (
            <ImageTileWithFallback
              key={item.url}
              url={item.url}
              label={item.label}
              onOpen={() => {
                const idx = images.findIndex((i) => i.url === item.url);
                if (idx >= 0) setOpenIndex(idx);
              }}
              onFail={() =>
                setFailedUrls((prev) => {
                  const next = new Set(prev);
                  next.add(item.url);
                  return next;
                })
              }
            />
          ) : (
            <ExternalTile
              key={item.url}
              url={item.url}
              label={item.label}
              kind={item.kind === 'image' ? 'file' : item.kind === 'pdf' ? 'pdf' : 'link'}
            />
          ),
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Files are stored on IPFS - click a thumbnail to inspect, or open the original in a new
        tab.
      </p>

      <AnimatePresence>
        {openIndex !== null && images[openIndex] && (
          <EvidenceLightbox
            images={images}
            index={openIndex}
            onClose={() => setOpenIndex(null)}
            onNavigate={(i) => setOpenIndex(i)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** ImageTile wrapper that also reports load failures up to the gallery, so the
 *  lightbox image list stays in sync with what actually rendered. */
function ImageTileWithFallback({
  url,
  label,
  onOpen,
  onFail,
}: {
  url: string;
  label?: string;
  onOpen: () => void;
  onFail: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ExternalTile url={url} label={label} kind="file" />;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${label || 'evidence image'}`}
      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl border border-surface-border bg-surface-subtle text-left"
    >
      <ImageInner
        url={url}
        label={label}
        onError={() => {
          setFailed(true);
          onFail();
        }}
      />
    </button>
  );
}

function ImageInner({
  url,
  label,
  onError,
}: {
  url: string;
  label?: string;
  onError: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <span className="absolute inset-0 animate-pulse bg-surface-muted" />}
      {/* Remote IPFS hosts aren't in the next/image allowlist - plain <img>. */}
      <img
        src={url}
        alt={label || 'Evidence'}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={onError}
        className={`h-full w-full max-w-full object-cover transition-all duration-300 group-hover:scale-105 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {label && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-1.5 pt-5 text-[11px] font-medium text-white">
          {label}
        </span>
      )}
    </>
  );
}
