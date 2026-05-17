import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, LockKeyhole, Save, Upload } from "lucide-react";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  assertOpenBookkeepingPeriod,
  formatNairaCompact,
  getSignedAttachmentUrl,
  getVatAmount,
  loadBookkeepingEntry,
  logBookkeepingDiagnostic,
  logBookkeepingEvent,
  periodParamFromDate,
  safeMoney,
  uploadBookkeepingAttachment,
  validateBookkeepingFile,
} from "@/lib/data/bookkeeping";

async function updateBookkeepingEntryAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const entryId = String(formData.get("entry_id") ?? "");
  const entry = await loadBookkeepingEntry({ supabase, workspace, entryId });
  const transactionDate = String(formData.get("transaction_date") ?? "").trim();
  const period = await assertOpenBookkeepingPeriod(supabase, workspace, transactionDate);

  if (entry.source_type !== "manual") {
    redirect(`/dashboard/msme/bookkeeping/${entryId}?error=source_locked`);
  }

  const entryType = String(formData.get("entry_type") ?? entry.entry_type) === "income" ? "income" : "expense";
  const amount = safeMoney(formData.get("amount"));
  const vatApplicable = String(formData.get("vat_applicable") ?? "") === "on";
  const vatAmount = getVatAmount(amount, vatApplicable, formData.get("vat_amount"));
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!transactionDate || !category || !description || amount <= 0) {
    redirect(`/dashboard/msme/bookkeeping/${entryId}?error=invalid_entry`);
  }

  const { error } = await supabase
    .from("bookkeeping_entries")
    .update({
      period_id: period.id,
      entry_type: entryType,
      category,
      amount,
      transaction_date: transactionDate,
      description,
      vat_applicable: vatApplicable,
      vat_amount: vatAmount,
      status: "posted",
    })
    .eq("id", entryId)
    .eq("msme_id", workspace.msme.id);

  if (error) {
    logBookkeepingDiagnostic({
      operation: "entry_update_failed",
      msmeId: workspace.msme.id,
      providerId: workspace.provider.id,
      entryId,
      code: error.code ?? null,
      message: error.message,
    });
    redirect(`/dashboard/msme/bookkeeping/${entryId}?error=update_failed`);
  }

  await logBookkeepingEvent(supabase, {
    entryId,
    msmeId: workspace.msme.id,
    action: "entry_updated",
    actorRole: workspace.role,
    actorId: workspace.appUserId,
    metadata: { source_type: entry.source_type },
  });

  revalidatePath("/dashboard/msme/bookkeeping");
  revalidatePath(`/dashboard/msme/bookkeeping/${entryId}`);
  redirect(`/dashboard/msme/bookkeeping/${entryId}?notice=entry_updated`);
}

async function uploadEvidenceAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const entryId = String(formData.get("entry_id") ?? "");
  const entry = await loadBookkeepingEntry({ supabase, workspace, entryId });
  await assertOpenBookkeepingPeriod(supabase, workspace, entry.transaction_date);
  const file = validateBookkeepingFile(formData.get("evidence") as File | null);
  if (!file) redirect(`/dashboard/msme/bookkeeping/${entryId}?error=missing_file`);

  await uploadBookkeepingAttachment({
    supabase,
    workspace,
    entryId,
    file,
    attachmentType: String(formData.get("attachment_type") ?? "receipt"),
  });

  revalidatePath(`/dashboard/msme/bookkeeping/${entryId}`);
  redirect(`/dashboard/msme/bookkeeping/${entryId}?notice=evidence_uploaded`);
}

