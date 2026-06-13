function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded-2xl bg-slate-200/80 ${className}`} />;
}

export default function ImpactIntelligenceLoading() {
  return (
    <section aria-label="Loading Impact Intelligence" aria-busy="true" className="animate-pulse space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <SkeletonBlock className="h-3 w-40" />
        </div>
        <div className="p-5 sm:p-6">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="mt-3 h-8 w-full max-w-xl" />
          <SkeletonBlock className="mt-3 h-4 w-full max-w-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
            <SkeletonBlock className="h-9 w-9" />
            <SkeletonBlock className="mt-4 h-6 w-16" />
            <SkeletonBlock className="mt-2 h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="mt-5 h-56 w-full" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <SkeletonBlock className="h-5 w-56" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-4 gap-4 border-b border-slate-100 p-4 last:border-0">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading dashboard data</span>
    </section>
  );
}
