import { PublicPageShell } from "@/components/public/public-page-shell";

export default function AboutPage() {
  return (
    <PublicPageShell
      eyebrow="About Digital Business Identity Network (DBIN)"
      title="DBIN is Nigeria's Digital Business Identity Network (DBIN) for trusted MSME participation"
      description="Digital Business Identity Network (DBIN) is an independent business identity and verification network for MSMEs, associations, institutions, marketplaces, lenders, and buyers. DBIN helps participants discover trusted businesses, improve compliance readiness, and transact with greater confidence across Nigeria's formal and informal economy."
      primaryCta={{ label: "Register your business", href: "/register/msme" }}
      secondaryCta={{ label: "Verify an MSME", href: "/verify" }}
      highlights={[
        "Business identity credential issuance with automated Business Identity Numbers and QR-backed records.",
        "Cross-role network access for MSMEs, associations, reviewers, FCCPC, FIRS, and administrators.",
        "Adapter-based trust integrations for NIN, BVN, CAC, and TIN verification workflows.",
        "Built-in civic compliance tooling for complaints resolution, tax/VAT simulation, and audit-ready reporting.",
      ]}
    />
  );
}
