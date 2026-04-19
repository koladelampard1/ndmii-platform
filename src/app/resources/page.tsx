import Link from "next/link";
import { PublicPageShell } from "@/components/public/public-page-shell";

const RESOURCES = [
  { title: "MSME onboarding guide", body: "Step-by-step guidance for identity registration and profile readiness.", href: "/for-msmes" },
  { title: "Public verification guide", body: "How to confirm MSME IDs and use verifier outcomes safely.", href: "/verify" },
  { title: "Marketplace discovery", body: "Find trusted providers with category, location, and trust filters.", href: "/marketplace" },
  { title: "Sample digital ID card", body: "Understand card fields, QR logic, and verification confidence.", href: "/sample-id-card" },
];

export default function ResourcesPage() {
  return (
    <PublicPageShell
      eyebrow="Resources"
      title="Guides and tools for identity, verification, and discovery"
      description="Access practical resources for MSMEs, buyers, associations, and institutions using the NDMII platform."
      primaryCta={{ label: "Open marketplace", href: "/marketplace" }}
      secondaryCta={{ label: "Contact support", href: "/contact" }}
    >
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {RESOURCES.map((resource) => (
          <article key={resource.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{resource.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{resource.body}</p>
            <Link href={resource.href} className="mt-4 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800">
              Open resource
            </Link>
          </article>
        ))}
      </section>
    </PublicPageShell>
  );
}
