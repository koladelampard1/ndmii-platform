import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { generateMsmeId } from "@/lib/data/ndmii";

async function reviewAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const note = String(formData.get("note") ?? "");

  const supabase = await createServerSupabaseClient();
  const { profile } = await getCurrentUserContext();
  const { data: msme } = await supabase.from("msmes").select("state,msme_id").eq("id", id).single();
  const update: Record<string, unknown> = {
    reviewer_notes: note,
    reviewed_at: new Date().toISOString(),
  };

  if (action === "approve") {
    update.verification_status = "verified";
    update.issued_at = new Date().toISOString();
    update.msme_id = msme?.msme_id?.startsWith("NDMII-") ? msme.msme_id : generateMsmeId(msme?.state ?? "LAG");
    await supabase.from("compliance_profiles").update({ overall_status: "verified", admin_override_status: "verified" }).eq("msme_id", id);
    await supabase.from("tax_profiles").upsert({ msme_id: id, tax_category: "SME_STANDARD", vat_applicable: true, estimated_monthly_obligation: 125000, outstanding_amount: 0, compliance_status: "compliant" }, { onConflict: "msme_id" });
  }
  if (action === "reject") {
    update.verification_status = "rejected";
  }
  if (action === "changes") {
    update.verification_status = "changes_requested";
  }

  await supabase.from("msmes").update(update).eq("id", id);
  await supabase.from("activity_logs").insert({
    actor_user_id: profile?.id,
    action: `review_${action}`,
    entity_type: "msme",
    entity_id: id,
    metadata: { note },
  });

  redirect("/dashboard/reviews?done=1");
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; sector?: string; status?: string; done?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("msmes")
    .select("id,msme_id,business_name,state,sector,verification_status,created_at")
    .in("verification_status", ["pending", "pending_review", "changes_requested"])
    .order("created_at", { ascending: false });

  if (params.state) query = query.eq("state", params.state);
  if (params.sector) query = query.eq("sector", params.sector);
  if (params.status) query = query.eq("verification_status", params.status);

  const { data: rows } = await query;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Reviewer Queue</h1>
      {params.done && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Action recorded.</p>}
      <form className="grid gap-2 rounded-lg border bg-white p-3 md:grid-cols-4">
        <input name="state" placeholder="Filter by state" className="rounded border px-3 py-2" defaultValue={params.state} />
        <input name="sector" placeholder="Filter by sector" className="rounded border px-3 py-2" defaultValue={params.sector} />
        <input name="status" placeholder="Filter by status" className="rounded border px-3 py-2" defaultValue={params.status} />
        <Button>Apply Filters</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">MSME</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Sector</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length === 0 && (
              <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={5}>No pending submissions match the selected filters.</td></tr>
            )}
            {(rows ?? []).map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-2"><p className="font-semibold">{row.business_name}</p><p className="text-xs text-slate-500">{row.msme_id}</p></td>
                <td className="px-3 py-2">{row.state}</td>
                <td className="px-3 py-2">{row.sector}</td>
                <td className="px-3 py-2"><StatusBadge status={row.verification_status.includes("pending") ? "warning" : "active"} label={row.verification_status} /></td>
                <td className="px-3 py-2">
                  <form action={reviewAction} className="space-y-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input name="note" placeholder="Reviewer note" className="w-full rounded border px-2 py-1 text-xs" />
                    <div className="flex gap-1">
                      <Button size="sm" name="action" value="approve">Approve</Button>
                      <Button size="sm" variant="secondary" name="action" value="changes">Request changes</Button>
                      <Button size="sm" variant="secondary" name="action" value="reject">Reject</Button>
                    </div>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
