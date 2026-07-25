import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkspaceDataClassificationMeta } from "@/lib/workspaces/workspace-classification";
import { WorkspaceDataClassificationBadge } from "@/components/workspace/workspace-page";

export type ExecutiveMetricStatus = "positive" | "neutral" | "attention" | "critical" | "unavailable";

export function ExecutiveMetricGrid({ children }: { children: ReactNode }) {
  return <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</section>;
}

export function ExecutiveMetricCard({
  label,
  value,
  context,
  trend,
  status = "neutral",
  icon: Icon,
  classification,
  sourceNote,
  comparisonPeriod,
  action,
  compact = false,
  unavailable = false,
}: {
  label: string;
  value: ReactNode;
  context?: string;
  trend?: string;
  status?: ExecutiveMetricStatus;
  icon?: LucideIcon;
  classification?: WorkspaceDataClassificationMeta;
  sourceNote?: string;
  comparisonPeriod?: string;
  action?: { label: string; href: string };
  compact?: boolean;
  unavailable?: boolean;
}) {
  const tone = {
    positive: "border-emerald-200 bg-emerald-50/60",
    neutral: "border-slate-200 bg-white",
    attention: "border-amber-200 bg-amber-50/60",
    critical: "border-rose-200 bg-rose-50/60",
    unavailable: "border-slate-200 bg-slate-50",
  }[unavailable ? "unavailable" : status];

  return (
    <article className={`min-w-0 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${tone} ${compact ? "p-3" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <div className="mt-2 truncate text-3xl font-black tracking-tight text-[#0c1733]">{unavailable ? <Minus className="h-7 w-7 text-slate-400" /> : value}</div>
        </div>
        {Icon ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white"><Icon className="h-5 w-5" /></span> : null}
      </div>
      {context ? <p className="mt-3 text-sm leading-5 text-slate-600">{context}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {classification ? <WorkspaceDataClassificationBadge classification={classification} /> : null}
        {trend ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{trend}</span> : null}
        {comparisonPeriod ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{comparisonPeriod}</span> : null}
      </div>
      {sourceNote ? <p className="mt-3 text-xs leading-5 text-slate-500">{sourceNote}</p> : null}
      {action ? <Link href={action.href} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-700 hover:gap-3">{action.label}<ArrowRight className="h-4 w-4" /></Link> : null}
    </article>
  );
}

export const TrendMetricCard = ExecutiveMetricCard;
export const StatusMetricCard = ExecutiveMetricCard;

export function ProgressMetricCard({ label, value, max, context }: { label: string; value: number; max: number; context?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <ExecutiveMetricCard
      label={label}
      value={`${pct}%`}
      context={context ?? `${value.toLocaleString()} of ${max.toLocaleString()}`}
      status={pct >= 80 ? "positive" : pct >= 40 ? "attention" : "neutral"}
    />
  );
}
