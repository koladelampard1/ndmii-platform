import Link from "next/link";
import { Activity, BadgeCheck, Building2, CircleDollarSign, Factory, FileWarning, Landmark, MapPinned, Network, ShieldCheck, TrendingUp, UsersRound } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { demoDisclosure, formatNrsStatus, requireNrsWorkspace } from "@/lib/nrs/access";
import { formatNaira } from "@/lib/data/invoicing";
import { NationalRevenueMap, type NrsStateMetric } from "@/components/nrs/national-revenue-map";
import { NrsPresentationModeToggle } from "@/components/nrs/presentation-mode-toggle";

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function opportunityBand(score: number) {
  if (score >= 80) return "Very High";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

export default async function NrsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; sector?: string; status?: string; vat?: string; arrears?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  requireNrsWorkspace(ctx);

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("tax_profiles")
    .select("id,msme_id,tax_category,vat_applicable,outstanding_amount,estimated_monthly_obligation,compliance_status,arrears_status,compliance_score,msmes!inner(msme_id,business_name,state,lga,sector,verification_status,tin)")
    .order("outstanding_amount", { ascending: false })
    .limit(300);

  if (params.status) query = query.eq("compliance_status", params.status);
  if (params.vat) query = query.eq("vat_applicable", params.vat === "true");
  if (params.arrears) query = query.eq("arrears_status", params.arrears);
  if (params.state) query = query.eq("msmes.state", params.state);
  if (params.sector) query = query.eq("msmes.sector", params.sector);
  if (params.q) {
    const q = params.q.trim().replace(/[%_,]/g, " ");
    if (q) query = (query as any).or(`business_name.ilike.%${q}%,msme_id.ilike.%${q}%`, { foreignTable: "msmes" });
  }
  const { data } = await query;

  const rows = data ?? [];

  const [{ data: vatRules }, { data: recentNotices }, { data: invoices }, { count: clusterCount }] = await Promise.all([
    supabase.from("vat_rules").select("id,category,vat_percent,applies_to,status").order("updated_at", { ascending: false }),
    supabase.from("activity_logs").select("created_at,metadata").eq("action", "nrs_issue_notice").order("created_at", { ascending: false }).limit(5),
    supabase.from("invoices").select("id,status,total_amount,vat_amount,msmes(state,sector)"),
    supabase.from("industrial_clusters").select("id", { count: "exact", head: true }),
  ]);

  const totals = rows.reduce(
    (acc, row) => {
      const msme = row.msmes as any;
      acc.outstanding += Number(row.outstanding_amount ?? 0);
      if (String(row.compliance_status ?? "").includes("overdue") || String(row.arrears_status ?? "").includes("overdue")) acc.overdue += 1;
      if (String(row.compliance_status ?? "").includes("compliant")) acc.compliant += 1;
      if (msme?.verification_status === "verified") acc.verified += 1;
      if (msme?.tin) acc.tinReady += 1;
      if (msme?.state) acc.states.set(msme.state, (acc.states.get(msme.state) ?? 0) + 1);
      if (msme?.sector) acc.sectors.set(msme.sector, (acc.sectors.get(msme.sector) ?? 0) + 1);
      return acc;
    },
    { outstanding: 0, overdue: 0, compliant: 0, verified: 0, tinReady: 0, states: new Map<string, number>(), sectors: new Map<string, number>() }
  );
  const invoiceValue = (invoices ?? []).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const vatExposure = (invoices ?? []).reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);
  const topStates = [...totals.states.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topSectors = [...totals.sectors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const invoiceStateTotals = new Map<string, { invoiceValue: number; vatExposure: number; count: number }>();
  const invoiceSectorTotals = new Map<string, { invoiceValue: number; vatExposure: number; count: number }>();
  for (const invoice of invoices ?? []) {
    const msme = (invoice.msmes ?? {}) as any;
    const state = msme.state ?? "Unassigned";
    const sector = msme.sector ?? "Unclassified";
    const stateEntry = invoiceStateTotals.get(state) ?? { invoiceValue: 0, vatExposure: 0, count: 0 };
    stateEntry.invoiceValue += Number(invoice.total_amount ?? 0);
    stateEntry.vatExposure += Number(invoice.vat_amount ?? 0);
    stateEntry.count += 1;
    invoiceStateTotals.set(state, stateEntry);
    const sectorEntry = invoiceSectorTotals.get(sector) ?? { invoiceValue: 0, vatExposure: 0, count: 0 };
    sectorEntry.invoiceValue += Number(invoice.total_amount ?? 0);
    sectorEntry.vatExposure += Number(invoice.vat_amount ?? 0);
    sectorEntry.count += 1;
    invoiceSectorTotals.set(sector, sectorEntry);
  }
  const revenueGuideKeys = new Set(rows.map((row) => `${(row.msmes as any)?.state ?? "Unassigned"}|${(row.msmes as any)?.lga ?? "Statewide"}`));
  const activeTaxpayers = rows.filter((row) => Number(row.estimated_monthly_obligation ?? 0) > 0 || Number(row.outstanding_amount ?? 0) > 0 || Boolean((row.msmes as any)?.tin)).length;
  const formalisedBusinesses = rows.filter((row) => Boolean((row.msmes as any)?.msme_id) && Boolean((row.msmes as any)?.tin)).length;
  const complianceReadiness = percent(totals.compliant + totals.tinReady, Math.max(1, rows.length * 2));
  const businessesRequiringIntervention = rows.filter((row) => Number(row.outstanding_amount ?? 0) > 0 || ["high", "overdue"].includes(String(row.arrears_status ?? "").toLowerCase()) || !((row.msmes as any)?.tin)).length;
  const revenueOpportunityScore = Math.min(100, Math.round((invoiceValue > 0 ? 35 : 0) + (vatExposure > 0 ? 20 : 0) + percent(totals.tinReady, rows.length) * 0.2 + percent(totals.verified, rows.length) * 0.15 + Math.min(20, businessesRequiringIntervention * 3)));
  const topInvoiceState = [...invoiceStateTotals.entries()].sort((a, b) => b[1].invoiceValue - a[1].invoiceValue)[0];
  const topVatSector = [...invoiceSectorTotals.entries()].sort((a, b) => b[1].vatExposure - a[1].vatExposure)[0];
  const topInterventionState = rows.reduce((map, row) => {
    const needsIntervention = Number(row.outstanding_amount ?? 0) > 0 || !((row.msmes as any)?.tin);
    if (!needsIntervention) return map;
    const state = (row.msmes as any)?.state ?? "Unassigned";
    map.set(state, (map.get(state) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const topIntervention = [...topInterventionState.entries()].sort((a, b) => b[1] - a[1])[0];
  const executiveInsights = [
    topInvoiceState ? `${topInvoiceState[0]} currently contributes the highest DBIN invoice activity in this view.` : null,
    topVatSector ? `${topVatSector[0]} shows the highest invoice-derived VAT exposure.` : null,
    topIntervention ? `Most businesses requiring intervention originate from ${topIntervention[0]}.` : null,
    complianceReadiness >= 60 ? `Compliance readiness is above ${complianceReadiness}% across loaded businesses.` : `Compliance readiness requires executive attention at ${complianceReadiness}%.`,
  ].filter(Boolean);
  const stateMetrics: NrsStateMetric[] = [...totals.states.keys()].map((state) => {
    const stateRows = rows.filter((row) => (row.msmes as any)?.state === state);
    const stateInvoices = invoiceStateTotals.get(state);
    return {
      state,
      businesses: stateRows.length,
      verified: stateRows.filter((row) => (row.msmes as any)?.verification_status === "verified").length,
      compliant: stateRows.filter((row) => String(row.compliance_status ?? "").includes("compliant")).length,
      revenueGuides: new Set(stateRows.map((row) => (row.msmes as any)?.lga ?? "Statewide")).size,
      vatExposure: stateInvoices?.vatExposure ?? 0,
      sectors: [...new Set(stateRows.map((row) => (row.msmes as any)?.sector).filter(Boolean))].slice(0, 4),
    };
  }).sort((a, b) => b.businesses - a.businesses);

  return (
    <section className="nrs-executive-shell space-y-5">
      <header className="presentation-expand rounded-3xl border bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Nigeria Revenue Service • Powered by DBIN Infrastructure</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">National Revenue Intelligence Centre</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-emerald-50">A national visibility layer for business formalisation, compliance readiness, digital invoice intelligence and revenue opportunity discovery across participating MSMEs.</p>
          </div>
          <NrsPresentationModeToggle />
        </div>
        <div className="presentation-hide mt-4 flex flex-wrap gap-2 text-xs">
          <Link href="/dashboard/nrs/invoices" className="rounded-full bg-white/15 px-3 py-2 hover:bg-white/25">Invoice Registry</Link>
          <Link href="/dashboard/nrs/vat-monitor" className="rounded-full bg-white/15 px-3 py-2 hover:bg-white/25">VAT & Consumption Tax Intelligence</Link>
          <Link href="/dashboard/nrs/revenue" className="rounded-full bg-white/15 px-3 py-2 hover:bg-white/25">National Revenue Intelligence</Link>
          <Link href="/dashboard/revenue-guides" className="rounded-full bg-white/15 px-3 py-2 hover:bg-white/25">Revenue Guide Operations Centre</Link>
        </div>
        <p className="mt-5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-emerald-50">{demoDisclosure()}</p>
      </header>

      <div className="presentation-kpi-grid grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Registered Businesses", value: rows.length.toLocaleString("en-NG"), subtitle: "Businesses visible to NRS through DBIN", tag: "DBIN Verified", trend: `${percent(totals.verified, rows.length)}% verified`, icon: Building2 },
          { label: "Verified Businesses", value: totals.verified.toLocaleString("en-NG"), subtitle: "Identity-confirmed business records", tag: "DBIN Verified", trend: "+ identity trust", icon: BadgeCheck },
          { label: "Formalised Businesses", value: formalisedBusinesses.toLocaleString("en-NG"), subtitle: "BIN and TIN-ready participants", tag: "DBIN Derived", trend: `${percent(formalisedBusinesses, rows.length)}% formalised`, icon: Landmark },
          { label: "Active Taxpayers", value: activeTaxpayers.toLocaleString("en-NG"), subtitle: "Businesses with tax profile signals", tag: "DBIN Derived", trend: "readiness signal", icon: Activity },
          { label: "Revenue Guides", value: revenueGuideKeys.size.toLocaleString("en-NG"), subtitle: "State/LGA guide desks inferred", tag: "DBIN Derived", trend: "field enablement", icon: UsersRound },
          { label: "Industrial Clusters", value: (clusterCount ?? 0).toLocaleString("en-NG"), subtitle: "Cluster registry connection points", tag: "DBIN Derived", trend: "growth pipeline", icon: Factory },
          { label: "Compliance Readiness", value: `${complianceReadiness}%`, subtitle: "TIN and compliance posture", tag: "DBIN Derived", trend: "policy readiness", icon: ShieldCheck },
          { label: "VAT Exposure", value: formatNaira(vatExposure), subtitle: "Invoice-derived consumption tax signal", tag: "DBIN Derived", trend: "not remittance", icon: CircleDollarSign },
          { label: "Revenue Opportunity", value: opportunityBand(revenueOpportunityScore), subtitle: `Derived insight score ${revenueOpportunityScore}/100`, tag: "Derived Insight", trend: "computed live", icon: TrendingUp },
          { label: "Requires Intervention", value: businessesRequiringIntervention.toLocaleString("en-NG"), subtitle: "Businesses needing activation or review", tag: "DBIN Derived", trend: `${percent(businessesRequiringIntervention, rows.length)}% of view`, icon: FileWarning },
        ].map(({ label, value, subtitle, tag, trend, icon: Icon }) => (
          <article key={label} className="presentation-expand rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Icon className="h-5 w-5" /></span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">{tag}</span>
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            <p className="mt-3 text-[11px] font-semibold text-emerald-700">{trend}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="presentation-expand rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Network className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Executive Insights</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">What the national data is saying</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {executiveInsights.map((insight) => (
              <p key={insight} className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-950">{insight}</p>
            ))}
          </div>
        </article>

        <article className="presentation-expand rounded-2xl border bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-white/10 p-2 text-emerald-200"><MapPinned className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">National Impact Pathway</p>
              <h2 className="mt-1 text-xl font-semibold">From business identity to economic growth</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {[
              ["Businesses Formalised", formalisedBusinesses ? formalisedBusinesses.toLocaleString("en-NG") : "Available after wider rollout"],
              ["Businesses Structured", totals.verified ? totals.verified.toLocaleString("en-NG") : "Available after wider rollout"],
              ["Businesses Becoming Tax Ready", totals.tinReady ? totals.tinReady.toLocaleString("en-NG") : "Available after wider rollout"],
              ["Businesses Becoming Investment Ready", (clusterCount ?? 0) > 0 ? `${clusterCount} cluster pathways` : "Available after wider rollout"],
              ["Businesses Growing", invoiceValue > 0 ? formatNaira(invoiceValue) : "Available after wider rollout"],
              ["Economic Growth", "Available after wider rollout"],
            ].map(([label, value], index, list) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-emerald-950">{index + 1}</span>
                <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">{label}</p>
                  <p className="font-semibold">{value}</p>
                </div>
                {index < list.length - 1 && <span className="hidden text-emerald-200 md:inline">→</span>}
              </div>
            ))}
          </div>
        </article>
      </div>

      <NationalRevenueMap states={stateMetrics} />

      <form className="presentation-hide grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
        <input name="q" defaultValue={params.q} placeholder="business or MSME ID" className="rounded border px-2 py-2 text-sm" />
        <input name="state" defaultValue={params.state} placeholder="state" className="rounded border px-2 py-2 text-sm" />
        <input name="sector" defaultValue={params.sector} placeholder="sector" className="rounded border px-2 py-2 text-sm" />
        <input name="status" defaultValue={params.status} placeholder="compliance status" className="rounded border px-2 py-2 text-sm" />
        <input name="arrears" defaultValue={params.arrears} placeholder="arrears status" className="rounded border px-2 py-2 text-sm" />
        <button className="rounded bg-emerald-800 px-3 py-2 text-sm text-white">Apply filters</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700"><tr><th className="px-3 py-2">Business Profile</th><th className="px-3 py-2">Readiness Category</th><th className="px-3 py-2">Monthly Signal</th><th className="px-3 py-2">Outstanding Exposure</th><th className="px-3 py-2">Compliance Readiness</th><th className="px-3 py-2">Profile</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No tax records match your filter set.</td></tr>}
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-3">{(row.msmes as any)?.business_name}<p className="text-xs text-slate-500">{(row.msmes as any)?.msme_id} • {(row.msmes as any)?.state}</p></td>
                  <td className="px-3 py-3">{formatNrsStatus(row.tax_category)}</td>
                  <td className="px-3 py-3">₦{Number(row.estimated_monthly_obligation).toLocaleString()}</td>
                  <td className="px-3 py-3">₦{Number(row.outstanding_amount).toLocaleString()}</td>
                  <td className="px-3 py-3 capitalize">{formatNrsStatus(row.compliance_status)}<p className="text-xs text-slate-500">arrears: {formatNrsStatus(row.arrears_status)} • score {row.compliance_score}</p></td>
                  <td className="px-3 py-3"><Link href={`/dashboard/nrs/${(row.msmes as any)?.msme_id}`} className="text-xs text-emerald-700 hover:underline">Open business profile →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="space-y-4">
          <article className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">State distribution</h2>
            <div className="mt-2 space-y-2 text-sm">
              {topStates.length === 0 && <p className="text-slate-500">Unavailable for current filters.</p>}
              {topStates.map(([state, count]) => <p key={state} className="flex justify-between rounded border px-2 py-1"><span>{state}</span><span>{count}</span></p>)}
            </div>
          </article>
          <article className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Sector distribution</h2>
            <div className="mt-2 space-y-2 text-sm">
              {topSectors.length === 0 && <p className="text-slate-500">Unavailable for current filters.</p>}
              {topSectors.map(([sector, count]) => <p key={sector} className="flex justify-between rounded border px-2 py-1"><span>{sector}</span><span>{count}</span></p>)}
            </div>
          </article>
          <article className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">VAT category rules</h2>
            <div className="mt-2 space-y-2 text-sm">
              {(vatRules ?? []).slice(0, 6).map((rule) => (
                <p key={rule.id} className="rounded border px-2 py-1">{rule.category}: {Number(rule.vat_percent).toFixed(2)}% ({rule.applies_to})</p>
              ))}
            </div>
          </article>
          <article className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Recent notices</h2>
            <div className="mt-2 space-y-2 text-xs text-slate-600">
              {(recentNotices ?? []).map((notice, idx) => (
                <p key={idx} className="rounded border px-2 py-1">{new Date(notice.created_at).toLocaleString()} • {(notice.metadata as any)?.notice_type ?? "notice"}</p>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
