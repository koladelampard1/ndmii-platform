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
  if (kind === "create_vat_rule") {
    await supabase.from("vat_rules").insert({
      category: String(formData.get("category") ?? "General goods"),
      vat_percent: Number(formData.get("vat_percent") ?? 7.5),
      applies_to: String(formData.get("applies_to") ?? "service"),
      status: String(formData.get("vat_status") ?? "active"),
      notes: String(formData.get("notes") ?? ""),
      updated_at: new Date().toISOString(),
    });
  }
  if (kind === "edit_vat_rule") {
    await supabase.from("vat_rules").update({
      category: String(formData.get("category") ?? "General goods"),
      vat_percent: Number(formData.get("vat_percent") ?? 7.5),
      applies_to: String(formData.get("applies_to") ?? "service"),
      notes: String(formData.get("notes") ?? ""),
      updated_at: new Date().toISOString(),
    }).eq("id", String(formData.get("vat_rule_id") ?? ""));
  }
  if (kind === "set_vat_rule_status") {
    await supabase.from("vat_rules").update({
      status: String(formData.get("vat_status") ?? "active"),
      updated_at: new Date().toISOString(),
    }).eq("id", String(formData.get("vat_rule_id") ?? ""));
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

  const [{ data: tax }, { data: payments }, { data: vatRules }] = await Promise.all([
    supabase.from("tax_profiles").select("id,tax_category,vat_applicable,estimated_monthly_obligation,outstanding_amount,compliance_score,compliance_status,arrears_status").eq("msme_id", msme.id).maybeSingle(),
    supabase.from("payments").select("amount,tax_type,status,payment_date,receipt_reference").eq("msme_id", msme.id).order("payment_date", { ascending: false }),
    supabase.from("vat_rules").select("id,category,vat_percent,applies_to,status,notes").order("updated_at", { ascending: false }),
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
          <select name="arrears_status" defaultValue={tax.arrears_status} className="w-full rounded border px-2 py-1 text-xs"><option>none</option><option>low</option><option>medium</option><option>high</option></select>
          <button className="w-full rounded bg-emerald-800 px-2 py-1 text-xs text-white">Update</button>
        </form>
        <form action={updateNrsAction} className="space-y-2 rounded border p-3">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="set_status" />
          <p className="text-xs font-medium">Compliance state</p>
          <select name="status" defaultValue={tax.compliance_status} className="w-full rounded border px-2 py-1 text-xs"><option>compliant</option><option>overdue</option><option>under review</option><option>partially compliant</option></select>
          <button className="w-full rounded bg-emerald-800 px-2 py-1 text-xs text-white">Mark status</button>
        </form>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <form action={updateNrsAction} className="space-y-2 rounded-xl border bg-white p-4">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="issue_notice" />
          <p className="text-sm font-medium">Issue simulated notice</p>
          <div className="grid gap-2 md:grid-cols-4">
            <input name="notice_type" placeholder="Notice type" className="rounded border px-2 py-2 text-sm" defaultValue="compliance_reminder" />
            <input name="message" placeholder="Notice message" className="rounded border px-2 py-2 text-sm md:col-span-2" />
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Issue notice</button>
          </div>
        </form>

        <form action={updateNrsAction} className="space-y-2 rounded-xl border bg-white p-4">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="create_vat_rule" />
          <p className="text-sm font-medium">Create VAT rule</p>
          <div className="grid gap-2 md:grid-cols-2">
            <input name="category" placeholder="Category name" className="rounded border px-2 py-2 text-sm" required />
            <input name="vat_percent" type="number" step="0.01" defaultValue="7.50" className="rounded border px-2 py-2 text-sm" required />
            <select name="applies_to" className="rounded border px-2 py-2 text-sm"><option value="product">product</option><option value="service">service</option><option value="mixed">mixed</option></select>
            <select name="vat_status" className="rounded border px-2 py-2 text-sm"><option value="active">active</option><option value="inactive">inactive</option></select>
            <input name="notes" placeholder="Notes" className="rounded border px-2 py-2 text-sm md:col-span-2" />
          </div>
          <button className="rounded bg-emerald-800 px-3 py-2 text-sm text-white">Create VAT rule</button>
        </form>
      </div>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">VAT rules visible to MSMEs</h2>
        <div className="mt-2 space-y-2 text-sm">
          {(vatRules ?? []).map((rule) => (
            <div key={rule.id} className="rounded border p-3">
              <form action={updateNrsAction} className="grid gap-2 md:grid-cols-6">
                <input type="hidden" name="tax_id" value={tax.id} />
                <input type="hidden" name="msme_id" value={msme.msme_id} />
                <input type="hidden" name="kind" value="edit_vat_rule" />
                <input type="hidden" name="vat_rule_id" value={rule.id} />
                <input name="category" defaultValue={rule.category} className="rounded border px-2 py-1 text-xs md:col-span-2" />
                <input name="vat_percent" type="number" step="0.01" defaultValue={rule.vat_percent} className="rounded border px-2 py-1 text-xs" />
                <select name="applies_to" defaultValue={rule.applies_to} className="rounded border px-2 py-1 text-xs"><option value="product">product</option><option value="service">service</option><option value="mixed">mixed</option></select>
                <input name="notes" defaultValue={rule.notes ?? ""} placeholder="Notes" className="rounded border px-2 py-1 text-xs" />
                <button className="rounded bg-slate-900 px-2 py-1 text-xs text-white">Save</button>
              </form>
              <form action={updateNrsAction} className="mt-2 flex gap-2">
                <input type="hidden" name="tax_id" value={tax.id} />
                <input type="hidden" name="msme_id" value={msme.msme_id} />
                <input type="hidden" name="kind" value="set_vat_rule_status" />
                <input type="hidden" name="vat_rule_id" value={rule.id} />
                <input type="hidden" name="vat_status" value="active" />
                <button className="rounded border border-emerald-600 px-2 py-1 text-xs text-emerald-700">Activate</button>
              </form>
              <form action={updateNrsAction} className="mt-2 flex gap-2">
                <input type="hidden" name="tax_id" value={tax.id} />
                <input type="hidden" name="msme_id" value={msme.msme_id} />
                <input type="hidden" name="kind" value="set_vat_rule_status" />
                <input type="hidden" name="vat_rule_id" value={rule.id} />
                <input type="hidden" name="vat_status" value="inactive" />
                <button className="rounded border border-rose-500 px-2 py-1 text-xs text-rose-700">Deactivate</button>
              </form>
              <p className="mt-1 text-xs text-slate-500">Current status: {rule.status}</p>
            </div>
          ))}
        </div>
      </article>

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
