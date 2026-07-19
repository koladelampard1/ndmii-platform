"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  Factory,
  MapPinned,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  UsersRound,
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
  const Icon = ICONS[workspace.icon] ?? Building2;
  const activeItem = workspace.navigation.find((item) => isActive(pathname, item.href));

  return (
    <div className="min-h-screen bg-[#eef2f7] lg:flex">
      <aside className={`${workspace.palette.shell} ${workspace.palette.text} lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[260px] lg:shrink-0 lg:flex-col`}>
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

        <nav aria-label={`${workspace.title} navigation`} className="overflow-x-auto px-3 py-3 lg:flex-1 lg:overflow-y-auto">
          <ul className="flex min-w-max gap-1 lg:block lg:min-w-0 lg:space-y-1">
            {workspace.navigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
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

        <div className="hidden border-t border-white/10 p-4 lg:block">
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
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{workspace.title}</p>
              <h1 className="mt-1 truncate text-xl font-black tracking-tight text-[#0c1733] sm:text-2xl">{activeItem?.label ?? "Overview"}</h1>
            </div>
            <AccountActions className="hidden sm:flex" compact />
          </header>
          <main className="p-4 sm:p-5 lg:p-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
