"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileClock,
  FileText,
  Factory,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/roles";
import { isPlatformAdmin } from "@/lib/auth/authorization";

type AdminCommandShellProps = {
  children: ReactNode;
  notificationCount?: number;
  adminName?: string | null;
  adminRole?: UserRole;
};

type NavItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  pending?: boolean;
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ label: "Admin Dashboard", href: "/dashboard/admin", icon: Home }],
  },
  {
    label: "MSME Management",
    items: [
      { label: "MSME Registry", href: "/dashboard/admin/msmes", icon: Building2, pending: true },
      { label: "Verifications", href: "/dashboard/admin/verifications", icon: ShieldCheck },
      { label: "Digital IDs", href: "/dashboard/admin/digital-ids", icon: BadgeCheck },
    ],
  },
  {
    label: "Association Management",
    items: [
      { label: "Associations", href: "/dashboard/admin/associations", icon: Users },
      { label: "Association Members / Approvals", href: "/dashboard/admin/association-members", icon: ClipboardCheck, pending: true },
      { label: "Bulk Upload", href: "/dashboard/admin/association-upload", icon: UploadCloud },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Complaints", href: "/dashboard/admin/complaints", icon: FileClock, pending: true },
      { label: "Impact Intelligence", href: "/dashboard/impact-intelligence", icon: LayoutDashboard },
      { label: "LCDBO Programme Operations", href: "/dashboard/lcdbo", icon: Factory },
      { label: "Public Verification", href: "/dashboard/admin/public-verification", icon: ShieldCheck, pending: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Users & Roles", icon: Users, pending: true },
      { label: "Audit Logs", href: "/dashboard/audit", icon: FileText },
      { label: "Settings", icon: Settings, pending: true },
    ],
  },
];

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminCommandShell({ children, notificationCount = 0, adminName, adminRole = "admin" }: AdminCommandShellProps) {
  const pathname = usePathname();
  const displayName = adminName?.trim() || "Admin User";
  const roleLabel = adminRole === "super_admin" ? "Super Administrator" : adminRole === "admin" ? "Administrator" : adminRole.replaceAll("_", " ");
  const visibleGroups = isPlatformAdmin(adminRole)
    ? navGroups
    : navGroups
        .map((group) => ({ ...group, items: group.items.filter((item) => item.href === "/dashboard/admin/msmes" || item.href === "/dashboard/admin/verifications") }))
        .filter((group) => group.items.length);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[292px] overflow-y-auto bg-[radial-gradient(circle_at_top_left,#078767_0,#034334_38%,#022d25_100%)] px-5 py-6 text-white shadow-2xl lg:block">
        <Link href="/dashboard/admin" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/95 text-[0.7rem] font-black tracking-[0.18em] text-white shadow-lg shadow-emerald-950/30 ring-1 ring-white/20">
            DBIN
          </span>
          <span className="text-[0.95rem] font-semibold leading-tight text-white">
            Digital Business<br />Identity Network
          </span>
        </Link>

        <nav className="mt-10 space-y-8" aria-label="Admin workspace navigation">
          {visibleGroups.map((group) => (
            <section key={group.label} className="space-y-2">
              <h2 className="px-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-emerald-100/60">{group.label}</h2>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  const className = [
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-emerald-500/22 text-white shadow-sm ring-1 ring-white/10"
                      : item.href
                        ? "text-emerald-50/90 hover:bg-white/10 hover:text-white"
                        : "cursor-not-allowed text-emerald-50/45",
                  ].join(" ");

                  const content = (
                    <>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                      {item.pending ? (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide text-emerald-50/70">Pending</span>
                      ) : item.href ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-emerald-50/45" aria-hidden="true" />
                      ) : null}
                    </>
                  );

                  return (
                    <li key={item.label}>
                      {item.href ? (
                        <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
                          {content}
                        </Link>
                      ) : (
                        <span className={className} aria-disabled="true">
                          {content}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="mt-10 rounded-2xl bg-emerald-500/12 p-4 ring-1 ring-white/10">
          <Link href="/contact" className="flex items-center gap-3 text-sm font-semibold text-emerald-50">
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Support
          </Link>
        </div>
      </aside>

      <div className="lg:pl-[292px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
          <div className="flex min-h-[76px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden" type="button" aria-label="Open admin navigation">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-950">Admin Dashboard</h1>
            <form action="/search" className="hidden w-full max-w-[430px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:flex">
              <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                name="q"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Search MSMEs, IDs, complaints..."
              />
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-500">K</kbd>
            </form>
            <button className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" type="button" aria-label="Notifications">
              <Bell className="h-5 w-5" aria-hidden="true" />
              {notificationCount > 0 ? (
                <span className="absolute right-1.5 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[0.62rem] font-bold text-white">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              ) : null}
            </button>
            <div className="flex items-center gap-3 rounded-lg px-1.5 py-1">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-700 text-sm font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-bold text-slate-950">{displayName}</p>
                <p className="text-xs font-medium capitalize text-slate-500">{roleLabel}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" aria-hidden="true" />
            </div>
          </div>
        </header>
        <main className="px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
