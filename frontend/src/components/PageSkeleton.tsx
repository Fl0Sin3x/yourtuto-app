/** Route-level loading placeholder (Suspense fallback) that mimics a page layout instead of a lone spinner. */
export function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-5 py-10" role="status" aria-busy="true">
      <span className="sr-only">Chargement…</span>
      <div className="h-8 w-1/3 rounded-lg bg-zinc-100 animate-pulse motion-reduce:animate-none" />
      <div className="mt-3 h-4 w-1/2 rounded bg-zinc-100 animate-pulse motion-reduce:animate-none" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-100">
            <div className="aspect-video rounded-xl bg-zinc-100 animate-pulse motion-reduce:animate-none" />
            <div className="mt-3 h-4 w-4/5 rounded bg-zinc-100 animate-pulse motion-reduce:animate-none" />
            <div className="mt-2 h-3 w-2/5 rounded bg-zinc-100 animate-pulse motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
