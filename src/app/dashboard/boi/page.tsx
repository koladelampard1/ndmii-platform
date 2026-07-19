import Link from "next/link";
import { ArrowRight, BarChart3, Building2, FileCheck2, Gauge, ShieldCheck, TrendingUp, UsersRound } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getExecutiveDashboardMetrics } from "@/lib/data/impact-intelligence";
import { getWorkspaceDefinition } from "@/lib/workspaces/workspace-registry";

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("en-NG") : "Unavailable";
}

export default async function BoiWorkspacePage() {
  const ctx = await getCurrentUserContext();
  const workspace = getWorkspaceDefinition("boi");
  const metrics = await getExecutiveDashboardMetrics(ctx).catch(() => null);

  const kpis = [
    { label: "Businesses in pipeline", value: formatNumber(metrics?.totalMsmes), detail: "Verified MSMEs represented in visible portfolio records", icon: UsersRound },
    { label: "Funding programmes", value: formatNumber(metrics?.activeProgrammes), detail: "Active funding and support programmes in scope", icon: Building2 },
    { label: "Readiness reviews", value: formatNumber(metrics?.completedAssessments), detail: "Completed investment-readiness assessments", icon: Gauge },
    { label: "Verified documents", value: formatNumber(metrics?.verifiedEvidence), detail: "Accepted evidence records supporting portfolio decisions", icon: FileCheck2 },
  ];

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#07162f_0%,#102f54_55%,#173b5d_100%)] p-6 text-white shadow-xl shadow-slate-300/30 sm:p-8">
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[48px] border-white/[0.035]" />
        <div className="relative grid gap-8 xl:grid-cols-[1fr_340px] xl:items-end">
          <div>
            <p className="inline-flex rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-100">
              Development finance workspace
            </p>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
              BOI investment intelligence for verified MSME growth.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100/75">
              Review business pipeline quality, investment readiness, credit signals, supporting documents,
              portfolio movement, and institutional reports from one governed workspace.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur">
            <p className="text-xs font-bold text-amber-200">Priority actions</p>
            <div className="mt-3 space-y-2">
              {workspace.quickActions.map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex items-center justify-between rounded-xl px-3 py-3 text-xs font-bold transition ${index === 0 ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/10"}`}
                >
                  {action.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="mt-5 text-3xl font-black tracking-tight text-slate-950">{kpi.value}</p>
              <h2 className="mt-1 text-sm font-bold text-slate-800">{kpi.label}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">{kpi.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Portfolio command</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">What can BOI do here?</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {workspace.navigation.slice(1, 7).map((item) => (
              <Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50">
                <p className="flex items-center justify-between text-sm font-black text-slate-900">
                  {item.label}
                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {item.description ?? "Open the governed workspace records behind this BOI capability."}
                </p>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-[#0f172a] p-6 text-white shadow-sm">
          <ShieldCheck className="h-7 w-7 text-emerald-300" />
          <h2 className="mt-4 text-xl font-black">Institutional assurance</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            BOI operates through dedicated product navigation while continuing to use DBIN’s shared identity,
            permission, audit, evidence, and reporting infrastructure.
          </p>
          <div className="mt-5 grid gap-2 text-xs">
            <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">Role-scoped access</span>
            <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">No LCDBO workspace leakage</span>
            <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">Verified business intelligence</span>
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Portfolio Intelligence", href: "/dashboard/boi/portfolio-intelligence", icon: BarChart3 },
          { title: "Institutional Reports", href: "/dashboard/boi/reports", icon: FileCheck2 },
          { title: "Risk Signals", href: "/dashboard/boi/risk-signals", icon: TrendingUp },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200">
              <Icon className="h-5 w-5 text-amber-700" />
              <p className="mt-4 text-sm font-black text-slate-950">{item.title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Open the existing governed records through BOI product language.</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
