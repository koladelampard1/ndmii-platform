import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, FileSearch, MapPinned, type LucideIcon } from "lucide-react";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { getStateOpportunitySummaries, getStateOpportunitySummary } from "@/lib/lcdbo/cluster-catalogue";
import { lcdboPublicHref } from "@/lib/lcdbo/content";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export async function generateStaticParams() {
  return getStateOpportunitySummaries().map((state) => ({ stateSlug: state.stateSlug }));
}

export async function generateMetadata({ params }: { params: Promise<{ stateSlug: string }> }): Promise<Metadata> {
  const { stateSlug } = await params;
  const state = getStateOpportunitySummary(stateSlug);
  return {
    title: state ? `LCDBO ${state.state} LGA Resource Opportunities` : "LCDBO State Resource Opportunities",
    description: state ? `RMRDC source-based LGA resource intelligence for ${state.state}.` : "LCDBO state resource profile.",
    alternates: { canonical: `${LCDBO_CANONICAL_ORIGIN}/clusters/state/${stateSlug}` },
  };
}

export default async function LcdboStateClusterProfilePage({ params }: { params: Promise<{ stateSlug: string }> }) {
  const { stateSlug } = await params;
  const state = getStateOpportunitySummary(stateSlug);
  if (!state) notFound();

  return (
    <LcdboShell>
      <section className="bg-[#06172f] px-4 py-14 text-white sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">State opportunity profile</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{state.state}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{state.sourceRows} RMRDC source rows across pages {state.sourcePages[0]}–{state.sourcePages[state.sourcePages.length - 1]}. Candidate anchor products remain pending institutional validation.</p>
        </div>
      </section>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <Metric icon={FileSearch} label="Source rows" value={state.sourceRows} />
          <Metric icon={MapPinned} label="LGA labels" value={state.lgas.length} />
          <Metric icon={BadgeCheck} label="Approved anchor products" value={0} />
        </section>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          This page is an opportunity profile, not an official cluster catalogue. The LGA names below preserve source labels from the 2017 RMRDC document and must be reconciled against DBIN’s canonical geography before anchor products are approved.
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.lgas.map((lga) => (
            <Link key={lga.publicReference} href={lcdboPublicHref(`/clusters/lga/${lga.publicReference}`)} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#008751]">{lga.sourceClassification}</p>
              <h2 className="mt-2 text-xl font-black text-[#06172f]">{lga.lga}</h2>
              <p className="mt-2 text-xs font-bold text-slate-500">Source page {lga.sourcePage} · Anchor product pending validation</p>
              <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">{lga.materialPreview}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#008751]">Open LGA profile <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </section>
      </main>
    </LcdboShell>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-[#008751]" /><p className="mt-5 text-3xl font-black text-[#06172f]">{value.toLocaleString("en-NG")}</p><p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p></article>;
}
