import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeReviewStatus } from "@/lib/data/msme-workflow";

type MonthPoint = { period: string; registrations: number; kycRate: number; complaints: number; tax: number };

function monthKey(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function ExecutiveDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const [
    { data: msmes },
    { data: complaints },
    { data: payments },
    { data: kyc },
    { data: associations },
    { count: manufacturerCount },
    { count: riskAlerts },
  ] = await Promise.all([
    supabase.from("msmes").select("id,state,sector,verification_status,review_status,suspended,flagged,created_at"),
    supabase.from("complaints").select("severity,created_at"),
    supabase.from("payments").select("amount,created_at"),
    supabase.from("compliance_profiles").select("msme_id,overall_status,created_at"),
    supabase.from("association_members").select("association_id"),
    supabase.from("manufacturer_profiles").select("*", { count: "exact", head: true }),
    supabase.from("manufacturer_profiles").select("*", { count: "exact", head: true }).eq("counterfeit_risk_flag", true),
  ]);

  const msmeRows = msmes ?? [];
  const totalMsmes = msmeRows.length;
  const verifiedMsmes = msmeRows.filter((row) => row.verification_status === "verified").length;
  const pendingReviews = msmeRows.filter((row) => ["pending_review", "submitted", "changes_requested"].includes(normalizeReviewStatus(row.verification_status, row.review_status))).length;
  const suspendedFlagged = msmeRows.filter((row) => row.suspended || row.flagged).length;

  const complaintBySeverity = Object.entries((complaints ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = row.severity ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {}));

  const kycRows = kyc ?? [];
  const kycRate = kycRows.length ? Math.round((kycRows.filter((k) => k.overall_status === "verified").length / kycRows.length) * 100) : 0;
  const revenue = (payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  const topStates = Object.entries(msmeRows.reduce<Record<string, number>>((acc, row) => { acc[row.state] = (acc[row.state] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);
  const topSectors = Object.entries(msmeRows.reduce<Record<string, number>>((acc, row) => { acc[row.sector] = (acc[row.sector] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);
  const topAssociations = Object.entries((associations ?? []).reduce<Record<string, number>>((acc, row) => { acc[row.association_id] = (acc[row.association_id] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);

  const monthly = new Map<string, MonthPoint>();
  for (const row of msmeRows) {
    const key = monthKey(row.created_at);
    const point = monthly.get(key) ?? { period: monthLabel(key), registrations: 0, kycRate: 0, complaints: 0, tax: 0 };
    point.registrations += 1;
    monthly.set(key, point);
  }
  for (const row of kycRows) {
    const key = monthKey(row.created_at);
    const point = monthly.get(key) ?? { period: monthLabel(key), registrations: 0, kycRate: 0, complaints: 0, tax: 0 };
    if (row.overall_status === "verified") point.kycRate += 1;
    monthly.set(key, point);
  }
  for (const row of complaints ?? []) {
    const key = monthKey(row.created_at);
    const point = monthly.get(key) ?? { period: monthLabel(key), registrations: 0, kycRate: 0, complaints: 0, tax: 0 };
    point.complaints += 1;
    monthly.set(key, point);
  }
  for (const row of payments ?? []) {
    const key = monthKey(row.created_at);
    const point = monthly.get(key) ?? { period: monthLabel(key), registrations: 0, kycRate: 0, complaints: 0, tax: 0 };
    point.tax += Number(row.amount ?? 0);
    monthly.set(key, point);
  }

  const trendRows = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, point]) => ({
      ...point,
      kycRate: point.registrations > 0 ? Math.round((point.kycRate / point.registrations) * 100) : 0,
    }));

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border bg-gradient-to-r from-indigo-900 via-slate-900 to-emerald-900 p-7 text-white shadow-xl">
        <h1 className="text-3xl font-bold">Executive National Dashboard</h1>
        <p className="mt-2 text-sm text-slate-200">Federal-level oversight for MSME identity, compliance, tax simulation, and enforcement operations.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Total Registered MSMEs" value={totalMsmes.toLocaleString()} status="up" />
        <DashboardCard title="Verified Businesses" value={verifiedMsmes.toLocaleString()} status="up" />
        <DashboardCard title="Pending Reviews" value={pendingReviews.toLocaleString()} status="down" />
        <DashboardCard title="Suspended / Flagged" value={suspendedFlagged.toLocaleString()} status="down" />
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
        <h2 className="font-semibold">Monthly trend widgets (database-backed)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr><th className="px-3 py-2">Period</th><th className="px-3 py-2">Registrations</th><th className="px-3 py-2">KYC Rate</th><th className="px-3 py-2">Complaints</th><th className="px-3 py-2">Tax Simulation</th></tr></thead><tbody>{trendRows.map((row) => <tr key={row.period} className="border-t"><td className="px-3 py-2">{row.period}</td><td className="px-3 py-2">{row.registrations}</td><td className="px-3 py-2">{row.kycRate}%</td><td className="px-3 py-2">{row.complaints}</td><td className="px-3 py-2">₦{row.tax.toLocaleString()}</td></tr>)}</tbody></table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Top associations by active members: {topAssociations.map(([id, total]) => `${id.slice(0, 6)}.. (${total})`).join(", ") || "No associations yet"}.</p>
      </article>
    </section>
  );
}
