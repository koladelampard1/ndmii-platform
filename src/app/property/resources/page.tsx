import Link from "next/link";
import { ArrowRight, BookOpen, FileSearch, ShieldCheck } from "lucide-react";
import { PropertyHero, PropertyPublicShell } from "@/components/property/public-property-explorer";

const resources = [
  {
    title: "Understanding NPIN",
    text: "How National Property Identification Numbers support public verification without exposing ownership details.",
    href: "/property/help#npin",
  },
  {
    title: "Registry status guide",
    text: "What approved, verified, active, suspended and unavailable statuses mean on public records.",
    href: "/property/help#statuses",
  },
  {
    title: "Privacy and public data",
    text: "What DLPI publishes, what it withholds, and why sensitive ownership data is protected.",
    href: "/property/help#privacy",
  },
];

export default function PropertyResourcesPage() {
  return (
    <PropertyPublicShell>
      <PropertyHero
        eyebrow="Property Resources"
        title="Learn how to use public property records responsibly."
        description="Guidance for citizens, institutions, investors and public-sector stakeholders using the DLPI public explorer."
      />
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {resources.map((resource, index) => {
            const Icon = index === 0 ? ShieldCheck : index === 1 ? FileSearch : BookOpen;
            return (
              <Link key={resource.title} href={resource.href} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1">
                <Icon className="h-7 w-7 text-[#008751]" />
                <h2 className="mt-5 text-xl font-black text-[#06172f]">{resource.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{resource.text}</p>
                <p className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#008751]">Read guide <ArrowRight className="h-4 w-4" /></p>
              </Link>
            );
          })}
        </div>
      </section>
    </PropertyPublicShell>
  );
}
