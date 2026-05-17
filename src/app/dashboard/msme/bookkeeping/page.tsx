import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Download, Eye, FileText, LockKeyhole, ReceiptText, Wallet } from "lucide-react";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  assertOpenBookkeepingPeriod,
  formatNairaCompact,
  getVatAmount,
  loadBookkeepingDashboard,
  logBookkeepingDiagnostic,
  logBookkeepingEvent,
  monthStart,
  parsePeriodParam,
  periodParamFromDate,
  safeMoney,
  uploadBookkeepingAttachment,
  validateBookkeepingFile,
} from "@/lib/data/bookkeeping";

const EXPENSE_CATEGORIES = [
  "Bank charges",
  "Equipment purchase",
  "Fuel / Diesel",
  "Internet / Data",
  "Inventory",
  "Logistics / Transport",
  "Marketing / Advertising",
  "Office supplies",
  "Other expense",
  "Professional services",
  "Rent",
  "Repairs / Maintenance",
  "Software / Subscriptions",
  "Staff salaries",
  "Taxes / Levies",
  "Utilities",
].sort((a, b) => a.localeCompare(b));

const INCOME_CATEGORIES = [
  "Contract payment",
  "Grant funding",
  "Investment received",
  "Loan received",
  "Other income",
  "Retail sales",
  "Service income",
  "Transfer / Capital injection",
  "Wholesale sales",
].sort((a, b) => a.localeCompare(b));

async function createBookkeepingEntryAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const transactionDate = String(formData.get("transaction_date") ?? "").trim();
  const entryType = String(formData.get("entry_type") ?? "expense") === "income" ? "income" : "expense";
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = safeMoney(formData.get("amount"));
  const vatApplicable = String(formData.get("vat_applicable") ?? "") === "on";
  const vatAmount = getVatAmount(amount, vatApplicable, formData.get("vat_amount"));
  const evidenceFile = validateBookkeepingFile(formData.get("evidence") as File | null);

  if (!transactionDate || !category || !description || amount <= 0) {
    redirect(`/dashboard/msme/bookkeeping?period=${periodParamFromDate(monthStart())}&error=invalid_entry`);
  }

  const period = await assertOpenBookkeepingPeriod(supabase, workspace, transactionDate);
  const { data, error } = await supabase
    .from("bookkeeping_entries")
    .insert({
      msme_id: workspace.msme.id,
      provider_profile_id: workspace.provider.id,
      period_id: period.id,
      entry_type: entryType,
      category,
      amount,
      currency: "NGN",
      transaction_date: transactionDate,
      description,
      source_type: "manual",
      vat_applicable: vatApplicable,
      vat_amount: vatAmount,
      status: "posted",
      created_by: workspace.appUserId,
    })
    .select("id")
    .single();

  if (error || !data) {
    logBookkeepingDiagnostic({
      operation: "manual_entry_create_failed",
      msmeId: workspace.msme.id,
      providerId: workspace.provider.id,
      sourceType: "manual",
      code: error?.code ?? null,
      message: error?.message ?? "missing_entry_id",
    });
    redirect(`/dashboard/msme/bookkeeping?period=${periodParamFromDate(period.period_month)}&error=create_failed`);
  }

  await logBookkeepingEvent(supabase, {
    entryId: data.id,
    msmeId: workspace.msme.id,
    action: "entry_created",
    actorRole: workspace.role,
    actorId: workspace.appUserId,
    metadata: { source_type: "manual", entry_type: entryType },
  });

  if (evidenceFile) {
    await uploadBookkeepingAttachment({ supabase, workspace, entryId: data.id, file: evidenceFile, attachmentType: entryType === "income" ? "payment_evidence" : "receipt" });
  }

  revalidatePath("/dashboard/msme/bookkeeping");
  redirect(`/dashboard/msme/bookkeeping?period=${periodParamFromDate(period.period_month)}&notice=entry_saved`);
}

async function closeBookkeepingPeriodAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const periodId = String(formData.get("period_id") ?? "");
  const { data: period, error: loadError } = await supabase
    .from("bookkeeping_periods")
    .select("id,period_month,status")
    .eq("id", periodId)
    .eq("msme_id", workspace.msme.id)
    .maybeSingle();

  if (loadError || !period) {
    logBookkeepingDiagnostic({
      operation: "period_close_load_failed",
      msmeId: workspace.msme.id,
      providerId: workspace.provider.id,
      code: loadError?.code ?? null,
      message: loadError?.message ?? "period_not_found",
    });
    redirect("/dashboard/msme/bookkeeping?error=period_not_found");
  }

  if (period.status === "closed") {
    redirect(`/dashboard/msme/bookkeeping?period=${periodParamFromDate(period.period_month)}&notice=period_already_closed`);
  }

  const { error } = await supabase
    .from("bookkeeping_periods")
    .update({ status: "closed", closed_by: workspace.appUserId, closed_at: new Date().toISOString() })
    .eq("id", period.id)
    .eq("msme_id", workspace.msme.id);

  if (error) {
    logBookkeepingDiagnostic({
      operation: "period_close_failed",
      msmeId: workspace.msme.id,
      providerId: workspace.provider.id,
      code: error.code ?? null,
      message: error.message,
    });
    redirect(`/dashboard/msme/bookkeeping?period=${periodParamFromDate(period.period_month)}&error=period_close_failed`);
  }

  await logBookkeepingEvent(supabase, {
    msmeId: workspace.msme.id,
    action: "period_closed",
    actorRole: workspace.role,
    actorId: workspace.appUserId,
    metadata: { period_id: period.id, period_month: period.period_month },
  });

  revalidatePath("/dashboard/msme/bookkeeping");
  redirect(`/dashboard/msme/bookkeeping?period=${periodParamFromDate(period.period_month)}&notice=period_closed`);
}

