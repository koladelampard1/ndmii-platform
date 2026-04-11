import Link from "next/link";
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
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{provider.display_name ?? "Unnamed provider"}</h3>
        <p className="text-xs text-slate-600">MSME ID: {provider.msme_id || "n/a"}</p>
        <p className="text-xs text-slate-600">Slug: {provider.public_slug || "n/a"}</p>
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        <Link href={providerHref} className="font-medium text-emerald-700 hover:text-emerald-800">
          View profile
        </Link>
        <Link href={quoteHref} className="text-slate-600 hover:text-slate-900">
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
