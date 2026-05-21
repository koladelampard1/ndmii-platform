"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";

export type ComplianceNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "info" | "warning" | "danger" | "success";
  createdAt?: string | null;
};

function storageKey(scope: string) {
  return `ndmii-compliance-read:${scope}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Now";
  return new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dotClass(severity: ComplianceNotification["severity"]) {
  if (severity === "danger") return "bg-rose-500";
  if (severity === "warning") return "bg-amber-500";
  if (severity === "success") return "bg-emerald-500";
  return "bg-blue-500";
}

export function ComplianceNotifications({ notifications, scope = "global" }: { notifications: ComplianceNotification[]; scope?: string }) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        setReadIds(new Set(JSON.parse(window.localStorage.getItem(storageKey(scope)) ?? "[]") as string[]));
      } catch {
        setReadIds(new Set());
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [scope]);

  const unreadCount = useMemo(() => notifications.filter((item) => !readIds.has(item.id)).length, [notifications, readIds]);

  function persist(next: Set<string>) {
    setReadIds(next);
    window.localStorage.setItem(storageKey(scope), JSON.stringify(Array.from(next)));
  }

  function markAllRead() {
    persist(new Set(notifications.map((item) => item.id)));
  }

  function markRead(id: string) {
    const next = new Set(readIds);
    next.add(id);
    persist(next);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        aria-label={`Compliance notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Compliance notifications</p>
            <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              <CheckCheck className="h-3.5 w-3.5" />
              Mark read
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No pending compliance notifications.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.map((item) => {
                const unread = !readIds.has(item.id);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => markRead(item.id)}
                    className={`block border-b px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${unread ? "bg-emerald-50/50" : "bg-white"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${dotClass(item.severity)}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{formatDate(item.createdAt)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