function sourceLabel(sourceType: string) {
  if (sourceType === "payment") return "Invoice payment";
  if (sourceType === "invoice") return "Invoice";
  if (sourceType === "refund") return "Refund";
  if (sourceType === "tax") return "Tax/VAT";
  return "Manual";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function MsmeBookkeepingPage({ searchParams }: { searchParams: Promise<{ period?: string; error?: string; notice?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const selectedPeriod = parsePeriodParam(params.period);
  const { period, entries, summary } = await loadBookkeepingDashboard({ supabase, workspace, periodMonth: selectedPeriod });
  const periodParam = periodParamFromDate(period.period_month);
  const isClosed = period.status === "closed";
  const csvHref = `/api/msme/bookkeeping/export?period=${periodParam}`;

  const categoryBreakdown = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.category] = (acc[entry.category] ?? 0) + Number(entry.amount ?? 0);
    return acc;
  }, {});

  return (
    <section className="space-y-6 pb-16">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Business Management</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Bookkeeping</h1>
            <p className="mt-2 text-sm text-slate-600">Persisted financial evidence for income, expenses, VAT, and invoice-linked records.</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${isClosed ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>
            {period.status} period
          </span>
        </div>
      </div>

      {params.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Bookkeeping action failed: {params.error.replaceAll("_", " ")}.</p> : null}
      {params.notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.notice.replaceAll("_", " ")}.</p> : null}

      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="font-medium text-slate-700">Period</span>
          <input name="period" type="month" defaultValue={periodParam} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={csvHref} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Download CSV
          </a>
          <a href={`${csvHref}&report=monthly`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            <ReceiptText className="h-4 w-4" /> Monthly report
          </a>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Revenue", value: formatNairaCompact(summary.revenue) },
          { label: "Expenses", value: formatNairaCompact(summary.expenses) },
          { label: "Net profit/loss", value: formatNairaCompact(summary.net) },
          { label: "Missing evidence", value: String(summary.missingEvidence) },
          { label: "VAT tracked", value: formatNairaCompact(summary.vatTotal) },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-emerald-800">{item.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <form action={createBookkeepingEntryAction} className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${isClosed ? "opacity-70" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Add record</h2>
            {isClosed ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600"><LockKeyhole className="h-4 w-4" /> Closed</span> : null}
          </div>
          <fieldset disabled={isClosed} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Record type</span>
                <select name="entry_type" className="w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Amount</span>
                <input name="amount" type="number" min="0.01" step="0.01" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="50000" required />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Category</span>
                <select name="category" className="w-full rounded-lg border border-slate-300 px-3 py-2" required>
                  <option value="">Select category</option>
                  <optgroup label="Income">{INCOME_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</optgroup>
                  <optgroup label="Expense">{EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</optgroup>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Date</span>
                <input name="transaction_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Description / notes</span>
              <textarea name="description" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Brief details of transaction" required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" name="vat_applicable" className="h-4 w-4 rounded border-slate-300" />
                VAT applies
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">VAT amount</span>
                <input name="vat_amount" type="number" min="0" step="0.01" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Optional" />
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Receipt/evidence</span>
              <input name="evidence" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="w-full rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-2" />
            </label>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
              <Wallet className="h-4 w-4" /> Save record
            </button>
          </fieldset>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">Category summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            {Object.entries(categoryBreakdown).length === 0 ? <p className="text-slate-500">No records yet.</p> : Object.entries(categoryBreakdown).map(([category, amount]) => (
              <div key={category} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-slate-600">{category}</span>
                <span className="font-medium text-slate-900">{formatNairaCompact(amount)}</span>
              </div>
            ))}
          </div>
          <form action={closeBookkeepingPeriodAction} className="mt-5">
            <input type="hidden" name="period_id" value={period.id} />
            <button disabled={isClosed} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
              <LockKeyhole className="h-4 w-4" /> Close period
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900">Bookkeeping records</h2>
        {entries.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">No bookkeeping records yet.</div>
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-slate-600"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">VAT</th><th className="px-3 py-2">Evidence</th><th className="px-3 py-2">Actions</th></tr></thead>
                <tbody>{entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2">{formatDate(entry.transaction_date)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs ${entry.entry_type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{entry.entry_type}</span></td>
                    <td className="px-3 py-2">{entry.category}</td>
                    <td className="px-3 py-2">{sourceLabel(entry.source_type)}</td>
                    <td className="px-3 py-2 font-medium">{formatNairaCompact(entry.amount)}</td>
                    <td className="px-3 py-2">{formatNairaCompact(entry.vat_amount)}</td>
                    <td className="px-3 py-2">{entry.bookkeeping_attachments?.length ? "Attached" : "Missing"}</td>
                    <td className="px-3 py-2"><Link href={`/dashboard/msme/bookkeeping/${entry.id}`} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Eye className="h-3.5 w-3.5" />View/Edit</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 lg:hidden">{entries.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{entry.category}</p>
                  <span className={`rounded-full px-2 py-1 text-xs ${entry.entry_type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{entry.entry_type}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{sourceLabel(entry.source_type)} · {formatDate(entry.transaction_date)}</p>
                <div className="mt-3 flex items-center justify-between"><p className="font-semibold text-slate-900">{formatNairaCompact(entry.amount)}</p><p className="text-xs text-slate-600">{entry.bookkeeping_attachments?.length ? "Evidence attached" : "Evidence missing"}</p></div>
                <Link href={`/dashboard/msme/bookkeeping/${entry.id}`} className="mt-3 inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs"><FileText className="h-3.5 w-3.5" />Open</Link>
              </article>
            ))}</div>
          </>
        )}
      </div>
    </section>
  );
}
