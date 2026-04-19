import { PublicPageShell } from "@/components/public/public-page-shell";

export default function ForFinancialInstitutionsPage() {
  return (
    <PublicPageShell
      eyebrow="For Financial Institutions"
      title="Onboard verified MSMEs with stronger confidence"
      description="Use NDMII identity and verification records to reduce due-diligence friction, improve customer trust signals, and accelerate MSME enablement workflows."
      primaryCta={{ label: "Partner with NDMII", href: "/partners?segment=financial-institutions" }}
      secondaryCta={{ label: "View verification portal", href: "/verify" }}
      highlights={[
        "Cross-check business identity before credit or service activation.",
        "Review trust and public profile indicators for underwriting context.",
        "Route institutions to coordinated partnership onboarding channels.",
        "Prepare for future live adapter integrations across identity systems.",
      ]}
    />
  );
}
