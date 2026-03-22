import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { supabase } from "@/lib/supabase/client";

export default async function ExecutiveDashboardPage() {
  const [
    { count: totalMsmes },
    { count: verifiedMsmes },
    { count: pendingReviews },
    { count: suspendedFlagged },
    { data: complaints },
    { data: payments },
    { data: kyc },
    { data: states },
    { data: sectors },
    { data: associations },
    { count: manufacturerCount },
    { count: riskAlerts },
  ] = await Promise.all([
    supabase.from("msmes").select("*", { count: "exact", head: true }),
    supabase.from("msmes").select("*", { count: "exact", head: true }).eq("verification_status", "verified"),
    supabase.from("msmes").select("*", { count: "exact", head: true }).eq("review_status", "pending_review"),
    supabase.from("msmes").select("*", { count: "exact", head: true }).or("suspended.eq.true,flagged.eq.true"),
    supabase.from("complaints").select("severity"),
    supabase.from("payments").select("amount"),
    supabase.from("compliance_profiles").select("overall_status"),
    supabase.from("msmes").select("state"),
    supabase.from("msmes").select("sector"),
    supabase.from("association_members").select("association_id"),
    supabase.from("manufacturer_profiles").select("*", { count: "exact", head: true }),
    supabase.from("manufacturer_profiles").select("*", { count: "exact", head: true }).eq("counterfeit_risk_flag", true),
  ]);

  const complaintBySeverity = Object.entries((complaints ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = row.severity ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {}));

  const kycRate = (kyc ?? []).length ? Math.round(((kyc ?? []).filter((k) => k.overall_status === "verified").length / (kyc ?? []).length) * 100) : 0;
  const revenue = (payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  const topStates = Object.entries((states ?? []).reduce<Record<string, number>>((acc, row) => { acc[row.state] = (acc[row.state] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);
  const topSectors = Object.entries((sectors ?? []).reduce<Record<string, number>>((acc, row) => { acc[row.sector] = (acc[row.sector] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);
  const topAssociations = Object.entries((associations ?? []).reduce<Record<string, number>>((acc, row) => { acc[row.association_id] = (acc[row.association_id] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);

  const trendRows = [
    { period: "Q4 2025", registrations: 4200, kycRate: 83, complaints: 110, tax: 12500000 },
    { period: "Q1 2026", registrations: 5810, kycRate: 88, complaints: 97, tax: 17800000 },
    { period: "Q2 2026 (Projected)", registrations: 6630, kycRate: 91, complaints: 90, tax: 20600000 },
  ];

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border bg-gradient-to-r from-indigo-900 via-slate-900 to-emerald-900 p-7 text-white shadow-xl">
        <h1 className="text-3xl font-bold">Executive National Dashboard</h1>
        <p className="mt-2 text-sm text-slate-200">Federal-level oversight for MSME identity, compliance, tax simulation, and enforcement operations.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Total Registered MSMEs" value={(totalMsmes ?? 0).toLocaleString()} status="up" />
        <DashboardCard title="Verified Businesses" value={(verifiedMsmes ?? 0).toLocaleString()} status="up" />
        <DashboardCard title="Pending Reviews" value={(pendingReviews ?? 0).toLocaleString()} status="down" />
        <DashboardCard title="Suspended / Flagged" value={(suspendedFlagged ?? 0).toLocaleString()} status="down" />
        <DashboardCard title="Simulated Tax Revenue" value={`₦${revenue.toLocaleString()}`} status="up" />
        <DashboardCard title="KYC Verification Rate" value={`${kycRate}%`} status="up" />
        <DashboardCard title="Manufacturer Count" value={(manufacturerCount ?? 0).toLocaleString()} status="up" />
        <DashboardCard title="Product Risk Alerts" value={(riskAlerts ?? 0).toLocaleString()} status="down" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Complaints by severity</h2>{complaintBySeverity.map(([s,c]) => <p key={s} className="mt-2 text-sm">{s}: {c}</p>)}</article>
        <article className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Top states by registration</h2>{topStates.map(([s,c]) => <p key={s} className="mt-2 text-sm">{s}: {c}</p>)}</article>
        <article className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Top sectors by registration</h2>{topSectors.map(([s,c]) => <p key={s} className="mt-2 text-sm">{s}: {c}</p>)}</article>
      </div>
      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Trend widgets (seeded demo)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr><th className="px-3 py-2">Period</th><th className="px-3 py-2">Registrations</th><th className="px-3 py-2">KYC Rate</th><th className="px-3 py-2">Complaints</th><th className="px-3 py-2">Tax Simulation</th></tr></thead><tbody>{trendRows.map((row) => <tr key={row.period} className="border-t"><td className="px-3 py-2">{row.period}</td><td className="px-3 py-2">{row.registrations}</td><td className="px-3 py-2">{row.kycRate}%</td><td className="px-3 py-2">{row.complaints}</td><td className="px-3 py-2">₦{row.tax.toLocaleString()}</td></tr>)}</tbody></table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Top associations by active members: {topAssociations.map(([id, total]) => `${id.slice(0, 6)}.. (${total})`).join(", ") || "No associations yet"}.</p>
      </article>
    </section>
  );
}
