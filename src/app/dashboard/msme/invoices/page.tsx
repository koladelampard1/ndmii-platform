import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, FileText, Search, TriangleAlert } from "lucide-react";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/data/invoicing";
import { getTableColumns, normalizeInvoiceStatus, pickExistingColumns } from "@/lib/data/commercial-ops";

type PageParams = {
  status?: string;
  q?: string;
  customer?: string;
  date?: string;
  sort?: string;
  tab?: string;
};

type EnrichedInvoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  due_date: string | null;
  total_amount: number;
  status: string;
  created_at: string | null;
};

const SORT_OPTIONS = ["newest", "oldest", "amount_high", "amount_low"] as const;
const DATE_OPTIONS = ["all", "7d", "30d", "90d"] as const;
const TAB_OPTIONS = ["all", "draft", "outstanding", "overdue", "paid", "cancelled"] as const;

function parseSafeOption<T extends readonly string[]>(value: string | undefined, options: T, fallback: T[number]) {
  return (value && options.includes(value) ? value : fallback) as T[number];
}

function formatDateSafe(value: string | null | undefined, fallback = "Date unavailable") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTimeSafe(value: string | null | undefined, fallback = "Date unavailable") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusToLabel(status: string) {
  if (status === "pending_payment" || status === "issued") return "Outstanding";
  if (status === "paid") return "Paid";
  if (status === "overdue") return "Overdue";
  if (status === "cancelled") return "Cancelled";
  return "Draft";
}

function statusBadgeClasses(status: string) {
  if (status === "pending_payment" || status === "issued") return "bg-amber-100 text-amber-700";
  if (status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "overdue") return "bg-rose-100 text-rose-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function statusToTab(status: string) {
  if (status === "pending_payment" || status === "issued") return "outstanding";
  if (status === "paid") return "paid";
  if (status === "overdue") return "overdue";
  if (status === "cancelled") return "cancelled";
  return "draft";
}

function dueDateContext(dueDate: string | null | undefined) {
  if (!dueDate) return "Date unavailable";
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return "Date unavailable";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `${diffDays} days left`;
}

function createHref(params: PageParams, tab: string) {
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.status) next.set("status", params.status);
  if (params.customer) next.set("customer", params.customer);
  if (params.date && params.date !== "all") next.set("date", params.date);
  if (params.sort && params.sort !== "newest") next.set("sort", params.sort);
  if (tab !== "all") next.set("tab", tab);
  const query = next.toString();
  return `/dashboard/msme/invoices${query ? `?${query}` : ""}`;
}

