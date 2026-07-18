import { PublicPageShell } from "@/components/public/public-page-shell";

export default function ForMsmesPage() {
  return (
    <PublicPageShell
      eyebrow="For MSMEs"
      title="Get verified, organised, and opportunity-ready with DBIN"
      description="Create your business identity, complete onboarding checks, structure your records, and unlock new opportunities with a public profile buyers can verify."
      primaryCta={{ label: "Start MSME registration", href: "/register/msme" }}
      secondaryCta={{ label: "See sample ID card", href: "/sample-id-card" }}
      highlights={[
        "Generate your digital business identity and track your verification status.",
        "Publish a public provider profile with services and quote intake.",
        "Build trust with verifiable identity, reviews, and complaint transparency.",
        "Use compliance and VAT/tax modules to stay operation-ready.",
      ]}
    />
  );
}
