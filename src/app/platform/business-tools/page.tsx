import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { BeforeAfterJourney, CapabilityProofCard, ProductFrame, ProductStatusBadge, SectionHeading } from "@/components/public/product-showcase";

export const metadata: Metadata = {
  title: "Business Operating Tools",
  description: "Explore DBIN business tools for MSME invoicing, receipts, quotations, bookkeeping support, planning and operational readiness.",
  alternates: { canonical: "/platform/business-tools" },
};

export default function BusinessToolsPage() {
  return (
    <PublicPageShell
      eyebrow="Business Tools"
      title="DBIN helps businesses become easier to operate, document and understand."
      description="Beyond identity, DBIN supports practical operating records such as invoices, receipts, quote workflows, business documentation and readiness evidence."
      primaryCta={{ label: "Explore the MSME Journey", href: "/for-msmes" }}
      secondaryCta={{ label: "Register your business", href: "/register" }}
    >
      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <ProductStatusBadge status="Available" />
          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">Operating records become trust signals.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Fictional product experiences show how MSMEs can organise invoices, receipts, customer records and business planning evidence without exposing private customer data.
          </p>
        </div>
        <ProductFrame kind="operations" status="Available" />
      </section>

      <section className="mt-14">
        <SectionHeading eyebrow="Operating journey" title="From scattered records to institution-ready evidence." />
        <div className="mt-8">
          <BeforeAfterJourney
            steps={[
              { title: "Create invoices", text: "Issue structured invoices and track status." },
              { title: "Record receipts", text: "Keep evidence of paid and outstanding activity." },
              { title: "Manage quotes", text: "Respond to buyer requests with a clearer service trail." },
              { title: "Organise documents", text: "Prepare business evidence for compliance and partner review." },
              { title: "Plan growth", text: "Use business planning tools to clarify needs and opportunities." },
              { title: "Build readiness", text: "Turn operating maturity into finance and programme confidence." },
            ]}
          />
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CapabilityProofCard title="Invoices and receipts" text="Structured records help MSMEs prove operating activity." status="Available" />
        <CapabilityProofCard title="Quote workflows" text="Business opportunities can move through a cleaner request path." status="Available" />
        <CapabilityProofCard title="Bookkeeping support" text="Basic record organisation supports visibility and readiness." status="Available" />
        <CapabilityProofCard title="Finance readiness" text="Evidence-backed readiness is not a credit score, but can reduce information asymmetry." status="Platform Capability" />
      </section>

      <section className="mt-14 rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8">
        <h2 className="text-3xl font-black">A business identity is stronger when the business has records behind it.</h2>
        <Link href="/for-msmes" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-black text-emerald-950">
          Explore the MSME Journey <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </PublicPageShell>
  );
}
