import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CircleDollarSign, CircleHelp, Download, FileSearch, Filter, Receipt, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

type TaxProfileRow = {
  msme_id: string;
  tax_category: string | null;
  vat_applicable: boolean | null;
  estimated_monthly_obligation: number | null;
  outstanding_amount: number | null;
  compliance_status: string | null;
  arrears_status: string | null;
  last_reviewed_at: string | null;
};

type PaymentRow = {
  id: string;
  msme_id: string;
  amount: number | null;
  status: string | null;
  tax_type: string | null;
  payment_date: string | null;
  receipt_reference: string | null;
};

type NoticeRow = {
  created_at: string;
  metadata: Record<string, unknown> | null;
  entity_id: string | null;
};

type PageParams = { receipt?: string; q?: string; status?: string; compliance?: string; taxType?: string; taxYear?: string };

async function recordPayment(formData: FormData) {
  "use server";
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();
  const msmeId = String(formData.get("msme_id"));
  const amount = Number(formData.get("amount") ?? 0);
  const receiptRef = `RCP-${Date.now()}`;

  if (!ctx || !["admin", "firs_officer", "nrs_officer", "msme"].includes(ctx.role)) redirect("/access-denied");
  if (ctx.role === "msme" && msmeId !== ctx.linkedMsmeId) redirect("/access-denied");

  await supabase.from("payments").insert({
    msme_id: msmeId,
    amount,
    tax_type: "VAT",
    status: "paid",
    receipt_reference: receiptRef,
  });
  await supabase.from("tax_profiles").update({ outstanding_amount: 0, compliance_status: "compliant", arrears_status: "none" }).eq("msme_id", msmeId);
  await supabase.from("activity_logs").insert({
    actor_user_id: ctx.appUserId,
    action: "payment_recorded",
    entity_type: "payment",
    metadata: { msmeId, amount, receiptRef },
  });

  redirect(`/dashboard/msme/payments?receipt=${receiptRef}`);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function formatTaxType(value: string | null) {
  if (!value) return "General Tax";
  return value
    .replace(/_SIM/gi, "")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusLabel(status: string | null) {
  const normalized = String(status ?? "pending").toLowerCase();
  if (normalized.includes("paid") || normalized === "none" || normalized === "compliant" || normalized.includes("settled")) {
    return { label: "Paid", className: "bg-emerald-100 text-emerald-700" };
  }
  if (normalized.includes("overdue") || normalized.includes("default")) {
    return { label: "Overdue", className: "bg-rose-100 text-rose-700" };
  }
  if (normalized.includes("relief") || normalized.includes("adjust")) {
    return { label: "Relief Applied", className: "bg-violet-100 text-violet-700" };
  }
  if (normalized.includes("due") || normalized.includes("arrears")) {
    return { label: "Due", className: "bg-amber-100 text-amber-700" };
  }
  return { label: "Pending", className: "bg-slate-100 text-slate-700" };
}

export async function TaxVatCompliancePage({ searchParams, msmeOnly = false }: { searchParams: PageParams; msmeOnly?: boolean }) {
  const params = searchParams;
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (!ctx || !["admin", "firs_officer", "nrs_officer", "msme"].includes(ctx.role)) redirect("/access-denied");
  if (msmeOnly && ctx.role !== "msme") redirect("/dashboard/payments");

  let profilesQuery = supabase
    .from("tax_profiles")
    .select("msme_id,tax_category,vat_applicable,estimated_monthly_obligation,outstanding_amount,compliance_status,arrears_status,last_reviewed_at")
    .order("outstanding_amount", { ascending: false })
    .limit(200);
  let historyQuery = supabase.from("payments").select("id,msme_id,amount,status,tax_type,payment_date,receipt_reference").order("created_at", { ascending: false }).limit(300);

  if (ctx.role === "msme") {
    profilesQuery = profilesQuery.eq("msme_id", ctx.linkedMsmeId ?? "");
    historyQuery = historyQuery.eq("msme_id", ctx.linkedMsmeId ?? "");
  }

  const [{ data: profiles }, { data: history }, { data: msmes }, { data: notices }] = await Promise.all([
    profilesQuery,
    historyQuery,
    supabase.from("msmes").select("id,msme_id,business_name,state,sector"),
    supabase.from("activity_logs").select("created_at,metadata,entity_id").eq("action", "nrs_issue_notice").order("created_at", { ascending: false }).limit(100),
  ]);

  const typedProfiles = (profiles ?? []) as TaxProfileRow[];
  const typedHistory = (history ?? []) as PaymentRow[];
  const typedNotices = (notices ?? []) as NoticeRow[];

  const msmeMap = new Map((msmes ?? []).map((row) => [row.id, row]));

  const taxYears = Array.from(
    new Set(
      typedProfiles
        .map((profile) => (profile.last_reviewed_at ? new Date(profile.last_reviewed_at).getFullYear().toString() : null))
        .filter((year): year is string => Boolean(year) && year !== "NaN"),
    ),
  ).sort((a, b) => Number(b) - Number(a));

  const taxTypes = Array.from(new Set(typedProfiles.map((profile) => profile.tax_category).filter((value): value is string => Boolean(value)))).sort();

  let rows = typedProfiles;

  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter((profile) => {
      const msme = msmeMap.get(profile.msme_id);
      const year = profile.last_reviewed_at ? new Date(profile.last_reviewed_at).getFullYear().toString() : "";
      return (
        msme?.business_name?.toLowerCase().includes(q) ||
        msme?.msme_id?.toLowerCase().includes(q) ||
        profile.tax_category?.toLowerCase().includes(q) ||
        year.includes(q)
      );
    });
  }

  if (params.status) rows = rows.filter((profile) => profile.arrears_status === params.status);
  if (params.compliance) rows = rows.filter((profile) => profile.compliance_status === params.compliance);
  if (params.taxType) rows = rows.filter((profile) => profile.tax_category === params.taxType);
  if (params.taxYear) rows = rows.filter((profile) => String(new Date(profile.last_reviewed_at ?? "").getFullYear()) === params.taxYear);

  const totalObligations = rows.reduce((sum, row) => sum + Number(row.estimated_monthly_obligation ?? 0), 0);
  const totalOutstanding = rows.reduce((sum, row) => sum + Number(row.outstanding_amount ?? 0), 0);
  const overdueCount = rows.filter((row) => row.compliance_status === "overdue" || row.arrears_status === "overdue").length;
  const compliantCount = rows.filter((row) => row.compliance_status === "compliant").length;
  const reliefAmount = rows.reduce((sum, row) => {
    const obligation = Number(row.estimated_monthly_obligation ?? 0);
    const outstanding = Number(row.outstanding_amount ?? 0);
    const diff = obligation - outstanding;
    return diff > 0 ? sum + diff : sum;
  }, 0);

  const complianceIsHealthy = totalOutstanding <= 0 && overdueCount === 0;
  const paymentsPreview = typedHistory.slice(0, 5);
  const noticesPreview = typedNotices.slice(0, 5);

  const badge = complianceIsHealthy
    ? { title: "You are Tax Compliant", body: "Great! You have no outstanding tax obligations at the moment.", className: "border-emerald-200 bg-emerald-50" }
    : {
        title: "Action required on tax compliance",
        body: `You currently have ${formatCurrency(totalOutstanding)} outstanding across ${rows.length} obligation record${rows.length === 1 ? "" : "s"}.`,
        className: "border-amber-200 bg-amber-50",
      };

  return (
    <section className="space-y-5 pb-2">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">My Tax / VAT Compliance</h1>
            <p className="mt-1 text-sm text-slate-600">View your tax obligations, payments, and compliance status.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/compliance"
              className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <FileSearch className="mr-2 h-4 w-4" />
              Tax Guide
            </Link>
            <Button className="bg-emerald-700 text-white hover:bg-emerald-800" type="button">
              <Download className="mr-2 h-4 w-4" />
              Download Tax Summary
            </Button>
          </div>
        </div>
      </header>

      {params.receipt && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Payment successful. Receipt reference: {params.receipt}</p>}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Total Obligations</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalObligations)}</p><p className="mt-1 text-xs text-slate-500">Total tax due</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Outstanding</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalOutstanding)}</p><p className="mt-1 text-xs text-slate-500">{totalOutstanding > 0 ? "Outstanding arrears require action" : "No outstanding arrears"}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Compliant</p><p className="mt-2 text-2xl font-semibold text-slate-900">{complianceIsHealthy ? "Yes" : compliantCount}</p><p className="mt-1 text-xs text-slate-500">{complianceIsHealthy ? "You are compliant" : "Compliance needs attention"}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Overdue</p><p className="mt-2 text-2xl font-semibold text-slate-900">{overdueCount}</p><p className="mt-1 text-xs text-slate-500">{overdueCount === 0 ? "No overdue amounts" : "Overdue obligations detected"}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Relief / Adjusted</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(reliefAmount)}</p><p className="mt-1 text-xs text-slate-500">After relief adjustments</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Payment History</p><p className="mt-2 text-2xl font-semibold text-slate-900">{typedHistory.length}</p><p className="mt-1 text-xs text-slate-500">Transactions</p></article>
      </div>

      <article className={`rounded-2xl border p-4 shadow-sm ${badge.className}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {complianceIsHealthy ? <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" /> : <ShieldX className="mt-0.5 h-5 w-5 text-amber-700" />}
            <div><h2 className="text-base font-semibold text-slate-900">{badge.title}</h2><p className="text-sm text-slate-700">{badge.body}</p></div>
          </div>
          <Link href="/dashboard/compliance" className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Learn more about tax compliance</Link>
        </div>
      </article>

      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="md:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Search</label><input name="q" placeholder="Search by tax type, period or reference" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue={params.q} /></div>
          <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Tax Type</label><select name="taxType" defaultValue={params.taxType ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All tax types</option>{taxTypes.map((taxType) => (<option key={taxType} value={taxType}>{formatTaxType(taxType)}</option>))}</select></div>
          <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Compliance Status</label><select name="compliance" defaultValue={params.compliance ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All statuses</option><option value="compliant">Compliant</option><option value="due">Due</option><option value="overdue">Overdue</option><option value="pending">Pending</option></select></div>
          <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Tax Year</label><select name="taxYear" defaultValue={params.taxYear ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All years</option>{taxYears.map((year) => (<option key={year} value={year}>{year}</option>))}</select></div>
          <div className="flex items-end gap-2"><Button className="flex-1 bg-emerald-700 hover:bg-emerald-800"><Filter className="mr-1.5 h-4 w-4" />Apply Filters</Button><Link href={msmeOnly ? "/dashboard/msme/payments" : "/dashboard/payments"} className="inline-flex h-10 items-center px-2 text-sm text-slate-600 hover:text-slate-800">Reset</Link></div>
        </div>
      </form>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr),minmax(320px,1fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-900">Tax Obligations</h2><p className="text-sm text-slate-600">Overview of your tax/VAT obligations.</p></div><Bell className="h-5 w-5 text-slate-400" /></div>
          {rows.length > 0 ? (
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">Tax Type</th><th className="px-3 py-2">Tax Year</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Amount (₦)</th><th className="px-3 py-2">Due Date</th><th className="px-3 py-2">Action</th></tr></thead><tbody>{rows.map((profile) => {
              const obligationStatus = statusLabel(profile.compliance_status ?? profile.arrears_status);
              const period = profile.vat_applicable ? "Monthly VAT Cycle" : "Tax Filing Cycle";
              return (
                <tr key={profile.msme_id} className="border-b border-slate-100"><td className="px-3 py-3 font-medium text-slate-700">{formatTaxType(profile.tax_category)}</td><td className="px-3 py-3 text-slate-600">{profile.last_reviewed_at ? new Date(profile.last_reviewed_at).getFullYear() : "—"}</td><td className="px-3 py-3 text-slate-600">{period}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${obligationStatus.className}`}>{obligationStatus.label}</span></td><td className="px-3 py-3 text-slate-600">{formatCurrency(Number(profile.outstanding_amount ?? 0))}</td><td className="px-3 py-3 text-slate-600">{formatDate(profile.last_reviewed_at)}</td><td className="px-3 py-3">{Number(profile.outstanding_amount ?? 0) > 0 ? (<form action={recordPayment} className="flex items-center gap-2"><input type="hidden" name="msme_id" value={profile.msme_id} /><input type="hidden" name="amount" value={Number(profile.outstanding_amount ?? 0)} /><Button size="sm" className="bg-emerald-700 hover:bg-emerald-800">Pay now</Button></form>) : (<span className="text-xs text-slate-500">No action</span>)}</td></tr>
              );
            })}</tbody></table></div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center"><Receipt className="h-12 w-12 text-slate-400" /><h3 className="mt-3 text-lg font-semibold text-slate-900">No tax obligations</h3><p className="mt-1 max-w-md text-sm text-slate-600">You have no tax obligations for the selected filters.</p><Link href={msmeOnly ? "/dashboard/msme/payments" : "/dashboard/payments"} className="mt-4 inline-flex h-10 items-center rounded-md bg-emerald-700 px-4 text-sm font-medium text-white transition hover:bg-emerald-800">View All Years</Link></div>
          )}
        </article>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-2"><div><h3 className="text-lg font-semibold text-slate-900">Recent Payments</h3><p className="text-sm text-slate-600">Your recent tax/VAT payments.</p></div><Link href={msmeOnly ? "/dashboard/msme/payments" : "/dashboard/payments"} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">View All</Link></div>
            {paymentsPreview.length > 0 ? (<div className="space-y-2">{paymentsPreview.map((payment) => {const paymentStatus = statusLabel(payment.status);return (<div key={payment.id} className="rounded-xl border border-slate-200 p-2.5"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{formatCurrency(Number(payment.amount ?? 0))}</p><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${paymentStatus.className}`}>{paymentStatus.label}</span></div><p className="text-xs text-slate-600">{formatDate(payment.payment_date)} • {formatTaxType(payment.tax_type)}</p><p className="truncate text-xs text-slate-500">Ref: {payment.receipt_reference ?? "Not available"}</p></div>);})}</div>) : (<div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center"><CircleDollarSign className="mx-auto h-9 w-9 text-slate-400" /><h4 className="mt-2 text-sm font-semibold text-slate-900">No payments yet</h4><p className="mt-1 text-xs text-slate-600">Your tax payment history will appear here once you make a payment.</p></div>)}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-lg font-semibold text-slate-900">Important Notices</h3>{noticesPreview.length > 0 ? (<div className="mt-3 space-y-2">{noticesPreview.map((notice, idx) => {const metadata = notice.metadata ?? {};const title = String(metadata.notice_type ?? "Regulatory Notice");const message = String(metadata.message ?? "Please review this notice and take action where required.");const noticeStatus = String(metadata.status ?? "Notice");return (<div key={`${notice.created_at}-${idx}`} className="rounded-xl border border-slate-200 p-2.5"><p className="text-xs font-semibold uppercase text-amber-700">{noticeStatus}</p><p className="text-sm font-semibold text-slate-900">{title}</p><p className="line-clamp-2 text-xs text-slate-600">{message}</p><p className="mt-1 text-xs text-slate-500">{formatDate(notice.created_at)}</p></div>);})}</div>) : (<div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><h4 className="text-sm font-semibold text-slate-900">No notices at the moment</h4><p className="mt-1 text-xs text-slate-600">You’re all caught up! We’ll notify you if anything requires your attention.</p></div>)}</article>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4"><h3 className="text-lg font-semibold text-slate-900">Stay Compliant</h3><ul className="mt-2 space-y-1.5 text-sm text-slate-700"><li>• File your returns on time</li><li>• Keep accurate records</li><li>• Pay outstanding obligations</li><li>• Request reliefs where eligible</li><li>• Stay updated on tax regulations</li></ul></article>
        <article className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4"><h3 className="text-lg font-semibold text-slate-900">Need Help?</h3><p className="mt-2 text-sm text-slate-700">Our support team is here to help you understand your tax obligations and compliance requirements.</p><Button className="mt-4 border border-sky-200 bg-white text-sky-700 hover:bg-sky-100" type="button"><CircleHelp className="mr-1.5 h-4 w-4" />Contact Support</Button></article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4"><h3 className="text-lg font-semibold text-slate-900">Tax Guides &amp; Resources</h3><p className="mt-2 text-sm text-slate-700">Access helpful guides, FAQs, and resources to manage your taxes with ease.</p><Link href="/dashboard/compliance" className="mt-4 inline-flex h-10 items-center rounded-md border border-amber-300 bg-white px-4 text-sm font-medium text-amber-700 transition hover:bg-amber-100">View Tax Guide</Link></article>
      </section>

      <footer className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"><p>Your tax information is secure and encrypted. We follow strict security measures to protect your data.</p></footer>
    </section>
  );
}
