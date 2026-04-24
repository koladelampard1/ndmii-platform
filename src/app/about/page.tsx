import { PublicPageShell } from "@/components/public/public-page-shell";

export default function AboutPage() {
  return (
    <PublicPageShell
      eyebrow="About the Business Identity Network"
      title="NDMII is Nigeria's Business Identity Network for trusted MSME participation"
      description="The NDMII Business Identity Network connects MSMEs, associations, regulators, and buyers through one trusted identity layer. It enables discoverability, compliance readiness, and safer transactions across Nigeria's formal and informal economy."
      primaryCta={{ label: "Register your business", href: "/register/msme" }}
      secondaryCta={{ label: "Verify an MSME", href: "/verify" }}
      highlights={[
        "National MSME identity issuance with automated Business Identity Numbers and QR-backed records.",
        "Cross-role network access for MSMEs, associations, reviewers, FCCPC, FIRS, and administrators.",
        "Adapter-based trust integrations for NIN, BVN, CAC, and TIN verification workflows.",
        "Built-in civic compliance tooling for complaints resolution, tax/VAT simulation, and audit-ready reporting.",
      ]}
    />
  );
}
