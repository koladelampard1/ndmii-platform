import { PublicPageShell } from "@/components/public/public-page-shell";

export default function ForGovernmentPage() {
  return (
    <PublicPageShell
      eyebrow="For Government"
      title="Improve MSME formalization and compliance visibility"
      description="NDMII supports regulatory stakeholders with trusted identity records, verification traceability, and operational transparency across public-facing MSME activities."
      primaryCta={{ label: "Explore partnership pathway", href: "/partners?segment=government" }}
      secondaryCta={{ label: "Contact NDMII", href: "/contact?topic=government" }}
      highlights={[
        "Verifiable identity issuance with public confirmation experiences.",
        "Structured complaint and operational workflow support.",
        "Signals for KYC, tax/VAT posture, and market legitimacy.",
        "Exportable reporting pathways for oversight teams.",
      ]}
    />
  );
}
