import { PublicPageShell } from "@/components/public/public-page-shell";
import { BeforeAfterJourney, CapabilityProofCard, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

export default function ForMsmesPage() {
  return (
    <PublicPageShell
      eyebrow="For MSMEs"
      title="From informal business to trusted digital enterprise."
      description="DBIN helps businesses create a trusted identity, build a public profile, organise operating records, prepare compliance evidence and access market or programme opportunities."
      primaryCta={{ label: "Start MSME registration", href: "/register/msme" }}
      secondaryCta={{ label: "See sample ID card", href: "/sample-id-card" }}
    >
      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <ProductStatusBadge status="Operational" />
          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">A practical journey, not just a certificate.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Register once, build useful records, become easier to verify and prepare for opportunities that require trust and evidence.
          </p>
        </div>
        <ProductFrame kind="identity" status="Operational" />
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="MSME journey" title="The full DBIN path for a growing business." />
        <div className="mt-8">
          <BeforeAfterJourney
            steps={[
              { title: "Informal business", text: "Start from scattered records, limited visibility and low institutional trust." },
              { title: "Register", text: "Create your DBIN profile and onboarding context." },
              { title: "Get trusted identity", text: "Prepare for credential and QR-backed verification." },
              { title: "Build your profile", text: "Publish services, sector, location and trust signals when eligible." },
              { title: "Use business tools", text: "Organise invoices, receipts, quotes and records." },
              { title: "Become compliance ready", text: "Track evidence, reminders and readiness items." },
              { title: "Access markets", text: "Use marketplace and programme pathways to become discoverable." },
              { title: "Grow", text: "Build finance and programme readiness through stronger records." },
            ]}
          />
        </div>
      </section>

      <section className="mt-14 grid gap-5 lg:grid-cols-3">
        <ProductFrame kind="operations" status="Available" />
        <ProductFrame kind="compliance" status="Available" />
        <ProductFrame kind="finance" status="Platform Capability" />
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <CapabilityProofCard title="Business identity" text="A trusted profile for verification and discovery." status="Operational" href="/platform/business-identity" />
        <CapabilityProofCard title="Invoice workspace" text="Operating records that show commercial activity." status="Available" href="/platform/business-tools" />
        <CapabilityProofCard title="Compliance checklist" text="Evidence and readiness workflows for better preparation." status="Available" href="/platform/compliance" />
        <CapabilityProofCard title="Marketplace visibility" text="A pathway to verified buyer discovery." status="Operational" href="/marketplace" />
        <CapabilityProofCard title="Finance readiness" text="Evidence-backed readiness, not guaranteed finance access." status="Platform Capability" href="/for-financial-institutions" />
      </section>
    </PublicPageShell>
  );
}
