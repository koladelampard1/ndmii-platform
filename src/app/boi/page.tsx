import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChartNoAxesCombined,
  FileChartColumn,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "BOI MSME Intelligence Portal | DBIN",
  description:
    "Programme intelligence, MSME verification, impact reporting, and analytics for authorized Bank of Industry stakeholders.",
};

const portalCapabilities = [
  {
    title: "Programme Intelligence",
    description:
      "Monitor programme delivery, portfolio performance, geographic reach, and intervention outcomes.",
    icon: ChartNoAxesCombined,
  },
  {
    title: "MSME Verification",
    description:
      "Review trusted digital business identity and verification signals across supported MSME cohorts.",
    icon: ShieldCheck,
  },
  {
    title: "Impact Reports",
    description:
      "Access structured programme evidence and decision-ready reports for institutional stakeholders.",
    icon: FileChartColumn,
  },
  {
    title: "Analytics",
    description:
      "Explore aggregated trends, performance indicators, and portfolio insights through role-scoped dashboards.",
    icon: BarChart3,
  },
];

export default function BoiPortalPage() {
  return (
    <main className="min-h-screen bg-[#f4f1e8] text-slate-950">
      <section className="relative isolate overflow-hidden bg-[#082f2b] text-white">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(120deg,#052e2b_0%,#064e3b_52%,#0f3d32_100%)]" />
        <div className="absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full border border-amber-300/20 bg-amber-300/10 blur-3xl" />
        <div className="absolute -bottom-44 left-1/4 -z-10 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-6 pb-20 pt-6 sm:px-8 lg:px-10 lg:pb-28">
          <header className="flex items-center justify-between border-b border-white/15 pb-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-amber-200/30 bg-amber-200/10">
                <Building2 className="h-6 w-6 text-amber-200" />
              </span>
              <div>
                <p className="text-sm font-black tracking-[0.22em] text-white">BOI</p>
                <p className="text-xs text-emerald-100/75">Institutional access portal</p>
              </div>
            </div>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/70 sm:block">
              Powered by DBIN
            </p>
          </header>

          <div className="grid gap-12 pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:pt-24">
            <div>
              <p className="inline-flex rounded-full border border-amber-200/25 bg-amber-200/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-100">
                Digital Business Identity Network
              </p>
              <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                BOI MSME
                <span className="block text-amber-200">Intelligence Portal</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-emerald-50/80 sm:text-lg">
                A secure institutional gateway for programme oversight, verified MSME intelligence,
                impact evidence, and portfolio analytics.
              </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-emerald-950/40 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
                Authorized access
              </p>
              <p className="mt-3 text-xl font-bold">Open the impact intelligence workspace</p>
              <p className="mt-2 text-sm leading-6 text-emerald-50/70">
                Existing authentication and role permissions remain in force for all programme data
                and reports.
              </p>
              <Link
                href="https://app.dbin.ng/dashboard/impact-intelligence"
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-black text-emerald-950 transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-100 focus:ring-offset-2 focus:ring-offset-emerald-950"
              >
                Continue to authorized portal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-800">
            Institutional intelligence
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Decision support for measurable MSME outcomes
          </h2>
          <p className="mt-4 leading-7 text-slate-600">
            The portal brings trusted identity infrastructure and programme evidence into a focused
            view for authorized Bank of Industry stakeholders.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {portalCapabilities.map((capability, index) => (
            <article
              key={capability.title}
              className="group rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-emerald-700/30"
            >
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-950 text-amber-200">
                  <capability.icon className="h-6 w-6" />
                </span>
                <span className="text-xs font-black text-slate-300">0{index + 1}</span>
              </div>
              <h3 className="mt-7 text-lg font-black text-slate-950">{capability.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-emerald-950/10 bg-[#ece7da]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-7 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p className="font-semibold text-slate-800">BOI MSME Intelligence Portal</p>
          <p>Digital Business Identity Network</p>
        </div>
      </footer>
    </main>
  );
}
