import { PublicPageShell } from "@/components/public/public-page-shell";

type Section = {
  title: string;
  body: string;
};

const sections: Section[] = [
  {
    title: "Acceptance of terms",
    body: "By visiting, registering, or using DBIN services, you agree to these terms and to use the platform only for lawful identity, verification, and participation purposes.",
  },
  {
    title: "Who may use DBIN",
    body: "DBIN is available to the public and to registered ecosystem users, including MSMEs, association officers, reviewers, FCCPC officers, FIRS officers, and platform administrators operating within assigned role permissions.",
  },
  {
    title: "Business onboarding responsibilities",
    body: "Applicants are responsible for completing onboarding steps accurately, providing required records, and maintaining current business details for identity issuance and workflow continuity.",
  },
  {
    title: "Accuracy of submitted business and identity information",
    body: "You must submit truthful business profile, ownership, and identity references. DBIN may flag, pause, or reject submissions that appear inconsistent, misleading, or incomplete.",
  },
  {
    title: "Verification and compliance simulations/disclaimers",
    body: "DBIN includes simulation layers for verification and compliance workflows to support operational readiness. Results should not be treated as formal legal, tax, or regulatory determinations without independent confirmation.",
  },
  {
    title: "Public verification records",
    body: "Selected verification status fields may be shown in public verification pages so buyers, partners, and institutions can confirm a business identity record without disclosing sensitive identifiers.",
  },
  {
    title: "Marketplace listings and provider profiles",
    body: "Businesses and service providers are responsible for listing content, service claims, and profile updates. DBIN may moderate or remove content that violates platform integrity or user safety standards.",
  },
  {
    title: "Prohibited use",
    body: "You may not misuse DBIN for fraud, impersonation, unauthorized data harvesting, malware activity, policy evasion, or attempts to bypass role controls and security safeguards.",
  },
  {
    title: "Role-based dashboard access",
    body: "Dashboard features are provided strictly by approved role assignment. Users must not attempt to view, export, or alter records beyond their authorization scope.",
  },
  {
    title: "Complaints, quote requests, and communication workflows",
    body: "Communication tools, complaint channels, and quote workflows are provided to support transparent interactions. Submissions should remain factual, professional, and relevant to legitimate service activity.",
  },
  {
    title: "Suspension or restriction of access",
    body: "DBIN may suspend, restrict, or terminate access where misuse, security threats, repeated policy breaches, or suspected unlawful conduct is identified.",
  },
  {
    title: "Limitation of liability",
    body: "DBIN is provided on an availability basis for business identity and workflow support. To the extent permitted by law, DBIN is not liable for indirect losses arising from reliance on user-submitted content or third-party actions.",
  },
  {
    title: "Updates to the terms",
    body: "Terms may be updated to reflect product changes, legal obligations, or security controls. Continued platform use after updates indicates acceptance of the revised terms.",
  },
  {
    title: "Contact/support",
    body: "For terms-related questions, operational concerns, or support requests, contact the DBIN operations team through the official contact page.",
  },
];

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Terms of Use"
      title="Digital Business Identity Network (DBIN) Terms of Use"
      description="These terms explain how DBIN supports business identity records, verification, marketplace discovery, onboarding workflows, and role-based dashboards across the ecosystem."
      primaryCta={{ label: "Register your business", href: "/register/msme" }}
      secondaryCta={{ label: "View privacy policy", href: "/privacy" }}
      highlights={[
        "Use DBIN lawfully and provide accurate business and identity information.",
        "Public verification pages display limited status records for trust and discovery.",
        "Dashboard access remains role-based and monitored through platform controls.",
        "DBIN may suspend activity that creates fraud, abuse, or security risk.",
      ]}
    >
      <div className="mt-8 space-y-6">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Last updated: April 2026</p>
        <section className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
            </article>
          ))}
        </section>
      </div>
    </PublicPageShell>
  );
}
