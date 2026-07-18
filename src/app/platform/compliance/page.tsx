import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { BeforeAfterJourney, CapabilityProofCard, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

export const metadata: Metadata = {
  title: "Compliance & Tax Readiness",
  description: "Explore DBIN compliance readiness, evidence workflows, reminders, VAT exposure previews and regulator-ready business signals.",
  alternates: { canonical: "/platform/compliance" },
};

export default function CompliancePage() {
  return (
    <PublicPageShell
      eyebrow="Compliance & Tax Readiness"
      title="Readiness infrastructure for businesses and institutions."
      description="DBIN supports compliance evidence, readiness tracking, reminders and controlled tax-readiness visibility. It does not claim official tax filing, live TIN validation or official VAT remittance."
      primaryCta={{ label: "Explore MSME readiness", href: "/for-msmes" }}
      secondaryCta={{ label: "Request institutional briefing", href: "/partners" }}
    >
      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <ProductStatusBadge status="Pilot" />
          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">Evidence first. Official integration only when authorised.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Compliance previews use careful language: readiness, evidence, visibility, regulator workflow and integration-ready signals—not official filing or assessment.
          </p>
        </div>
        <ProductFrame kind="compliance" status="Pilot" />
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="Readiness workflow" title="A safer path from records to regulatory confidence." />
        <div className="mt-8">
          <BeforeAfterJourney
            steps={[
              { title: "Understand requirements", text: "Businesses see what evidence may be needed for readiness." },
              { title: "Submit evidence", text: "Documents and references can be organised for review workflows." },
              { title: "Track status", text: "Items move through submitted, under review, changes requested and approved states." },
              { title: "Receive reminders", text: "Renewals and deadlines become easier to manage." },
              { title: "View exposure", text: "Invoice-derived VAT exposure can be shown as a controlled readiness signal." },
              { title: "Support review", text: "Institutions can use controlled workspaces where authorised." },
            ]}
          />
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CapabilityProofCard title="Compliance centre" text="Track requirements, evidence and readiness status." status="Pilot" />
        <CapabilityProofCard title="Evidence review" text="Support structured review without exposing public-private records." status="Pilot" />
        <CapabilityProofCard title="Reminder workflow" text="Help businesses stay ahead of deadlines and renewals." status="Available" />
        <CapabilityProofCard title="Regulator-ready visibility" text="Designed to support controlled institutional workflows." status="Programme capability" />
      </section>

      <section className="mt-14 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-xl font-black">Claims boundary</h2>
        <p className="mt-2 text-sm leading-6">
          DBIN readiness previews are not official tax filings, remittance ledgers, TIN validations, VAT assessments or government determinations. They are designed to support better records and controlled institutional workflows.
        </p>
        <Link href="/partners" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-amber-950">
          Request an institutional briefing <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </PublicPageShell>
  );
}
