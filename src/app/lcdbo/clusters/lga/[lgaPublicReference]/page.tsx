import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Factory, FileSearch, ShieldAlert } from "lucide-react";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { RMRDC_SOURCE_DISCLOSURE, getLgaResourceProfile, publicLgaReference, sourceRows } from "@/lib/lcdbo/cluster-catalogue";
import { LCDBO_REGISTER_HREF, lcdboPublicHref } from "@/lib/lcdbo/content";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export async function generateStaticParams() {
  return sourceRows().map((row) => ({
    lgaPublicReference: publicLgaReference(row.normalised_state, row.source_lga_label),
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ lgaPublicReference: string }> }): Promise<Metadata> {
  const { lgaPublicReference } = await params;
  const profile = getLgaResourceProfile(lgaPublicReference);
  return {
    title: profile ? `LCDBO ${profile.summary.lga} Resource Profile` : "LCDBO LGA Resource Profile",
    description: profile ? `RMRDC source-based raw-material and opportunity evidence for ${profile.summary.lga}, ${profile.summary.state}.` : "LCDBO LGA resource profile.",
    alternates: { canonical: `${LCDBO_CANONICAL_ORIGIN}/clusters/lga/${lgaPublicReference}` },
  };
}

export default async function LcdboLgaResourceProfilePage({ params }: { params: Promise<{ lgaPublicReference: string }> }) {
  const { lgaPublicReference } = await params;
  const profile = getLgaResourceProfile(lgaPublicReference);
  if (!profile) notFound();
  const { row, summary } = profile;

  return (
    <LcdboShell>
      <section className="bg-[#06172f] px-4 py-14 text-white sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Canonical LGA resource profile</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{summary.lga}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{summary.state} · Public reference {summary.publicReference}</p>
        </div>
      </section>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <section className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <FileSearch className="h-6 w-6 text-[#008751]" />
            <h2 className="mt-4 text-xl font-black text-[#06172f]">Source attribution</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Info label="Source" value="RMRDC Reference Source — 2017" />
              <Info label="Source page" value={String(row.source_page)} />
              <Info label="Original state label" value={row.source_state_label} />
              <Info label="Original LGA label" value={row.source_lga_label_original} />
              <Info label="Extraction confidence" value={row.extraction_confidence.replaceAll("_", " ")} />
            </dl>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ShieldAlert className="h-6 w-6 text-amber-600" />
            <h2 className="mt-4 text-xl font-black text-[#06172f]">Anchor-product status</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{RMRDC_SOURCE_DISCLOSURE}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Badge label="Candidate Anchor Product" value="Not selected" />
              <Badge label="Approved Anchor Product" value="None" />
              <Badge label="Cluster Concept" value="Pending assessment" />
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-[#06172f]">Source-listed raw materials and investment opportunities</h2>
          <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">{row.source_material_and_opportunity_text}</p>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          The official LGA name remains {summary.lga}. Any future “{summary.lga} [Anchor Product] Industrial Cluster” identity must be institutionally approved before publication.
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href={LCDBO_REGISTER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f]">Register Your Business <ArrowRight className="h-4 w-4" /></Link>
          <Link href={lcdboPublicHref(`/clusters/state/${summary.stateSlug}`)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-[#0B2E59]">Back to State <Factory className="h-4 w-4" /></Link>
        </div>
      </main>
    </LcdboShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</dt><dd className="mt-1 font-bold text-[#06172f]">{value}</dd></div>;
}

function Badge({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-[#06172f]">{value}</p></div>;
}
