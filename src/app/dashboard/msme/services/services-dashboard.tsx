"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  Eye,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Star,
  Store,
  Tags,
  TrendingUp,
  Zap,
} from "lucide-react";

export type ServiceRecord = {
  id: string;
  provider_profile_id: string;
  service_name: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  pricing_model: string | null;
  is_active: boolean | null;
  created_at: string | null;
  views_count?: number | null;
  quote_requests_count?: number | null;
  average_rating?: number | null;
};

type MsmeServicesDashboardProps = {
  services: ServiceRecord[];
  categories: string[];
  saved: boolean;
  serviceAction: (formData: FormData) => Promise<void>;
  createServiceRoute: string;
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
  return value === "inactive" ? "Inactive" : "Active";
}

export function MsmeServicesDashboard({ services, categories, saved, serviceAction, createServiceRoute }: MsmeServicesDashboardProps) {
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
      if (service.pricing_model?.trim()) seen.add(service.pricing_model.trim());
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [categories, services]);

  const visibleServices = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const filtered = services.filter((service) => {
      const matchesQuery =
        lowered.length === 0 ||
        [service.service_name, service.description, service.pricing_model]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(lowered));

      const matchesCategory =
        categoryFilter === "all" ||
        (service.pricing_model ?? "").trim().toLowerCase() === categoryFilter.trim().toLowerCase();

      const matchesStatus =
        statusFilter === "all" || (statusFilter === "available" ? service.is_active !== false : service.is_active === false);

      return matchesQuery && matchesCategory && matchesStatus;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === "price_desc") return Number(b.price_min ?? 0) - Number(a.price_min ?? 0);
      if (sortBy === "price_asc") return Number(a.price_min ?? 0) - Number(b.price_min ?? 0);

      const left = new Date(a.created_at ?? 0).getTime();
      const right = new Date(b.created_at ?? 0).getTime();
      if (sortBy === "oldest") return left - right;
      return right - left;
    });

    return sorted;
  }, [services, query, categoryFilter, statusFilter, sortBy]);

  const highestPriced = useMemo(
    () => [...services].sort((a, b) => Number(b.price_min ?? 0) - Number(a.price_min ?? 0))[0],
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
  const hasPerformanceData = Boolean(mostViewed?.service_name || mostRequested?.service_name || highestPriced?.service_name);
  const servicesByCategory = useMemo(() => {
    const grouped = new Map<string, ServiceRecord[]>();
    for (const service of services) {
      const key = service.pricing_model?.trim() || "Uncategorized";
      const bucket = grouped.get(key) ?? [];
      bucket.push(service);
      grouped.set(key, bucket);
    }
    return Array.from(grouped.entries())
      .map(([category, items]) => ({
        category,
        count: items.length,
        items: items.sort((a, b) => (a.service_name ?? "").localeCompare(b.service_name ?? "")),
      }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  }, [services]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    console.info("[msme-services] add-new-service-route", { route: createServiceRoute });
  }, [createServiceRoute]);

  return (
    <section className="space-y-8 pb-4">
      {saved && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
          Service catalog updated.
        </p>
      )}

      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">My Services</h1>
          <p className="mt-2 text-base text-slate-600">Manage the services you offer to your customers.</p>
        </div>
        <Link
          href={createServiceRoute}
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add New Service
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Store, label: "Total Services", value: services.length, helper: "Active services" },
          { icon: Eye, label: "Total Views", value: totalViews, helper: "This month" },
          { icon: MessageSquare, label: "Quote Requests", value: totalQuotes, helper: "This month" },
          { icon: Star, label: "Avg. Rating", value: avgRating.toFixed(1), helper: "Service ratings" },
        ].map((stat) => (
          <article key={stat.label} className="flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 inline-flex w-fit rounded-full bg-emerald-50 p-2.5 text-emerald-700 ring-1 ring-emerald-100">
              <stat.icon className="h-4 w-4" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-950">{stat.value}</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{stat.label}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.helper}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="border-b border-slate-200 pb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "all" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600 hover:text-slate-800"
                  }`}
                >
                  All Services
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("categories")}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "categories" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600 hover:text-slate-800"
                  }`}
                >
                  Service Categories
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="relative md:col-span-2 xl:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search services..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm"
                />
              </label>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
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
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
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
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="oldest">Sort: Oldest</option>
                  <option value="price_desc">Sort: Price High-Low</option>
                  <option value="price_asc">Sort: Price Low-High</option>
                </select>
              </label>
            </div>
            </div>

            {activeTab === "categories" ? (
              <div className="mt-5 space-y-3">
                {!servicesByCategory.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                    No service categories yet. Add your first service to start organizing your catalog.
                  </div>
                ) : (
                  servicesByCategory.map((group) => (
                    <article key={group.category} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{group.category}</p>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          {group.count} service{group.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.items.slice(0, 4).map((service) => (
                          <span key={service.id} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">
                            {service.service_name || "Untitled service"}
                          </span>
                        ))}
                        {group.count > 4 ? (
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
                            +{group.count - 4} more
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {!visibleServices.length ? (
                <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-6 py-12 text-center shadow-sm">
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <Store className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">You have not added any services yet</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    Add your first service to start appearing in the marketplace and receiving quote requests.
                  </p>
                  <Link
                    href={createServiceRoute}
                    className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Service
                  </Link>
                </div>
              ) : (
                visibleServices.map((service) => {
                  const createdDate = formatDate(service.created_at);
                  return (
                    <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:flex">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-lg font-semibold text-slate-900">{service.service_name || "Untitled service"}</p>
                              {service.description && <p className="text-sm text-slate-600">{service.description}</p>}
                            </div>
                            <button type="button" className="rounded-lg border border-slate-200 p-1.5 text-slate-500">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                            {service.pricing_model && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                                <Tags className="h-3.5 w-3.5" />
                                {service.pricing_model}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Price</p>
                              <p className="font-semibold text-slate-900">From {formatCurrency(service.price_min)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                {statusLabel(service.is_active === false ? "inactive" : "active")}
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
                        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Edit service status</summary>
                        <form action={serviceAction} className="mt-3 grid gap-2 md:grid-cols-2">
                          <input type="hidden" name="kind" value="update" />
                          <input type="hidden" name="service_id" value={service.id} />
                          <select name="is_active" defaultValue={String(service.is_active !== false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
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

        <aside className="space-y-4 xl:col-span-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
              Service Performance
            </h2>
            {!hasPerformanceData ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No performance data yet. Add services to start tracking insights.</p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 text-sm">
                <div className="space-y-1 py-3 first:pt-0">
                  <p className="text-slate-500">Most Viewed Service</p>
                  <p className="font-semibold text-slate-900">{mostViewed?.service_name ?? "No data yet"}</p>
                </div>
                <div className="space-y-1 py-3">
                  <p className="text-slate-500">Most Requested Service</p>
                  <p className="font-semibold text-slate-900">{mostRequested?.service_name ?? "No data yet"}</p>
                </div>
                <div className="space-y-1 py-3 last:pb-0">
                  <p className="text-slate-500">Highest Priced Service</p>
                  <p className="font-semibold text-slate-900">
                    {highestPriced?.service_name ? `${highestPriced.service_name} (${formatCurrency(highestPriced.price_min)})` : "No data yet"}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Tips to get more customers</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
              {[
                "Add clear descriptions and pricing",
                "Upload relevant photos",
                "Keep your services up to date",
                "Respond to quote requests quickly",
                "Encourage customer reviews",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white shadow-lg shadow-emerald-900/20">
            <h2 className="text-xl font-semibold">Grow Your Business</h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-100">
              Add more services to increase your visibility and attract more customers.
            </p>
            <Link
              href={createServiceRoute}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-emerald-900"
            >
              Add New Service
              <Plus className="h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
    </section>
  );
}
