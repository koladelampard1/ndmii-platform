import { resolvePublicProviderProfile, type NormalizedProviderProfile } from "@/lib/data/provider-profile-resolver";

export type ProviderProfileRow = NormalizedProviderProfile;

export async function ensureProviderProfileForPublicMsme(input: {
  msmeRowId?: string | null;
  msmePublicId?: string | null;
}): Promise<ProviderProfileRow | null> {
  const providerSlug = input.msmePublicId?.trim() || input.msmeRowId?.trim();
  if (!providerSlug) return null;

  const resolved = await resolvePublicProviderProfile({
    providerRouteParam: providerSlug,
  });

  return resolved.provider;
}

export async function resolveProviderProfileRow(input: {
  providerPathSegment: string;
  providerId?: string | null;
  msmeRowId?: string | null;
  msmePublicId?: string | null;
}): Promise<ProviderProfileRow | null> {
  const providerSlug = input.providerPathSegment?.trim() || "";
  if (!providerSlug) return null;

  const resolved = await resolvePublicProviderProfile({
    providerRouteParam: providerSlug,
  });

  return resolved.provider;
}
