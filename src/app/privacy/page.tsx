import { PublicPageShell } from "@/components/public/public-page-shell";

type Section = {
  title: string;
  body: string;
};

const sections: Section[] = [
  {
    title: "Data we collect",
    body: "DBIN processes business profile data, identity references, verification status, compliance signals, marketplace activity, support and complaint records, and operational logs required to run the platform safely.",
  },
  {
    title: "Business profile data",
    body: "This includes business name, sector, operating location, contact channels, association affiliation, listing metadata, and profile updates submitted during onboarding and account maintenance.",
  },
  {
    title: "Identity and verification data",
    body: "DBIN stores identity reference fields and verification outcomes linked to submitted records. Sensitive identifiers are minimized and should not be unnecessarily exposed on public pages.",
  },
  {
    title: "Compliance and tax/VAT-related data",
    body: "The platform may process tax and compliance-related declarations, simulation outcomes, and workflow notes used for readiness, review routing, and business support operations.",
  },
  {
    title: "Marketplace and public profile data",
    body: "Public-facing listings can include approved business identity details, service categories, trust indicators, and profile summaries intended to improve discoverability and buyer confidence.",
  },
  {
    title: "Uploaded documents and images",
    body: "Documents or media submitted by users are processed for onboarding, profile quality, and verification workflows. Users must avoid uploading unrelated, excessive, or prohibited personal data.",
  },
  {
    title: "How we use data",
    body: "DBIN uses data to issue business identity records, support verification, route users to role-appropriate dashboards, resolve complaints, improve platform reliability, and monitor abuse.",
  },
  {
    title: "Public verification visibility",
    body: "Verification portals are designed to show limited status outputs needed for trust decisions while reducing exposure of sensitive personal and business identifiers.",
  },
  {
    title: "Role-based access controls",
    body: "Access to dashboard modules and record sets is controlled by user role, authorization scope, and session context. Users are expected to act only within assigned permissions.",
  },
  {
    title: "Data sharing with associations, institutions, regulators, partners, and service providers",
    body: "DBIN may share relevant records with authorized entities supporting onboarding, compliance, service delivery, hosting, analytics, and incident response, subject to operational need and confidentiality safeguards.",
  },
  {
    title: "Data retention",
    body: "Records are retained according to operational, legal, audit, and security requirements. Retention timelines may vary by data type, workflow status, and dispute handling obligations.",
  },
  {
    title: "Security controls",
    body: "DBIN applies layered controls such as access restrictions, monitored sessions, audit logs, and secure infrastructure practices. No online platform can guarantee absolute security, but risk reduction is continuously prioritized.",
  },
  {
    title: "User responsibilities",
    body: "Users must protect account credentials, maintain accurate records, and promptly report suspected unauthorized access or data misuse through official DBIN support channels.",
  },
  {
    title: "Your rights and correction requests",
    body: "You may request correction of inaccurate profile or identity-linked records and raise data handling concerns. DBIN reviews requests in line with role permissions and applicable obligations.",
  },
  {
    title: "Contact for privacy/data questions",
    body: "For privacy enquiries, correction requests, or data governance questions, contact the DBIN operations desk through the contact page.",
  },
];

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy Policy"
      title="How DBIN handles personal and business data"
      description="DBIN processes business profile data, identity references, verification status, compliance data, marketplace activity, support records, and operational logs to deliver secure, role-based services."
      primaryCta={{ label: "Contact operations desk", href: "/contact" }}
      secondaryCta={{ label: "Read cookie notice", href: "/cookies" }}
      highlights={[
        "Sensitive identifiers are minimized and should not be unnecessarily exposed on public pages.",
        "Data is used for identity issuance, verification workflows, support operations, and platform security.",
        "Access to records follows role-based permissions and monitored session controls.",
        "This policy describes DBIN operational practices and does not claim formal government endorsement.",
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
