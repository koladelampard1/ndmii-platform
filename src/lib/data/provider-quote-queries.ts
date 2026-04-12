import type { SupabaseClient } from "@supabase/supabase-js";

export const PROVIDER_QUOTE_OWNERSHIP_FIELD = "provider_profile_id" as const;

export function applyProviderQuoteOwnership(query: any, providerProfileId: string) {
  return query.eq(PROVIDER_QUOTE_OWNERSHIP_FIELD, providerProfileId);
}

export async function fetchProviderQuoteInboxCount(supabase: SupabaseClient, providerProfileId: string) {
  const { count, error } = await applyProviderQuoteOwnership(
    supabase.from("provider_quotes").select("id", { count: "exact", head: true }),
    providerProfileId
  );

  if (error) throw new Error(error.message);

  return count ?? 0;
}
