import Link from "next/link";
import { PublicPageShell } from "@/components/public/public-page-shell";

const PARTNER_SEGMENTS = [
  { title: "Associations", description: "Onboard member businesses and coordinate verification at scale.", href: "/for-associations" },
  { title: "Government agencies", description: "Advance MSME formalization and compliance operations.", href: "/for-government" },
  { title: "Financial institutions", description: "Reduce onboarding risk with verifiable MSME identity signals.", href: "/for-financial-institutions" },
  { title: "Procurement platforms", description: "Source trusted providers from verified business listings.", href: "/marketplace" },
];

export default function PartnersPage() {
  return (
    <PublicPageShell
      eyebrow="Partnerships"
      title="Partner with NDMII to scale trusted MSME outcomes"
      description="We work with public institutions, private partners, and trade bodies to strengthen verified market participation for Nigerian MSMEs."
      primaryCta={{ label: "Submit partnership interest", href: "/contact?topic=partnership" }}
      secondaryCta={{ label: "Explore resources", href: "/resources" }}
    >
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {PARTNER_SEGMENTS.map((segment) => (
          <article key={segment.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{segment.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{segment.description}</p>
            <Link href={segment.href} className="mt-4 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800">
              Learn more
            </Link>
          </article>
        ))}
      </section>
    </PublicPageShell>
  );
}
