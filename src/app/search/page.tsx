import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { getMarketplaceFilterOptions, searchMarketplaceProviders } from "@/lib/data/marketplace";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const category = typeof params.category === "string" ? params.category : "";
  const specialization = typeof params.specialization === "string" ? params.specialization : "";
  const state = typeof params.state === "string" ? params.state : "";
  const lga = typeof params.lga === "string" ? params.lga : "";
  const rating = typeof params.rating === "string" ? Number(params.rating) : 0;
  const verification = typeof params.verification === "string" ? params.verification : "verified";

  const [options, providers] = await Promise.all([
    getMarketplaceFilterOptions(),
    searchMarketplaceProviders({
      q: q || undefined,
      category: category || undefined,
      specialization: specialization || undefined,
      state: state || undefined,
      lga: lga || undefined,
      minRating: rating || undefined,
      verification,
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Marketplace search</p>
            <h1 className="text-3xl font-semibold">Find verified providers</h1>
          </div>
          <Link href="/verify" className="text-sm font-medium text-slate-600 hover:text-slate-900">Verify MSME ID</Link>
        </div>

        <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <input name="q" defaultValue={q} placeholder="Business name or ID" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select name="category" defaultValue={category} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All categories</option>
            {options.categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input name="specialization" defaultValue={specialization} placeholder="Specialization" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select name="state" defaultValue={state} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All states</option>
            {options.states.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select name="lga" defaultValue={lga} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All LGAs</option>
            {options.lgas.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select name="rating" defaultValue={rating ? String(rating) : ""} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Any rating</option>
            <option value="5">5.0+</option>
            <option value="4">4.0+</option>
            <option value="3">3.0+</option>
          </select>
          <select name="verification" defaultValue={verification} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="verified">Verified only</option>
          </select>
          <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">Apply filters</button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
          <span>{providers.length} verified providers found</span>
          <span>Search is restricted to approved NDMII identities.</span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
        </div>
      </section>
    </main>
  );
}