async function voidEntryAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const entryId = String(formData.get("entry_id") ?? "");
  const entry = await loadBookkeepingEntry({ supabase, workspace, entryId });
  await assertOpenBookkeepingPeriod(supabase, workspace, entry.transaction_date);

  const { error } = await supabase
    .from("bookkeeping_entries")
    .update({ status: "void" })
    .eq("id", entryId)
    .eq("msme_id", workspace.msme.id);

  if (error) {
    logBookkeepingDiagnostic({
      operation: "entry_void_failed",
      msmeId: workspace.msme.id,
      providerId: workspace.provider.id,
      entryId,
      code: error.code ?? null,
      message: error.message,
    });
    redirect(`/dashboard/msme/bookkeeping/${entryId}?error=void_failed`);
  }

  await logBookkeepingEvent(supabase, {
    entryId,
    msmeId: workspace.msme.id,
    action: "entry_voided",
    actorRole: workspace.role,
    actorId: workspace.appUserId,
    metadata: { source_type: entry.source_type },
  });

  revalidatePath("/dashboard/msme/bookkeeping");
  redirect(`/dashboard/msme/bookkeeping?period=${periodParamFromDate(entry.transaction_date)}&notice=entry_voided`);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function BookkeepingEntryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { entryId } = await params;
  const query = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const entry = await loadBookkeepingEntry({ supabase, workspace, entryId });
  const period = await assertOpenBookkeepingPeriod(supabase, workspace, entry.transaction_date).catch(() => null);
  const isClosed = !period || period.status !== "open";
  const isSourceLocked = entry.source_type !== "manual";
  const attachments = entry.bookkeeping_attachments ?? [];
  const signedAttachments = await Promise.all(attachments.map(async (attachment) => ({ attachment, signedUrl: await getSignedAttachmentUrl(supabase, attachment) })));

  return (
    <section className="space-y-5 pb-16">
      <Link href={`/dashboard/msme/bookkeeping?period=${periodParamFromDate(entry.transaction_date)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" /> Back to bookkeeping
      </Link>

      {query.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Action failed: {query.error.replaceAll("_", " ")}.</p> : null}
      {query.notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.notice.replaceAll("_", " ")}.</p> : null}

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Bookkeeping Entry</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">{entry.category}</h1>
            <p className="mt-1 text-sm text-slate-600">{formatDate(entry.transaction_date)} · {entry.source_type.replaceAll("_", " ")}</p>
          </div>
          <p className="text-2xl font-black text-slate-950">{formatNairaCompact(entry.amount)}</p>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <form action={updateBookkeepingEntryAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="entry_id" value={entry.id} />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Entry details</h2>
            {(isClosed || isSourceLocked) ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600"><LockKeyhole className="h-4 w-4" /> Locked</span> : null}
          </div>
          <fieldset disabled={isClosed || isSourceLocked} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Type</span><select name="entry_type" defaultValue={entry.entry_type} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="income">Income</option><option value="expense">Expense</option></select></label>
              <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Amount</span><input name="amount" type="number" min="0.01" step="0.01" defaultValue={entry.amount} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></label>
              <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Category</span><input name="category" defaultValue={entry.category} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></label>
              <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Date</span><input name="transaction_date" type="date" defaultValue={entry.transaction_date} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></label>
            </div>
            <label className="block space-y-1 text-sm"><span className="font-medium text-slate-700">Description</span><textarea name="description" defaultValue={entry.description ?? ""} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" name="vat_applicable" defaultChecked={entry.vat_applicable} className="h-4 w-4 rounded border-slate-300" />VAT applies</label>
              <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">VAT amount</span><input name="vat_amount" type="number" min="0" step="0.01" defaultValue={entry.vat_amount} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><Save className="h-4 w-4" />Save changes</button>
          </fieldset>
          {isSourceLocked ? <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">Invoice, payment, refund, and tax-sourced entries are edited at their source record.</p> : null}
        </form>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Evidence</h2>
            <div className="mt-3 space-y-2">
              {signedAttachments.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No evidence attached.</p> : signedAttachments.map(({ attachment, signedUrl }) => (
                <div key={attachment.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{attachment.file_name}</p>
                  <p className="text-slate-500">{attachment.attachment_type.replaceAll("_", " ")} · {Math.ceil(attachment.file_size / 1024)} KB</p>
                  {signedUrl ? <a href={signedUrl} className="mt-2 inline-flex items-center gap-1 text-emerald-700 hover:underline"><Download className="h-4 w-4" />Open signed file</a> : null}
                </div>
              ))}
            </div>
            <form action={uploadEvidenceAction} className="mt-4 space-y-3">
              <input type="hidden" name="entry_id" value={entry.id} />
              <select name="attachment_type" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled={isClosed}>
                <option value="receipt">Receipt</option>
                <option value="invoice">Invoice</option>
                <option value="payment_evidence">Payment evidence</option>
                <option value="other">Other</option>
              </select>
              <input name="evidence" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="w-full rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-2 text-sm" disabled={isClosed} />
              <button disabled={isClosed} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><Upload className="h-4 w-4" />Upload evidence</button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Status</h2>
            <p className="mt-2 text-sm text-slate-600">Status: <span className="font-semibold">{entry.status}</span></p>
            <p className="mt-1 text-sm text-slate-600">Source: <span className="font-semibold">{entry.source_type}</span></p>
            <form action={voidEntryAction} className="mt-4">
              <input type="hidden" name="entry_id" value={entry.id} />
              <button disabled={isClosed} className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Void entry</button>
            </form>
          </section>
        </aside>
      </div>
    </section>
  );
}
