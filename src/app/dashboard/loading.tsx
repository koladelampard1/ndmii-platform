export default function DashboardLoading() {
  return (
    <section className="animate-pulse space-y-4">
      <div className="h-8 w-72 rounded bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="h-24 rounded-xl border bg-slate-100" />
        ))}
      </div>
      <div className="h-10 rounded-xl border bg-slate-100" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-xl border bg-slate-100" />
        <div className="h-64 rounded-xl border bg-slate-100" />
      </div>
    </section>
  );
}
