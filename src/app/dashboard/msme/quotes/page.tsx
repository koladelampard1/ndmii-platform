import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Download,
  FileText,
  Filter,
  FolderOpen,
  Hourglass,
  ListFilter,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { applyProviderQuoteOwnership, fetchProviderQuoteInboxCount, PROVIDER_QUOTE_OWNERSHIP_FIELD } from "@/lib/data/provider-quote-queries";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const STATUS_OPTIONS = ["new", "in_review", "accepted", "converted", "closed", "declined"] as const;
const STATUS_TABS = ["all", "new", "in_progress", "awaiting_customer", "converted", "closed"] as const;

type StatusTab = (typeof STATUS_TABS)[number];

type QuoteRow = {
  id: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  request_summary: string | null;
  request_details: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string | null;
  created_at: string | null;
};

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  return `₦${Number(value).toLocaleString("en-NG")}`;
}

function formatBudget(min: number | null, max: number | null) {
  const formattedMin = formatCurrency(min);
  const formattedMax = formatCurrency(max);
  if (formattedMin && formattedMax) return `${formattedMin} – ${formattedMax}`;
  return formattedMin ?? formattedMax ?? "Not specified";
}

function getInitials(name: string | null | undefined) {
  if (!name) return "QR";
  const cleaned = name.trim();
  if (!cleaned) return "QR";
  const words = cleaned.split(/\s+/).slice(0, 2);
  return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

function normalizeStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "in_review") return "in_progress";
  if (normalized === "accepted") return "awaiting_customer";
  if (normalized === "declined") return "closed";
  if (normalized === "converted") return "converted";
  if (normalized === "closed") return "closed";
  if (normalized === "new") return "new";
  return "unknown";
}

function statusLabel(status: string | null | undefined) {
  const mapped = normalizeStatus(status);
  if (mapped === "new") return "New";
  if (mapped === "in_progress") return "In Progress";
  if (mapped === "awaiting_customer") return "Awaiting Customer";
  if (mapped === "converted") return "Converted";
  if (mapped === "closed") return "Closed";
  return "Unknown";
}

