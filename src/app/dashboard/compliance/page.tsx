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

  await supabase
    .from("compliance_profiles")
    .update({ admin_override_status: status, override_notes: notes, overall_status: status, validation_overridden_at: new Date().toISOString() })
    .eq("id", id);
  await supabase
    .from("activity_logs")
    .insert({ actor_user_id: ctx.appUserId, action: "kyc_override", entity_type: "compliance_profile", entity_id: id, metadata: { status, notes } });
  redirect("/dashboard/compliance?saved=1");
}

type ComplianceRecord = {
  id: string;
  msme_id: string;
  overall_status: string | null;
  nin_status: string | null;
  bvn_status: string | null;
  cac_status: string | null;
  tin_status: string | null;
  admin_override_status: string | null;
  override_notes: string | null;
  validation_overridden_at: string | null;
  msmes?: { id?: string; msme_id?: string; business_name?: string } | null;
  validation_results?: {
    nin_status?: string | null;
    bvn_status?: string | null;
    cac_status?: string | null;
    tin_status?: string | null;
    confidence_score?: number | null;
    validated_at?: string | null;
    validation_summary?: string | null;
  } | null;
};

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (ctx.role === "msme") {
    redirect("/dashboard/msme/compliance");
  }

  if (!["admin", "reviewer"].includes(ctx.role)) {
    redirect("/access-denied");
  }

  const { data } = await supabase
    .from("compliance_profiles")
    .select(
      "id,msme_id,overall_status,nin_status,bvn_status,cac_status,tin_status,nin_checked_at,bvn_checked_at,cac_checked_at,tin_checked_at,nin_response_summary,bvn_response_summary,cac_response_summary,tin_response_summary,admin_override_status,override_notes,validation_overridden_at,last_reviewed_at,created_at,updated_at,msmes(id,msme_id,business_name),validation_results(nin_status,bvn_status,cac_status,tin_status,confidence_score,validated_at,validation_summary)",
    )
    .order("last_reviewed_at", { ascending: false });

  const rows = (data ?? []) as ComplianceRecord[];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">KYC Simulation Module</h1>
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Override saved.</p>}

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-700">
            <tr>
              <th className="px-3 py-2">MSME</th>
              <th className="px-3 py-2">CAC</th>
              <th className="px-3 py-2">BVN</th>
              <th className="px-3 py-2">NIN</th>
              <th className="px-3 py-2">TIN</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const matrix = (row.validation_results as any) ?? {};
              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <p className="font-semibold">{(row.msmes as any)?.business_name}</p>
                    <p className="text-xs text-slate-500">{(row.msmes as any)?.msme_id}</p>
                    <StatusBadge status={row.overall_status === "verified" ? "active" : row.overall_status === "failed" ? "critical" : "warning"} label={row.overall_status ?? "pending"} />
                  </td>
                  <td className="px-3 py-2 capitalize">{matrix.cac_status ?? row.cac_status ?? "pending"}</td>
                  <td className="px-3 py-2 capitalize">{matrix.bvn_status ?? row.bvn_status ?? "pending"}</td>
                  <td className="px-3 py-2 capitalize">{matrix.nin_status ?? row.nin_status ?? "pending"}</td>
                  <td className="px-3 py-2 capitalize">{matrix.tin_status ?? row.tin_status ?? "pending"}</td>
                  <td className="px-3 py-2">
                    {matrix.confidence_score ?? 0}%<p className="text-xs text-slate-500">{matrix.validated_at ? new Date(matrix.validated_at).toLocaleString() : "pending"}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{matrix.validation_summary ?? "Validation simulation pending."}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">{(row.msmes as any)?.business_name}</h2>
                <p className="text-xs text-slate-500">{(row.msmes as any)?.msme_id}</p>
              </div>
              <StatusBadge status={row.overall_status === "verified" ? "active" : row.overall_status === "failed" ? "critical" : "warning"} label={row.overall_status ?? "pending"} />
            </div>
            {row.admin_override_status && (
              <p className="mt-1 text-xs text-amber-700">
                Override: {row.admin_override_status} {row.validation_overridden_at ? `at ${new Date(row.validation_overridden_at).toLocaleString()}` : ""} {row.override_notes ? `• ${row.override_notes}` : ""}
              </p>
            )}
            <form action={overrideAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={row.id} />
              <select name="override" className="rounded border px-2 py-1 text-sm">
                <option value="verified">verified</option>
                <option value="pending">pending</option>
                <option value="failed">failed</option>
                <option value="mismatch">mismatch</option>
              </select>
              <input name="notes" placeholder="Admin/reviewer override notes" className="min-w-72 flex-1 rounded border px-2 py-1 text-sm" />
              <Button size="sm">Apply Override</Button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
