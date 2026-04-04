import { PrintButton } from "@/components/msme/print-button";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getCurrentUserContext } from "@/lib/auth/session";

function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  return [headers.join(","), ...rows.map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ state?: string; sector?: string; status?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["admin", "association_officer"].includes(ctx.role)) redirect("/access-denied");
  const [msmes, complaints, compliance, tax, associations, manufacturers] = await Promise.all([
    supabase.from("msmes").select("msme_id,business_name,state,sector,verification_status,created_at,association_id"),
    supabase.from("complaints").select("summary,status,severity,state,sector,complaint_category,regulator_target,provider_profile_id,provider_id,created_at"),
    supabase.from("compliance_profiles").select("overall_status,score,risk_level,last_reviewed_at"),
    supabase.from("tax_profiles").select("tax_category,vat_applicable,outstanding_amount,compliance_status,arrears_status"),
    supabase.from("association_members").select("member_status,is_verified,created_at,associations(name),msmes(msme_id,business_name,state,sector)"),
    supabase.from("manufacturer_profiles").select("traceability_code,standards_status,inspection_status,counterfeit_risk_flag,msmes(msme_id,business_name,state,sector)"),
  ]);

  const filterMsme = (m: any) => (!params.state || m.state === params.state) && (!params.sector || m.sector === params.sector) && (!params.status || m.verification_status === params.status);
  const scopedMsmes = ctx.role === "association_officer"
    ? (msmes.data ?? []).filter((m: any) => m.association_id === ctx.linkedAssociationId)
    : (msmes.data ?? []);
  const registryRows = scopedMsmes.filter(filterMsme);

  const reports = [
    { name: "MSME registry report", csv: toCsv(["MSME ID", "Business", "State", "Sector", "Status", "Created"], registryRows.map((m: any) => [m.msme_id, m.business_name, m.state, m.sector, m.verification_status, m.created_at])) },
    { name: "Complaint report", csv: toCsv(["Summary", "Status", "Severity", "Category", "Regulator", "State", "Sector", "Provider Profile", "Created"], (complaints.data ?? []).map((c: any) => [c.summary, c.status, c.severity, c.complaint_category ?? "", c.regulator_target ?? "", c.state, c.sector, c.provider_profile_id ?? c.provider_id ?? "", c.created_at])) },
    { name: "Compliance report", csv: toCsv(["Status", "Score", "Risk", "Reviewed"], (compliance.data ?? []).map((c: any) => [c.overall_status, c.score, c.risk_level, c.last_reviewed_at])) },
    { name: "Tax summary report", csv: toCsv(["Category", "VAT", "Outstanding", "Compliance", "Arrears"], (tax.data ?? []).map((t: any) => [t.tax_category, t.vat_applicable, t.outstanding_amount, t.compliance_status, t.arrears_status])) },
    { name: "Association member report", csv: toCsv(["Association", "MSME ID", "Business", "Status", "Verified"], (associations.data ?? []).map((a: any) => [a.associations?.name, a.msmes?.msme_id, a.msmes?.business_name, a.member_status, a.is_verified])) },
    { name: "Manufacturer verification report", csv: toCsv(["MSME ID", "Business", "Traceability", "Inspection", "Standard", "Risk Alert"], (manufacturers.data ?? []).map((m: any) => [m.msmes?.msme_id, m.msmes?.business_name, m.traceability_code, m.inspection_status, m.standards_status, m.counterfeit_risk_flag])) },
  ];

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Reporting & Export Center</h1>
      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-5 print:hidden">
        <input name="state" defaultValue={params.state} placeholder="state" className="rounded border px-2 py-2 text-sm" />
        <input name="sector" defaultValue={params.sector} placeholder="sector" className="rounded border px-2 py-2 text-sm" />
        <input name="status" defaultValue={params.status} placeholder="status" className="rounded border px-2 py-2 text-sm" />
        <input name="from" defaultValue={params.from} placeholder="from yyyy-mm-dd" className="rounded border px-2 py-2 text-sm" />
        <input name="to" defaultValue={params.to} placeholder="to yyyy-mm-dd" className="rounded border px-2 py-2 text-sm" />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply filters</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <article key={report.name} className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="font-semibold">{report.name}</h2>
            <p className="mt-1 text-xs text-slate-500">CSV export and print-friendly summary available.</p>
            <div className="mt-3 flex gap-2">
              <a download={`${report.name.replaceAll(" ", "-").toLowerCase()}.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(report.csv)}`} className="rounded border px-3 py-2 text-xs">Download CSV</a>
              <PrintButton />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
