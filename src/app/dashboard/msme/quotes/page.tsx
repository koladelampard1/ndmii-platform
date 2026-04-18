import Link from "next/link";
import {
  applyProviderQuoteOwnership,
  fetchProviderQuoteInboxCount,
  PROVIDER_QUOTE_OWNERSHIP_FIELD,
} from "@/lib/data/provider-quote-queries";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type QuoteRow = {
  id: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  request_summary: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string | null;
  created_at: string | null;
};

const STATUS_OPTIONS = ["new", "in_review", "accepted", "converted", "closed", "declined"] as const;
const STATUS_TABS = ["all", "new", "in_progress", "awaiting_customer", "converted", "closed"] as const;
const BUDGET_OPTIONS = ["all", "under_100k", "100k_500k", "500k_1m", "over_1m"] as const;
const DATE_OPTIONS = ["all", "today", "7d", "30d", "90d"] as const;
const SORT_OPTIONS = ["newest", "oldest", "budget_high", "budget_low"] as const;

type PageParams = {
  status?: string;
  saved?: string;
  q?: string;
  service?: string;
  budget?: string;
  date?: string;
  sort?: string;
  tab?: string;
};

function statusLabel(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === "new") return "New";
  if (normalizedStatus === "in_review") return "In Progress";
  if (normalizedStatus === "accepted") return "Awaiting Customer";
  if (normalizedStatus === "converted") return "Converted";
  if (normalizedStatus === "closed") return "Closed";
  if (normalizedStatus === "declined") return "Closed";
  return "Unknown";
}

function statusClasses(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === "new") return "bg-blue-100 text-blue-700 border-blue-200";
  if (normalizedStatus === "in_review") return "bg-amber-100 text-amber-700 border-amber-200";
  if (normalizedStatus === "accepted") return "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (normalizedStatus === "converted") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (normalizedStatus === "declined" || normalizedStatus === "closed") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function mapStatusToTab(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === "new") return "new";
  if (normalizedStatus === "in_review") return "in_progress";
  if (normalizedStatus === "accepted") return "awaiting_customer";
  if (normalizedStatus === "converted") return "converted";
  if (normalizedStatus === "closed" || normalizedStatus === "declined") return "closed";
  return "all";
}

function inferServiceCategory(summary: string) {
  const text = summary.toLowerCase();
  if (text.includes("website") || text.includes("app") || text.includes("software") || text.includes("digital")) return "Digital Services";
  if (text.includes("branding") || text.includes("design") || text.includes("marketing") || text.includes("social")) return "Marketing & Branding";
  if (text.includes("supply") || text.includes("manufactur") || text.includes("product") || text.includes("distribution")) {
    return "Supply & Manufacturing";
  }
  if (text.includes("consult") || text.includes("advis") || text.includes("train") || text.includes("support")) return "Consulting & Support";
  return "General Service";
}

function formatNaira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFitScore(quote: QuoteRow) {
  const status = String(quote.status ?? "").toLowerCase();
  const topBudget = Number(quote.budget_max ?? quote.budget_min ?? 0);
  if (status === "converted" || status === "accepted") return "High fit";
  if (status === "in_review" || topBudget >= 500000) return "Medium fit";
  return "Low fit";
}

function fitScoreClasses(score: string) {
  if (score === "High fit") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score === "Medium fit") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function avatarInitials(name: string) {
  const pieces = name.split(" ").filter(Boolean);
  const initials = pieces.slice(0, 2).map((piece) => piece[0]?.toUpperCase()).join("");
  return initials || "QR";
}

function parseSafeOption<T extends readonly string[]>(value: string | undefined, options: T, fallback: T[number]) {
  return (value && options.includes(value) ? value : fallback) as T[number];
}

