import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PageAction = {
  href: string;
  label: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
};

export function ImpactPageHeader({
  eyebrow,
  title,
  description,
  badge,
  actions = [],
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
  actions?: PageAction[];
  children?: ReactNode;
}) {
  return (
    <header className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <nav className="flex flex-wrap items-center gap-1 text-xs font-medium text-slate-500">
          <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">
            Impact Intelligence
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-700">{title}</span>
          {badge && <StatusBadge value={badge} className="ml-2" />}
        </nav>
      </div>
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
          <h1 className="mt-2 max-w-4xl text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition",
                    action.variant === "primary"
                      ? "bg-slate-950 text-white hover:bg-slate-800"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {action.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {children && <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4">{children}</div>}
    </header>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: LucideIcon;
  tone?: "slate" | "emerald" | "amber" | "red" | "blue";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        {Icon && (
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", tones[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {detail && <p className="mt-2 text-sm leading-5 text-slate-600">{detail}</p>}
    </div>
  );
}

export function StatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  const normalized = value ?? "pending";
  const key = normalized.toLowerCase();
  const tone =
    ["approved", "active", "verified", "reviewed", "completed", "resolved", "generated"].includes(key)
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : ["critical", "high", "rejected", "cancelled"].includes(key)
        ? "bg-red-50 text-red-700 ring-red-200"
        : ["medium", "draft", "planned", "pending", "assigned", "in_progress", "submitted", "needs_review", "on_hold", "paused"].includes(key)
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1", tone, className)}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon: Icon,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      {Icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </article>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-slate-200">{children}</div>;
}

export const tableClassName = "w-full min-w-[760px] text-left text-sm";
export const tableHeadClassName = "bg-slate-50 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500";
export const tableCellClassName = "px-4 py-4 align-top";
export const tableRowClassName = "border-t border-slate-100 transition hover:bg-slate-50/70";

export function QuickLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 hover:text-emerald-800">
      {children}
    </Link>
  );
}
