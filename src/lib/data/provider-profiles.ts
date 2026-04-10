import { resolvePublicProviderProfile, type NormalizedProviderProfile } from "@/lib/data/provider-profile-resolver";

export type ProviderProfileRow = NormalizedProviderProfile & { slug?: string | null };

export async function ensureProviderProfileForPublicMsme(input: {
  msmeRowId?: string | null;
  msmePublicId?: string | null;
}): Promise<ProviderProfileRow | null> {
  const legacyKey = input.msmePublicId?.trim() || input.msmeRowId?.trim();
  if (!legacyKey) return null;
  const resolved = await resolvePublicProviderProfile({
    providerRouteParam: legacyKey,
    allowSlugFallback: false,
    allowLegacyMsmeFallback: true,
  });
  return resolved.provider;
}

export async function resolveProviderProfileRow(input: {
  providerPathSegment: string;
  providerId?: string | null;
  msmeRowId?: string | null;
  msmePublicId?: string | null;
}): Promise<ProviderProfileRow | null> {
  const lookupParam =
    input.providerPathSegment?.trim() ||
    input.providerId?.trim() ||
    input.msmePublicId?.trim() ||
    input.msmeRowId?.trim() ||
    "";

  if (!lookupParam) return null;

  const resolved = await resolvePublicProviderProfile({
    providerRouteParam: lookupParam,
    allowSlugFallback: true,
    allowLegacyMsmeFallback: true,
  });

  return resolved.provider;
}
