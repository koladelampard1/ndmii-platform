"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, User, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MsmeDashboardTopbarProps = {
  ownerName: string;
  businessName: string;
  publicProfileHref: string;
};

type MenuItem = {
  href: string;
  label: string;
  icon: typeof User;
};

export function MsmeDashboardTopbar({ ownerName, businessName, publicProfileHref }: MsmeDashboardTopbarProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const menuItems: MenuItem[] = [
    { href: "/dashboard/msme", label: "My Dashboard", icon: UserCircle2 },
    { href: "/dashboard/msme/settings", label: "Business Profile / Settings", icon: Settings },
    { href: publicProfileHref, label: "View Public Profile", icon: User },
    { href: "/logout", label: "Logout", icon: LogOut },
  ];

  return (
    <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-900 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Go to Digital Business Identity Network (DBIN) landing page"
        >
          <span className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-semibold tracking-wide text-white">DBIN</span>
          <span className="hidden text-sm font-semibold sm:inline">Digital Business Identity Network (DBIN)</span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((previous) => !previous)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left text-slate-700 transition",
              "hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
            )}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="Open user menu"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <UserCircle2 className="h-5 w-5" />
            </span>
            <span className="hidden max-w-[190px] min-w-0 sm:block">
              <span className="block truncate text-sm font-semibold text-slate-900">{ownerName}</span>
              <span className="block truncate text-xs text-slate-500">{businessName}</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", open ? "rotate-180" : "rotate-0")} />
          </button>

          {open ? (
            <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg" role="menu">
              {menuItems.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    onClick={() => setOpen(false)}
                    role="menuitem"
                  >
                    <ItemIcon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
