import Image from "next/image";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { getProviderPublicProfile } from "@/lib/data/marketplace";

export default async function ProviderPublicPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const provider = await getProviderPublicProfile(providerId);

  if (!provider) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[220px_1fr]">
          <div>
            <Image
              src={provider.logo_url ?? "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80"}
              alt={provider.business_name}
              width={600}
              height={320}
              className="h-44 w-full rounded-2xl object-cover"
            />
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Verification badge</p>
              <p className="mt-1">NDMII approved provider</p>
            </div>
            <div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
              <p className="font-semibold">Trust score</p>
              <p className="mt-1 text-2xl font-bold">{provider.trust_score}</p>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold">{provider.business_name}</h1>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Verified</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{provider.category} • {provider.specialization ?? "General services"}</p>
            <p className="text-sm text-slate-500">{provider.state}{provider.lga ? `, ${provider.lga}` : ""}</p>

            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Service description</h2>
              <p className="mt-2 text-sm text-slate-700">{provider.long_description}</p>
            </div>

            <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-600">Rating summary</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{provider.avg_rating.toFixed(1)}</p>
                <p className="text-sm text-slate-500">From {provider.review_count} reviews</p>
              </div>
              <div className="flex items-end justify-end">
                <button className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">Request quote / Contact</button>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Reviews</h2>
          <div className="mt-3 space-y-3">
            {provider.reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{review.review_title}</p>
                  <p className="text-sm text-slate-500">{review.rating.toFixed(1)} / 5</p>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{review.reviewer_name}</p>
                <p className="mt-2 text-sm text-slate-600">{review.review_body}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
