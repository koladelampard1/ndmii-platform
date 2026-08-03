import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MapPinned, Search } from "lucide-react";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { getStateOpportunitySummaries, sourceMetadata } from "@/lib/lcdbo/cluster-catalogue";
import { lcdboPublicHref } from "@/lib/lcdbo/content";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export const metadata: Metadata = {
  title: "LCDBO State and LGA Opportunity Explorer",
  description: "Search RMRDC source-based state and LGA resource intelligence for LCDBO opportunity exploration.",
  alternates: { canonical: `${LCDBO_CANONICAL_ORIGIN}/clusters/map` },
};

export default async function LcdboClusterMapPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = String(q ?? "").trim().toLowerCase();
  const states = getStateOpportunitySummaries();
  const filtered = states
    .map((state) => ({
      ...state,
      lgas: state.lgas.filter((lga) => !query || [state.state, lga.lga, lga.materialPreview].join(" ").toLowerCase().includes(query)),
    }))
    .filter((state) => state.lgas.length || state.state.toLowerCase().includes(query));

  return (
    <LcdboShell>
      <section className="bg-[#06172f] px-4 py-14 text-white sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">National opportunity explorer</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">State and LGA resource intelligence.</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">A non-GIS explorer for the {sourceMetadata().publication_month} RMRDC source. Geography remains official; anchor products remain pending institutional approval.</p>
        </div>
      </section>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#06172f]">Search state, LGA or material
            <div className="relative mt-2">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#008751]" />
              <input name="q" defaultValue={q} className="h-14 w-full rounded-xl border border-slate-200 pl-12 pr-4 text-sm font-semibold outline-none focus:border-[#008751] focus:ring-4 focus:ring-emerald-100" placeholder="Try Mushin, leather, cassava, limestone or Ondo" />
            </div>
          </label>
        </form>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((state) => (
            <article key={state.state} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <MapPinned className="h-6 w-6 text-[#008751]" />
              <h2 className="mt-4 text-2xl font-black text-[#06172f]">{state.state}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">{state.lgas.length} matching LGA source rows · {state.sourceRows} total source rows</p>
              <div className="mt-4 space-y-2">
                {state.lgas.slice(0, 5).map((lga) => (
                  <Link key={lga.publicReference} href={lcdboPublicHref(`/clusters/lga/${lga.publicReference}`)} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-[#06172f] hover:bg-emerald-50">
                    {lga.lga}<ArrowRight className="h-4 w-4 text-[#008751]" />
                  </Link>
                ))}
              </div>
              <Link href={lcdboPublicHref(`/clusters/state/${state.stateSlug}`)} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#008751]">Open state profile <ArrowRight className="h-4 w-4" /></Link>
            </article>
          ))}
        </div>
        {!filtered.length ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No state or LGA source rows match this search.</div> : null}
      </main>
    </LcdboShell>
  );
}
