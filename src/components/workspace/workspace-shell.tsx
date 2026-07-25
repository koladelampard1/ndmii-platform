"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  Factory,
  MapPinned,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkspaceDefinition, WorkspaceNavigationSection } from "@/lib/workspaces/workspace-registry";
import { AccountActions } from "@/components/auth/account-actions";

const ICONS: Record<string, LucideIcon> = {
  Building2,
  ChartNoAxesCombined,
  Factory,
  MapPinned,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  UsersRound,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceShell({
  workspace,
  children,
  userLabel,
  userEmail,
  navigationSections,
}: {
  workspace: WorkspaceDefinition;
  children: ReactNode;
  userLabel: string;
  userEmail: string | null;
  navigationSections?: WorkspaceNavigationSection[];
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const Icon = ICONS[workspace.icon] ?? Building2;
  const sections = navigationSections?.length ? navigationSections : workspace.navigationSections ?? [{ label: "Workspace", items: workspace.navigation }];
  const activeItem = sections.flatMap((section) => section.items).find((item) => isActive(pathname, item.href));

  const navigation = (
    <nav aria-label={`${workspace.title} navigation`} className="overflow-y-auto px-3 py-3 lg:flex-1">
      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.label} aria-labelledby={`${workspace.id}-${section.label.replace(/\s+/g, "-").toLowerCase()}-nav`}>
            <h2 id={`${workspace.id}-${section.label.replace(/\s+/g, "-").toLowerCase()}-nav`} className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {section.label}
            </h2>
            {section.description ? <p className="mt-1 px-3 text-[10px] leading-4 text-slate-500">{section.description}</p> : null}
            <ul className="mt-2 space-y-1">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileNavOpen(false)}
                      className={[
                        "group flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm"
                          : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950",
                      ].join(" ")}
                    >
                      <span>{item.label}</span>
                      <ArrowRight className={["h-3.5 w-3.5 transition group-hover:translate-x-0.5", active ? "text-emerald-700" : "text-slate-500"].join(" ")} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#eef2f7] lg:flex">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-black focus:text-slate-950 focus:shadow-xl">
        Skip to workspace content
      </a>
      <aside className="z-40 hidden border-r border-slate-200 bg-white text-slate-950 opacity-100 shadow-xl shadow-slate-200/70 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[280px] lg:shrink-0 lg:flex-col">
        <div className="border-b border-slate-200 px-5 py-6">
          <Link href={workspace.homepage} className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50">
              <Icon className="h-5 w-5 text-emerald-700" />
            </span>
            <span>
              <span className="block text-lg font-black text-slate-950">{workspace.logoLabel}</span>
              <span className="block text-[10px] leading-tight text-slate-600">{workspace.title}</span>
            </span>
          </Link>
        </div>

        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{workspace.id.replaceAll("-", " ")} workspace</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">{workspace.subtitle}</p>
        </div>

        {navigation}

        {workspace.quickActions.length ? (
          <div className="border-t border-slate-200 p-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Quick actions</p>
            <div className="space-y-2">
              {workspace.quickActions.slice(0, 3).map((action) => (
                <Link key={action.href} href={action.href} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-800 transition hover:bg-white">
                  {action.label}
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-700" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="border-t border-slate-200 p-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="truncate text-xs font-bold text-slate-950">{userLabel}</p>
            <p className="mt-1 truncate text-[10px] text-slate-600">{userEmail ?? "Institutional account"}</p>
            <AccountActions className="mt-3 border-t border-slate-200 pt-3" />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:p-1.5 lg:pl-0">
        <div className="min-h-screen overflow-hidden bg-[#f8fafc] lg:rounded-l-[24px] lg:border lg:border-slate-200 lg:shadow-xl lg:shadow-slate-300/30">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-5 sm:py-5 lg:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 lg:hidden"
                aria-label={`Open ${workspace.logoLabel} navigation`}
                aria-expanded={mobileNavOpen}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{workspace.title}</p>
                <h1 className="mt-1 truncate text-xl font-black tracking-tight text-[#0c1733] sm:text-2xl">{activeItem?.label ?? "Overview"}</h1>
              </div>
            </div>
          </header>
          <main id="workspace-content" className="p-4 sm:p-5 lg:p-7">{children}</main>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`${workspace.logoLabel} navigation`}>
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 flex h-full w-[min(88vw,23rem)] flex-col border-r border-slate-200 bg-white text-slate-950 opacity-100 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-5">
              <Link href={workspace.homepage} className="flex min-w-0 items-center gap-3" onClick={() => setMobileNavOpen(false)}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50">
                  <Icon className="h-5 w-5 text-emerald-700" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-slate-950">{workspace.logoLabel}</span>
                  <span className="block truncate text-[10px] text-slate-600">{workspace.title}</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{workspace.id.replaceAll("-", " ")} workspace</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{workspace.subtitle}</p>
            </div>
            {navigation}
            <div className="border-t border-slate-200 p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="truncate text-xs font-bold text-slate-950">{userLabel}</p>
                <p className="mt-1 truncate text-[10px] text-slate-600">{userEmail ?? "Institutional account"}</p>
                <AccountActions className="mt-3 border-t border-slate-200 pt-3" compact />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
