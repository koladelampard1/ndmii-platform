import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { getCategoryBySlug, searchMarketplaceProviders, slugifyCategory } from "@/lib/data/marketplace";

export default async function CategoryProvidersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const providers = await searchMarketplaceProviders({
    category,
    verification: "verified_or_approved",
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Category results</p>
            <h1 className="text-3xl font-semibold">{category}</h1>
          </div>
          <Link href={`/search?category=${encodeURIComponent(category)}`} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
            Open in full search
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/categories" className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900">
            All categories
          </Link>
          <Link
            href={`/search?category=${encodeURIComponent(category)}&verification=verified_or_approved`}
            className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
          >
            Filtered search view
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>

        {providers.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            No providers are currently listed in this category. Try another category or use the full marketplace search.
          </p>
        ) : null}
      </section>
    </main>
  );
}

export async function generateStaticParams() {
  const categories = [
    "Construction & Artisan",
    "Fashion & Textiles",
    "Food Processing",
    "Professional Services",
    "Creative & Media",
    "Repairs & Maintenance",
  ];

  return categories.map((name) => ({ slug: slugifyCategory(name) }));
}
