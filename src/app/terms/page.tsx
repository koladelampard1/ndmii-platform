import { PublicPageShell } from "@/components/public/public-page-shell";

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Terms of Use"
      title="Business Identity Network (BIN) Terms of Use"
      description="These terms govern access to BIN public pages, identity verification tools, onboarding workflows, and role-based dashboards used by MSMEs, associations, and regulators."
      primaryCta={{ label: "Register your business", href: "/register/msme" }}
      secondaryCta={{ label: "View privacy policy", href: "/privacy" }}
      highlights={[
        "BIN services are provided for lawful onboarding, identity verification, and ecosystem compliance workflows.",
        "Users must provide accurate profile, identity, and compliance data during onboarding and updates.",
        "Regulatory and association roles may access restricted dashboards only within approved authorization scope.",
        "BIN may suspend misuse, fraudulent activity, or attempts to bypass access controls.",
      ]}
    />
  );
}
