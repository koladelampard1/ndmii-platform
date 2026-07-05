import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Landmark, MapPin, ShieldCheck } from "lucide-react";
import { POPULAR_PROPERTY_SEARCHES, getPublicPropertyStats, searchPublicProperties } from "@/lib/data/public-property-explorer";
import { PrivacyNotice, PropertyCard, PropertyHero, PropertyPublicShell, StatCard } from "@/components/property/public-property-explorer";

export const dynamic = "force-dynamic";

export default async function PropertyHomePage() {
  const [stats, featured] = await Promise.all([
    getPublicPropertyStats(),
    searchPublicProperties({ limit: 6 }),
  ]);

  const categoryCards = [
    { label: "Industrial properties", value: stats.industrial, href: "/property/search?property_type=industrial", icon: Building2 },
    { label: "Agricultural properties", value: stats.agricultural, href: "/property/search?property_type=agricultural", icon: MapPin },
    { label: "Government land", value: stats.government, href: "/property/search?property_type=government", icon: Landmark },
    { label: "Institutional land", value: stats.institutional, href: "/property/search?property_type=institutional", icon: ShieldCheck },
  ];

  return (
    <PropertyPublicShell>
      <PropertyHero
        title="Nigeria’s public gateway for verified property intelligence."
        description="Search privacy-safe public property records, verify NPIN credentials, explore state registry coverage and understand land information through the Digital Land Intelligence Platform."
      />

      <section className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Verified properties" value={stats.verified} detail="Public records with official NPIN visibility." />
          <StatCard label="Industrial" value={stats.industrial} detail="Industrial and production-oriented registry records." />
          <StatCard label="Agricultural" value={stats.agricultural} detail="Agricultural land and productive asset signals." />
          <StatCard label="States indexed" value={stats.states.length} detail="State explorer foundation without GIS maps." />
        </div>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="rounded-[2rem] bg-[#06172f] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#D4A017]">Popular searches</p>
            <h2 className="mt-3 text-3xl font-black">Start with common registry questions.</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {POPULAR_PROPERTY_SEARCHES.map((search) => (
                <Link key={search} href={`/property/search?q=${encodeURIComponent(search)}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20">
                  {search}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {categoryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.label} href={card.href} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <Icon className="h-6 w-6 text-[#008751]" />
                  <p className="mt-4 text-3xl font-black text-[#06172f]">{card.value}</p>
                  <p className="mt-1 font-black text-slate-700">{card.label}</p>
                  <p className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#008751]">Explore <ArrowRight className="h-4 w-4" /></p>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#008751]">Featured public records</p>
              <h2 className="mt-2 text-3xl font-black text-[#06172f]">Verified property profiles</h2>
            </div>
            <Link href="/property/search" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#06172f]">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {featured.results.length ? (
            <div className="grid gap-5 lg:grid-cols-3">
              {featured.results.map((property) => <PropertyCard key={property.id} property={property} />)}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <h3 className="text-2xl font-black text-[#06172f]">No public property records yet</h3>
              <p className="mt-2 text-slate-500">Approved and verified NPIN records will appear here once published by registry operations.</p>
            </div>
          )}
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {[
            ["State explorer", "Explore registry coverage and verification signals by state.", "/property/explorer"],
            ["Verify NPIN", "Confirm property credential status with a public lookup.", "/property/verify"],
            ["Learn DLPI", "Understand privacy, registry status and public records.", "/property/about"],
          ].map(([title, text, href]) => (
            <Link key={title} href={href} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1">
              <BookOpen className="h-6 w-6 text-[#008751]" />
              <h3 className="mt-4 text-xl font-black text-[#06172f]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
            </Link>
          ))}
        </section>

        <PrivacyNotice />
      </section>
    </PropertyPublicShell>
  );
}