export default async function MsmeInvoicesPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const invoiceColumns = await getTableColumns(supabase, "invoices");
  const invoiceSelect = pickExistingColumns(invoiceColumns, [
    "id",
    "invoice_number",
    "customer_name",
    "customer_email",
    "due_date",
    "total_amount",
    "status",
    "issued_at",
    "created_at",
    "provider_profile_id",
  ]).join(",");

  let query = supabase
    .from("invoices")
    .select(invoiceSelect || "id")
    .eq("provider_profile_id", workspace.provider.id)
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);

  const { data: invoices, error } = await query;
  if (error) throw new Error(error.message);

  const selectedDate = parseSafeOption(params.date, DATE_OPTIONS, "all");
  const selectedSort = parseSafeOption(params.sort, SORT_OPTIONS, "newest");
  const selectedTab = parseSafeOption(params.tab, TAB_OPTIONS, "all");
  const searchTerm = String(params.q ?? "").trim().toLowerCase();

  const invoiceList: EnrichedInvoice[] = (invoices ?? []).map((invoice: any) => ({
    id: String(invoice.id ?? ""),
    invoice_number: String(invoice.invoice_number ?? invoice.id ?? "N/A"),
    customer_name: String(invoice.customer_name ?? "Unknown customer"),
    customer_email: String(invoice.customer_email ?? "No email available"),
    due_date: invoice.due_date ? String(invoice.due_date) : null,
    total_amount: Number(invoice.total_amount ?? 0),
    status: normalizeInvoiceStatus(String(invoice.status ?? "draft")),
    created_at: invoice.created_at ? String(invoice.created_at) : null,
  }));

  const customerOptions = Array.from(new Set(invoiceList.map((item) => item.customer_name))).sort((a, b) => a.localeCompare(b));
  const selectedCustomer = params.customer && customerOptions.includes(params.customer) ? params.customer : "all";

  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;

  const filteredInvoices = invoiceList
    .filter((invoice) => {
      if (!searchTerm) return true;
      const haystack = [invoice.invoice_number, invoice.customer_name, invoice.customer_email, invoice.total_amount.toString()].join(" ").toLowerCase();
      return haystack.includes(searchTerm);
    })
    .filter((invoice) => (selectedCustomer === "all" ? true : invoice.customer_name === selectedCustomer))
    .filter((invoice) => (selectedTab === "all" ? true : statusToTab(invoice.status) === selectedTab))
    .filter((invoice) => {
      if (selectedDate === "all") return true;
      const stamp = new Date(String(invoice.created_at ?? "")).getTime();
      if (Number.isNaN(stamp)) return false;
      if (selectedDate === "7d") return now - stamp <= dayInMs * 7;
      if (selectedDate === "30d") return now - stamp <= dayInMs * 30;
      return now - stamp <= dayInMs * 90;
    })
    .sort((a, b) => {
      const aCreated = new Date(String(a.created_at ?? 0)).getTime();
      const bCreated = new Date(String(b.created_at ?? 0)).getTime();
      if (selectedSort === "oldest") return aCreated - bCreated;
      if (selectedSort === "amount_high") return b.total_amount - a.total_amount;
      if (selectedSort === "amount_low") return a.total_amount - b.total_amount;
      return bCreated - aCreated;
    });

  const statusCounts = {
    all: invoiceList.length,
    draft: invoiceList.filter((item) => statusToTab(item.status) === "draft").length,
    outstanding: invoiceList.filter((item) => statusToTab(item.status) === "outstanding").length,
    overdue: invoiceList.filter((item) => item.status === "overdue").length,
    paid: invoiceList.filter((item) => item.status === "paid").length,
    cancelled: invoiceList.filter((item) => item.status === "cancelled").length,
  };

  const totalOutstandingAmount = invoiceList
    .filter((item) => item.status === "overdue" || statusToTab(item.status) === "outstanding")
    .reduce((sum, item) => sum + item.total_amount, 0);

  const dueInNext7DaysCount = invoiceList.filter((item) => {
    if (!item.due_date) return false;
    const due = new Date(item.due_date);
    if (Number.isNaN(due.getTime())) return false;
    const diff = due.getTime() - now;
    return diff >= 0 && diff <= dayInMs * 7;
  }).length;

  const kpis = [
    {
      title: "Total Invoices",
      value: statusCounts.all,
      helper: "All time",
      icon: FileText,
      iconClass: "bg-emerald-100 text-emerald-700",
    },
    {
      title: "Outstanding",
      value: statusCounts.outstanding,
      helper: "Awaiting payment",
      icon: CircleDollarSign,
      iconClass: "bg-blue-100 text-blue-700",
    },
    {
      title: "Overdue",
      value: statusCounts.overdue,
      helper: "Past due date",
      icon: Clock3,
      iconClass: "bg-amber-100 text-amber-700",
    },
    {
      title: "Paid",
      value: statusCounts.paid,
      helper: "Successfully paid",
      icon: CheckCircle2,
      iconClass: "bg-emerald-100 text-emerald-700",
    },
  ];

  const tabItems: Array<{ key: (typeof TAB_OPTIONS)[number]; label: string; count: number }> = [
    { key: "all", label: "All Invoices", count: statusCounts.all },
    { key: "draft", label: "Draft", count: statusCounts.draft },
    { key: "outstanding", label: "Outstanding", count: statusCounts.outstanding },
    { key: "overdue", label: "Overdue", count: statusCounts.overdue },
    { key: "paid", label: "Paid", count: statusCounts.paid },
    { key: "cancelled", label: "Cancelled", count: statusCounts.cancelled },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-600">Create invoices, monitor payment status, and manage customer billing lifecycle.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Export Invoices
          </button>
          <Link href="/dashboard/msme/invoices/new" className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            New Invoice
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl font-semibold text-slate-900">{kpi.value.toLocaleString("en-NG")}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{kpi.title}</p>
                </div>
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${kpi.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{kpi.helper}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-12">
              <div className="relative lg:col-span-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="invoice-search"
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="Search by invoice number, customer, or amount"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none ring-emerald-200 placeholder:text-slate-400 focus:ring"
                />
              </div>

              <select name="status" defaultValue={params.status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="pending_payment">Pending Payment</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select name="customer" defaultValue={selectedCustomer} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <option value="all">All Customers</option>
                {customerOptions.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>

              <select name="date" defaultValue={selectedDate} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <option value="all">All Time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>

              <select name="sort" defaultValue={selectedSort} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="amount_high">Amount: High to low</option>
                <option value="amount_low">Amount: Low to high</option>
              </select>

              {selectedTab !== "all" && <input type="hidden" name="tab" value={selectedTab} />}

              <div className="flex items-center gap-2">
                <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  Apply
                </button>
                <Link href="/dashboard/msme/invoices" className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  Reset Filters
                </Link>
              </div>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
              {tabItems.map((tab) => {
                const isActive = selectedTab === tab.key;
                return (
                  <Link
                    key={tab.key}
                    href={createHref(params, tab.key)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{tab.count}</span>
                  </Link>
                );
              })}
            </div>

            {filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <FileText className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">No invoices yet</h2>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Create your first invoice to start tracking payments and customer billing.
                </p>
                <Link
                  href="/dashboard/msme/invoices/new"
                  className="mt-4 inline-flex items-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Create New Invoice
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="bg-slate-50/90 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Invoice</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Due Date</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => {
                      const dueHint = dueDateContext(invoice.due_date);
                      const dueHintClass =
                        dueHint === "Overdue"
                          ? "text-rose-600"
                          : dueHint === "Due tomorrow" || dueHint === "Due today"
                            ? "text-amber-600"
                            : "text-slate-500";

                      return (
                        <tr key={invoice.id} className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-900">{invoice.invoice_number}</p>
                            <p className="mt-1 text-xs text-slate-500">Created {formatDateTimeSafe(invoice.created_at)}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium text-slate-900">{invoice.customer_name}</p>
                            <p className="mt-1 text-xs text-slate-500">{invoice.customer_email}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium text-slate-900">{formatDateSafe(invoice.due_date)}</p>
                            <p className={`mt-1 text-xs ${dueHintClass}`}>{dueHint}</p>
                          </td>
                          <td className="px-4 py-4 font-semibold text-slate-900">{formatNaira(invoice.total_amount)}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(invoice.status)}`}>
                              {statusToLabel(invoice.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <Link
                              href={`/dashboard/msme/invoices/${invoice.id}`}
                              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Payment Overview</h3>
            <div className="mt-3 space-y-2">
              {[
                { label: "Paid", value: statusCounts.paid, tone: "bg-emerald-500" },
                { label: "Outstanding", value: statusCounts.outstanding, tone: "bg-amber-500" },
                { label: "Overdue", value: statusCounts.overdue, tone: "bg-rose-500" },
                { label: "Cancelled", value: statusCounts.cancelled, tone: "bg-slate-400" },
              ].map((item) => {
                const width = statusCounts.all === 0 ? 0 : Math.round((item.value / statusCounts.all) * 100);
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                      <span>{item.label}</span>
                      <span>
                        {item.value} ({width}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${item.tone}`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Outstanding Summary</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Total Outstanding Amount</dt>
                <dd className="font-semibold text-rose-600">{formatNaira(totalOutstandingAmount)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Overdue invoices</dt>
                <dd className="font-semibold text-slate-800">{statusCounts.overdue} invoices</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Due in next 7 days</dt>
                <dd className="font-semibold text-slate-800">{dueInNext7DaysCount} invoices</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Tips for Faster Payments</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />Send invoices promptly</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />Provide clear payment terms</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />Follow up before due date</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />Offer multiple payment options</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />Keep customer communication clear</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-emerald-800 bg-emerald-950 p-4 text-white shadow-sm">
            <h3 className="text-lg font-semibold">Get paid faster. Stay on track.</h3>
            <p className="mt-2 text-sm text-emerald-100">Create professional invoices and track payments with ease.</p>
            <Link
              href="/dashboard/msme/invoices/new"
              className="mt-4 inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              Create New Invoice
            </Link>
          </article>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm text-emerald-900">
          Need help with invoices? Learn how to create, send, and manage invoices effectively.
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          <CalendarDays className="h-4 w-4" />
          View Help Center
        </button>
      </div>

      {invoices && invoices.some((inv: any) => Number.isNaN(new Date(String(inv.created_at ?? "")).getTime())) && (
        <p className="inline-flex items-center gap-2 text-xs text-slate-500">
          <TriangleAlert className="h-3.5 w-3.5" /> Some records have unavailable dates and are shown safely.
        </p>
      )}
    </section>
  );
}
