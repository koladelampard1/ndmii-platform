import { PublicPageShell } from "@/components/public/public-page-shell";

export default function ForMsmesPage() {
  return (
    <PublicPageShell
      eyebrow="For MSMEs"
      title="Get verified, trusted, and market-ready with NDMII"
      description="Create your business identity, complete onboarding checks, and unlock new opportunities with a public profile buyers can verify instantly."
      primaryCta={{ label: "Start MSME registration", href: "/register/msme" }}
      secondaryCta={{ label: "See sample ID card", href: "/sample-id-card" }}
      highlights={[
        "Generate your digital MSME ID and track your verification status.",
        "Publish a public provider profile with services and quote intake.",
        "Build trust with verifiable identity, reviews, and complaint transparency.",
        "Use compliance and VAT/tax modules to stay operation-ready.",
      ]}
    />
  );
}
