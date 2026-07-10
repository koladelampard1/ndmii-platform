import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, BookOpenCheck, BriefcaseBusiness, Building2, ClipboardCheck, FileText, Landmark, QrCode, ReceiptText, ShieldCheck, TrendingUp } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { demoDisclosure, formatNrsStatus, requireNrsWorkspace } from "@/lib/nrs/access";
import { formatNaira } from "@/lib/data/invoicing";

function opportunityBand(score: number) {
  if (score >= 80) return "Very High";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

async function updateNrsAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  requireNrsWorkspace(ctx);

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
  requireNrsWorkspace(ctx);

  const supabase = await createServerSupabaseClient();
  const { data: msme } = await supabase.from("msmes").select("id,msme_id,business_name,state,lga,sector,verification_status,tin").eq("msme_id", msmeId).maybeSingle();
  if (!msme) return <div className="rounded border bg-white p-6">MSME tax record not found.</div>;

  const [{ data: tax }, { data: payments }, { data: vatRules }, { data: invoices }, { data: complianceProfile }, { data: complianceItems }] = await Promise.all([
    supabase.from("tax_profiles").select("id,tax_category,vat_applicable,estimated_monthly_obligation,outstanding_amount,compliance_score,compliance_status,arrears_status").eq("msme_id", msme.id).maybeSingle(),
    supabase.from("payments").select("amount,tax_type,status,payment_date,receipt_reference").eq("msme_id", msme.id).order("payment_date", { ascending: false }),
    supabase.from("vat_rules").select("id,category,vat_percent,applies_to,status,notes").order("updated_at", { ascending: false }),
    supabase.from("invoices").select("id,invoice_number,status,total_amount,vat_amount,created_at").eq("msme_id", msme.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("msme_compliance_profiles").select("overall_status,compliance_score,risk_level,next_deadline_at").eq("msme_id", msme.id).maybeSingle(),
    supabase.from("msme_compliance_items").select("id,status,updated_at,compliance_requirement_definitions(title,category),compliance_regulators(code)").eq("msme_id", msme.id).order("updated_at", { ascending: false }).limit(8),
  ]);

  if (!tax) return <div className="rounded border bg-white p-6">No tax profile has been generated for this MSME.</div>;

  const { data: logs } = await supabase
    .from("activity_logs")
    .select("action,created_at,metadata")
    .eq("entity_type", "tax_profile")
    .eq("entity_id", tax.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const invoiceValue = (invoices ?? []).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const vatExposure = (invoices ?? []).reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);
  const paidInvoiceValue = (invoices ?? []).filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const complianceScore = Number(tax.compliance_score ?? complianceProfile?.compliance_score ?? 0);
  const opportunityScore = Math.min(100, Math.round((invoiceValue > 0 ? 35 : 0) + (vatExposure > 0 ? 20 : 0) + (msme.verification_status === "verified" ? 15 : 0) + (msme.tin ? 15 : 0) + Math.min(15, complianceScore / 7)));
  const revenueOpportunity = opportunityBand(opportunityScore);
  const journeyStages = [
    { label: "Discovery", done: true, icon: Building2 },
    { label: "Registration", done: Boolean(msme.msme_id), icon: FileText },
    { label: "BIN Issued", done: Boolean(msme.msme_id), icon: BadgeCheck },
    { label: "Identity Verified", done: msme.verification_status === "verified", icon: ShieldCheck },
    { label: "TIN Ready", done: Boolean(msme.tin), icon: Landmark },
    { label: "Business Structured", done: Boolean(tax.tax_category), icon: BriefcaseBusiness },
    { label: "Digital Bookkeeping", done: (payments ?? []).length > 0 || (invoices ?? []).length > 0, icon: BookOpenCheck },
    { label: "Invoices Active", done: (invoices ?? []).length > 0, icon: ReceiptText },
    { label: "Compliance Ready", done: String(tax.compliance_status ?? complianceProfile?.overall_status ?? "").includes("compliant"), icon: ClipboardCheck },
    { label: "Tax Ready", done: Boolean(msme.tin) && String(tax.compliance_status ?? "").includes("compliant"), icon: Landmark },
    { label: "Growth Journey", done: invoiceValue > 0 && complianceScore >= 70, icon: TrendingUp },
  ];
  const firstIncompleteIndex = journeyStages.findIndex((stage) => !stage.done);

  return (
    <section className="space-y-5">
      <header className="rounded-3xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Nigeria Revenue Service • Business Profile</p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_180px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{msme.business_name}</h1>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700">{msme.verification_status === "verified" ? "DBIN Verified" : "Verification Pending"}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">BIN {msme.msme_id} • {msme.state}{msme.lga ? ` / ${msme.lga}` : ""} • {msme.sector}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["BIN", msme.msme_id ?? "Pending"],
                ["TIN Linkage", msme.tin ? "Available" : "Pending"],
                ["Compliance Status", formatNrsStatus(tax.compliance_status)],
                ["Trust Score", complianceScore ? `${complianceScore}/100` : "Pending"],
                ["Revenue Opportunity", revenueOpportunity],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
                  <p className="mt-1 text-base font-semibold capitalize text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-3xl border bg-slate-950 p-4 text-white">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white text-slate-950">
              <QrCode className="h-14 w-14" />
            </div>
            <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-emerald-200">QR Verification</p>
            <p className="mt-1 text-center text-[11px] text-slate-300">Linked to DBIN public verification infrastructure</p>
          </div>
        </div>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{demoDisclosure()}</p>
      </header>
      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Action completed: {query.saved}</p>}

      <article className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Formalisation Journey</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">From discovery to growth readiness</h2>
            <p className="mt-1 text-sm text-slate-600">Progress is computed from existing DBIN identity, invoice, payment and compliance records. No progress is fabricated.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Derived Insight</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {journeyStages.map((stage, index) => {
            const isCurrent = firstIncompleteIndex === index;
            const Icon = stage.icon;
            return (
              <div key={stage.label} className={`rounded-2xl border p-3 ${stage.done ? "border-emerald-200 bg-emerald-50" : isCurrent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2">
                  <span className={`rounded-xl p-2 ${stage.done ? "bg-emerald-600 text-white" : isCurrent ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}><Icon className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{stage.label}</p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">{stage.done ? "Completed" : isCurrent ? "Current" : "Future"}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["TIN linkage", msme.tin ? "Available" : "Pending", "Pending NRS Integration"],
          ["Tax category", formatNrsStatus(tax.tax_category), "DBIN readiness"],
          ["Compliance status", formatNrsStatus(tax.compliance_status), "Evidence-based"],
          ["Outstanding obligations", formatNaira(tax.outstanding_amount), "DBIN Derived"],
          ["Invoice activity", (invoices ?? []).length.toLocaleString("en-NG"), "DBIN invoices"],
          ["Invoice value", formatNaira(invoiceValue), "DBIN Derived"],
          ["Paid invoice value", formatNaira(paidInvoiceValue), "DBIN Derived"],
          ["VAT exposure", formatNaira(vatExposure), "Invoice-derived, not remittance"],
          ["Compliance score", `${tax.compliance_score ?? complianceProfile?.compliance_score ?? "Unavailable"}`, "Demonstration Data"],
          ["Risk level", formatNrsStatus(complianceProfile?.risk_level), "Evidence-based compliance"],
        ].map(([label, value, tag]) => (
          <article key={label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-semibold capitalize text-slate-950">{value}</p>
            <p className="mt-1 text-[11px] text-emerald-700">{tag}</p>
          </article>
        ))}
      </div>

      <details className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Administrative adjustment tools</summary>
        <p className="mt-1 text-xs text-slate-500">For controlled demo operations only. These actions adjust DBIN demonstration records, not official statutory NRS accounts.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
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
      </details>

      <div className="grid gap-3 lg:grid-cols-2">
        <form action={updateNrsAction} className="space-y-2 rounded-xl border bg-white p-4">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="issue_notice" />
          <p className="text-sm font-medium">Issue Compliance Notice</p>
          <p className="text-xs text-slate-500">Delivery is simulated in this demonstration environment.</p>
          <div className="grid gap-2 md:grid-cols-4">
            <input name="notice_type" placeholder="Notice type" className="rounded border px-2 py-2 text-sm" defaultValue="compliance_reminder" />
            <input name="message" placeholder="Notice message" className="rounded border px-2 py-2 text-sm md:col-span-2" />
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Issue notice</button>
          </div>
        </form>

        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">VAT rule maintenance</summary>
        <form action={updateNrsAction} className="mt-3 space-y-2">
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
        </details>
      </div>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Invoice and VAT activity</h2>
        <p className="mt-1 text-xs text-slate-500">DBIN invoice-derived exposure only. Not official statutory VAT remittance.</p>
        <div className="mt-3 space-y-2 text-sm">
          {(invoices ?? []).length === 0 && <p className="rounded border border-dashed p-4 text-slate-500">No invoice activity has been recorded for this taxpayer.</p>}
          {(invoices ?? []).map((invoice) => (
            <div key={invoice.id} className="flex flex-wrap justify-between gap-2 rounded border p-3">
              <span className="font-medium">{invoice.invoice_number}</span>
              <span>{formatNaira(invoice.total_amount)} • VAT {formatNaira(invoice.vat_amount)} • {formatNrsStatus(invoice.status)}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Compliance review state</h2>
        <div className="mt-3 space-y-2 text-sm">
          {(complianceItems ?? []).length === 0 && <p className="rounded border border-dashed p-4 text-slate-500">No compliance requirements are currently visible for this taxpayer.</p>}
          {(complianceItems ?? []).map((item: any) => {
            const req = Array.isArray(item.compliance_requirement_definitions) ? item.compliance_requirement_definitions[0] : item.compliance_requirement_definitions;
            const regulator = Array.isArray(item.compliance_regulators) ? item.compliance_regulators[0] : item.compliance_regulators;
            return <div key={item.id} className="rounded border p-3"><p className="font-medium">{req?.title ?? "Compliance requirement"} <span className="text-xs text-slate-500">({regulator?.code ?? "N/A"})</span></p><p className="text-slate-600 capitalize">{formatNrsStatus(item.status)}</p></div>;
          })}
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Recommended next actions</h2>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          {[
            !msme.tin ? "Prioritise TIN linkage once NRS integration is activated." : null,
            (invoices ?? []).length === 0 ? "Enable digital invoicing to improve transaction visibility." : null,
            !String(tax.compliance_status ?? "").includes("compliant") ? "Request or review compliance evidence before marking tax-ready." : null,
            Number(tax.outstanding_amount ?? 0) > 0 ? "Follow up outstanding exposure through a compliance notice." : null,
            revenueOpportunity === "Very High" || revenueOpportunity === "High" ? "Consider this business for structured growth and investment-readiness support." : null,
            "Maintain monitoring through DBIN identity, invoice and compliance signals.",
          ].filter(Boolean).map((item) => (
            <p key={item} className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-emerald-950">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{item}</span>
            </p>
          ))}
        </div>
      </article>

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
