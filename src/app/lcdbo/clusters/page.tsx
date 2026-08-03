import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Factory, FileSearch, MapPinned, ShieldCheck, type LucideIcon } from "lucide-react";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LCDBO_REGISTER_HREF, lcdboPublicHref } from "@/lib/lcdbo/content";
import {
  LCDBO_CLUSTER_DATA_CLASSES,
  RMRDC_SOURCE_DISCLOSURE,
  getLcdboSourceCoverage,
  getStateOpportunitySummaries,
  listApprovedPublicClusters,
  sourceMetadata,
} from "@/lib/lcdbo/cluster-catalogue";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export const metadata: Metadata = {
  title: "LCDBO Industrial Clusters | Opportunity Explorer and Catalogue Governance",
  description:
    "Explore LCDBO's governed national LGA resource intelligence, anchor-product model and approved public cluster catalogue foundation.",
  alternates: {
    canonical: `${LCDBO_CANONICAL_ORIGIN}/clusters`,
  },
};

export default async function LcdboClustersPage() {
  const metadata = sourceMetadata();
  const coverage = getLcdboSourceCoverage();
  const states = getStateOpportunitySummaries();
  const publishedClusters = await listApprovedPublicClusters();

  return (
    <LcdboShell landing>
      <section className="relative overflow-hidden bg-[#06172f] px-4 py-20 text-white sm:px-6 lg:py-24">
        <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-[#008751]/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl">
          <p className="inline-flex rounded-full border border-[#efc85d]/35 bg-[#efc85d]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">
            RMRDC Reference Source — 2017
          </p>
          <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[1.02] tracking-[-0.045em] sm:text-7xl">
            Nigeria’s LGA resource intelligence, governed for industrial-cluster development.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">
            {RMRDC_SOURCE_DISCLOSURE}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={lcdboPublicHref("/clusters/map")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">
              Explore States and LGAs <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={lcdboPublicHref("/clusters/catalogue")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">
              Approved Public Catalogue <BadgeCheck className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Governed distinction" title="Opportunity evidence is not the same as an approved cluster." description="LCDBO now separates RMRDC source intelligence, candidate anchor products, proposed opportunities and approved public cluster records." />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { title: "Source intelligence", detail: "Original RMRDC document rows with page provenance and source wording preserved.", Icon: FileSearch },
              { title: "Anchor-product governance", detail: "A future selection process for one approved primary industrial identity per LGA.", Icon: ShieldCheck },
              { title: "Opportunity explorer", detail: "Public evidence and proposed pathways that remain clearly marked as pending validation.", Icon: MapPinned },
              { title: "Approved catalogue", detail: "Only published, institutionally approved cluster records with stable public references.", Icon: Factory },
            ].map(({ title, detail, Icon }: { title: string; detail: string; Icon: LucideIcon }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 shadow-sm">
                <Icon className="h-6 w-6 text-[#008751]" />
                <h2 className="mt-5 text-lg font-black text-[#06172f]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f3f6f9] px-4 py-14 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Source coverage" title="RMRDC LGA reference extraction." description="The source has been extracted into a reviewable repository artifact. It is not automatically treated as approved anchor-product data." />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric value={coverage.sourceRows} label="source LGA rows extracted" />
            <Metric value={coverage.stateFctCoverage} label="states/FCT represented" />
            <Metric value={coverage.exactCanonicalMatches} label="current canonical LGA exact matches" />
            <Metric value={publishedClusters.length} label="published catalogue clusters" />
          </div>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <strong>Governance note:</strong> current DBIN seed geography contains {coverage.currentCanonicalLgaSeedCount} LGA records, so the system cannot honestly claim 774/774 canonical reconciliation yet. The source extraction contains {coverage.sourceRows} rows and must be reconciled against a complete constitutional LGA register before anchor products are approved.
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="National state explorer" title="Start with state-level source coverage." description={`${metadata.title}. Prepared by ${metadata.prepared_by}, ${metadata.publication_month}.`} />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {states.slice(0, 12).map((state) => (
              <Link key={state.state} href={lcdboPublicHref(`/clusters/state/${state.stateSlug}`)} className="group rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 transition hover:-translate-y-1 hover:border-[#008751]/40 hover:bg-white hover:shadow-xl">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">State opportunity profile</p>
                <h2 className="mt-2 text-2xl font-black text-[#06172f]">{state.state}</h2>
                <p className="mt-3 text-sm font-semibold text-slate-600">{state.sourceRows} source rows · pages {state.sourcePages[0]}–{state.sourcePages[state.sourcePages.length - 1]}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#008751]">Open profile <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
          <Link href={lcdboPublicHref("/clusters/map")} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#0B2E59] px-5 py-3 text-sm font-black text-white">
            View all states and LGAs <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionHeading dark eyebrow="Classification framework" title="Every public claim needs a label." description="These labels keep proposed opportunities, targets and approved records from being confused with operational facts." />
          <div className="mt-8 flex flex-wrap gap-2">
            {LCDBO_CLUSTER_DATA_CLASSES.map((label) => (
              <span key={label} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-100">{label}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[30px] border border-slate-200 bg-[#f8fafc] p-6 shadow-xl shadow-slate-200/70 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#008751]">Participate through DBIN</p>
            <h2 className="mt-2 text-3xl font-black text-[#06172f]">Enter the LCDBO pipeline as evidence becomes governed.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">MSMEs can register now. Approved catalogue records and LGA anchor-product decisions will be published only after institutional review.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={LCDBO_REGISTER_HREF} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f]">Register Your Business</Link>
            <Link href={lcdboPublicHref("/clusters/catalogue")} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-[#0B2E59]">View Catalogue</Link>
          </div>
        </div>
      </section>
    </LcdboShell>
  );
}

function SectionHeading({ eyebrow, title, description, dark = false }: { eyebrow: string; title: string; description: string; dark?: boolean }) {
  return <div className="max-w-3xl"><p className={`text-xs font-black uppercase tracking-[0.18em] ${dark ? "text-[#efc85d]" : "text-[#008751]"}`}>{eyebrow}</p><h2 className={`mt-3 text-4xl font-black tracking-tight sm:text-5xl ${dark ? "text-white" : "text-[#06172f]"}`}>{title}</h2><p className={`mt-4 text-base leading-7 ${dark ? "text-slate-300" : "text-slate-600"}`}>{description}</p></div>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-4xl font-black tracking-tight text-[#06172f]">{value.toLocaleString("en-NG")}</p><p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p></article>;
}
