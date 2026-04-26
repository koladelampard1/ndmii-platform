import Link from "next/link";
import { Building2, CheckCircle2, Grid3X3, LayoutList, ListFilter, Map, MapPin, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { SearchSubmitButton } from "@/components/marketplace/search-submit-button";
import { getMarketplaceFilterOptions, searchMarketplaceProviders } from "@/lib/data/marketplace";

const FALLBACK_BUSINESS_TYPES = [
  "Sole Proprietor",
  "Limited Company",
  "Cooperative",
  "Association Member",
  "Service Provider",
  "Manufacturer",
  "Retailer",
];

const FALLBACK_CATEGORIES = [
  "Automotive",
  "Professional Services",
  "Food Processing",
  "Repairs & Maintenance",
  "Agriculture",
  "ICT Services",
  "Manufacturing",
  "Construction",
  "Retail",
  "Transport",
  "Beauty",
  "Education",
  "Health",
  "Logistics",
];

const FALLBACK_SPECIALIZATIONS = [
  "Rewiring",
  "Car Painting",
  "Fabrication",
  "Agro Processing",
  "Electrical Services",
  "Tailoring",
  "Catering",
  "POS Services",
  "ICT Support",
  "Logistics Support",
];

const FALLBACK_STATES = ["FCT", "Lagos", "Rivers", "Kano", "Kaduna", "Oyo", "Ogun", "Enugu", "Anambra", "Delta", "Edo"];

const FALLBACK_LGAS = ["Abuja Municipal", "Port Harcourt", "Ikeja", "Lekki", "Kano Municipal", "Ibadan South-West", "Wuse", "Garki", "Victoria Island"];

function withoutParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([entryKey, value]) => {
    if (entryKey === key) return;
    if (typeof value === "string" && value) {
      next.set(entryKey, value);
    }
  });

  const query = next.toString();
  return query ? `/marketplace?${query}` : "/marketplace";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const queryParam = typeof params.q === "string" ? params.q : "";
  const serviceParam = typeof params.service === "string" ? params.service : "";
  const q = queryParam || serviceParam;
  const category = typeof params.category === "string" ? params.category : "";
  const specialization = typeof params.specialization === "string" ? params.specialization : "";
  const stateParam = typeof params.state === "string" ? params.state : "";
  const locationParam = typeof params.location === "string" ? params.location : "";
  const location = locationParam || stateParam;
  const lga = typeof params.lga === "string" ? params.lga : "";
  const ratingParam = typeof params.rating === "string" ? params.rating : "";
  const rating = ratingParam ? Number(ratingParam) : 0;
  const businessType = typeof params.business_type === "string" ? params.business_type : "all";
  const verificationParam = typeof params.verification === "string" ? params.verification : "verified_or_approved";
  const verification = verificationParam === "pending_review" ? "all" : verificationParam;
  const sortParam = typeof params.sort === "string" ? params.sort : "relevance";
  const sort = sortParam === "top-rated" || sortParam === "featured" ? sortParam : "relevance";

  const [options, providers] = await Promise.all([
    getMarketplaceFilterOptions(),
    searchMarketplaceProviders({
      q: q || undefined,
      category: category || undefined,
      specialization: specialization || undefined,
      state: location || undefined,
      lga: lga || undefined,
      minRating: rating || undefined,
      verification,
      sort,
    }),
  ]);

  const uniqueValues = (values: string[]) => [...new Set(values.map((item) => item.trim()).filter(Boolean))];
  const safeCategories = uniqueValues(options.categories).length ? uniqueValues(options.categories) : FALLBACK_CATEGORIES;
  const safeStates = uniqueValues(options.states).length ? uniqueValues(options.states) : FALLBACK_STATES;
  const safeLgas = uniqueValues(options.lgas).length ? uniqueValues(options.lgas) : FALLBACK_LGAS;
  const safeBusinessTypes = FALLBACK_BUSINESS_TYPES;
  const safeSpecializations = FALLBACK_SPECIALIZATIONS;

  const stats = [
    { icon: Building2, value: "12,842+", label: "Verified Businesses" },
    { icon: Users, value: "38+", label: "Associations onboarded" },
    { icon: MapPin, value: "11", label: "States covered" },
    { icon: ShieldCheck, value: "98.7%", label: "Verification accuracy" },
  ];

  const verificationLabelMap: Record<string, string> = {
    verified_or_approved: "Verified + Approved",
    verified: "Verified",
    pending_review: "Pending Review",
    all: "All",
  };

  const sortLabelMap: Record<string, string> = {
    relevance: "Best match",
    "top-rated": "Highest rated",
    newest: "Newest",
    "most-reviewed": "Most reviewed",
    "a-z": "A-Z",
  };

  const activeFilters = [
    { key: "verification", label: verificationLabelMap[verificationParam] ?? "Verified + Approved", removeHref: withoutParam(params, "verification") },
    { key: "category", label: category || "All categories", removeHref: withoutParam(params, "category") },
    { key: "specialization", label: specialization || "All specializations", removeHref: withoutParam(params, "specialization") },
    { key: "state", label: stateParam || "All states", removeHref: withoutParam(params, "state") },
    { key: "lga", label: lga || "All LGAs", removeHref: withoutParam(params, "lga") },
    { key: "rating", label: ratingParam ? `${ratingParam}+` : "Any rating", removeHref: withoutParam(params, "rating") },
    { key: "business_type", label: businessType === "all" ? "All types" : businessType, removeHref: withoutParam(params, "business_type") },
    { key: "sort", label: sortLabelMap[sortParam] ?? "Best match", removeHref: withoutParam(params, "sort") },
  ] as Array<{ key: string; label: string; removeHref: string }>;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 pb-14 pt-10 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Marketplace</p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl">Find verified businesses you can trust</h1>
              <p className="mt-3 max-w-2xl text-lg text-emerald-100/90">
                Search, discover, and connect with trusted businesses across Nigeria.
              </p>
            </div>
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 self-start justify-self-start rounded-xl border border-emerald-300/30 bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-800/70"
            >
              <ShieldCheck className="h-4 w-4" />
              Verify Business ID
            </Link>
          </div>

          <div className="mt-8 flex gap-4 overflow-x-auto pb-2">
            {stats.map((item) => (
              <article
                key={item.label}
                className="min-w-[220px] flex-1 rounded-xl border border-emerald-300/20 bg-gradient-to-b from-emerald-900/70 to-emerald-950/70 p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_10px_40px_rgba(4,120,87,0.25)]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700/80">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-bold text-white">{item.value}</p>
                <p className="text-sm text-emerald-100/90">{item.label}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:mt-12 lg:px-8">
          <form action="/marketplace" className="relative z-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>What service do you need?</span>
                <div className="relative">
                  <input
                    aria-label="Search for service or business"
                    name="q"
                    defaultValue={q}
                    placeholder="Search for service or business"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 pr-10 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                </div>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
                <span>Location</span>
                <input
                  aria-label="Location"
                  name="location"
                  defaultValue={location}
                  placeholder="Enter location (e.g. Abuja)"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Category</span>
                <select
                  aria-label="Category"
                  name="category"
                  defaultValue={category}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">All categories</option>
                  {safeCategories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Specialization</span>
                <select
                  aria-label="Specialization"
                  name="specialization"
                  defaultValue={specialization}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">All specializations</option>
                  {safeSpecializations.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Business type</span>
                <select
                  aria-label="Business type"
                  name="business_type"
                  defaultValue={businessType}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All types</option>
                  {safeBusinessTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>LGA</span>
                <select
                  aria-label="LGA"
                  name="lga"
                  defaultValue={lga}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">All LGAs</option>
                  {safeLgas.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>State</span>
                <select
                  aria-label="State"
                  name="state"
                  defaultValue={stateParam}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">All states</option>
                  {safeStates.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Rating</span>
                <select
                  aria-label="Rating"
                  name="rating"
                  defaultValue={rating ? String(rating) : ""}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Any rating</option>
                  <option value="4.5">4.5+</option>
                  <option value="4">4.0+</option>
                  <option value="3.5">3.5+</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Verification status</span>
                <select
                  aria-label="Verification status"
                  name="verification"
                  defaultValue={verificationParam}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="verified_or_approved">Verified + Approved</option>
                  <option value="verified">Verified</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Sort by</span>
                <select
                  aria-label="Sort by"
                  name="sort"
                  defaultValue={sortParam}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="relevance">Best match</option>
                  <option value="top-rated">Highest rated</option>
                  <option value="newest">Newest</option>
                  <option value="most-reviewed">Most reviewed</option>
                  <option value="a-z">A-Z</option>
                </select>
              </label>
              <div className="flex items-end md:col-span-3 lg:col-span-1 lg:justify-end">
                <SearchSubmitButton />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/marketplace" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                Clear all filters
              </Link>
              {activeFilters.map((chip) => (
                <Link
                  key={chip.key}
                  href={chip.removeHref}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </Link>
              ))}
            </div>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">Verified businesses ({providers.length})</h2>
            <p className="mt-1 text-sm text-slate-600">Browse trusted businesses that have been verified on DBIN.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Grid view"
              className="rounded-lg border border-emerald-200 bg-emerald-600 p-2 text-white"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Map view"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              <Map className="h-4 w-4" />
              Map view
            </button>
          </div>
        </div>

        {providers.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy="false">
            {providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ListFilter className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">No verified businesses match your filters yet.</h2>
            <p className="mt-2 text-sm text-slate-600">Try adjusting category, location, or specialization.</p>
            <Link
              href="/marketplace"
              className="mt-4 inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Reset filters
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="font-semibold">100% Verified</p>
              <p className="text-sm text-slate-600">Every business is verified and approved.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="font-semibold">Secure &amp; Trusted</p>
              <p className="text-sm text-slate-600">Your data and identity are protected.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="font-semibold">QR Verifiable</p>
              <p className="text-sm text-slate-600">Instant verification anytime.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
            <Users className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="font-semibold">Partner Ready</p>
              <p className="text-sm text-slate-600">Trusted by institutions and marketplaces.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
