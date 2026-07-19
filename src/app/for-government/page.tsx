import { PublicPageShell } from "@/components/public/public-page-shell";
import { CapabilityProofCard, CaseStudyProof, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

const proof = [
  {
    label: "Revenue Intelligence",
    challenge: "Revenue teams need visibility without treating platform data as official remittance.",
    capability: "Governed views of invoice-derived exposure, VAT signals and readiness.",
    outcome: "Planning and guide operations supported by trusted signals.",
    next: "Institution-specific governance and validated integration scope.",
    status: "Institutional Capability" as const,
  },
  {
    label: "Impact Intelligence workspace",
    challenge: "Programmes need evidence, data quality and executive reporting.",
    capability: "KPI governance, snapshots, risk flags and briefings.",
    outcome: "Programme monitoring structured on DBIN.",
    next: "Partner-specific indicators and verified source pipelines.",
    status: "Platform Capability" as const,
  },
  {
    label: "Property public verification",
    challenge: "Asset credentials need public trust and privacy-safe disclosure.",
    capability: "NPIN lookup and sanitized public profile views.",
    outcome: "Registry verification made public without exposing private ownership data.",
    next: "Future GIS and boundary intelligence after public safety guardrails.",
    status: "Business Verification" as const,
    href: "/property",
  },
];

export default function ForGovernmentPage() {
  return (
    <PublicPageShell
      eyebrow="For Government & Regulators"
      title="Digital infrastructure for formalisation, readiness and public trust."
      description="DBIN is designed to support formalisation programmes, verified registries, regulator workspaces, compliance operations, revenue readiness, programme dashboards, impact monitoring and public verification."
      primaryCta={{ label: "Request an Institutional Briefing", href: "/partners?segment=government" }}
      secondaryCta={{ label: "Explore platform", href: "/platform" }}
    >
      <section className="mt-10 grid gap-5 lg:grid-cols-3">
        <ProductFrame kind="revenue" status="Institutional Capability" />
        <ProductFrame kind="impact" status="Platform Capability" />
        <ProductFrame kind="property" status="Business Verification" />
      </section>

      <section className="mt-14">
        <SectionHeading
          eyebrow="Institutional capability"
          title="Designed to support public-sector workflows without overclaiming authority."
          description="DBIN can help institutions see readiness and participation signals. Official adoption, tax remittance, registry status or regulatory determinations require separate authority and governance."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CapabilityProofCard title="Formalisation programmes" text="Coordinate identity, onboarding and readiness pathways." status="Platform Capability" />
          <CapabilityProofCard title="Regulator workspaces" text="Designed for governed review and evidence workflows." status="Platform Capability" />
          <CapabilityProofCard title="Compliance operations" text="Track readiness, evidence and renewal signals." status="Available" href="/platform/compliance" />
          <CapabilityProofCard title="Revenue readiness" text="Show derived exposure and readiness signals under appropriate governance." status="Institutional Capability" href="/platform/intelligence" />
          <CapabilityProofCard title="Revenue Guide networks" text="Coordinate local field support and business follow-up." status="Institutional Capability" />
          <CapabilityProofCard title="Industrial cluster coordination" text="Support LCDBO and cluster participation workflows." status="Available" href="/lcdbo" />
          <CapabilityProofCard title="Impact monitoring" text="Use KPI, snapshot and executive reporting infrastructure." status="Platform Capability" href="/platform/intelligence" />
          <CapabilityProofCard title="Property and asset intelligence" text="Connect public verification to privacy-safe property records." status="Business Verification" href="/property" />
        </div>
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="Product proof" title="Institutional use cases with safe labels." />
        <div className="mt-8">
          <CaseStudyProof items={proof} />
        </div>
      </section>

      <section className="mt-14 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <ProductStatusBadge status="Institutional Capability" />
        <h2 className="mt-4 text-xl font-black">Important governance boundary</h2>
        <p className="mt-2 text-sm leading-6">
          This page describes DBIN-powered programme and institutional capability. It does not imply formal adoption by NRS, BOI, any state government or regulator unless separately documented.
        </p>
      </section>
    </PublicPageShell>
  );
}
