import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { CapabilityProofCard, CaseStudyProof, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

export const metadata: Metadata = {
  title: "Business, Revenue & Impact Intelligence",
  description: "Explore DBIN intelligence previews for MSME business intelligence, revenue visibility, impact monitoring, risk signals and executive reporting.",
  alternates: { canonical: "/platform/intelligence" },
};

const proof = [
  {
    label: "NRS executive demonstration",
    challenge: "Revenue leaders need safe visibility without treating DBIN activity as official remittance.",
    capability: "Invoice-derived exposure, VAT signals and readiness indicators.",
    demonstrates: "How enterprise activity data can support controlled planning.",
    next: "Validated governance, integration scope and institution-specific authority.",
    status: "Controlled demonstration" as const,
  },
  {
    label: "Impact Intelligence workspace",
    challenge: "Programmes need evidence, risk and reporting confidence.",
    capability: "KPI governance, snapshots, risk flags and executive briefings.",
    demonstrates: "How DBIN can support programme accountability.",
    next: "More verified source data and partner-specific reporting templates.",
    status: "Programme capability" as const,
  },
  {
    label: "Revenue Guide operating model",
    challenge: "Field engagement requires targeted follow-up and readiness context.",
    capability: "Guide assignments, local cohorts and intervention signals.",
    demonstrates: "How DBIN can coordinate human support around data.",
    next: "Operational policy, field governance and validated roll-out model.",
    status: "Controlled demonstration" as const,
  },
];

export default function IntelligencePage() {
  return (
    <PublicPageShell
      eyebrow="Intelligence"
      title="Business, revenue, programme and impact intelligence—shown safely."
      description="DBIN intelligence previews show how trusted business records can support portfolio monitoring, executive reporting, risk visibility and programme decisions without exposing private dashboard data."
      primaryCta={{ label: "Request an Institutional Briefing", href: "/partners" }}
      secondaryCta={{ label: "Explore programmes", href: "/programmes" }}
    >
      <section className="mt-10 grid gap-5 lg:grid-cols-3">
        <ProductFrame kind="revenue" status="Controlled demonstration" />
        <ProductFrame kind="impact" status="Programme capability" />
        <ProductFrame kind="guides" status="Programme capability" />
      </section>

      <section className="mt-14">
        <SectionHeading
          eyebrow="Intelligence layer"
          title="From business activity to decision support."
          description="These previews are fictional and redacted. They demonstrate the shape of insight DBIN can support: readiness scoring, sector and geography patterns, risk monitoring, programme performance and executive snapshots."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CapabilityProofCard title="Revenue intelligence" text="Derived exposure signals from operating activity, not official tax ledgers." status="Controlled demonstration" />
          <CapabilityProofCard title="Risk monitoring" text="Risk flags and watchlists for programme and portfolio attention." status="Programme capability" />
          <CapabilityProofCard title="Executive dashboards" text="Summaries for decision-makers with clear data-quality boundaries." status="Programme capability" />
          <CapabilityProofCard title="Geographic insight" text="State, LGA and sector patterns for planning and programme delivery." status="Programme capability" />
        </div>
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="Proof examples" title="Demonstrations, not unsupported national claims." />
        <div className="mt-8">
          <CaseStudyProof items={proof} />
        </div>
      </section>

      <section className="mt-14 rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8">
        <ProductStatusBadge status="Controlled demonstration" />
        <Radar className="mt-5 h-8 w-8 text-emerald-300" />
        <h2 className="mt-4 text-3xl font-black">Explore DBIN intelligence with the right governance frame.</h2>
        <Link href="/partners" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-black text-emerald-950">
          Request an Institutional Briefing <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </PublicPageShell>
  );
}
