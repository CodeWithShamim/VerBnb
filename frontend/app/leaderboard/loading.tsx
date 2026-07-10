export default function LeaderboardLoading() {
  return (
    <div className="bg-grid min-h-screen">
      <div className="container-page max-w-6xl py-12">
        <div className="mb-8">
          <div className="h-8 w-72 animate-pulse rounded-lg bg-surface-muted" />
          <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="card divide-y divide-surface-border/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="h-4 w-8 animate-pulse rounded bg-surface-muted" />
              <div className="h-7 w-44 animate-pulse rounded-lg bg-surface-muted" />
              <div className="h-2 w-24 animate-pulse rounded-full bg-surface-muted" />
              <div className="ml-auto hidden h-4 w-32 animate-pulse rounded bg-surface-muted sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
