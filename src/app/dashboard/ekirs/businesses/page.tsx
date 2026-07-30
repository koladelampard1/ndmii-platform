import Link from "next/link";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState, WorkspaceToolbar } from "@/components/workspace/workspace-page";
import { EKIRS_JURISDICTION, EKITI_CONSTITUTIONAL_LGAS } from "@/lib/state-revenue/jurisdictions";
import { EKIRS_SECTORS, filterEkirsBusinesses, normalizeEkirsFilters } from "@/lib/state-revenue/ekirs-demo-data";
import { StateRevenueBusinessTable } from "@/components/state-revenue/state-revenue-components";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function SelectFilter({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <select name={name} defaultValue={value} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800">
        <option value="">All</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default async function EkirsBusinessesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = normalizeEkirsFilters({
    q: first(params.q),
    lga: first(params.lga),
    sector: first(params.sector),
    verification: first(params.verification),
    tin: first(params.tin),
    formality: first(params.formality),
  });
  const businesses = filterEkirsBusinesses(filters);

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Synthetic business registry"
        title="Business Registry"
        description="Review deterministic Ekiti business records by LGA, sector, verification level, formality and TIN-readiness signals."
        disclosure={EKIRS_JURISDICTION.demonstration.disclosure}
      />
      <form action="/dashboard/ekirs/businesses">
        <WorkspaceToolbar>
          <label className="grid min-w-[16rem] flex-1 gap-1 text-xs font-bold text-slate-600">
            Search
            <input name="q" defaultValue={filters.q} placeholder="Search BIN, business, LGA or sector" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800" />
          </label>
          <SelectFilter name="lga" label="LGA" value={filters.lga} options={EKITI_CONSTITUTIONAL_LGAS} />
          <SelectFilter name="sector" label="Sector" value={filters.sector} options={EKIRS_SECTORS} />
          <SelectFilter name="verification" label="Verification" value={filters.verification} options={["0", "1", "2", "3", "4"]} />
          <SelectFilter name="tin" label="TIN" value={filters.tin} options={["linked", "pending", "unlinked"]} />
          <SelectFilter name="formality" label="Formality" value={filters.formality} options={["formal", "informal", "transitioning"]} />
          <button type="submit" className="h-10 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800">Apply</button>
          <Link href="/dashboard/ekirs/businesses" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Reset</Link>
        </WorkspaceToolbar>
      </form>
      <WorkspaceSection title={`${businesses.length} records`} description="All rows are synthetic and safe for demonstration.">
        {businesses.length ? <StateRevenueBusinessTable businesses={businesses} getProfileHref={(business) => `/dashboard/ekirs/businesses/${encodeURIComponent(business.bin)}`} /> : <WorkspaceState type="filtered-zero" title="No matching records" description="Adjust the filters to view deterministic EKIRS demonstration records." />}
      </WorkspaceSection>
    </WorkspacePage>
  );
}
