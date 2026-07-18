import { PublicPageShell } from "@/components/public/public-page-shell";
import { BeforeAfterJourney, CapabilityProofCard, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

export default function ForAssociationsPage() {
  return (
    <PublicPageShell
      eyebrow="For Associations & Cooperatives"
      title="Turn member networks into verified, opportunity-ready portfolios."
      description="Associations can use DBIN to coordinate member onboarding, verification, collective visibility, programme participation, compliance support and reporting."
      primaryCta={{ label: "Onboard Your Association", href: "/partners?segment=associations" }}
      secondaryCta={{ label: "Contact onboarding team", href: "/contact?topic=association-onboarding" }}
    >
      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <ProductStatusBadge status="Available" />
          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">A member portfolio that can plug into programmes.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            DBIN helps associations move from informal member lists to structured records, verification status, programme matching and collective visibility.
          </p>
        </div>
        <ProductFrame kind="association" status="Available" />
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="Association journey" title="From member list to trusted network." />
        <div className="mt-8">
          <BeforeAfterJourney
            steps={[
              { title: "Prepare member cohort", text: "Organise member businesses and onboarding context." },
              { title: "Bulk-ready onboarding", text: "Support structured profile creation at member scale." },
              { title: "Member verification", text: "Track identity and readiness status across the portfolio." },
              { title: "Programme participation", text: "Connect qualified members to LCDBO, clusters and future programmes." },
              { title: "Compliance support", text: "Help members understand evidence and readiness requirements." },
              { title: "Reporting and engagement", text: "Use portfolio insight to support members and partners." },
            ]}
          />
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <CapabilityProofCard title="Member onboarding" text="Coordinate member records in structured workflows." status="Available" />
        <CapabilityProofCard title="Member verification" text="Improve credibility and trust visibility." status="Live" />
        <CapabilityProofCard title="Collective visibility" text="Present members as a more discoverable ecosystem." status="Available" />
        <CapabilityProofCard title="Programme onboarding" text="Prepare members for LCDBO and cluster participation." status="Pilot" href="/lcdbo" />
        <CapabilityProofCard title="Readiness support" text="Support compliance and evidence preparation." status="Pilot" href="/platform/compliance" />
      </section>
    </PublicPageShell>
  );
}
