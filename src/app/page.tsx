import Link from "next/link";
import { ShieldCheck, Search, MapPin, BadgeCheck } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { Button } from "@/components/ui/button";
import { getMarketplaceLandingData } from "@/lib/data/marketplace";

const DEV_MODE = process.env.NODE_ENV !== "production";

function HomepageProviderSection({
  sectionName,
  providers,
  className,
}: {
  sectionName: string;
  providers: Parameters<typeof ProviderCard>[0]["provider"][];
  className: string;
}) {
  if (providers.length === 0) return null;

  return (
    <>
      {DEV_MODE && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Debug:</strong> {sectionName} • rows={providers.length} • first_public_slug={providers[0]?.public_slug ?? "n/a"}
        </div>
      )}
      <div className={className}>
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </>
  );
}

export default async function LandingPage() {
  const { topRated, featured, recentlyTrusted, categories } = await getMarketplaceLandingData();
  if (DEV_MODE) {
    console.info("[homepage-render] topRatedProviders.length", topRated.length);
    console.info("[homepage-render] featuredProviders.length", featured.length);
    console.info("[homepage-render] recentProviders.length", recentlyTrusted.length);
    console.info("[homepage-render] topRatedProviders[0]", topRated[0] ?? null);
    console.info("[homepage-render] featuredProviders[0]", featured[0] ?? null);
    console.info("[homepage-render] recentProviders[0]", recentlyTrusted[0] ?? null);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-14 pt-10 md:pt-16">
        <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#111827_45%,#052e2b_100%)] p-8 text-white md:p-12">
          <p className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            National verified marketplace
          </p>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight md:text-5xl">
            Find verified artisans, businesses, and MSMEs across Nigeria.
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-slate-200 md:text-base">
            Discover trusted providers by category, specialization, and location—powered by the NDMII verification infrastructure.
          </p>

          <form action="/search" className="mt-8 rounded-2xl bg-white p-2 shadow-xl">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-slate-800">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  name="q"
                  placeholder="Search provider name, service, or ID"
                  className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <Button type="submit" className="h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                Search marketplace
              </Button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            {categories.slice(0, 6).map((category) => (
              <Link
                key={category}
                href={`/search?category=${encodeURIComponent(category)}&verification=verified_or_approved`}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/20"
              >
                {category}
              </Link>
            ))}
            <Link href="/categories" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/20">
              Browse all categories
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-12 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "NDMII Verified", body: "Only approved providers from the federal registry appear in public marketplace search." },
          { icon: MapPin, title: "Location Precision", body: "Filter by state and LGA to quickly find providers near your market or project site." },
          { icon: BadgeCheck, title: "Trust Signals", body: "Ratings, review summaries, and trust score placeholders build confidence before engagement." },
        ].map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <item.icon className="h-5 w-5 text-emerald-600" />
            <h2 className="mt-3 text-base font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Top-rated providers</p>
            <h2 className="text-2xl font-semibold text-slate-900">Trusted by marketplace users</h2>
          </div>
          <Link href="/search?sort=top-rated&verification=verified_or_approved" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">View all</Link>
        </div>
        <HomepageProviderSection sectionName="Top-rated providers" providers={topRated} className="grid gap-4 md:grid-cols-3" />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Featured verified businesses</p>
            <h2 className="text-2xl font-semibold text-slate-900">Discover standout MSMEs</h2>
          </div>
          <Link href="/search?sort=featured&verification=verified_or_approved" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">View all</Link>
        </div>
        <HomepageProviderSection sectionName="Featured providers" providers={featured} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Recently trusted providers</p>
            <h2 className="text-2xl font-semibold text-slate-900">Freshly validated and marketplace-ready</h2>
          </div>
          <Link href="/search?sort=featured&verification=verified_or_approved" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Explore providers</Link>
        </div>
        <HomepageProviderSection sectionName="Recently trusted providers" providers={recentlyTrusted} className="grid gap-4 md:grid-cols-3" />
      </section>
    </main>
  );
}
