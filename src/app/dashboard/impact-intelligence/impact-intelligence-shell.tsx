"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarCheck2,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileArchive,
  FileText,
  Factory,
  Flag,
  History,
  LayoutDashboard,
  Network,
  Radar,
  Target,
  UsersRound,
} from "lucide-react";
import { AccountActions } from "@/components/auth/account-actions";
import { canAccessRoute, canRole, type ImpactResource } from "@/lib/impact-intelligence/permissions";
import type { UserRole } from "@/types/roles";

type ImpactIntelligenceShellProps = {
  children: ReactNode;
  role: UserRole;
  fullName: string | null;
  email: string | null;
  canAccessLcdbo?: boolean;
};

type WorkspaceLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  resource?: ImpactResource;
};

const WORKSPACE_NAV: WorkspaceLink[] = [
  { label: "Overview", href: "/dashboard/impact-intelligence", icon: LayoutDashboard, resource: "workspace" },
  { label: "LCDBO Operations", href: "/dashboard/lcdbo", icon: Factory },
  { label: "Programmes", href: "/dashboard/impact-intelligence/programmes", icon: Building2, resource: "programme" },
  { label: "Cohorts", href: "/dashboard/impact-intelligence/cohorts", icon: UsersRound, resource: "cohort" },
  { label: "Interventions", href: "/dashboard/impact-intelligence/interventions", icon: Network, resource: "intervention" },
  { label: "Assessments", href: "/dashboard/impact-intelligence/assessments", icon: ClipboardCheck, resource: "assessment" },
  { label: "Monitoring", href: "/dashboard/impact-intelligence/monitoring", icon: CalendarCheck2, resource: "monitoring_visit" },
  { label: "Evidence", href: "/dashboard/impact-intelligence/evidence", icon: FileArchive, resource: "evidence" },
  { label: "Indicators", href: "/dashboard/impact-intelligence/indicators", icon: Target, resource: "indicator" },
  { label: "Reports", href: "/dashboard/impact-intelligence/reports", icon: FileText, resource: "report" },
  { label: "Analytics", href: "/dashboard/impact-intelligence/analytics", icon: BarChart3, resource: "analytics" },
  { label: "Intelligence", href: "/dashboard/impact-intelligence/intelligence", icon: Radar, resource: "intelligence" },
  { label: "Risk Flags", href: "/dashboard/impact-intelligence/risk-flags", icon: Flag, resource: "risk_flag" },
  { label: "Audit Trail", href: "/dashboard/impact-intelligence/reports", icon: History, resource: "audit_log" },
];

function roleLabel(role: UserRole) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name: string | null, role: UserRole) {
  const source = name?.trim() || roleLabel(role);
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard/impact-intelligence") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ImpactIntelligenceShell({
  children,
  role,
  fullName,
  email,
  canAccessLcdbo = false,
}: ImpactIntelligenceShellProps) {
  const pathname = usePathname();
  const items = WORKSPACE_NAV.filter((item) => {
    if (item.href === "/dashboard/lcdbo") return canAccessLcdbo;
    if (!canAccessRoute(role, item.href)) return false;
    if (item.resource === "audit_log" && !canRole(role, "audit_log", "read")) return false;
    return true;
  });
  const activeItem = items.find((item) => isActiveRoute(pathname, item.href));

  return (
    <div className="impact-intelligence-workspace min-h-screen bg-[#eef2f7] lg:flex">
      <aside className="bg-[#08162f] text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[244px] lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-5 lg:block lg:border-0 lg:px-6 lg:py-7">
          <Link href="/dashboard/impact-intelligence" className="flex items-center gap-3">
            <span className="grid h-10 w-10 grid-cols-3 gap-1" aria-hidden="true">
              {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} className={`rounded-full bg-white ${index === 4 ? "opacity-100" : "opacity-75"}`} />
              ))}
            </span>
            <span>
              <span className="block text-xl font-bold tracking-wide text-white">DBIN</span>
              <span className="block max-w-28 text-[8px] leading-tight text-slate-400">Digital Business Identity Network</span>
            </span>
          </Link>
          <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 lg:hidden">
            {roleLabel(role)}
          </span>
        </div>

        <div className="border-b border-white/5 px-5 py-3 lg:px-6 lg:py-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
            <ChartNoAxesCombined className="h-4 w-4" />
            Impact Intelligence
          </p>
        </div>

        <nav aria-label="Impact Intelligence navigation" className="overflow-x-auto px-3 py-3 lg:flex-1 lg:overflow-y-auto">
          <ul className="flex min-w-max gap-1 lg:block lg:min-w-0 lg:space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActiveRoute(pathname, item.href);
              return (
                <li key={`${item.label}-${item.href}`}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "group flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-xs font-medium transition",
                      active
                        ? "border-emerald-400 bg-white/10 text-white"
                        : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-emerald-300" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <AccountActions className="border-t border-white/10 p-3 lg:hidden" dark compact />

        <div className="hidden p-4 lg:block">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                {initials(fullName, role)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{fullName || roleLabel(role)}</p>
                <p className="truncate text-[10px] text-slate-400">{email || "Institutional workspace"}</p>
              </div>
            </div>
            <p className="mt-3 border-t border-white/10 pt-3 text-[10px] font-medium text-slate-300">{roleLabel(role)}</p>
            <AccountActions className="mt-3 border-t border-white/10 pt-3" dark />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:p-1.5 lg:pl-0">
        <div className="min-h-screen overflow-hidden bg-[#f7f9fc] lg:rounded-l-[24px] lg:border lg:border-slate-200 lg:shadow-xl lg:shadow-slate-300/30">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-5 sm:py-5 lg:px-7">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Impact Intelligence</p>
              <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-[#0c1733] sm:text-2xl">{activeItem?.label ?? "Workspace"}</h1>
            </div>
            <div className="flex items-center gap-3">
              <AccountActions className="hidden sm:flex lg:hidden" compact />
              <button type="button" aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              </button>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                {initials(fullName, role)}
              </span>
            </div>
          </header>
          <main className="p-4 sm:p-5 lg:p-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
