"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileBadge2,
  FileText,
  ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Settings,
  ShieldCheck,
  User,
  Wrench,
  Star,
  type LucideIcon,
  Menu,
} from "lucide-react";

type WorkspaceLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type WorkspaceSection = {
  title: string;
  links: WorkspaceLink[];
};

const WORKSPACE_SECTIONS: WorkspaceSection[] = [
  {
    title: "",
    links: [{ href: "/dashboard/msme", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "Business Management",
    links: [
      { href: "/dashboard/msme/profile", label: "My Business Profile", icon: User },
      { href: "/dashboard/msme/services", label: "My Services", icon: Wrench },
      { href: "/dashboard/msme/portfolio", label: "Portfolio Gallery", icon: ImageIcon },
      { href: "/dashboard/msme/reviews", label: "Customer Reviews", icon: Star },
      { href: "/dashboard/msme/complaints", label: "Complaints", icon: MessageSquare },
      { href: "/dashboard/msme/quotes", label: "Quote Requests", icon: ClipboardList },
      { href: "/dashboard/msme/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    title: "Identity & Verification",
    links: [
      { href: "/dashboard/msme/id-card", label: "My Business Identity Credential", icon: FileBadge2 },
      { href: "/dashboard/msme/compliance", label: "Verification Status", icon: ShieldCheck },
      { href: "/dashboard/payments", label: "Tax / VAT", icon: FileText },
    ],
  },
  {
    title: "Settings",
    links: [{ href: "/dashboard/msme/settings", label: "Settings", icon: Settings }],
  },
];

function isLinkActive(pathname: string, link: WorkspaceLink) {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {WORKSPACE_SECTIONS.map((section) => (
        <div key={section.title || "dashboard"}>
          {section.title ? <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300/95">{section.title}</p> : null}
          <div className="space-y-1.5">
            {section.links.map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(pathname, item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-emerald-800 font-medium text-white" : "text-emerald-100/95 hover:bg-emerald-900/75 hover:text-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function MsmeWorkspaceSidebar() {
  return (
    <aside className="flex h-full flex-col rounded-3xl bg-emerald-950 p-5 text-white shadow-xl lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <div className="mb-6 border-b border-emerald-900/80 pb-5">
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">BIN</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">My Workspace</h2>
      </div>

      <div className="lg:hidden">
        <details className="group rounded-2xl border border-emerald-800 bg-emerald-900/45 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 text-sm font-semibold marker:content-none">
            <span className="inline-flex items-center gap-2">
              <Menu className="h-4 w-4" />
              Workspace navigation
            </span>
            <span className="text-xs text-emerald-200 group-open:hidden">Open</span>
            <span className="hidden text-xs text-emerald-200 group-open:inline">Close</span>
          </summary>
          <div className="pt-3">
            <SidebarNav />
          </div>
        </details>
      </div>

      <div className="hidden lg:block">
        <SidebarNav />
      </div>

      <div className="mt-6 lg:mt-auto lg:pt-6">
        <div className="rounded-2xl border border-emerald-800 bg-emerald-900/50 p-4">
          <p className="text-lg font-semibold">Need Help?</p>
          <p className="mt-1.5 text-sm text-emerald-100/90">Our support team can help you manage your MSME dashboard quickly.</p>
          <Link
            href="/dashboard/msme/settings"
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </aside>
  );
}
