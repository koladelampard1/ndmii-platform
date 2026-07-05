import Link from "next/link";
import { Filter, Search } from "lucide-react";
import { PROPERTY_TYPE_OPTIONS, POPULAR_PROPERTY_SEARCHES, getPublicPropertyStats, searchPublicProperties } from "@/lib/data/public-property-explorer";
import { PrivacyNotice, PropertyCard, PropertyHero, PropertyPublicShell } from "@/components/property/public-property-explorer";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

function value(params: Params, key: string) {
  const raw = params[key];
  return typeof raw === "string" ? raw : "";
}

export default async function PropertySearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters = {
    q: value(params, "q"),
    npin: value(params, "npin"),
    applicationReference: value(params, "application_reference"),
    state: value(params, "state"),
    lga: value(params, "lga"),
    ward: value(params, "ward"),
    community: value(params, "community"),
    category: value(params, "category"),
    propertyType: value(params, "property_type"),
    landUse: value(params, "land_use"),
    registryStatus: value(params, "registry_status"),
    verificationStatus: value(params, "verification_status"),
    page: Number(value(params, "page") || 1),
    limit: 18,
  };
  const [stats, search] = await Promise.all([
    getPublicPropertyStats(),
    searchPublicProperties(filters),
  ]);

  return (
    <PropertyPublicShell>
      <PropertyHero
        eyebrow="National Property Search"
        title="Search public property records without exposing private ownership data."
        description="Find public registry records by NPIN, application reference, location, property type, land use, keyword, registry status or verification status."
        searchDefault={filters.q}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-[#008751]" />
            <h2 className="text-xl font-black text-[#06172f]">Advanced filters</h2>
          </div>
          <form className="mt-5 space-y-3">
            <Input name="q" label="Keywords" defaultValue={filters.q} placeholder="Industrial land, school, farm..." />
            <Input name="npin" label="NPIN" defaultValue={filters.npin} placeholder="NPIN-LA-000000001" />
            <Input name="application_reference" label="Application Reference" defaultValue={filters.applicationReference} />
            <Input name="state" label="State" defaultValue={filters.state} />
            <Input name="lga" label="LGA" defaultValue={filters.lga} />
            <Input name="ward" label="Ward" defaultValue={filters.ward} />
            <Input name="community" label="Community" defaultValue={filters.community} />
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Property type</span>
              <select name="property_type" defaultValue={filters.propertyType} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold">
                <option value="">All types</option>
                {PROPERTY_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <Input name="land_use" label="Land use" defaultValue={filters.landUse} />
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Registry status</span>
              <select name="registry_status" defaultValue={filters.registryStatus} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold">
                <option value="">Any public status</option>
                <option value="approved">Approved</option>
                <option value="verified">Verified</option>
                <option value="active">Active</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Verification status</span>
              <select name="verification_status" defaultValue={filters.verificationStatus} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold">
                <option value="">Any</option>
                <option value="verified">Verified</option>
                <option value="approved">Approved</option>
              </select>
            </label>
            <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#06172f] text-sm font-black text-white">
              <Search className="h-4 w-4" />
              Apply filters
            </button>
          </form>
        </aside>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#008751]">Search results</p>
            <h1 className="mt-2 text-3xl font-black text-[#06172f]">{search.results.length} public records shown</h1>
            <p className="mt-2 text-sm text-slate-500">Showing privacy-safe property profiles only. Total matching count: {search.count}.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {POPULAR_PROPERTY_SEARCHES.map((item) => (
                <Link key={item} href={`/property/search?q=${encodeURIComponent(item)}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{item}</Link>
              ))}
            </div>
          </div>

          {search.results.length ? (
            <div className="grid gap-5 xl:grid-cols-2">
              {search.results.map((property) => <PropertyCard key={property.id} property={property} />)}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <h2 className="text-2xl font-black text-[#06172f]">No matching public property records</h2>
              <p className="mt-2 text-slate-500">Try a broader state, property type or keyword. Only approved/verified public records are searchable.</p>
              <p className="mt-4 text-sm font-bold text-slate-600">Suggested: {stats.states.slice(0, 4).map((state) => state.name).join(", ") || "Lagos, Ogun, FCT"}</p>
            </div>
          )}

          <PrivacyNotice />
        </div>
      </section>
    </PropertyPublicShell>
  );
}

function Input({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none ring-[#008751] focus:ring-2" />
    </label>
  );
}
