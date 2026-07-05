import Link from "next/link";
import { syncRegistryCasesAction } from "@/app/dashboard/property/operations/actions";
import { getRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import { getOperationsDashboard } from "@/lib/property/property-operations-service";
import { RegistryCaseTable, RegistryMetric, RegistryOperationsHero } from "@/components/property/property-operations-workspace";

export const dynamic = "force-dynamic";

export default async function PropertyOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { ctx, supabase, access } = await getRegistryOperationsContext();
  const dashboard = await getOperationsDashboard({ client: supabase, ctx });

  return (
    <main className="space-y-6">
      <RegistryOperationsHero
        title="Registry Operations Command Centre"
        description="Review property applications, manage officer assignments, verify documents and ownership, issue official NPINs, and maintain complete registry audit history."
        actions={[
          { href: "/dashboard/property/cases", label: "All Cases", primary: true },
          { href: "/dashboard/property/register", label: "Register Property" },
          { href: "/dashboard/property/pending", label: "Pending" },
          { href: "/dashboard/property/completed", label: "Completed" },
        ]}
      />

      {query.success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Registry operation completed.</p> : null}
      {query.error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{decodeURIComponent(query.error)}</p> : null}

      {access.canMutate ? (
        <form action={syncRegistryCasesAction} className="flex justify-end">
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-[#06172f]" type="submit">Sync Submitted Applications</button>
        </form>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RegistryMetric label="Awaiting review" value={dashboard.metrics.awaitingReview} detail="Submitted applications not yet under active review." />
        <RegistryMetric label="Assigned today" value={dashboard.metrics.assignedToday} detail="Cases routed to registry officers today." tone="amber" />
        <RegistryMetric label="Pending verification" value={dashboard.metrics.pendingVerification} detail="Cases awaiting document, survey or ownership checks." />
        <RegistryMetric label="Returned" value={dashboard.metrics.returned} detail="Applications returned for correction." tone="rose" />
        <RegistryMetric label="Approved today" value={dashboard.metrics.approvedToday} detail="Applications approved today." />
        <RegistryMetric label="Rejected" value={dashboard.metrics.rejected} detail="Rejected registry applications." tone="rose" />
        <RegistryMetric label="Avg review time" value={`${dashboard.metrics.averageReviewTimeHours}h`} detail="Average from submission to completion." tone="slate" />
        <RegistryMetric label="Total cases" value={dashboard.cases.length} detail="Registry cases currently visible." tone="slate" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <article>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Registry queue</p>
              <h2 className="text-2xl font-black text-[#06172f]">Recent cases</h2>
            </div>
            <Link href="/dashboard/property/cases" className="text-sm font-black text-[#008751]">View all</Link>
          </div>
          <RegistryCaseTable cases={dashboard.cases.slice(0, 8)} />
        </article>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Officer workload</p>
            <div className="mt-4 space-y-3">
              {dashboard.workload.length ? dashboard.workload.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                  <span className="font-bold text-[#06172f]">{item.name}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{item.count}</span>
                </div>
              )) : <p className="text-sm text-slate-500">No active assignments yet.</p>}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Recent activity</p>
            <div className="mt-4 space-y-3">
              {dashboard.events.map((event) => (
                <div key={event.id} className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-black text-[#06172f]">{event.event_type}</p>
                  <p className="mt-1 text-xs text-slate-500">{event.summary ?? "Registry event recorded."}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
