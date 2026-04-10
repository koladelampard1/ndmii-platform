import Image from "next/image";
import Link from "next/link";
import { Star, Sparkles } from "lucide-react";
import { ProviderCard as ProviderCardType } from "@/lib/data/marketplace";
import { Button } from "@/components/ui/button";

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rounded ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
        />
      ))}
    </div>
  );
}

export function ProviderCard({ provider }: { provider: ProviderCardType }) {
  const verificationLabel =
    provider.verification_status === "approved"
      ? "Approved"
      : provider.verification_status === "verified"
        ? "Verified"
        : "Pending";

  const isTopRated = provider.avg_rating >= 4.7 && provider.review_count >= 10;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <Image
          src={provider.logo_url ?? "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80"}
          alt={provider.business_name}
          width={56}
          height={56}
          className="h-14 w-14 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-slate-900">{provider.business_name}</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{verificationLabel}</span>
            {isTopRated && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <Sparkles className="h-3 w-3" /> Top rated
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">{provider.category}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <Stars rating={provider.avg_rating} />
            <span>{provider.avg_rating.toFixed(1)}</span>
            <span>({provider.review_count} reviews)</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-600">{provider.short_description}</p>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{provider.specialization ?? "General services"}</span>
        <span>
          {provider.state}
          {provider.lga ? `, ${provider.lga}` : ""}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trust score: {provider.trust_score}</span>
        <Link href={`/providers/${provider.public_slug}`}>
          <Button size="sm">View profile</Button>
        </Link>
      </div>
    </article>
  );
}