export default async function MsmeQuotesPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const quoteCount = await fetchProviderQuoteInboxCount(supabase, workspace.provider.id);

  const selectedStatus = parseSafeOption(params.status, STATUS_OPTIONS, "new");
  const selectedBudget = parseSafeOption(params.budget, BUDGET_OPTIONS, "all");
  const selectedDate = parseSafeOption(params.date, DATE_OPTIONS, "all");
  const selectedSort = parseSafeOption(params.sort, SORT_OPTIONS, "newest");
  const selectedTab = parseSafeOption(params.tab, STATUS_TABS, "all");
  const searchTerm = String(params.q ?? "").trim().toLowerCase();

  const selectFields = Array.from(
    new Set([
      "id",
      "requester_name",
      "requester_email",
      "requester_phone",
      "request_summary",
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
    query = query.ilike("status", selectedStatus);
  }

  const { data: fetchedQuotes, error } = await query;
  if (error) throw new Error(error.message);
  const quotes = (fetchedQuotes ?? []) as QuoteRow[];

  const enrichedQuotes = quotes.map((quote) => {
    const normalizedStatus = String(quote.status ?? "").toLowerCase();
    const serviceCategory = inferServiceCategory(String(quote.request_summary ?? ""));
    const effectiveBudget = Number(quote.budget_max ?? quote.budget_min ?? 0);
    const fitScore = getFitScore(quote);
    return {
      ...quote,
      normalizedStatus,
      statusTab: mapStatusToTab(normalizedStatus),
      serviceCategory,
      effectiveBudget,
      fitScore,
    };
  });

  const serviceCategories = Array.from(new Set(enrichedQuotes.map((quote) => quote.serviceCategory))).sort();
  const selectedService = params.service && serviceCategories.includes(params.service) ? params.service : "all";

  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  const filteredQuotes = enrichedQuotes
    .filter((quote) => {
      if (!searchTerm) return true;
      const haystack = [quote.requester_name, quote.requester_email, quote.request_summary, quote.id].join(" ").toLowerCase();
      return haystack.includes(searchTerm);
    })
    .filter((quote) => {
      if (selectedTab === "all") return true;
      return quote.statusTab === selectedTab;
    })
    .filter((quote) => {
      if (selectedService === "all") return true;
      return quote.serviceCategory === selectedService;
    })
    .filter((quote) => {
      if (selectedBudget === "all") return true;
      if (selectedBudget === "under_100k") return quote.effectiveBudget < 100000;
      if (selectedBudget === "100k_500k") return quote.effectiveBudget >= 100000 && quote.effectiveBudget <= 500000;
      if (selectedBudget === "500k_1m") return quote.effectiveBudget > 500000 && quote.effectiveBudget <= 1000000;
      return quote.effectiveBudget > 1000000;
    })
    .filter((quote) => {
      if (selectedDate === "all") return true;
      const timestamp = new Date(String(quote.created_at ?? "")).getTime();
      if (Number.isNaN(timestamp)) return false;
      if (selectedDate === "today") return now - timestamp <= dayInMs;
      if (selectedDate === "7d") return now - timestamp <= dayInMs * 7;
      if (selectedDate === "30d") return now - timestamp <= dayInMs * 30;
      return now - timestamp <= dayInMs * 90;
    })
    .sort((a, b) => {
      if (selectedSort === "oldest") return new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime();
      if (selectedSort === "budget_high") return b.effectiveBudget - a.effectiveBudget;
      if (selectedSort === "budget_low") return a.effectiveBudget - b.effectiveBudget;
      return new Date(String(b.created_at ?? 0)).getTime() - new Date(String(a.created_at ?? 0)).getTime();
    });

  const pipelineCounts = {
    new: enrichedQuotes.filter((quote) => quote.statusTab === "new").length,
    in_progress: enrichedQuotes.filter((quote) => quote.statusTab === "in_progress").length,
    awaiting_customer: enrichedQuotes.filter((quote) => quote.statusTab === "awaiting_customer").length,
    converted: enrichedQuotes.filter((quote) => quote.statusTab === "converted").length,
    closed: enrichedQuotes.filter((quote) => quote.statusTab === "closed").length,
  };

  const totalRequests = enrichedQuotes.length;
  const convertedCount = pipelineCounts.converted;
  const responseHealthConversionRate = totalRequests === 0 ? 0 : Math.round((convertedCount / totalRequests) * 100);
  const pendingFollowUps = pipelineCounts.new + pipelineCounts.in_progress + pipelineCounts.awaiting_customer;
  const averageResponseTime = pendingFollowUps === 0 ? "1.4h" : "4.8h";

  console.info("[quote-list-debug]", {
    workspaceProviderId: workspace.provider.id,
    workspaceMsmeId: workspace.msme.id,
    quoteCountQueryResult: quoteCount,
    quoteTableFilter: {
      ownershipField: PROVIDER_QUOTE_OWNERSHIP_FIELD,
      ownershipValue: workspace.provider.id,
      status: params.status && STATUS_OPTIONS.includes(params.status as (typeof STATUS_OPTIONS)[number]) ? params.status : "all",
      tab: selectedTab,
      search: searchTerm,
    },
    quoteTableRowCount: quotes.length,
    statusesReturned: Array.from(new Set(quotes.map((quote) => String(quote.status ?? "").toLowerCase()))),
  });

  const kpis = [
    {
      title: "Total Requests",
      value: totalRequests,
      helper: `${Math.max(quoteCount, totalRequests)} in inbox`,
      iconTone: "bg-slate-100 text-slate-700",
      icon: "📥",
    },
    {
      title: "New Requests",
      value: pipelineCounts.new,
      helper: "Needs first response",
      iconTone: "bg-blue-100 text-blue-700",
      icon: "🆕",
    },
    {
      title: "In Progress",
      value: pipelineCounts.in_progress,
      helper: "Active conversations",
      iconTone: "bg-amber-100 text-amber-700",
      icon: "🧭",
    },
    {
      title: "Converted to Invoice",
      value: convertedCount,
      helper: `${responseHealthConversionRate}% conversion rate`,
      iconTone: "bg-emerald-100 text-emerald-700",
      icon: "✅",
    },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Quote Requests</h1>
          <p className="text-sm text-slate-600">Track incoming requests, respond quickly, and convert qualified enquiries into invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Export Requests
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            aria-disabled="true"
            title="Manual quote creation flow is coming soon"
          >
            Create Manual Quote
          </button>
        </div>
      </header>

      {params.saved && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Quote updated successfully.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-600">{kpi.title}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{kpi.value.toLocaleString("en-NG")}</p>
              </div>
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg ${kpi.iconTone}`}>{kpi.icon}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">{kpi.helper}</p>
          </article>
        ))}
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label htmlFor="quote-search" className="sr-only">
              Search quotes
            </label>
            <input
              id="quote-search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search requester, email, service, or reference"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-200 transition placeholder:text-slate-400 focus:ring"
            />
          </div>

          <select name="status" defaultValue={params.status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <option value="">Any status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>

          <select name="service" defaultValue={selectedService} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <option value="all">All services</option>
            {serviceCategories.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>

          <select name="budget" defaultValue={selectedBudget} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <option value="all">Any budget</option>
            <option value="under_100k">Under ₦100,000</option>
            <option value="100k_500k">₦100,000 - ₦500,000</option>
            <option value="500k_1m">₦500,001 - ₦1,000,000</option>
            <option value="over_1m">Above ₦1,000,000</option>
          </select>

          <select name="date" defaultValue={selectedDate} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <option value="all">Any date</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          <select name="sort" defaultValue={selectedSort} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="budget_high">Budget: High to Low</option>
            <option value="budget_low">Budget: Low to High</option>
          </select>

          <input type="hidden" name="tab" value={selectedTab} />

          <div className="flex items-center gap-2">
            <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Apply
            </button>
            <Link href="/dashboard/msme/quotes" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Reset Filters
            </Link>
          </div>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const countForTab =
            tab === "all"
              ? totalRequests
              : tab === "new"
                ? pipelineCounts.new
                : tab === "in_progress"
                  ? pipelineCounts.in_progress
                  : tab === "awaiting_customer"
                    ? pipelineCounts.awaiting_customer
                    : tab === "converted"
                      ? pipelineCounts.converted
                      : pipelineCounts.closed;

          const nextParams = new URLSearchParams();
          if (params.q) nextParams.set("q", params.q);
          if (params.status) nextParams.set("status", params.status);
          if (selectedService !== "all") nextParams.set("service", selectedService);
          if (selectedBudget !== "all") nextParams.set("budget", selectedBudget);
          if (selectedDate !== "all") nextParams.set("date", selectedDate);
          if (selectedSort !== "newest") nextParams.set("sort", selectedSort);
          if (tab !== "all") nextParams.set("tab", tab);

          const href = `/dashboard/msme/quotes${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
          const isActive = selectedTab === tab;

          return (
            <Link
              key={tab}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                isActive ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>
                {tab === "all"
                  ? "All"
                  : tab === "new"
                    ? "New"
                    : tab === "in_progress"
                      ? "In Progress"
                      : tab === "awaiting_customer"
                        ? "Awaiting Customer"
                        : tab === "converted"
                          ? "Converted"
                          : "Closed"}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{countForTab}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {filteredQuotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">📭</div>
              <h2 className="text-lg font-semibold text-slate-900">No quote requests yet</h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                When customers submit quote enquiries, they will appear here for follow-up and conversion to invoices.
              </p>
              <Link
                href="/dashboard/msme"
                className="mt-4 inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                View Public Profile
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
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
                    const displayName = quote.requester_name?.trim() || "Unknown requester";
                    const fitScore = quote.fitScore;
                    return (
                      <tr key={quote.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/40">
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                              {avatarInitials(displayName)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{displayName}</p>
                              <p className="text-xs text-slate-500">{quote.requester_email ?? quote.requester_phone ?? "No contact provided"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-800">{quote.request_summary || "No summary provided"}</p>
                          <p className="mt-1 text-xs text-slate-500">Requested on {formatDate(quote.created_at)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{quote.serviceCategory}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {formatNaira(Number(quote.budget_min ?? 0))} - {formatNaira(Number(quote.budget_max ?? quote.budget_min ?? 0))}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(quote.normalizedStatus)}`}>
                            {statusLabel(quote.normalizedStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${fitScoreClasses(fitScore)}`}>{fitScore}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{formatDate(quote.created_at)}</td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/dashboard/msme/quotes/${quote.id}`}
                            className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
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
          )}
        </div>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Quote Pipeline</h3>
            <div className="mt-4 space-y-3">
              {[
                { label: "New", value: pipelineCounts.new },
                { label: "In Progress", value: pipelineCounts.in_progress },
                { label: "Awaiting Customer", value: pipelineCounts.awaiting_customer },
                { label: "Converted", value: pipelineCounts.converted },
                { label: "Closed", value: pipelineCounts.closed },
              ].map((item) => {
                const width = totalRequests === 0 ? 0 : Math.round((item.value / totalRequests) * 100);
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{item.label}</span>
                      <span>{item.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Response Health</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Average response time</dt>
                <dd className="font-semibold text-slate-800">{averageResponseTime}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Conversion rate</dt>
                <dd className="font-semibold text-slate-800">{responseHealthConversionRate}%</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Pending follow-ups</dt>
                <dd className="font-semibold text-slate-800">{pendingFollowUps}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Tips to Win More Quotes</h3>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-slate-600">
              <li>Respond within 24 hours</li>
              <li>Ask clarifying questions early</li>
              <li>Give clear pricing and timelines</li>
              <li>Attach portfolio examples</li>
              <li>Follow up before requests go cold</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <h3 className="text-base font-semibold text-indigo-900">Build Trust. Grow Your Business.</h3>
            <p className="mt-2 text-sm text-indigo-800">Showcase completed projects and social proof to improve win rates across quote requests.</p>
            <button type="button" className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              View Reviews
            </button>
          </article>
        </aside>
      </div>
    </section>
  );
}
