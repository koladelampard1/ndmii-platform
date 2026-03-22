import { ChartsContainer } from "@/components/dashboard/charts-container";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DataTable } from "@/components/dashboard/data-table";
import { chartData, kpiCards } from "@/lib/data/demo";

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Regulatory Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <DashboardCard key={card.title} title={card.title} value={card.value} status={card.status as "up" | "down"} />
        ))}
      </div>
      <ChartsContainer data={chartData} />
      <DataTable />
    </section>
  );
}
