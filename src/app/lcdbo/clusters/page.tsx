import { ClusterCard, MapPlaceholder } from "@/components/lcdbo/lcdbo-cards";
import { LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";
import Link from "next/link";
import { Filter, MapPinned } from "lucide-react";

function clean(value?: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed && trimmed !== "all" ? trimmed : "";
}

export default async function LcdboClustersPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; sector?: string; clusterType?: string; status?: string }>;
}) {
  const params = await searchParams;
  const data = await loadLcdboPublicData();
  const state = clean(params.state);
  const sector = clean(params.sector);
  const clusterType = clean(params.clusterType);
  const status = clean(params.status);
  const clusters = data.clusters.filter((cluster) => {
    if (state && cluster.state !== state) return false;
    if (sector && cluster.sector !== sector) return false;
    if (clusterType && cluster.clusterType !== clusterType) return false;
    if (status && cluster.status !== status) return false;
    return true;
  });
  const states = [...new Set(data.clusters.map((cluster) => cluster.state))].sort();
  const sectors = [...new Set(data.clusters.map((cluster) => cluster.sector))].sort();
  const clusterTypes = [...new Set(data.clusters.map((cluster) => cluster.clusterType))].sort();
  const statuses = [...new Set(data.clusters.map((cluster) => cluster.status))].sort();

  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="Industrial clusters"
        title="Discover Nigeria’s emerging industrial cluster pipeline."
        description="Explore LCDBO pilot clusters by location, sector, type and programme status, then enter the participation pathway through your DBIN business workspace."
      />
      <LcdboSection title="Pilot footprint" description="A map-style planning view for cluster geography. Full GIS integration is reserved for a later phase.">
        <MapPlaceholder clusters={clusters.length ? clusters : data.clusters} />
      </LcdboSection>
      <LcdboSection title="Cluster discovery" description={`${clusters.length} cluster${clusters.length === 1 ? "" : "s"} match the current view.`}>
        <form className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
          <Select name="state" label="State" value={state} options={states} />
          <Select name="sector" label="Sector" value={sector} options={sectors} />
          <Select name="clusterType" label="Cluster type" value={clusterType} options={clusterTypes} />
          <Select name="status" label="Status" value={status} options={statuses} />
          <button className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-[#0B2E59] px-4 py-2 text-sm font-black text-white"><Filter className="h-4 w-4" />Apply filters</button>
        </form>
        {(state || sector || clusterType || status) && <div className="mb-5 flex justify-end"><Link href="/lcdbo/clusters" className="text-sm font-black text-[#008751]">Clear all filters</Link></div>}
        <div className="grid gap-4 lg:grid-cols-3">
          {clusters.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} />
          ))}
          {!clusters.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center lg:col-span-3"><MapPinned className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-4 text-lg font-black text-[#0B2E59]">No clusters match these filters</h2><p className="mt-2 text-sm text-slate-500">Reset the filters to return to the national cluster pipeline.</p></div>}
        </div>
      </LcdboSection>
    </LcdboShell>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) {
  return (
    <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
      {label}
      <select name={name} defaultValue={value || "all"} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900">
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
