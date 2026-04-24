import Link from "next/link";
import { Bookmark, MapPin, Star } from "lucide-react";
import { ProviderCard as ProviderCardType } from "@/lib/data/marketplace";
import { buildProviderProfileHref, buildProviderQuoteHref } from "@/lib/provider-links";

const DEV_MODE = process.env.NODE_ENV !== "production";

export function ProviderCard({ provider }: { provider: ProviderCardType }) {
  const providerHref = buildProviderProfileHref({
    id: provider.id,
    msme_id: provider.msme_id,
    public_slug: provider.public_slug,
  });
  const quoteHref = buildProviderQuoteHref({
    id: provider.id,
    msme_id: provider.msme_id,
    public_slug: provider.public_slug,
  });

  const displayName = provider.display_name ?? provider.business_name ?? "Unnamed provider";
  const location = [provider.state, provider.lga].filter(Boolean).join(" • ");
  const initials = displayName
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="absolute left-4 top-4 inline-flex rounded bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        {provider.verification_status === "approved" ? "Approved" : "Verified"}
      </div>
      <button
        type="button"
        aria-label="Bookmark business"
        className="absolute right-4 top-4 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <Bookmark className="h-4 w-4" />
      </button>

      <div className="mt-8 flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
          {provider.logo_url ? (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${provider.logo_url})` }}
              aria-label={`${displayName} logo`}
              role="img"
            />
          ) : (
            initials
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">{displayName}</h3>
          <p className="text-sm text-slate-600">{provider.category || "General Services"}</p>
          <p className="inline-flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            {location || "Nigeria"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 text-sm text-slate-700">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <span className="font-semibold">{provider.avg_rating ? provider.avg_rating.toFixed(1) : "—"}</span>
        <span className="text-slate-500">({provider.review_count} reviews)</span>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href={providerHref}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          View profile
        </Link>
        <Link
          href={quoteHref}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          Request quote
        </Link>
      </div>

      {DEV_MODE && (
        <pre className="sr-only" data-provider-card-debug>
          {JSON.stringify(
            {
              provider_id: provider.id,
              msme_id: provider.msme_id,
              public_slug: provider.public_slug,
              href: providerHref,
              quote_href: quoteHref,
              display_name: provider.display_name,
            },
            null,
            2,
          )}
        </pre>
      )}
    </article>
  );
}
