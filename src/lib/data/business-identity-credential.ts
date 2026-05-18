import type { createServerSupabaseClient } from "@/lib/supabase/server";

export const BUSINESS_IDENTITY_CREDENTIAL_MSME_SELECT =
  "id,msme_id,business_name,owner_name,sector,business_type,contact_email,contact_phone,address,cac_number,passport_photo_url,passport_photo_path,verification_status,association_id";

export type BusinessIdentityCredentialMsme = {
  id: string;
  msme_id: string;
  business_name: string | null;
  owner_name: string | null;
  sector: string | null;
  business_type: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  cac_number: string | null;
  passport_photo_url: string | null;
  passport_photo_path?: string | null;
  verification_status: string | null;
  association_id: string | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type ProviderLogoRow = {
  id: string;
  msme_id: string | null;
  logo_url: string | null;
};

export async function getBusinessIdentityCredentialLogoUrl(
  supabase: SupabaseClient,
  profile: Pick<BusinessIdentityCredentialMsme, "id">,
) {
  const { data } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,logo_url")
    .eq("msme_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  return ((data ?? []) as ProviderLogoRow[]).find((row) => row.logo_url?.trim())?.logo_url ?? null;
}

export async function getBusinessIdentityCredentialPassportPhotoUrl(
  supabase: SupabaseClient,
  profile: Pick<BusinessIdentityCredentialMsme, "passport_photo_path" | "passport_photo_url">,
) {
  const path = profile.passport_photo_path?.trim();
  if (!path) {
    return null;
  }

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_MSME_PASSPORT_BUCKET || "msme-passports";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
