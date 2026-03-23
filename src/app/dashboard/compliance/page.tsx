import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

async function overrideAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const status = String(formData.get("override"));
  const notes = String(formData.get("notes") ?? "");
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (!["admin", "reviewer"].includes(ctx.role)) {
    redirect("/access-denied");
  }

  await supabase.from("compliance_profiles").update({ admin_override_status: status, override_notes: notes, overall_status: status, validation_overridden_at: new Date().toISOString() }).eq("id", id);
  await supabase.from("activity_logs").insert({ actor_user_id: ctx.appUserId, action: "kyc_override", entity_type: "compliance_profile", entity_id: id, metadata: { status, notes } });
  redirect("/dashboard/compliance?saved=1");
}

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (!["admin", "reviewer", "msme"].includes(ctx.role)) {
    redirect("/access-denied");
  }

  let query = supabase
    .from("compliance_profiles")
    .select("id,msme_id,overall_status,nin_status,bvn_status,cac_status,tin_status,nin_checked_at,bvn_checked_at,cac_checked_at,tin_checked_at,nin_response_summary,bvn_response_summary,cac_response_summary,tin_response_summary,admin_override_status,override_notes,validation_overridden_at,msmes(id,msme_id,business_name)")
    .order("last_reviewed_at", { ascending: false });

  if (ctx.role === "msme") query = query.eq("msme_id", ctx.linkedMsmeId ?? "");

  const { data } = await query;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{ctx.role === "msme" ? "My KYC & Compliance" : "KYC Simulation Module"}</h1>
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Override saved.</p>}
      <div className="grid gap-3">
        {(data ?? []).map((row) => (
          <article key={row.id} className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">{(row.msmes as any)?.business_name}</h2>
                <p className="text-xs text-slate-500">{(row.msmes as any)?.msme_id}</p>
              </div>
              <StatusBadge status={row.overall_status === "verified" ? "active" : row.overall_status === "failed" ? "critical" : "warning"} label={row.overall_status} />
            </div>
            <p className="mt-2 text-xs text-slate-600">NIN: {row.nin_status} ({row.nin_checked_at ? new Date(row.nin_checked_at).toLocaleString() : "pending"}) • BVN: {row.bvn_status} ({row.bvn_checked_at ? new Date(row.bvn_checked_at).toLocaleString() : "pending"}) • CAC: {row.cac_status} ({row.cac_checked_at ? new Date(row.cac_checked_at).toLocaleString() : "pending"}) • TIN: {row.tin_status} ({row.tin_checked_at ? new Date(row.tin_checked_at).toLocaleString() : "pending"})</p>
            <div className="mt-2 grid gap-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 md:grid-cols-2">
              <p>NIN service: {row.nin_response_summary ?? "NIN simulation pending response"}</p>
              <p>BVN service: {row.bvn_response_summary ?? "BVN simulation pending response"}</p>
              <p>CAC service: {row.cac_response_summary ?? "CAC simulation pending response"}</p>
              <p>TIN service: {row.tin_response_summary ?? "TIN simulation pending response"}</p>
            </div>
            {row.admin_override_status && <p className="mt-1 text-xs text-amber-700">Override: {row.admin_override_status} {row.validation_overridden_at ? `at ${new Date(row.validation_overridden_at).toLocaleString()}` : ""} {row.override_notes ? `• ${row.override_notes}` : ""}</p>}
            {ctx.role !== "msme" && (
              <form action={overrideAction} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={row.id} />
                <select name="override" className="rounded border px-2 py-1 text-sm">
                  <option value="verified">verified</option><option value="pending">pending</option><option value="failed">failed</option><option value="mismatch">mismatch</option>
                </select>
                <input name="notes" placeholder="Admin/reviewer override notes" className="min-w-72 flex-1 rounded border px-2 py-1 text-sm" />
                <Button size="sm">Apply Override</Button>
              </form>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
