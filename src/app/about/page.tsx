import { PublicPageShell } from "@/components/public/public-page-shell";

export default function AboutPage() {
  return (
    <PublicPageShell
      eyebrow="About NDMII"
      title="Nigeria's trusted digital identity and discovery infrastructure for MSMEs"
      description="NDMII helps businesses become visible, verifiable, and procurement-ready through digital identity issuance, marketplace discovery, and verification tools built for public confidence."
      primaryCta={{ label: "Register your business", href: "/signup/msme" }}
      secondaryCta={{ label: "Verify an MSME", href: "/verify" }}
      highlights={[
        "Identity generation engine with verifiable MSME IDs and QR-backed records.",
        "Public marketplace for discovering approved providers by category and location.",
        "KYC simulation adapters for NIN, BVN, CAC, and TIN integrations.",
        "Regulator and institution readiness across compliance, complaints, and tax visibility.",
      ]}
    />
  );
}
