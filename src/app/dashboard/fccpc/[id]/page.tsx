import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { logActivity } from "@/lib/data/operations";
import { supabase } from "@/lib/supabase/client";
import { getCurrentUserContext } from "@/lib/auth/session";

type ComplaintRecord = {
  id: string;
  msme_id: string | null;
  provider_profile_id?: string | null;
  provider_id?: string | null;
  summary?: string | null;
  description?: string | null;
  status?: string | null;
  severity?: string | null;
  complaint_type?: string | null;
  regulator_target?: string | null;
  investigation_notes?: string | null;
  msmes?: {
    id?: string;
    msme_id?: string | null;
    business_name?: string | null;
    verification_status?: string | null;
    flagged?: boolean | null;
    suspended?: boolean | null;
    compliance_tag?: string | null;
    enforcement_note?: string | null;
  } | null;
};

function devDetailLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ndmii][complaint-detail] ${message}`, payload ?? {});
  }
}

async function enforcementAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (!["fccpc_officer", "admin"].includes(ctx.role)) redirect("/access-denied");
  const complaintId = String(formData.get("complaint_id"));
  const msmeId = String(formData.get("msme_id"));
  const kind = String(formData.get("kind"));
  const note = String(formData.get("note") ?? "");

  if (kind === "investigation_note") {
    await supabase.from("complaints").update({ investigation_notes: note }).eq("id", complaintId);
    await logActivity("fccpc_investigation_note", "complaint", complaintId, { note });
  }

  if (kind === "flag") {
    await supabase.from("msmes").update({ flagged: true, enforcement_note: note || "Flagged by FCCPC" }).eq("id", msmeId);
    await logActivity("fccpc_flag_business", "msme", msmeId, { note });
  }

  if (kind === "suspend") {
    await supabase.from("msmes").update({ suspended: true, verification_status: "suspended", enforcement_note: note || "Suspended by FCCPC" }).eq("id", msmeId);
    await logActivity("fccpc_suspend_business", "msme", msmeId, { note });
  }

  if (kind === "reinstate") {
    await supabase.from("msmes").update({ suspended: false, flagged: false, verification_status: "verified", enforcement_note: note || "Reinstated by FCCPC" }).eq("id", msmeId);
    await logActivity("fccpc_reinstate_business", "msme", msmeId, { note });
  }

  if (kind === "close") {
    await supabase.from("complaints").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", complaintId);
    await logActivity("fccpc_close_complaint", "complaint", complaintId, { note });
  }

  redirect(`/dashboard/fccpc/${complaintId}?saved=1`);
}

export default async function ComplaintDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; qid?: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentUserContext();
  if (!["fccpc_officer", "admin"].includes(ctx.role)) redirect("/access-denied");
  const query = await searchParams;
  const clickedComplaintId = String((query as Record<string, string | undefined>).qid ?? "").trim() || null;
  const detailQueryId = String(id ?? "").trim();

  devDetailLog("workspace_opened", {
    clickedComplaintId,
    detailQueryId,
  });

  const { data: complaintFromRichQueryRaw, error: richQueryError } = await supabase
    .from("complaints")
    .select("*,msmes(id,msme_id,business_name,verification_status,flagged,suspended,compliance_tag,enforcement_note)")
    .eq("id", detailQueryId)
    .maybeSingle();

  if (richQueryError) {
    devDetailLog("rich_lookup_error", {
      detailQueryId,
      message: richQueryError.message,
    });
  }

  const complaintFromRichQuery = complaintFromRichQueryRaw as ComplaintRecord | null;

  let complaint: ComplaintRecord | null = complaintFromRichQuery;

  if (!complaint) {
    const { data: complaintFallbackRaw, error: fallbackError } = await supabase
      .from("complaints")
      .select("id,msme_id,provider_profile_id,provider_id,summary,description,status,severity,complaint_type,regulator_target")
      .eq("id", detailQueryId)
      .maybeSingle();

    if (fallbackError) {
      devDetailLog("fallback_lookup_error", {
        detailQueryId,
        message: fallbackError.message,
      });
    }

    const complaintFallback = complaintFallbackRaw as ComplaintRecord | null;
    complaint = complaintFallback;
  }

  devDetailLog("lookup_result", {
    clickedComplaintId,
    detailQueryId,
    rowFound: Boolean(complaint),
  });

  if (!complaint) return <div className="rounded border bg-white p-6">Complaint record not found.</div>;
  const providerId = complaint.provider_profile_id ?? complaint.provider_id;
  const msmeLookupId = complaint.msme_id ?? "";
  const { data: providerRaw } = await supabase
    .from("provider_profiles")
    .select("id,display_name")
    .eq("id", providerId ?? "")
    .maybeSingle();

  const provider = providerRaw as { display_name?: string | null } | null;

  const [{ data: activityRaw }, { data: complianceRaw }, { data: taxRaw }] = await Promise.all([
    supabase.from("activity_logs").select("action,metadata,created_at").in("entity_type", ["complaint", "msme"]).order("created_at", { ascending: false }).limit(12),
    supabase.from("compliance_profiles").select("score,overall_status,risk_level").eq("msme_id", msmeLookupId).maybeSingle(),
    supabase.from("tax_profiles").select("tax_category,outstanding_amount,compliance_status").eq("msme_id", msmeLookupId).maybeSingle(),
  ]);

  const activity = (activityRaw as { action?: string; created_at?: string }[] | null) ?? [];
  const compliance = complianceRaw as { score?: number; overall_status?: string; risk_level?: string } | null;
  const tax = taxRaw as { tax_category?: string; outstanding_amount?: number | string; compliance_status?: string } | null;

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">FCCPC Complaint Detail & Enforcement</h1>
      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Enforcement action recorded.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border bg-white p-4 md:col-span-2">
          <h2 className="font-semibold">Complaint Summary</h2>
          <p className="mt-2 text-sm">{complaint.summary}</p>
          <p className="mt-2 text-sm text-slate-600">{complaint.description}</p>
          <p className="mt-3 text-xs text-slate-500">Severity: {complaint.severity} • Status: {complaint.status}</p>
          <p className="mt-1 text-xs text-slate-500">Type: {complaint.complaint_type ?? "marketplace_report"} • Regulator: {(complaint.regulator_target ?? "fccpc").toUpperCase()}</p>
          <h3 className="mt-4 text-sm font-medium">Investigation notes</h3>
          <form action={enforcementAction} className="mt-2 space-y-2">
            <input type="hidden" name="complaint_id" value={complaint.id} /><input type="hidden" name="msme_id" value={complaint.msme_id ?? ""} /><input type="hidden" name="kind" value="investigation_note" />
            <textarea name="note" defaultValue={complaint.investigation_notes ?? ""} className="min-h-24 w-full rounded border p-2 text-sm" placeholder="Enter investigation observations" />
            <button className="rounded bg-slate-900 px-3 py-2 text-xs text-white">Save notes</button>
          </form>
        </article>

        <article className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Linked MSME</h2>
          <p className="mt-2 text-sm">{complaint.msmes?.business_name}</p>
          <p className="text-xs text-slate-500">{complaint.msmes?.msme_id}</p>
          <p className="text-xs text-slate-500">Provider: {provider?.display_name ?? "Not linked"}</p>
          <p className="mt-2 text-xs">Business Status: {complaint.msmes?.verification_status}</p>
          <p className="text-xs">Compliance tag: {complaint.msmes?.compliance_tag ?? "partially compliant"}</p>
          <p className="text-xs">Tax summary: {tax ? `${tax.tax_category} • Outstanding ₦${Number(tax.outstanding_amount).toLocaleString()} • ${tax.compliance_status}` : "No tax profile"}</p>
          <p className="mt-2 text-xs">Compliance profile: {compliance ? `Score ${compliance.score}/100 • ${compliance.overall_status} • ${compliance.risk_level}` : "Not available"}</p>
          <div className="mt-3 flex gap-2">
            {complaint.msmes?.flagged && <StatusBadge status="warning" label="Flagged" />}
            {complaint.msmes?.suspended && <StatusBadge status="critical" label="Suspended" />}
          </div>
        </article>
      </div>

      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["flag", "Flag business"],
          ["suspend", "Suspend business"],
          ["reinstate", "Reinstate business"],
          ["close", "Close complaint"],
        ].map(([kind, label]) => (
          <form key={kind} action={enforcementAction} className="space-y-2 rounded border p-3">
            <input type="hidden" name="complaint_id" value={complaint.id} />
            <input type="hidden" name="msme_id" value={complaint.msme_id ?? ""} />
            <input type="hidden" name="kind" value={kind} />
            <p className="text-xs font-medium">{label}</p>
            <input name="note" className="w-full rounded border px-2 py-1 text-xs" placeholder="Optional note" />
            <button className="w-full rounded bg-slate-900 px-2 py-1 text-xs text-white">Confirm</button>
          </form>
        ))}
      </div>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Complaint & Enforcement Activity</h2>
        <div className="mt-3 space-y-2 text-sm">
          {activity.length === 0 && <p className="text-slate-500">No activity logs yet.</p>}
          {activity.map((item, idx) => (
            <div key={idx} className="rounded border p-2">
              <p className="font-medium">{item.action}</p>
              <p className="text-xs text-slate-600">{new Date(item.created_at ?? Date.now()).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
