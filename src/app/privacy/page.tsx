import { PublicPageShell } from "@/components/public/public-page-shell";

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy Policy"
      title="How BIN handles personal and business data"
      description="BIN processes identity and business records to support verification, compliance simulation, and trusted digital participation across Nigeria's MSME ecosystem."
      primaryCta={{ label: "Contact operations desk", href: "/contact" }}
      secondaryCta={{ label: "Read cookie notice", href: "/cookies" }}
      highlights={[
        "BIN collects onboarding and profile data needed to issue Business Identity Numbers and verification credentials.",
        "Data from simulated NIN, BVN, CAC, and TIN adapters is used only for MVP demonstration and workflow testing.",
        "Role-based access controls limit dashboard visibility based on user type and authorized responsibilities.",
        "Operational logs and analytics are retained to improve platform reliability, fraud controls, and service quality.",
      ]}
    />
  );
}
