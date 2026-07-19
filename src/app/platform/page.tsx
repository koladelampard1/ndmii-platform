import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Layers3, LockKeyhole, ShieldCheck } from "lucide-react";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { CapabilityProofCard, CaseStudyProof, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

export const metadata: Metadata = {
  title: "Platform Overview",
  description: "Explore DBIN as Nigeria’s digital business infrastructure for identity, verification, operations, compliance, opportunity, programmes and intelligence.",
  alternates: { canonical: "/platform" },
};

const architecture = [
  { title: "Identity", text: "Structured business profiles and credential-ready records.", href: "/platform/business-identity", status: "Operational" as const },
  { title: "Trust", text: "Public verification, QR credentials and discoverability.", href: "/verify", status: "Operational" as const },
  { title: "Operations", text: "Invoices, receipts, quotations and business records.", href: "/platform/business-tools", status: "Available" as const },
  { title: "Compliance", text: "Evidence, reminders and tax-readiness workflows.", href: "/platform/compliance", status: "Available" as const },
  { title: "Opportunity", text: "Marketplace, procurement, finance and programme pathways.", href: "/marketplace", status: "Operational" as const },
  { title: "Programmes", text: "LCDBO, clusters, Revenue Guides and institutional workspaces.", href: "/programmes", status: "Platform Capability" as const },
  { title: "Intelligence", text: "Business, revenue, impact and executive insight workspaces.", href: "/platform/intelligence", status: "Institutional Capability" as const },
  { title: "Infrastructure", text: "Property verification and physical asset intelligence services.", href: "/property", status: "Business Verification" as const },
];

const caseProof = [
  {
    label: "LCDBO programme infrastructure",
    challenge: "Industrial programmes need enrolment, readiness and participation workflows.",
    capability: "Programme workspace, cluster participation and review queues.",
    outcome: "Sector-specific operating layers for enterprise programmes.",
    next: "Broader partner onboarding and validated programme reporting.",
    status: "Available" as const,
    href: "/lcdbo",
  },
  {
    label: "Property public verification",
    challenge: "Public users need safe verification without owner-data exposure.",
    capability: "NPIN lookup, sanitized profiles and public verification services.",
    outcome: "Trust principles extended to physical assets.",
    next: "Future GIS and boundary intelligence after privacy safeguards.",
    status: "Business Verification" as const,
    href: "/property",
  },
  {
    label: "Revenue Intelligence",
    challenge: "Institutions need visibility without treating estimates as official tax records.",
    capability: "Derived exposure, readiness indicators and guide operations workspaces.",
    outcome: "Activity signals that can support governed public-sector planning.",
    next: "Institution-specific governance, validation and integration agreements.",
    status: "Institutional Capability" as const,
    href: "/platform/intelligence",
  },
];

export default function PlatformPage() {
  return (
    <PublicPageShell
      eyebrow="DBIN Platform"
      title="The business architecture behind trusted enterprise growth."
      description="DBIN connects business identity, public verification, operating tools, readiness evidence, opportunity pathways, programme delivery and intelligence into one reusable infrastructure layer."
      primaryCta={{ label: "Register your business", href: "/register" }}
      secondaryCta={{ label: "Partner with DBIN", href: "/partners" }}
    >
      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Why DBIN exists"
            title="A trusted business ecosystem needs connected records."
            description="Businesses should not need to restart trust-building every time they meet a buyer, association, lender, regulator or programme partner. DBIN creates reusable business records and safe verification services that can support many journeys."
          />
        </div>
        <ProductFrame kind="identity" status="Operational" />
      </section>

      <section className="mt-14">
        <SectionHeading
          eyebrow="Platform architecture"
          title="Identity to infrastructure, in eight practical layers."
          description="This is not technical plumbing. It is the operating map of how DBIN supports businesses and institutions."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {architecture.map((item) => (
            <CapabilityProofCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Security and governance</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] md:text-5xl">Built for controlled visibility.</h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Product storytelling uses fictional data and safe product experiences. In production workflows, DBIN separates public verification from private records, role-based dashboards and audit trails.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Role-based access", LockKeyhole],
              ["Public/private separation", ShieldCheck],
              ["Audit-ready workflows", ClipboardCheck],
              ["Interoperability-ready records", Layers3],
            ].map(([label, Icon]) => {
              const ItemIcon = Icon as typeof ShieldCheck;
              return (
                <div key={label as string} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <ItemIcon className="h-5 w-5 text-emerald-300" />
                  <p className="mt-3 text-sm font-black">{label as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-14">
        <SectionHeading
          eyebrow="Product showcase"
          title="The platform becomes visible through safe product frames."
          description="Each product experience uses fictional Nigerian business records and clear status labels."
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <ProductFrame kind="operations" status="Available" />
          <ProductFrame kind="impact" status="Platform Capability" />
          <ProductFrame kind="revenue" status="Institutional Capability" />
          <ProductFrame kind="property" status="Business Verification" />
        </div>
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="Institutional use cases" title="Proof without overstating adoption." />
        <div className="mt-8">
          <CaseStudyProof items={caseProof} />
        </div>
      </section>

      <section className="mt-14 rounded-[2rem] bg-emerald-700 p-6 text-white sm:p-8">
        <ProductStatusBadge status="Platform Capability" />
        <h2 className="mt-4 text-3xl font-black tracking-[-0.03em]">Ready to see how DBIN can support your ecosystem?</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-emerald-900">
            Register your business <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/partners" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-black text-white">
            Request an institutional briefing
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
