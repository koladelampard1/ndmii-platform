import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { getMarketplaceCategories } from "@/lib/data/marketplace";

export default async function CategoriesPage() {
  const categories = await getMarketplaceCategories();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Marketplace categories</p>
        <h1 className="mt-1 text-3xl font-semibold">Browse providers by category</h1>
        <p className="mt-2 text-sm text-slate-600">Choose a category to discover verified businesses across Nigeria.</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-700"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
