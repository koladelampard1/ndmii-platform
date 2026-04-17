"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Eye,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Star,
  Store,
  Tags,
  TrendingUp,
  Zap,
} from "lucide-react";

export type ServiceRecord = {
  id: string;
  category: string | null;
  specialization: string | null;
  title: string | null;
  short_description: string | null;
  pricing_mode: string | null;
  min_price: number | null;
  max_price: number | null;
  turnaround_time: string | null;
  vat_applicable: boolean | null;
  availability_status: string | null;
  created_at: string | null;
  updated_at: string | null;
  views_count?: number | null;
  quote_requests_count?: number | null;
  average_rating?: number | null;
};

type MsmeServicesDashboardProps = {
  services: ServiceRecord[];
  categories: string[];
  saved: boolean;
  serviceAction: (formData: FormData) => Promise<void>;
};

const formatter = new Intl.NumberFormat("en-NG");

function formatCurrency(value: number | null | undefined) {
  return `₦${formatter.format(Number(value ?? 0))}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(value: string | null | undefined) {
  if (!value) return "Active";
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function MsmeServicesDashboard({ services, categories, saved, serviceAction }: MsmeServicesDashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "categories">("all");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "price_desc" | "price_asc">("newest");

  const totalViews = useMemo(
    () => services.reduce((sum, service) => sum + Number(service.views_count ?? 0), 0),
    [services],
  );
  const totalQuotes = useMemo(
    () => services.reduce((sum, service) => sum + Number(service.quote_requests_count ?? 0), 0),
    [services],
  );
  const avgRating = useMemo(() => {
    const ratings = services
      .map((service) => Number(service.average_rating ?? 0))
      .filter((rating) => Number.isFinite(rating) && rating > 0);
    if (!ratings.length) return 0;
    return ratings.reduce((sum, item) => sum + item, 0) / ratings.length;
  }, [services]);

  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    for (const category of categories) {
      if (category?.trim()) seen.add(category.trim());
    }
    for (const service of services) {
      if (service.category?.trim()) seen.add(service.category.trim());
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [categories, services]);

  const visibleServices = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const filtered = services.filter((service) => {
      const matchesQuery =
        lowered.length === 0 ||
        [service.title, service.short_description, service.category, service.specialization]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(lowered));

      const matchesCategory =
        categoryFilter === "all" ||
        (service.category ?? "").trim().toLowerCase() === categoryFilter.trim().toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        (service.availability_status ?? "").trim().toLowerCase() === statusFilter.trim().toLowerCase();

      return matchesQuery && matchesCategory && matchesStatus;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === "price_desc") return Number(b.min_price ?? 0) - Number(a.min_price ?? 0);
      if (sortBy === "price_asc") return Number(a.min_price ?? 0) - Number(b.min_price ?? 0);

      const left = new Date(a.created_at ?? 0).getTime();
      const right = new Date(b.created_at ?? 0).getTime();
      if (sortBy === "oldest") return left - right;
      return right - left;
    });

    return sorted;
  }, [services, query, categoryFilter, statusFilter, sortBy]);

  const highestPriced = useMemo(
    () => [...services].sort((a, b) => Number(b.min_price ?? 0) - Number(a.min_price ?? 0))[0],
    [services],
  );
  const mostViewed = useMemo(
    () => [...services].sort((a, b) => Number(b.views_count ?? 0) - Number(a.views_count ?? 0))[0],
    [services],
  );
  const mostRequested = useMemo(
    () => [...services].sort((a, b) => Number(b.quote_requests_count ?? 0) - Number(a.quote_requests_count ?? 0))[0],
    [services],
  );

  return (
    <section className="space-y-6 pb-2">
      {saved && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          Service catalog updated.
        </p>
      )}

      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Services</h1>
          <p className="mt-1 text-sm text-slate-600">Manage the services you offer to your customers.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((open) => !open)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          <Plus className="h-4 w-4" />
          Add New Service
        </button>
      </header>

      {showAddForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Add New Service</h2>
          <form action={serviceAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input type="hidden" name="kind" value="create" />
            <select name="category" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {uniqueCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              {!uniqueCategories.length && <option value="Professional Services">Professional Services</option>}
            </select>
            <input name="specialization" placeholder="Specialization" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input name="title" required placeholder="Service title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input
              name="short_description"
              required
              placeholder="Short description"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2 xl:col-span-3"
            />
            <select name="pricing_mode" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="fixed">fixed</option>
              <option value="range">range</option>
              <option value="negotiable">negotiable</option>
            </select>
            <input name="min_price" type="number" min={0} step="0.01" placeholder="Minimum price" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input name="max_price" type="number" min={0} step="0.01" placeholder="Maximum price" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input name="turnaround_time" placeholder="Turnaround e.g. 5 days" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <select name="vat_applicable" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="false">VAT not applicable</option>
              <option value="true">VAT applicable</option>
            </select>
            <select name="availability_status" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="available">available</option>
              <option value="limited">limited</option>
              <option value="unavailable">unavailable</option>
            </select>
            <div className="md:col-span-2 xl:col-span-3 flex justify-end">
              <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save Service</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { icon: Store, label: "Total Services", value: services.length, helper: "Active services" },
          { icon: Eye, label: "Total Views", value: totalViews, helper: "This month" },
          { icon: MessageSquare, label: "Quote Requests", value: totalQuotes, helper: "This month" },
          { icon: Star, label: "Avg. Rating", value: avgRating.toFixed(1), helper: "Service ratings" },
        ].map((stat) => (
          <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 inline-flex rounded-full bg-emerald-50 p-2 text-emerald-700">
              <stat.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-sm font-semibold text-slate-700">{stat.label}</p>
            <p className="text-xs text-slate-500">{stat.helper}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-10">
        <div className="space-y-4 xl:col-span-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="border-b border-slate-200 pb-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    activeTab === "all" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  All Services
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("categories")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    activeTab === "categories" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Service Categories
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="relative md:col-span-2 xl:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search services..."
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
                />
              </label>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="all">All Status</option>
                <option value="available">Active</option>
                <option value="limited">Limited</option>
                <option value="unavailable">Unavailable</option>
              </select>

              <label className="relative">
                <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="oldest">Sort: Oldest</option>
                  <option value="price_desc">Sort: Price High-Low</option>
                  <option value="price_asc">Sort: Price Low-High</option>
                </select>
              </label>
            </div>

            {activeTab === "categories" ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                Category grouping view will appear here as your services and categories grow.
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {!visibleServices.length ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                  <h3 className="text-lg font-semibold text-slate-900">You have not added any services yet.</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Add your first service to start appearing in the marketplace and receiving quote requests.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Service
                  </button>
                </div>
              ) : (
                visibleServices.map((service) => {
                  const createdDate = formatDate(service.created_at);
                  return (
                    <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start gap-4">
                        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:flex">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-lg font-semibold text-slate-900">{service.title || "Untitled service"}</p>
                              {service.short_description && <p className="text-sm text-slate-600">{service.short_description}</p>}
                            </div>
                            <button type="button" className="rounded-lg border border-slate-200 p-1.5 text-slate-500">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                            {service.category && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                                <Tags className="h-3.5 w-3.5" />
                                {service.category}
                              </span>
                            )}
                            {service.specialization && (
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">{service.specialization}</span>
                            )}
                          </div>

                          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Price</p>
                              <p className="font-semibold text-slate-900">From {formatCurrency(service.min_price)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                {statusLabel(service.availability_status)}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Added</p>
                              <p className="font-medium text-slate-700">{createdDate ? `Added ${createdDate}` : "No date"}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Edit service</summary>
                        <form action={serviceAction} className="mt-3 grid gap-2 md:grid-cols-2">
                          <input type="hidden" name="kind" value="update" />
                          <input type="hidden" name="service_id" value={service.id} />
                          <input name="category" defaultValue={service.category ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                          <input name="specialization" defaultValue={service.specialization ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                          <input name="title" defaultValue={service.title ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                          <input
                            name="short_description"
                            defaultValue={service.short_description ?? ""}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                          />
                          <input name="pricing_mode" defaultValue={service.pricing_mode ?? "range"} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                          <input
                            name="min_price"
                            type="number"
                            step="0.01"
                            defaultValue={service.min_price ?? 0}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                          <input
                            name="max_price"
                            type="number"
                            step="0.01"
                            defaultValue={service.max_price ?? 0}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                          <input name="turnaround_time" defaultValue={service.turnaround_time ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                          <select
                            name="vat_applicable"
                            defaultValue={String(Boolean(service.vat_applicable))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="false">VAT not applicable</option>
                            <option value="true">VAT applicable</option>
                          </select>
                          <select
                            name="availability_status"
                            defaultValue={service.availability_status ?? "available"}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="available">available</option>
                            <option value="limited">limited</option>
                            <option value="unavailable">unavailable</option>
                          </select>
                          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Save</button>
                          </div>
                        </form>
                        <form action={serviceAction} className="mt-2">
                          <input type="hidden" name="kind" value="delete" />
                          <input type="hidden" name="service_id" value={service.id} />
                          <button className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">Delete</button>
                        </form>
                      </details>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:col-span-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
              Service Performance
            </h2>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-slate-500">Most Viewed Service</p>
                <p className="font-semibold text-slate-900">{mostViewed?.title ?? "No data yet"}</p>
              </div>
              <div>
                <p className="text-slate-500">Most Requested Service</p>
                <p className="font-semibold text-slate-900">{mostRequested?.title ?? "No data yet"}</p>
              </div>
              <div>
                <p className="text-slate-500">Highest Priced Service</p>
                <p className="font-semibold text-slate-900">
                  {highestPriced?.title ? `${highestPriced.title} (${formatCurrency(highestPriced.min_price)})` : "No data yet"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Tips to get more customers</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {[
                "Add clear descriptions and pricing",
                "Upload relevant photos",
                "Keep your services up to date",
                "Respond to quote requests quickly",
                "Encourage customer reviews",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-emerald-950 p-5 text-white">
            <h2 className="text-xl font-semibold">Grow Your Business</h2>
            <p className="mt-2 text-sm text-emerald-100">
              Add more services to increase your visibility and attract more customers.
            </p>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-900"
            >
              Add New Service
              <Plus className="h-4 w-4" />
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
}
