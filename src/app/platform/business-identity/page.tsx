import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { BeforeAfterJourney, CapabilityProofCard, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

export const metadata: Metadata = {
  title: "Digital Business Identity",
  description: "See how DBIN business identity creates trusted profiles, digital credentials, QR verification and discoverability for Nigerian businesses.",
  alternates: { canonical: "/platform/business-identity" },
};

export default function BusinessIdentityPage() {
  return (
    <PublicPageShell
      eyebrow="Business Identity"
      title="A trusted digital identity for every credible business journey."
      description="DBIN helps businesses structure their profile, receive credential-ready records, verify publicly and participate more confidently in markets, associations and programmes."
      primaryCta={{ label: "Register Your Business", href: "/register" }}
      secondaryCta={{ label: "Verify a Business", href: "/verify" }}
    >
      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <ProductStatusBadge status="Live" />
          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">From informal presence to trusted profile.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            A DBIN identity connects business profile, verification state, public credential, marketplace visibility and programme participation using safe, reusable records.
          </p>
        </div>
        <ProductFrame kind="identity" status="Live" />
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="Verification journey" title="What a business identity enables." />
        <div className="mt-8">
          <BeforeAfterJourney
            steps={[
              { title: "Create profile", text: "Capture business name, sector, location and operating context." },
              { title: "Review readiness", text: "Prepare evidence and profile details for trust checks." },
              { title: "Issue credential", text: "Use a public-facing credential route once approved." },
              { title: "Verify publicly", text: "Customers and partners can confirm status through DBIN." },
              { title: "Publish profile", text: "Eligible businesses can be discovered through marketplace surfaces." },
              { title: "Join programmes", text: "Identity-linked businesses can enter programme and cluster workflows." },
            ]}
          />
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CapabilityProofCard title="Unique business profile" text="Structured public and private fields support safer business discovery." status="Live" />
        <CapabilityProofCard title="QR verification" text="Credential previews show how public verification confirms status." status="Live" href="/sample-id-card" />
        <CapabilityProofCard title="Trust and discoverability" text="Verified businesses can become easier to find and evaluate." status="Live" href="/marketplace" />
        <CapabilityProofCard title="Programme participation" text="Business identity creates a foundation for LCDBO and future programme workflows." status="Pilot" href="/lcdbo" />
      </section>

      <section className="mt-14 rounded-[2rem] bg-emerald-700 p-6 text-white sm:p-8">
        <BadgeCheck className="h-8 w-8 text-emerald-100" />
        <h2 className="mt-4 text-3xl font-black">Ready to create a DBIN business identity?</h2>
        <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-emerald-900">
          Register Your Business <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </PublicPageShell>
  );
}
