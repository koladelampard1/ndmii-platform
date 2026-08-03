import Link from "next/link";
import { AlertTriangle, BadgeCheck, Database, FileSearch, MapPinned } from "lucide-react";
import { requireWorkspaceAccess } from "@/lib/workspaces/workspace-access-server";
import { getLcdboSourceCoverage, getStateOpportunitySummaries, sourceMetadata } from "@/lib/lcdbo/cluster-catalogue";
import { LcdboCommandMetricCard, LcdboEmptyState } from "@/components/lcdbo/lcdbo-visuals";

export default async function LcdboSourceIntelligencePage() {
  await requireWorkspaceAccess("lcdbo");
  const metadata = sourceMetadata();
  const coverage = getLcdboSourceCoverage();
  const states = getStateOpportunitySummaries();

  return (
    <section className="space-y-6">
      <header className="rounded-3xl bg-[#0B2E59] p-6 text-white shadow-lg sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f2c76b]">LCDBO source intelligence governance</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">RMRDC LGA resource source register</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{metadata.title}. Prepared by {metadata.prepared_by}, {metadata.publication_month}. This workspace is for reconciliation and governance, not automatic publication.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <LcdboCommandMetricCard icon={FileSearch} label="Source rows" value={coverage.sourceRows} />
        <LcdboCommandMetricCard icon={MapPinned} label="States/FCT" value={coverage.stateFctCoverage} />
        <LcdboCommandMetricCard icon={Database} label="Canonical LGA seed" value={coverage.currentCanonicalLgaSeedCount} />
        <LcdboCommandMetricCard icon={BadgeCheck} label="Exact matches" value={coverage.exactCanonicalMatches} />
        <LcdboCommandMetricCard icon={AlertTriangle} label="Review required" value={coverage.ambiguous} attention />
      </div>

      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <strong>Reconciliation limitation:</strong> current DBIN canonical geography seed contains {coverage.currentCanonicalLgaSeedCount} LGA records, so most RMRDC source rows remain pending reconciliation until a full constitutional LGA register is added.
      </article>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#0B2E59]">State source coverage</h2>
            <p className="mt-1 text-sm text-slate-600">Use this view to prioritise source-to-canonical review and anchor-product assessment.</p>
          </div>
          <Link href="/dashboard/lcdbo/data-quality" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-[#0B2E59]">Open Data Quality</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {states.map((state) => (
            <div key={state.state} className="rounded-xl bg-slate-50 p-4">
              <p className="font-black text-[#06172f]">{state.state}</p>
              <p className="mt-1 text-sm text-slate-600">{state.sourceRows} source rows · pages {state.sourcePages[0]}–{state.sourcePages[state.sourcePages.length - 1]}</p>
            </div>
          ))}
        </div>
      </section>

      {!states.length ? <LcdboEmptyState icon={FileSearch} title="No source rows loaded" detail="Run the extraction script and commit the governed source artifact before reconciliation can begin." /> : null}
    </section>
  );
}
