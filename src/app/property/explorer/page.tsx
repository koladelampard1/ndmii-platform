import Link from "next/link";
import { ArrowRight, BarChart3, Building2, MapPin, ShieldCheck } from "lucide-react";
import { getPublicStateExplorer } from "@/lib/data/public-property-explorer";
import { PrivacyNotice, PropertyHero, PropertyPublicShell } from "@/components/property/public-property-explorer";

export const dynamic = "force-dynamic";

export default async function PropertyExplorerPage() {
  const states = await getPublicStateExplorer();
  const activeStates = states.filter((state) => state.propertyCount > 0);

  return (
    <PropertyPublicShell>
      <PropertyHero
        eyebrow="State Explorer"
        title="Explore registry coverage across Nigerian states."
        description="Review public property counts, category signals, registry coverage and verification coverage by state. No GIS map or parcel boundary drawing is included in this phase."
      />
      <section className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="States listed" value={states.length} icon={MapPin} />
          <Metric label="States with public records" value={activeStates.length} icon={ShieldCheck} />
          <Metric label="Public properties" value={states.reduce((sum, state) => sum + state.propertyCount, 0)} icon={Building2} />
          <Metric label="Explorer mode" value="No map" icon={BarChart3} />
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {states.map((state) => (
            <article key={state.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">State registry signal</p>
                  <h2 className="mt-2 text-2xl font-black text-[#06172f]">{state.name}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{state.propertyCount} records</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info label="Registry coverage" value={`${state.registryCoverage}%`} />
                <Info label="Verification coverage" value={`${state.verificationCoverage}%`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(state.categories.length ? state.categories : ["Coverage emerging"]).map((category) => (
                  <span key={category} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{category}</span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-500">{state.industrialReadiness}</p>
              <Link href={`/property/search?state=${encodeURIComponent(state.name)}`} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-[#06172f]">
                Search {state.name}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <PrivacyNotice />
      </section>
    </PropertyPublicShell>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof MapPin }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="h-6 w-6 text-[#008751]" />
      <p className="mt-4 text-3xl font-black text-[#06172f]">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-500">{label}</p>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-[#06172f]">{value}</p>
    </div>
  );
}
