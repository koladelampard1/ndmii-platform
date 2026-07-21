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
import type { WorkspaceDefinition } from "@/lib/workspaces/workspace-registry";
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
}: {
  workspace: WorkspaceDefinition;
  children: ReactNode;
  userLabel: string;
  userEmail: string | null;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const Icon = ICONS[workspace.icon] ?? Building2;
  const activeItem = workspace.navigation.find((item) => isActive(pathname, item.href));

  const navigation = (
    <nav aria-label={`${workspace.title} navigation`} className="overflow-y-auto px-3 py-3 lg:flex-1">
      <ul className="space-y-1">
        {workspace.navigation.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileNavOpen(false)}
                className={[
                  "group flex items-center justify-between gap-3 rounded-xl border-l-2 px-3 py-2.5 text-xs font-semibold transition",
                  active ? "border-white bg-white/[0.12] text-white" : "border-transparent text-slate-300 hover:bg-white/[0.07] hover:text-white",
                ].join(" ")}
              >
                <span>{item.label}</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-80" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#eef2f7] lg:flex">
      <aside className={`${workspace.palette.shell} ${workspace.palette.text} hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[260px] lg:shrink-0 lg:flex-col`}>
        <div className="border-b border-white/10 px-5 py-6">
          <Link href={workspace.homepage} className="flex items-center gap-3">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl border border-white/10 ${workspace.palette.accentSoft}`}>
              <Icon className={`h-5 w-5 ${workspace.palette.accent}`} />
            </span>
            <span>
              <span className="block text-lg font-black text-white">{workspace.logoLabel}</span>
              <span className="block text-[10px] leading-tight text-slate-300">{workspace.title}</span>
            </span>
          </Link>
        </div>

        <div className="border-b border-white/10 px-5 py-4">
          <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${workspace.palette.accent}`}>{workspace.id.replaceAll("-", " ")} workspace</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">{workspace.subtitle}</p>
        </div>

        {navigation}

        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="truncate text-xs font-bold text-white">{userLabel}</p>
            <p className="mt-1 truncate text-[10px] text-slate-400">{userEmail ?? "Institutional account"}</p>
            <AccountActions className="mt-3 border-t border-white/10 pt-3" dark />
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
          <main className="p-4 sm:p-5 lg:p-7">{children}</main>
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
          <div className={`${workspace.palette.shell} ${workspace.palette.text} relative flex h-full w-[min(86vw,22rem)] flex-col shadow-2xl`}>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
              <Link href={workspace.homepage} className="flex min-w-0 items-center gap-3" onClick={() => setMobileNavOpen(false)}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 ${workspace.palette.accentSoft}`}>
                  <Icon className={`h-5 w-5 ${workspace.palette.accent}`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-white">{workspace.logoLabel}</span>
                  <span className="block truncate text-[10px] text-slate-300">{workspace.title}</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-200 transition hover:bg-white/10 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-white/10 px-5 py-4">
              <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${workspace.palette.accent}`}>{workspace.id.replaceAll("-", " ")} workspace</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{workspace.subtitle}</p>
            </div>
            {navigation}
            <div className="border-t border-white/10 p-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="truncate text-xs font-bold text-white">{userLabel}</p>
                <p className="mt-1 truncate text-[10px] text-slate-400">{userEmail ?? "Institutional account"}</p>
                <AccountActions className="mt-3 border-t border-white/10 pt-3" dark compact />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
