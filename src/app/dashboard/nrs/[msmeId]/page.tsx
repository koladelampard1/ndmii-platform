import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

async function updateNrsAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (!["firs_officer", "nrs_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const taxId = String(formData.get("tax_id"));
  const msmeId = String(formData.get("msme_id"));
  const kind = String(formData.get("kind"));

  if (kind === "set_tax_category") {
    await supabase.from("tax_profiles").update({ tax_category: String(formData.get("tax_category")) }).eq("id", taxId);
  }
  if (kind === "apply_relief") {
    const relief = Number(formData.get("relief") ?? 0);
    const { data } = await supabase.from("tax_profiles").select("outstanding_amount").eq("id", taxId).maybeSingle();
    const outstanding = Math.max(0, Number(data?.outstanding_amount ?? 0) - relief);
    await supabase.from("tax_profiles").update({ outstanding_amount: outstanding, compliance_status: "partially compliant" }).eq("id", taxId);
  }
  if (kind === "adjust_arrears") {
    await supabase.from("tax_profiles").update({ outstanding_amount: Number(formData.get("outstanding_amount") ?? 0), arrears_status: String(formData.get("arrears_status") ?? "none") }).eq("id", taxId);
  }
  if (kind === "set_status") {
    await supabase
      .from("tax_profiles")
      .update({ compliance_status: String(formData.get("status")), last_reviewed_at: new Date().toISOString() })
      .eq("id", taxId);
  }
  if (kind === "issue_notice") {
    await supabase.from("activity_logs").insert({
      actor_user_id: ctx.appUserId,
      action: "nrs_issue_notice",
      entity_type: "tax_profile",
      entity_id: taxId,
      metadata: { notice_type: String(formData.get("notice_type") ?? "general"), message: String(formData.get("message") ?? "") },
    });
  }

  await supabase.from("activity_logs").insert({
    actor_user_id: ctx.appUserId,
    action: `nrs_${kind}`,
    entity_type: "tax_profile",
    entity_id: taxId,
    metadata: { msmeId },
  });

  redirect(`/dashboard/nrs/${msmeId}?saved=${kind}`);
}

export default async function NrsTaxDetailPage({ params, searchParams }: { params: Promise<{ msmeId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { msmeId } = await params;
  const query = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["firs_officer", "nrs_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const { data: msme } = await supabase.from("msmes").select("id,msme_id,business_name,state,sector").eq("msme_id", msmeId).maybeSingle();
  if (!msme) return <div className="rounded border bg-white p-6">MSME tax record not found.</div>;

  const [{ data: tax }, { data: payments }] = await Promise.all([
    supabase.from("tax_profiles").select("id,tax_category,vat_applicable,estimated_monthly_obligation,outstanding_amount,compliance_score,compliance_status,arrears_status").eq("msme_id", msme.id).maybeSingle(),
    supabase.from("payments").select("amount,tax_type,status,payment_date,receipt_reference").eq("msme_id", msme.id).order("payment_date", { ascending: false }),
  ]);

  if (!tax) return <div className="rounded border bg-white p-6">No tax profile has been generated for this MSME.</div>;

  const { data: logs } = await supabase
    .from("activity_logs")
    .select("action,created_at,metadata")
    .eq("entity_type", "tax_profile")
    .eq("entity_id", tax.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">NRS Tax Profile Detail</h1>
      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Action completed: {query.saved}</p>}
      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">{msme.business_name}</h2>
        <p className="text-xs text-slate-500">{msme.msme_id} • {msme.state} • {msme.sector}</p>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
          <p><strong>Tax category:</strong> {tax.tax_category}</p>
          <p><strong>Outstanding balance:</strong> ₦{Number(tax.outstanding_amount).toLocaleString()}</p>
          <p><strong>Compliance status:</strong> {tax.compliance_status}</p>
        </div>
      </article>

      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
        <form action={updateNrsAction} className="space-y-2 rounded border p-3">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="set_tax_category" />
          <p className="text-xs font-medium">Set tax category</p>
          <input name="tax_category" defaultValue={tax.tax_category} className="w-full rounded border px-2 py-1 text-xs" />
          <button className="w-full rounded bg-emerald-800 px-2 py-1 text-xs text-white">Save</button>
        </form>
        <form action={updateNrsAction} className="space-y-2 rounded border p-3">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="apply_relief" />
          <p className="text-xs font-medium">Apply tax relief</p>
          <input name="relief" type="number" defaultValue="5000" className="w-full rounded border px-2 py-1 text-xs" />
          <button className="w-full rounded bg-emerald-800 px-2 py-1 text-xs text-white">Apply</button>
        </form>
        <form action={updateNrsAction} className="space-y-2 rounded border p-3">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="adjust_arrears" />
          <p className="text-xs font-medium">Add/adjust arrears</p>
          <input name="outstanding_amount" type="number" defaultValue={tax.outstanding_amount} className="w-full rounded border px-2 py-1 text-xs" />
          <select name="arrears_status" className="w-full rounded border px-2 py-1 text-xs"><option>none</option><option>low</option><option>medium</option><option>high</option></select>
          <button className="w-full rounded bg-emerald-800 px-2 py-1 text-xs text-white">Update</button>
        </form>
        <form action={updateNrsAction} className="space-y-2 rounded border p-3">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="set_status" />
          <p className="text-xs font-medium">Compliance state</p>
          <select name="status" className="w-full rounded border px-2 py-1 text-xs"><option>compliant</option><option>overdue</option><option>under review</option><option>partially compliant</option></select>
          <button className="w-full rounded bg-emerald-800 px-2 py-1 text-xs text-white">Mark status</button>
        </form>
      </div>

      <form action={updateNrsAction} className="space-y-2 rounded-xl border bg-white p-4">
        <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="issue_notice" />
        <p className="text-sm font-medium">Issue simulated notice</p>
        <div className="grid gap-2 md:grid-cols-4">
          <input name="notice_type" placeholder="Notice type" className="rounded border px-2 py-2 text-sm" defaultValue="compliance_reminder" />
          <input name="message" placeholder="Notice message" className="rounded border px-2 py-2 text-sm md:col-span-2" />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Issue notice</button>
        </div>
      </form>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Payment ledger / history</h2>
        <div className="mt-2 space-y-2 text-sm">
          {(payments ?? []).length === 0 && <p className="text-slate-500">No payment receipts recorded.</p>}
          {(payments ?? []).map((payment, idx) => (
            <div key={idx} className="rounded border p-2">{payment.payment_date}: ₦{Number(payment.amount).toLocaleString()} • {payment.tax_type} • {payment.status} • Receipt {payment.receipt_reference ?? "N/A"}</div>
          ))}
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Recent operations</h2>
        <div className="mt-2 space-y-2 text-sm">{(logs ?? []).map((log, idx) => <div key={idx} className="rounded border p-2">{log.action} • {new Date(log.created_at).toLocaleString()}</div>)}</div>
      </article>
    </section>
  );
}
