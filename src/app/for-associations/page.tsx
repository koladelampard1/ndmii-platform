import { PublicPageShell } from "@/components/public/public-page-shell";

export default function ForAssociationsPage() {
  return (
    <PublicPageShell
      eyebrow="For Associations"
      title="Digitally onboard members and strengthen market trust"
      description="Associations can use NDMII to scale member onboarding, improve verification quality, and provide stronger visibility for credible businesses."
      primaryCta={{ label: "Partner with NDMII", href: "/partners?segment=associations" }}
      secondaryCta={{ label: "Contact onboarding team", href: "/contact?topic=association-onboarding" }}
      highlights={[
        "Bulk-ready onboarding pathways for association member cohorts.",
        "Visibility into member verification and public trust indicators.",
        "Escalation workflow support for complaint and dispute signals.",
        "Institutional recognition benefits for compliant members.",
      ]}
    />
  );
}
