import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { supabase } from "@/lib/supabase/client";

async function overrideAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const status = String(formData.get("override"));
  const notes = String(formData.get("notes") ?? "");

  await supabase.from("compliance_profiles").update({ admin_override_status: status, override_notes: notes, overall_status: status }).eq("id", id);
  await supabase.from("activity_logs").insert({ action: "kyc_override", entity_type: "compliance_profile", entity_id: id, metadata: { status, notes } });
  redirect("/dashboard/compliance?saved=1");
}

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const { data } = await supabase
    .from("compliance_profiles")
    .select("id,overall_status,nin_status,bvn_status,cac_status,tin_status,admin_override_status,msmes(msme_id,business_name)")
    .order("last_reviewed_at", { ascending: false });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">KYC Simulation Module</h1>
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Override saved.</p>}
      <div className="grid gap-3">
        {(data ?? []).map((row) => (
          <article key={row.id} className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">{row.msmes?.business_name}</h2>
                <p className="text-xs text-slate-500">{row.msmes?.msme_id}</p>
              </div>
              <StatusBadge status={row.overall_status === "verified" ? "active" : row.overall_status === "failed" ? "critical" : "warning"} label={row.overall_status} />
            </div>
            <p className="mt-2 text-xs text-slate-600">NIN: {row.nin_status} • BVN: {row.bvn_status} • CAC: {row.cac_status} • TIN: {row.tin_status}</p>
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
