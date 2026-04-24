import { PublicPageShell } from "@/components/public/public-page-shell";

type Section = {
  title: string;
  body: string;
};

const sections: Section[] = [
  {
    title: "Essential cookies",
    body: "BIN relies on essential cookies and session signals to keep core services available, maintain secure page flow, and support access to authorized public and account experiences.",
  },
  {
    title: "Authentication/session cookies",
    body: "When users sign in, session cookies help maintain authenticated state across requests so dashboard features can load safely without repeated login prompts.",
  },
  {
    title: "Role and access routing cookies",
    body: "BIN uses session context to route users to role-appropriate dashboards and prevent cross-role access to protected routes and records.",
  },
  {
    title: "Security cookies",
    body: "Security-related cookies and request checks support fraud detection, abuse prevention, route protection, and account integrity monitoring.",
  },
  {
    title: "Analytics/performance cookies",
    body: "Performance and analytics storage may be used to understand navigation quality, error trends, and page responsiveness so BIN can improve reliability and usability.",
  },
  {
    title: "User preferences",
    body: "Preference storage may retain language, display, or workflow convenience choices to improve repeat visits while preserving professional user experience.",
  },
  {
    title: "Managing cookies in browser settings",
    body: "You can review, delete, or block many cookies using browser controls. Settings usually appear under privacy, security, or site data preferences.",
  },
  {
    title: "Impact of disabling cookies",
    body: "Disabling essential cookies can prevent secure sign-in persistence, role-based dashboard routing, and access to protected account workflows. Public informational pages will usually remain available.",
  },
  {
    title: "Updates to cookie notice",
    body: "BIN may update this notice as platform controls evolve. Continued use after updates indicates acceptance of the current cookie and session practices.",
  },
];

export default function CookiesPage() {
  return (
    <PublicPageShell
      eyebrow="Cookie Notice"
      title="Cookie and session use on BIN"
      description="BIN uses cookies and session storage for authentication, dashboard routing, role-based access, security controls, analytics, and everyday usability improvements."
      primaryCta={{ label: "Open verification portal", href: "/verify" }}
      secondaryCta={{ label: "Back to homepage", href: "/" }}
      highlights={[
        "Essential session controls are required for secure dashboard access.",
        "Role-aware routing helps protect restricted modules from unauthorized access.",
        "Security cookies support abuse monitoring and route protection.",
        "Public pages remain available even when non-essential cookies are limited.",
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
