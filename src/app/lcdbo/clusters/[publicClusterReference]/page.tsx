import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, Factory } from "lucide-react";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { getApprovedPublicCluster, listApprovedPublicClusters } from "@/lib/lcdbo/cluster-catalogue";
import { LCDBO_REGISTER_HREF, lcdboPublicHref } from "@/lib/lcdbo/content";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export async function generateStaticParams() {
  const clusters = await listApprovedPublicClusters();
  return clusters.map((cluster) => ({ publicClusterReference: cluster.publicSlug }));
}

export async function generateMetadata({ params }: { params: Promise<{ publicClusterReference: string }> }): Promise<Metadata> {
  const { publicClusterReference } = await params;
  const cluster = await getApprovedPublicCluster(publicClusterReference);
  return {
    title: cluster ? `LCDBO ${cluster.name}` : "LCDBO Public Cluster Profile",
    description: cluster?.publicSummary ?? "Approved LCDBO public cluster profile.",
    alternates: { canonical: `${LCDBO_CANONICAL_ORIGIN}/clusters/${publicClusterReference}` },
  };
}

export default async function LcdboPublicClusterProfilePage({ params }: { params: Promise<{ publicClusterReference: string }> }) {
  const { publicClusterReference } = await params;
  const cluster = await getApprovedPublicCluster(publicClusterReference);
  if (!cluster) notFound();

  return (
    <LcdboShell>
      <section className="bg-[#06172f] px-4 py-14 text-white sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
            Approved Programme Cluster
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">{cluster.name}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{cluster.publicSummary}</p>
        </div>
      </section>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Public reference" value={cluster.publicReference} />
          <Metric label="Sector" value={cluster.sector} />
          <Metric label="Status" value={cluster.status.replaceAll("_", " ")} />
          <Metric label="Classification" value={cluster.dataClassification.replaceAll("_", " ")} />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Factory className="h-6 w-6 text-[#008751]" />
          <h2 className="mt-4 text-xl font-black text-[#06172f]">Public-safe cluster profile</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{cluster.description}</p>
          <p className="mt-4 text-xs font-bold text-slate-500">Last reviewed: {cluster.lastReviewedAt ? new Date(cluster.lastReviewedAt).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "review date pending"}</p>
        </section>
        <div className="flex flex-wrap gap-3">
          <Link href={LCDBO_REGISTER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f]">Register Your Business <ArrowRight className="h-4 w-4" /></Link>
          <Link href={lcdboPublicHref("/clusters/catalogue")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-[#0B2E59]">Back to Catalogue <BadgeCheck className="h-4 w-4" /></Link>
        </div>
      </main>
    </LcdboShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-2 break-words text-lg font-black capitalize text-[#06172f]">{value}</p></article>;
}
