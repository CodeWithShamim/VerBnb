/**
 * Branded web3 loader - a conic-gradient ring spinning around a counter-
 * rotating gradient core, with three colored dots orbiting the whole thing.
 * Pure CSS (see globals.css .loader-*), so it costs nothing to render and
 * works inside server components like app/loading.tsx.
 */
export default function Loader({ label = 'Talking to the chain…' }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5"
      role="status"
      aria-label={label}
    >
      <div className="loader-ring">
        <div className="loader-core" />
        <span className="loader-dot animate-orbit bg-pop-cyan" style={{ animationDelay: '0s' }} />
        <span
          className="loader-dot animate-orbit bg-pop-pink"
          style={{ animationDelay: '-0.8s' }}
        />
        <span
          className="loader-dot animate-orbit bg-pop-orange"
          style={{ animationDelay: '-1.6s' }}
        />
      </div>
      <p className="text-sm font-medium text-slate-500">
        <span className="text-gradient-pop font-semibold">{label}</span>
      </p>
    </div>
  );
}
