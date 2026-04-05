import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProviderWorkspaceContext = {
  role: string;
  appUserId: string | null;
  msme: {
    id: string;
    msme_id: string;
    business_name: string;
    owner_name: string;
    state: string;
    lga: string | null;
    sector: string;
    verification_status: string;
    contact_email: string | null;
  };
  provider: {
    id: string;
    msme_id: string;
    display_name: string;
    short_description: string | null;
    long_description: string | null;
    logo_url: string | null;
    slug: string;
    trust_score: number;
  };
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 55);
}

export async function getProviderWorkspaceContext(): Promise<ProviderWorkspaceContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx.appUserId || !["msme", "admin"].includes(ctx.role)) {
    redirect("/access-denied");
  }

  const supabase = await createServerSupabaseClient();

  let msmeId = ctx.linkedMsmeId;

  if (!msmeId) {
    const { data: byOwner } = await supabase
      .from("msmes")
      .select("id")
      .eq("created_by", ctx.appUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    msmeId = byOwner?.id ?? null;
  }

  if (!msmeId && ctx.email) {
    const { data: byEmail } = await supabase
      .from("msmes")
      .select("id")
      .eq("contact_email", ctx.email.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    msmeId = byEmail?.id ?? null;
  }

  if (!msmeId && ctx.linkedProviderId) {
    const { data: byProvider } = await supabase
      .from("provider_profiles")
      .select("msme_id")
      .eq("id", ctx.linkedProviderId)
      .maybeSingle();

    msmeId = byProvider?.msme_id ?? null;
  }

  if (!msmeId) {
    redirect("/access-denied");
  }

  const { data: msme } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,state,lga,sector,verification_status,contact_email")
    .eq("id", msmeId)
    .maybeSingle();

  if (!msme) {
    redirect("/access-denied");
  }

  let { data: provider } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,display_name,short_description,long_description,logo_url,slug,trust_score")
    .eq("msme_id", msme.id)
    .maybeSingle();

  if (!provider) {
    const suffix = msme.msme_id.slice(-4).toLowerCase();
    const slugBase = `${slugify(msme.business_name)}-${suffix}`;
    const { data: inserted } = await supabase
      .from("provider_profiles")
      .insert({
        msme_id: msme.id,
        display_name: msme.business_name,
        slug: slugBase,
        short_description: `Verified ${msme.sector.toLowerCase()} provider in ${msme.state}.`,
        long_description: `${msme.business_name} is a verified MSME provider operating within the NDMII marketplace operations layer.`,
        logo_url: null,
        passport_url: null,
        trust_score: 82,
        is_featured: false,
      })
      .select("id,msme_id,display_name,short_description,long_description,logo_url,slug,trust_score")
      .maybeSingle();

    provider = inserted ?? null;
  }

  if (!provider) {
    redirect("/access-denied");
  }

  return {
    role: ctx.role,
    appUserId: ctx.appUserId,
    msme,
    provider: {
      ...provider,
      trust_score: Number(provider.trust_score ?? 0),
    },
  };
}
