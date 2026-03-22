import { StatusBadge } from "@/components/dashboard/status-badge";

export function DashboardCard({ title, value, status }: { title: string; value: string; status: "up" | "down" }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-2xl font-semibold">{value}</p>
        <StatusBadge status={status === "up" ? "active" : "warning"} label={status.toUpperCase()} />
      </div>
    </div>
  );
}
