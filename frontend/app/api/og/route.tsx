import { ImageResponse } from 'next/og';

export const runtime = 'edge';

/**
 * OG verdict card — 1200x630 shareable image for resolved disputes.
 *
 * GET /api/og?id=...&category=...&verdict=...&refund=0-100&trust=0-100&summary=...
 * Every param is optional except id; all values are whitelisted/clamped so the
 * endpoint can never be abused to render arbitrary content.
 */

// Brand palette (kept in sync with tailwind.config.ts `hero`/`brand` colors and
// the per-category accents in lib/contracts.ts CATEGORIES).
const BRAND = '#7b39fc';
const BRAND_LIGHT = '#8b4dff';
const DARK = '#2b2344';
const DARK_LIGHT = '#3a3059';

const CATEGORY_META: Record<string, { title: string; accent: string }> = {
  rental: { title: 'Rental', accent: '#7b39fc' },
  marketplace: { title: 'Marketplace', accent: '#06b6d4' },
  sourcing: { title: 'Sourcing', accent: '#10b981' },
  delivery: { title: 'Delivery', accent: '#f59e0b' },
};

// Keys from lib/contracts.ts map onto the same meta.
const CATEGORY_ALIASES: Record<string, string> = {
  rental: 'rental',
  product: 'marketplace',
  marketplace: 'marketplace',
  sourcing: 'sourcing',
  delivery: 'delivery',
};

const KNOWN_VERDICTS = new Set([
  'REFUND_GRANTED',
  'NOT_DELIVERED',
  'WRONG_ADDRESS',
  'VERIFIED',
  'DELIVERED',
  'DISPUTE_REJECTED',
  'PARTIAL_REFUND',
  'CLAIM_SUPPORTED',
  'CLAIM_REJECTED',
]);

function clampPct(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function sanitizeText(raw: string | null, max: number): string {
  if (!raw) return '';
  // Strip control chars, collapse whitespace, clamp length.
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const id = sanitizeText(searchParams.get('id'), 64) || 'dispute';
  const catKey = CATEGORY_ALIASES[(searchParams.get('category') || '').toLowerCase()];
  const category = catKey ? CATEGORY_META[catKey] : null;
  const accent = category?.accent ?? BRAND;

  const rawVerdict = (searchParams.get('verdict') || '').toUpperCase().trim();
  const verdict = KNOWN_VERDICTS.has(rawVerdict) ? rawVerdict.replaceAll('_', ' ') : 'RESOLVED';

  const refund = clampPct(searchParams.get('refund'));
  const trust = clampPct(searchParams.get('trust'));
  const summary = sanitizeText(searchParams.get('summary'), 140);

  const headline = refund !== null ? `${refund}%` : verdict;
  const headlineLabel = refund !== null ? 'refund recommended' : 'verdict';
  const headlineSize = refund !== null ? 168 : verdict.length > 14 ? 76 : 104;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundImage: `linear-gradient(135deg, #17102b 0%, ${DARK} 42%, ${DARK_LIGHT} 74%, #4c2a86 100%)`,
          color: '#ffffff',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          padding: '56px 72px',
          position: 'relative',
        }}
      >
        {/* Glow accents */}
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 9999,
            backgroundImage: `radial-gradient(circle, ${BRAND}55 0%, ${BRAND}00 70%)`,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -220,
            left: -140,
            width: 560,
            height: 560,
            borderRadius: 9999,
            backgroundImage: `radial-gradient(circle, ${accent}40 0%, ${accent}00 70%)`,
            display: 'flex',
          }}
        />

        {/* Top row: logo + category chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundImage: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_LIGHT} 100%)`,
                fontSize: 38,
                fontWeight: 800,
                boxShadow: `0 12px 40px ${BRAND}66`,
              }}
            >
              V
            </div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
              VerBnb
            </div>
          </div>
          {category ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: 9999,
                border: '1px solid rgba(255,255,255,0.22)',
                backgroundColor: 'rgba(255,255,255,0.08)',
                padding: '10px 26px',
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: 14,
                  height: 14,
                  borderRadius: 9999,
                  backgroundColor: accent,
                }}
              />
              {`${category.title} dispute`}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                borderRadius: 9999,
                border: '1px solid rgba(255,255,255,0.22)',
                backgroundColor: 'rgba(255,255,255,0.08)',
                padding: '10px 26px',
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              Dispute
            </div>
          )}
        </div>

        {/* Middle: headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 28 }}>
            <div
              style={{
                display: 'flex',
                fontSize: headlineSize,
                fontWeight: 800,
                letterSpacing: -3,
                lineHeight: 1,
              }}
            >
              {headline}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 34,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              {headlineLabel}
            </div>
          </div>

          {refund !== null && (
            <div
              style={{
                display: 'flex',
                marginTop: 30,
                width: 640,
                height: 16,
                borderRadius: 9999,
                backgroundColor: 'rgba(255,255,255,0.14)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: `${Math.max(refund, 2)}%`,
                  height: '100%',
                  borderRadius: 9999,
                  backgroundImage: `linear-gradient(90deg, ${BRAND} 0%, ${accent} 100%)`,
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 30 }}>
            {refund !== null && (
              <div
                style={{
                  display: 'flex',
                  borderRadius: 9999,
                  backgroundColor: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  padding: '8px 20px',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {verdict}
              </div>
            )}
            {trust !== null && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderRadius: 9999,
                  backgroundColor: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  padding: '8px 20px',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    width: 12,
                    height: 12,
                    borderRadius: 9999,
                    backgroundColor: trust >= 70 ? '#34d399' : trust >= 40 ? '#fbbf24' : '#fb7185',
                  }}
                />
                {`Trust ${trust}/100`}
              </div>
            )}
          </div>

          {summary && (
            <div
              style={{
                display: 'flex',
                marginTop: 34,
                maxWidth: 980,
                fontSize: 30,
                lineHeight: 1.4,
                color: 'rgba(255,255,255,0.80)',
              }}
            >
              {`"${summary}"`}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.16)',
            paddingTop: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              color: 'rgba(255,255,255,0.60)',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          >
            {id}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24 }}>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              AI consensus
            </div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.40)' }}>·</div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              settled on-chain
            </div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.40)' }}>·</div>
            <div style={{ display: 'flex', color: BRAND_LIGHT, fontWeight: 800 }}>GenLayer</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
