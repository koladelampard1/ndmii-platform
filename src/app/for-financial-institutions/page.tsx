import { PublicPageShell } from "@/components/public/public-page-shell";
import { BeforeAfterJourney, CapabilityProofCard, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

export default function ForFinancialInstitutionsPage() {
  return (
    <PublicPageShell
      eyebrow="For Financial Institutions & DFIs"
      title="Reduce information asymmetry with verified business evidence."
      description="DBIN helps financial partners understand business identity, operating maturity, readiness evidence, invoice activity and programme-linked MSME portfolios—without claiming formal credit scoring or guaranteed finance access."
      primaryCta={{ label: "Explore Institutional Partnership", href: "/partners?segment=financial-institutions" }}
      secondaryCta={{ label: "View verification portal", href: "/verify" }}
    >
      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <ProductStatusBadge status="Programme capability" />
          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">Better records before better capital deployment.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            DBIN can support consented diligence and pipeline visibility through identity, operating records, compliance evidence and programme participation signals.
          </p>
        </div>
        <ProductFrame kind="finance" status="Programme capability" />
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="Finance-readiness journey" title="From unknown applicant to evidence-backed business." />
        <div className="mt-8">
          <BeforeAfterJourney
            steps={[
              { title: "Verified identity", text: "Confirm business profile and public verification signals." },
              { title: "Operating maturity", text: "Review invoice, receipt and business-record patterns where authorised." },
              { title: "Compliance readiness", text: "Understand evidence status and readiness posture." },
              { title: "Consented diligence", text: "Use controlled workflows rather than scraping private records." },
              { title: "Portfolio intelligence", text: "See sector, geography and programme cohorts at aggregate level." },
              { title: "Pipeline visibility", text: "Identify businesses ready for support, not guaranteed credit approval." },
            ]}
          />
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CapabilityProofCard title="Verified business identity" text="Reduce onboarding uncertainty with public trust signals." status="Live" href="/platform/business-identity" />
        <CapabilityProofCard title="Invoice visibility" text="Operating evidence can support a clearer business picture where consented." status="Available" href="/platform/business-tools" />
        <CapabilityProofCard title="Compliance evidence" text="Readiness information helps partners understand documentation posture." status="Pilot" href="/platform/compliance" />
        <CapabilityProofCard title="Consented insights" text="Institutional use should remain controlled and permission-aware." status="Programme capability" />
        <CapabilityProofCard title="Portfolio intelligence" text="Aggregate sector and geographic patterns can support MSME portfolio design." status="Controlled demonstration" href="/platform/intelligence" />
        <CapabilityProofCard title="Investment readiness" text="DBIN can help create better-prepared MSME pipelines." status="Programme capability" href="/programmes" />
      </section>
    </PublicPageShell>
  );
}
