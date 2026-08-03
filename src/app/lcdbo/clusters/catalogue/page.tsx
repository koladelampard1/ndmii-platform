import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, ShieldCheck } from "lucide-react";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { listApprovedPublicClusters } from "@/lib/lcdbo/cluster-catalogue";
import { lcdboPublicHref } from "@/lib/lcdbo/content";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export const metadata: Metadata = {
  title: "LCDBO Approved Public Cluster Catalogue",
  description: "Official LCDBO public cluster catalogue containing only institutionally approved published cluster records.",
  alternates: { canonical: `${LCDBO_CANONICAL_ORIGIN}/clusters/catalogue` },
};

export default async function LcdboApprovedClusterCataloguePage() {
  const clusters = await listApprovedPublicClusters();

  return (
    <LcdboShell>
      <section className="bg-[#06172f] px-4 py-14 text-white sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Approved public catalogue</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Institutionally approved LCDBO clusters only.</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">This catalogue excludes proposed opportunities, generated themes, fallback records, SICIP records, UAT data and unpublished programme records.</p>
        </div>
      </section>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
          <strong>Catalogue rule:</strong> a cluster appears here only when it has a stable public reference, public-safe summary, LCDBO programme ownership, institutional approval and publication status.
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clusters.map((cluster) => (
            <Link key={cluster.publicReference} href={lcdboPublicHref(`/clusters/${cluster.publicSlug}`)} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
              <BadgeCheck className="h-6 w-6 text-[#008751]" />
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-[#008751]">{cluster.dataClassification.replaceAll("_", " ")}</p>
              <h2 className="mt-2 text-xl font-black text-[#06172f]">{cluster.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{cluster.publicSummary}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#008751]">Open public profile <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
        {!clusters.length ? (
          <section className="mt-8 rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <ShieldCheck className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-2xl font-black text-[#06172f]">No approved public clusters are published yet.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">The opportunity explorer remains available, but the official catalogue will stay empty until records pass institutional approval and publication governance.</p>
            <Link href={lcdboPublicHref("/clusters/map")} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0B2E59] px-5 py-3 text-sm font-black text-white">Explore opportunities <ArrowRight className="h-4 w-4" /></Link>
          </section>
        ) : null}
      </main>
    </LcdboShell>
  );
}
