const DEV_MODE = process.env.NODE_ENV !== "production";

type ProviderLinkInput = {
  id: string;
  msme_id: string;
  public_slug: string;
};

type ProviderQuoteLinkOptions = {
  serviceId?: string | null;
};

function logProviderLinkGeneration(href: string, provider: ProviderLinkInput) {
  if (!DEV_MODE) return;
  console.info("[provider-link]", {
    provider_profile_id: provider.id,
    provider_profile_msme_id: provider.msme_id,
    provider_profile_public_slug: provider.public_slug,
    href,
  });
}

export function buildProviderProfileHref(provider: ProviderLinkInput): string {
  const href = `/providers/${provider.public_slug}`;
  logProviderLinkGeneration(href, provider);
  return href;
}

export function buildProviderQuoteHref(provider: ProviderLinkInput, options?: ProviderQuoteLinkOptions): string {
  const params = new URLSearchParams();
  if (options?.serviceId) params.set("service", options.serviceId);
  const href = `/providers/${provider.public_slug}/request-quote${params.toString() ? `?${params.toString()}` : ""}`;
  logProviderLinkGeneration(href, provider);
  return href;
}
