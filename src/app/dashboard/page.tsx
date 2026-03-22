import Link from "next/link";
import { ChartsContainer } from "@/components/dashboard/charts-container";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DataTable } from "@/components/dashboard/data-table";
import { getDashboardMetrics, getMsmes } from "@/lib/data/ndmii";

export default async function DashboardPage() {
  const [metrics, msmes] = await Promise.all([getDashboardMetrics(), getMsmes()]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Regulatory Dashboard</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/dashboard/msme/onboarding" className="rounded bg-slate-900 px-3 py-2 text-white">New onboarding</Link>
          <Link href="/dashboard/reviews" className="rounded border px-3 py-2">Reviewer queue</Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.cards.map((card) => (
          <DashboardCard key={card.title} title={card.title} value={card.value} status={card.status} />
        ))}
      </div>
      <ChartsContainer stateData={metrics.stateDistribution} sectorData={metrics.sectorDistribution} />
      <DataTable rows={msmes.slice(0, 12)} />
    </section>
  );
}
