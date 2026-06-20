import { ClusterCard, MapPlaceholder } from "@/components/lcdbo/lcdbo-cards";
import { LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";

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
        title="Cluster registry foundation for LCDBO pilots."
        description="Pilot cluster records are sourced from the DBIN platform foundation when available and will become the operating base for future LCDBO and SICIP modules."
      />
      <LcdboSection title="Pilot footprint" description="A map-style planning view for cluster geography. Full GIS integration is reserved for a later phase.">
        <MapPlaceholder clusters={clusters.length ? clusters : data.clusters} />
      </LcdboSection>
      <LcdboSection title="Cluster pipeline">
        <form className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
          <Select name="state" label="State" value={state} options={states} />
          <Select name="sector" label="Sector" value={sector} options={sectors} />
          <Select name="clusterType" label="Cluster type" value={clusterType} options={clusterTypes} />
          <Select name="status" label="Status" value={status} options={statuses} />
          <button className="self-end rounded-md bg-[#06172f] px-4 py-2 text-sm font-black text-white">Apply filters</button>
        </form>
        <div className="grid gap-4 lg:grid-cols-3">
          {clusters.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} />
          ))}
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
