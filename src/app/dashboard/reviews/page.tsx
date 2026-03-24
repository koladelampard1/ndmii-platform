import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { assertMsmeAction, requireRole } from "@/lib/data/authorization-scope";

function calculateConfidence(statuses: string[]) {
  return statuses.reduce((acc, status) => acc + (status === "verified" ? 25 : status === "mismatch" ? 10 : status === "pending" ? 5 : 0), 0);
}

async function reviewAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const note = String(formData.get("note") ?? "");

  const supabase = await createServerSupabaseClient();
  const { ctx } = await assertMsmeAction(id, action);
  const { data: msme } = await supabase.from("msmes").select("state,msme_id,nin,bvn,cac_number,tin").eq("id", id).single();
  const validation = await runKycSimulation({
    NIN: msme?.nin ?? "",
    BVN: msme?.bvn ?? "",
    CAC: msme?.cac_number ?? "",
    TIN: msme?.tin ?? "",
  });

  const nowIso = new Date().toISOString();
  const ninStatus = validation.checks.find((x) => x.provider === "NIN")?.status ?? "pending";
  const bvnStatus = validation.checks.find((x) => x.provider === "BVN")?.status ?? "pending";
  const cacStatus = validation.checks.find((x) => x.provider === "CAC")?.status ?? "pending";
  const tinStatus = validation.checks.find((x) => x.provider === "TIN")?.status ?? "pending";

  const update: Record<string, unknown> = {
    reviewer_notes: note,
    reviewed_at: nowIso,
  };

  await supabase.from("compliance_profiles").upsert({
    msme_id: id,
    overall_status: validation.overallStatus,
    nin_status: ninStatus,
    bvn_status: bvnStatus,
    cac_status: cacStatus,
    tin_status: tinStatus,
    nin_checked_at: nowIso,
    bvn_checked_at: nowIso,
    cac_checked_at: nowIso,
    tin_checked_at: nowIso,
    nin_response_summary: validation.checks.find((x) => x.provider === "NIN")?.summary ?? null,
    bvn_response_summary: validation.checks.find((x) => x.provider === "BVN")?.summary ?? null,
    cac_response_summary: validation.checks.find((x) => x.provider === "CAC")?.summary ?? null,
    tin_response_summary: validation.checks.find((x) => x.provider === "TIN")?.summary ?? null,
    last_reviewed_at: nowIso,
  }, { onConflict: "msme_id" });

  await supabase.from("validation_results").upsert({
    msme_id: id,
    nin_status: ninStatus,
    bvn_status: bvnStatus,
    cac_status: cacStatus,
    tin_status: tinStatus,
    confidence_score: calculateConfidence([ninStatus, bvnStatus, cacStatus, tinStatus]),
    validation_summary: `Review run ${validation.overallStatus}. NIN ${ninStatus}, BVN ${bvnStatus}, CAC ${cacStatus}, TIN ${tinStatus}.`,
    validated_at: nowIso,
    updated_at: nowIso,
  }, { onConflict: "msme_id" });

  if (action === "approve") {
    const ndmiiId = msme?.msme_id?.startsWith("NDMII-") ? msme.msme_id : generateMsmeId(msme?.state ?? "LAG");
    update.verification_status = "verified";
    update.review_status = "approved";
    update.compliance_tag = "fully compliant";
    update.issued_at = nowIso;
    update.msme_id = ndmiiId;
    await supabase.from("digital_ids").upsert({
      msme_id: id,
      ndmii_id: ndmiiId,
      issued_at: nowIso,
      qr_code_ref: `https://ndmii.gov.ng/verify/${ndmiiId}`,
      status: "active",
      validation_snapshot: {
        overall_status: validation.overallStatus,
        nin_status: ninStatus,
        bvn_status: bvnStatus,
        cac_status: cacStatus,
        tin_status: tinStatus,
        validated_at: nowIso,
      },
      updated_at: nowIso,
    }, { onConflict: "msme_id" });
    await supabase.from("compliance_profiles").upsert({ msme_id: id, overall_status: "verified", admin_override_status: "verified", risk_level: "low", score: 92 }, { onConflict: "msme_id" });
    await supabase.from("tax_profiles").upsert({ msme_id: id, tax_category: "SME_STANDARD", vat_applicable: true, estimated_monthly_obligation: 125000, outstanding_amount: 0, compliance_status: "compliant", last_reviewed_at: nowIso }, { onConflict: "msme_id" });
  }
  if (action === "reject") {
    update.verification_status = "rejected";
    update.review_status = "rejected";
    update.compliance_tag = "non-compliant";
    await supabase.from("digital_ids").update({ status: "revoked", updated_at: nowIso }).eq("msme_id", id);
  }
  if (action === "changes") {
    update.verification_status = "changes_requested";
    update.review_status = "changes_requested";
    await supabase.from("digital_ids").update({ status: "under_review", updated_at: nowIso }).eq("msme_id", id);
  }

  await supabase.from("msmes").update(update).eq("id", id);
  await supabase.from("activity_logs").insert({
    actor_user_id: ctx.appUserId,
    action: `review_${action}`,
    entity_type: "msme",
    entity_id: id,
    metadata: { note, resulting_status: update.verification_status },
  });

  revalidatePath("/dashboard/msme");
  revalidatePath("/dashboard/executive");
  revalidatePath("/dashboard/msme/id-card");
  revalidatePath("/dashboard/compliance");
  revalidatePath("/verify");

  redirect(`/dashboard/reviews?done=${action}`);
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; sector?: string; status?: string; done?: string }>;
}) {
  await requireRole(["reviewer", "admin"]);
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("msmes")
    .select("id,msme_id,business_name,state,sector,verification_status,review_status,created_at,validation_results(nin_status,bvn_status,cac_status,tin_status,validated_at,validation_summary,confidence_score)")
    .in("review_status", ["pending_review", "submitted", "changes_requested"])
    .order("created_at", { ascending: false });

  if (params.state) query = query.eq("state", params.state);
  if (params.sector) query = query.eq("sector", params.sector);
  if (params.status) query = query.eq("verification_status", params.status);

  const { data: rows } = await query;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Reviewer Queue</h1>
      {params.done && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Action recorded: {params.done}.</p>}
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
            {(rows ?? []).map((row) => {
              const validation = (row.validation_results as any) ?? {};
              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2"><p className="font-semibold">{row.business_name}</p><p className="text-xs text-slate-500">{row.msme_id}</p></td>
                  <td className="px-3 py-2">{row.state}</td>
                  <td className="px-3 py-2">{row.sector}</td>
                  <td className="px-3 py-2"><StatusBadge status={row.verification_status.includes("pending") ? "warning" : "active"} label={`${row.verification_status} • ${row.review_status ?? "pending_review"}`} /></td>
                  <td className="px-3 py-2">
                    <div className="mb-2 rounded border bg-slate-50 p-2 text-xs text-slate-700">
                      <p><strong>Validation panel:</strong> CAC {validation.cac_status ?? "pending"} • NIN {validation.nin_status ?? "pending"} • BVN {validation.bvn_status ?? "pending"} • TIN {validation.tin_status ?? "pending"}</p>
                      <p className="mt-1">Timestamp: {validation.validated_at ? new Date(validation.validated_at).toLocaleString() : "pending"} • Confidence: {validation.confidence_score ?? 0}%</p>
                      <p className="mt-1">Summary: {validation.validation_summary ?? "Validation simulation not run yet."}</p>
                    </div>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
