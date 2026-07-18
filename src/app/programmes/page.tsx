import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Factory, Landmark, MapPinned, ReceiptText, ShieldCheck } from "lucide-react";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { CaseStudyProof, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

export const metadata: Metadata = {
  title: "Programme Workspaces",
  description: "See how DBIN powers reusable programme infrastructure for LCDBO, clusters, Revenue Guides, revenue intelligence, impact intelligence and property verification.",
  alternates: { canonical: "/programmes" },
};

const programmes = [
  {
    title: "LCDBO",
    status: "Live public surface" as const,
    normalizedStatus: "Pilot" as const,
    audience: "MSMEs, industrial partners, government and programme officers",
    objective: "Support non-oil local content, MSME capability and value-chain development.",
    uses: ["Business identity", "MSME enrolment", "Cluster interest", "Readiness review"],
    href: "/lcdbo",
    kind: "clusters" as const,
  },
  {
    title: "Industrial Clusters",
    status: "Programme capability" as const,
    normalizedStatus: "Programme capability" as const,
    audience: "MSMEs, cluster operators, state partners and investors",
    objective: "Coordinate participation, placement, documents, assessments and production-readiness pathways.",
    uses: ["Cluster registry", "Participation review", "Officer assignment", "Readiness assessment"],
    href: "/lcdbo/clusters",
    kind: "clusters" as const,
  },
  {
    title: "Revenue Guides",
    status: "Controlled demonstration" as const,
    normalizedStatus: "Controlled demonstration" as const,
    audience: "Revenue teams, state operators and field-support coordinators",
    objective: "Demonstrate a human operating model for readiness, follow-up and formalisation support.",
    uses: ["Guide desks", "Readiness cohorts", "Follow-up queues", "Local insight"],
    href: "/platform/intelligence",
    kind: "guides" as const,
  },
  {
    title: "NRS / Revenue Intelligence",
    status: "Controlled demonstration" as const,
    normalizedStatus: "Controlled demonstration" as const,
    audience: "Revenue leaders and institutional stakeholders",
    objective: "Show how DBIN-derived business activity signals can support planning, not official remittance.",
    uses: ["Invoice exposure", "VAT signal", "Compliance readiness", "Executive view"],
    href: "/platform/intelligence",
    kind: "revenue" as const,
  },
  {
    title: "Impact Intelligence",
    status: "Programme capability" as const,
    normalizedStatus: "Programme capability" as const,
    audience: "Development partners, programme teams and executives",
    objective: "Track evidence, KPIs, risks, data quality and executive reporting across programmes.",
    uses: ["KPI governance", "Snapshots", "Risk flags", "Executive briefings"],
    href: "/platform/intelligence",
    kind: "impact" as const,
  },
  {
    title: "DLPI / Property Intelligence",
    status: "Public verification surface" as const,
    normalizedStatus: "Public verification surface" as const,
    audience: "Public users, registries, state governments and asset stakeholders",
    objective: "Provide privacy-safe public property verification and registry-profile discovery.",
    uses: ["NPIN verification", "Public-safe profiles", "Registry search", "Credential status"],
    href: "/property",
    kind: "property" as const,
  },
  {
    title: "SICIP",
    status: "Coming soon" as const,
    normalizedStatus: "Coming soon" as const,
    audience: "Investors, DFIs, industrial partners and programme secretariats",
    objective: "Future investment programme capability for structured cluster opportunity pipelines.",
    uses: ["Investment readiness", "Cluster pipelines", "Partner workspaces", "Impact reporting"],
    href: "/programmes",
    kind: "finance" as const,
  },
];

const proof = [
  {
    label: "LCDBO programme infrastructure",
    challenge: "MSMEs need a way to join programme and cluster workflows.",
    capability: "Enrolment, cluster interest, review queues and operational dashboards.",
    demonstrates: "How DBIN can support real programme participation.",
    next: "Deeper partner onboarding and validated programme reporting.",
    status: "Pilot" as const,
    href: "/lcdbo",
  },
  {
    label: "Property public verification",
    challenge: "Property credentials need public trust without exposing private ownership data.",
    capability: "NPIN lookup and privacy-safe public profiles.",
    demonstrates: "How DBIN can extend verification principles to assets.",
    next: "Future GIS readiness after hardening.",
    status: "Public verification surface" as const,
    href: "/property",
  },
  {
    label: "Impact Intelligence workspace",
    challenge: "Programmes need evidence, risk and executive reporting.",
    capability: "KPI governance, snapshots, data-quality centre and briefings.",
    demonstrates: "How DBIN can organise programme accountability.",
    next: "Partner-specific reporting packs and source validation.",
    status: "Programme capability" as const,
    href: "/platform/intelligence",
  },
];

function StatusLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white">
      {label}
    </span>
  );
}

export default function ProgrammesPage() {
  return (
    <PublicPageShell
      eyebrow="Programme Workspaces"
      title="Reusable infrastructure for national and institutional programmes."
      description="DBIN powers programme surfaces through identity, verification, operating records, readiness evidence, participation workflows and intelligence—without presenting controlled demonstrations as national adoption."
      primaryCta={{ label: "Explore LCDBO", href: "/lcdbo" }}
      secondaryCta={{ label: "Partner with DBIN", href: "/partners" }}
    >
      <section className="mt-10">
        <SectionHeading
          eyebrow="Programme architecture"
          title="One infrastructure layer, multiple programme models."
          description="Each programme uses a different combination of DBIN capabilities. Status labels make clear what is public, pilot, controlled or future-facing."
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {programmes.map((programme) => (
            <article key={programme.title} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-4 p-5 md:grid-cols-[1fr_1fr]">
                <div>
                  <ProductStatusBadge status={programme.normalizedStatus} />
                  <h2 className="mt-4 text-2xl font-black text-slate-950">{programme.title}</h2>
                  <p className="mt-2 text-sm font-bold text-slate-500">{programme.audience}</p>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{programme.objective}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {programme.uses.map((use) => <span key={use} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{use}</span>)}
                  </div>
                  <Link href={programme.href} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-700">
                    Open pathway <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <ProductFrame kind={programme.kind} status={programme.normalizedStatus} className="shadow-none" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Identity and verification", ShieldCheck],
            ["Revenue and readiness", ReceiptText],
            ["Industrial coordination", Factory],
            ["Institutional monitoring", BarChart3],
            ["Public-sector capability", Landmark],
            ["Asset verification", MapPinned],
          ].map(([label, Icon]) => {
            const ItemIcon = Icon as typeof ShieldCheck;
            return (
              <div key={label as string} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <ItemIcon className="h-5 w-5 text-emerald-300" />
                <p className="mt-3 text-sm font-black">{label as string}</p>
                <StatusLabel label="DBIN layer" />
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="Implementation proof" title="Examples framed with the right governance labels." />
        <div className="mt-8">
          <CaseStudyProof items={proof} />
        </div>
      </section>
    </PublicPageShell>
  );
}
