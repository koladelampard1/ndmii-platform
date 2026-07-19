"use client";

import { useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

type ProductTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  headline: string;
  microcopy: string;
  metric: string;
  action: string;
};

const PRODUCT_TABS: ProductTab[] = [
  {
    id: "identity",
    label: "Identity",
    icon: BadgeCheck,
    headline: "Verified.",
    microcopy: "Issued",
    metric: "DBIN-2048",
    action: "View",
  },
  {
    id: "invoices",
    label: "Invoices",
    icon: ReceiptText,
    headline: "Recorded.",
    microcopy: "Organised",
    metric: "₦4.8m",
    action: "Create",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: Store,
    headline: "Discoverable.",
    microcopy: "Live",
    metric: "Live",
    action: "Open",
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ClipboardCheck,
    headline: "Ready.",
    microcopy: "Checked",
    metric: "82%",
    action: "Review",
  },
  {
    id: "Analytics",
    label: "Analytics",
    icon: BarChart3,
    headline: "Visible.",
    microcopy: "Signals",
    metric: "12 states",
    action: "View",
  },
];

export function DbinProductExperience() {
  const [activeId, setActiveId] = useState(PRODUCT_TABS[0].id);
  const active = PRODUCT_TABS.find((tab) => tab.id === activeId) ?? PRODUCT_TABS[0];
  const ActiveIcon = active.icon;

  return (
    <div className="overflow-hidden rounded-[2rem] bg-slate-950 p-3 shadow-2xl shadow-emerald-950/20 ring-1 ring-slate-900/10">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 text-white">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-auto text-xs font-bold text-slate-400">workspace.dbin.ng</span>
      </div>

      <div className="grid min-h-[34rem] bg-white lg:grid-cols-[15rem_1fr]">
        <aside className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">DBIN Workspace</p>
          <div className="mt-5 grid gap-2">
            {PRODUCT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === active.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveId(tab.id)}
                  className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-left text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                    isActive ? "bg-emerald-700 text-white shadow-lg shadow-emerald-200" : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="bg-[radial-gradient(circle_at_top_right,#dcfce7,transparent_36%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Eko Fresh</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">{active.headline}</h3>
            </div>
            <div className="rounded-3xl bg-slate-950 p-4 text-white shadow-xl">
              <ActiveIcon className="h-6 w-6 text-emerald-300" aria-hidden="true" />
              <p className="mt-3 text-2xl font-black">{active.metric}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.75fr]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-black text-slate-950">{active.label}</p>
              </div>
              <div className="mt-6 grid gap-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="h-2.5 w-2/3 rounded-full bg-slate-300" />
                      <div className="mt-2 h-2 w-1/2 rounded-full bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                {active.action}
              </button>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.5rem] bg-emerald-700 p-5 text-white shadow-lg">
                <ShieldCheck className="h-6 w-6 text-emerald-100" aria-hidden="true" />
                <p className="mt-4 text-lg font-black">{active.microcopy}</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <Search className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <p className="mt-4 text-sm font-bold text-slate-600">Private by design.</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <WalletCards className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <p className="mt-4 text-sm font-bold text-slate-600">Readiness signals.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