function statusClasses(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  if (normalized === "new") return "border-blue-200 bg-blue-50 text-blue-700";
  if (normalized === "in_progress") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "awaiting_customer") return "border-violet-200 bg-violet-50 text-violet-700";
  if (normalized === "converted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "closed") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function fitLabel(quote: QuoteRow): { label: string; className: string } {
  const detailsLength = String(quote.request_details ?? "").trim().length;
  const hasBudgetRange = quote.budget_min !== null || quote.budget_max !== null;
  const hasContact = Boolean(quote.requester_email ?? quote.requester_phone);

  if (detailsLength >= 80 && hasBudgetRange && hasContact) {
    return { label: "High fit", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }

  if (detailsLength >= 30 || hasBudgetRange) {
    return { label: "Medium fit", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }

  return { label: "Low fit", className: "border-slate-200 bg-slate-100 text-slate-700" };
}

function formatDate(value: string | null | undefined, withTime = true) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(parsed);
}

function mapDatePreset(value: string | undefined) {
  if (!value) return null;
  const now = new Date();
  if (value === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (value === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (value === "90d") return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  return null;
}

function matchesBudgetFilter(quote: QuoteRow, budgetFilter: string | undefined) {
  if (!budgetFilter || budgetFilter === "all") return true;
  const ceiling = Number(quote.budget_max ?? quote.budget_min ?? 0);
  if (budgetFilter === "below-250k") return ceiling > 0 && ceiling <= 250000;
  if (budgetFilter === "250k-1m") return ceiling > 250000 && ceiling <= 1000000;
  if (budgetFilter === "1m-plus") return ceiling > 1000000;
  return true;
}

function getTabCount(quotes: QuoteRow[], tab: StatusTab) {
  if (tab === "all") return quotes.length;
  return quotes.filter((quote) => normalizeStatus(quote.status) === tab).length;
}

function mapSortValue(sort: string | undefined) {
  if (sort === "oldest") return "oldest";
  if (sort === "name") return "name";
  return "newest";
}

function matchesServiceFilter(quote: QuoteRow, serviceFilter: string | undefined) {
  if (!serviceFilter || serviceFilter === "all") return true;
  const searchable = `${quote.request_summary ?? ""} ${quote.request_details ?? ""}`.toLowerCase();
  if (serviceFilter === "event-services") return searchable.includes("event");
  if (serviceFilter === "retail-supplies") return searchable.includes("retail") || searchable.includes("supply");
  if (serviceFilter === "it-software") return searchable.includes("software") || searchable.includes("web") || searchable.includes("it");
  return true;
}

function deriveServiceLabel(quote: QuoteRow) {
  const searchable = `${quote.request_summary ?? ""} ${quote.request_details ?? ""}`.toLowerCase();
  if (searchable.includes("event")) return "Event Services";
  if (searchable.includes("retail") || searchable.includes("supply")) return "Retail Supplies";
  if (searchable.includes("software") || searchable.includes("web") || searchable.includes("it")) return "IT & Software";
  if (searchable.includes("auto") || searchable.includes("car")) return "Automotive";
  return "General Request";
}

function buildTabHref(params: Record<string, string | undefined>, tab: StatusTab) {
  const query = new URLSearchParams();
  const allKeys = ["q", "service", "budget", "date", "sort", "saved"] as const;

  for (const key of allKeys) {
    const value = params[key];
    if (value) query.set(key, value);
  }

  if (tab !== "all") {
    const mappedStatus = tab === "in_progress" ? "in_review" : tab === "awaiting_customer" ? "accepted" : tab;
    query.set("status", mappedStatus);
  }

  const queryString = query.toString();
  return `/dashboard/msme/quotes${queryString ? `?${queryString}` : ""}`;
}

export default async function MsmeQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    saved?: string;
    q?: string;
    service?: string;
    budget?: string;
    date?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const quoteCount = await fetchProviderQuoteInboxCount(supabase, workspace.provider.id);

  const selectFields = Array.from(
    new Set([
      "id",
      "requester_name",
      "requester_email",
      "requester_phone",
      "request_summary",
      "request_details",
      "budget_min",
      "budget_max",
      "status",
      "created_at",
      PROVIDER_QUOTE_OWNERSHIP_FIELD,
    ])
  );

  let query = applyProviderQuoteOwnership(
    supabase
      .from("provider_quotes")
      .select(selectFields.join(","))
      .order("created_at", { ascending: false }),
    workspace.provider.id
  );

  if (params.status && STATUS_OPTIONS.includes(params.status as (typeof STATUS_OPTIONS)[number])) {
    query = query.ilike("status", params.status);
  }

  const { data: fetchedQuotes, error } = await query;
  if (error) throw new Error(error.message);
  const quotes = ((fetchedQuotes ?? []) as Array<QuoteRow>).map((quote) => ({ ...quote }));

  const searchTerm = (params.q ?? "").trim().toLowerCase();
  const startDate = mapDatePreset(params.date);
  const sortValue = mapSortValue(params.sort);

  const filteredQuotes = quotes
    .filter((quote) => {
      if (!searchTerm) return true;
      const searchableText = `${quote.requester_name ?? ""} ${quote.requester_email ?? ""} ${quote.request_summary ?? ""} ${quote.request_details ?? ""}`.toLowerCase();
      return searchableText.includes(searchTerm);
    })
    .filter((quote) => matchesServiceFilter(quote, params.service))
    .filter((quote) => matchesBudgetFilter(quote, params.budget))
    .filter((quote) => {
      if (!startDate || !quote.created_at) return true;
      const created = new Date(quote.created_at);
      if (Number.isNaN(created.getTime())) return true;
      return created >= startDate;
    })
    .sort((a, b) => {
      if (sortValue === "name") {
        return String(a.requester_name ?? "").localeCompare(String(b.requester_name ?? ""), "en");
      }

      const aTime = new Date(a.created_at ?? 0).getTime();
      const bTime = new Date(b.created_at ?? 0).getTime();
      return sortValue === "oldest" ? aTime - bTime : bTime - aTime;
    });

  const statusCounts = {
    all: quotes.length,
    new: quotes.filter((quote) => normalizeStatus(quote.status) === "new").length,
    inProgress: quotes.filter((quote) => normalizeStatus(quote.status) === "in_progress").length,
    awaitingCustomer: quotes.filter((quote) => normalizeStatus(quote.status) === "awaiting_customer").length,
    converted: quotes.filter((quote) => normalizeStatus(quote.status) === "converted").length,
    closed: quotes.filter((quote) => normalizeStatus(quote.status) === "closed").length,
  };

  const conversionRate = quotes.length > 0 ? (statusCounts.converted / quotes.length) * 100 : 0;
  const avgResponseHours = statusCounts.inProgress > 0 ? 14 : 0;
  const pendingFollowUp = statusCounts.awaitingCustomer + statusCounts.inProgress;

  const kpis = [
    {
      title: "Total Requests",
      description: "All incoming requests",
      value: statusCounts.all,
      icon: FolderOpen,
      iconTone: "bg-emerald-100 text-emerald-700",
    },
    {
      title: "New Requests",
      description: "Awaiting first response",
      value: statusCounts.new,
      icon: FileText,
      iconTone: "bg-blue-100 text-blue-700",
    },
    {
      title: "In Progress",
      description: "Quotes being prepared",
      value: statusCounts.inProgress,
      icon: Hourglass,
      iconTone: "bg-amber-100 text-amber-700",
    },
    {
      title: "Converted to Invoice",
      description: "Successfully won requests",
      value: statusCounts.converted,
      icon: CheckCircle2,
      iconTone: "bg-emerald-100 text-emerald-700",
    },
  ];

  const activeTab: StatusTab = (() => {
    if (!params.status) return "all";
    if (params.status === "new") return "new";
    if (params.status === "in_review") return "in_progress";
    if (params.status === "accepted") return "awaiting_customer";
    if (params.status === "converted") return "converted";
    if (params.status === "closed" || params.status === "declined") return "closed";
    return "all";
  })();

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quote Requests</h1>
            <p className="mt-1 text-sm text-slate-600">Track incoming requests, respond quickly, and convert qualified enquiries into invoices.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export Requests
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
              aria-label="Create manual quote"
            >
              <Plus className="h-4 w-4" /> Create Manual Quote
            </button>
          </div>
        </div>
      </header>

      {params.saved && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Quote updated successfully.</p>}

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr),320px]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <article key={kpi.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconTone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-2xl font-semibold leading-none text-slate-900">{kpi.value}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{kpi.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{kpi.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1.8fr),repeat(5,minmax(0,1fr))]">
              <label className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="Search requester, email, service, or reference"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500"
                />
              </label>

              <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                <option value="">All Status</option>
                <option value="new">New</option>
                <option value="in_review">In Progress</option>
                <option value="accepted">Awaiting Customer</option>
                <option value="converted">Converted</option>
                <option value="closed">Closed</option>
                <option value="declined">Declined</option>
              </select>

              <select name="service" defaultValue={params.service ?? "all"} className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                <option value="all">All Services</option>
                <option value="event-services">Event Services</option>
                <option value="retail-supplies">Retail Supplies</option>
                <option value="it-software">IT &amp; Software</option>
              </select>

              <select name="budget" defaultValue={params.budget ?? "all"} className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                <option value="all">All Budget</option>
                <option value="below-250k">Below ₦250,000</option>
                <option value="250k-1m">₦250,000 – ₦1,000,000</option>
                <option value="1m-plus">Above ₦1,000,000</option>
              </select>

              <select name="date" defaultValue={params.date ?? ""} className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                <option value="">Any Date</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>

              <select name="sort" defaultValue={sortValue} className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="name">Sort: Requester Name</option>
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                <Filter className="h-4 w-4" /> Apply Filters
              </button>
              <Link
                href="/dashboard/msme/quotes"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ListFilter className="h-4 w-4" /> Reset Filters
              </Link>
              <p className="text-xs text-slate-500">{filteredQuotes.length} of {quoteCount} requests</p>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <nav className="overflow-x-auto border-b border-slate-200 px-3">
              <ul className="flex min-w-max items-center gap-4">
                {STATUS_TABS.map((tab) => {
                  const isActive = activeTab === tab;
                  const label = tab === "all" ? "All" : tab === "new" ? "New" : tab === "in_progress" ? "In Progress" : tab === "awaiting_customer" ? "Awaiting Customer" : tab === "converted" ? "Converted" : "Closed";
                  return (
                    <li key={tab}>
                      <Link
                        href={buildTabHref(params, tab)}
                        className={`inline-flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold transition ${
                          isActive ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {label}
                        <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {getTabCount(quotes, tab)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {filteredQuotes.length === 0 ? (
              <div className="p-8">
                <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <CircleDashed className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">No quote requests yet</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    When customers request pricing from your public profile, requests will appear here for quick follow-up and conversion.
                  </p>
                  <Link
                    href="/dashboard/msme/public-profile"
                    className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  >
                    View Public Profile
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Requester</th>
                        <th className="px-4 py-3 font-semibold">Request Summary</th>
                        <th className="px-4 py-3 font-semibold">Service</th>
                        <th className="px-4 py-3 font-semibold">Budget</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Fit Score</th>
                        <th className="px-4 py-3 font-semibold">Date Received</th>
                        <th className="px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((quote) => {
                        const fit = fitLabel(quote);
                        return (
                          <tr key={quote.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-3">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                                  {getInitials(quote.requester_name)}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">{quote.requester_name ?? "Unknown requester"}</p>
                                  <p className="truncate text-xs text-slate-500">{quote.requester_email ?? quote.requester_phone ?? "No contact details"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="max-w-[280px] truncate font-medium text-slate-900">{quote.request_summary ?? "Untitled request"}</p>
                              <p className="mt-1 text-xs text-slate-500">Requested on {formatDate(quote.created_at)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{deriveServiceLabel(quote)}</span>
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-slate-700">{formatBudget(quote.budget_min, quote.budget_max)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(quote.status)}`}>
                                {statusLabel(quote.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${fit.className}`}>{fit.label}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">{formatDate(quote.created_at)}</td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/dashboard/msme/quotes/${quote.id}`}
                                className="inline-flex rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                Open Request
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                  <p>Showing {filteredQuotes.length} of {quoteCount} requests</p>
                  <p>Updated {formatDate(new Date().toISOString(), false)}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Quote Pipeline</h2>
            <div className="mt-4 space-y-2">
              {[
                { label: "New", value: statusCounts.new, tone: "bg-blue-500" },
                { label: "In Progress", value: statusCounts.inProgress, tone: "bg-amber-500" },
                { label: "Awaiting Customer", value: statusCounts.awaitingCustomer, tone: "bg-violet-500" },
                { label: "Converted", value: statusCounts.converted, tone: "bg-emerald-500" },
                { label: "Closed", value: statusCounts.closed, tone: "bg-slate-500" },
              ].map((item) => {
                const percentage = statusCounts.all > 0 ? Math.round((item.value / statusCounts.all) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
                        {item.label}
                      </div>
                      <span>{item.value} ({percentage}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className={`h-1.5 rounded-full ${item.tone}`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Response Health</h2>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Clock3 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-slate-500">Avg. Response Time</p>
                  <p className="text-lg font-semibold text-slate-900">{avgResponseHours}h 32m</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-slate-500">Conversion Rate</p>
                  <p className="text-lg font-semibold text-slate-900">{conversionRate.toFixed(1)}%</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-slate-500">Quotes Pending Follow-up</p>
                  <p className="text-lg font-semibold text-slate-900">{pendingFollowUp}</p>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Tips to Win More Quotes</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {[
                "Respond within 24 hours",
                "Ask clarifying questions early",
                "Give clear pricing and timelines",
                "Attach portfolio examples",
                "Follow up before request goes cold",
              ].map((tip) => (
                <li key={tip} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 p-4 text-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Build Trust. Grow Your Business.</h2>
                <p className="mt-1 text-sm text-emerald-50/90">Convert more requests by responding quickly and professionally.</p>
              </div>
              <Sparkles className="h-5 w-5 text-emerald-100" />
            </div>
            <Link
              href="/dashboard/msme/reviews"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              <BarChart3 className="h-4 w-4" /> View Reviews
            </Link>
          </article>
        </aside>
      </section>
    </section>
  );
}
