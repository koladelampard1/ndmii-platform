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

type ProviderAccessAuditLog = {
  route: string;
  source: string;
  email: string | null;
  role: string;
  resolvedUserId: string | null;
  resolvedMsmeId: string | null;
  resolvedMsmePublicId: string | null;
  linkedMsmeId: string | null;
  linkedProviderId: string | null;
  providerRow: {
    id: string;
    msme_id: string | null;
    display_name: string;
  } | null;
  resolvedProviderMsmeId: string | null;
  decision: "allow" | "deny";
  reason: string;
};

function logProviderAccessAudit(payload: ProviderAccessAuditLog) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[provider-rbac]", payload);
}

export async function getProviderWorkspaceContext(): Promise<ProviderWorkspaceContext> {
  const ctx = await getCurrentUserContext();
  const route = "/dashboard/msme/*";
  const source = "src/lib/data/provider-operations.ts#getProviderWorkspaceContext";
  if (!["msme", "admin"].includes(ctx.role)) {
    logProviderAccessAudit({
      route,
      source,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: ctx.appUserId,
      resolvedMsmeId: null,
      resolvedMsmePublicId: null,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerRow: null,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "role_not_allowed_for_provider_workspace",
    });
    redirect("/access-denied");
  }

  const supabase = await createServerSupabaseClient();
  let resolvedAppUserId = ctx.appUserId;

  if (!resolvedAppUserId && ctx.authUserId) {
    const { data: byAuthUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", ctx.authUserId)
      .maybeSingle();
    resolvedAppUserId = byAuthUser?.id ?? null;
  }

  if (!resolvedAppUserId && ctx.email) {
    const { data: byEmailUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", ctx.email.toLowerCase())
      .maybeSingle();
    resolvedAppUserId = byEmailUser?.id ?? null;
  }

  let msmeId: string | null = null;
  let msmePublicId: string | null = null;
  if (ctx.role === "admin") {
    msmeId = ctx.linkedMsmeId;
  }

  if (!msmeId && resolvedAppUserId) {
    const { data: byOwner } = await supabase
      .from("msmes")
      .select("id,msme_id")
      .eq("created_by", resolvedAppUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    msmeId = byOwner?.id ?? null;
    msmePublicId = byOwner?.msme_id ?? null;
  }

  if (!msmeId && ctx.email) {
    const { data: byEmail } = await supabase
      .from("msmes")
      .select("id,msme_id")
      .eq("contact_email", ctx.email.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    msmeId = byEmail?.id ?? null;
    msmePublicId = byEmail?.msme_id ?? null;
  }

  if ((!msmeId || !msmePublicId) && ctx.linkedMsmeId) {
    const { data: byLinkedMsme } = await supabase
      .from("msmes")
      .select("id,msme_id")
      .or(`id.eq.${ctx.linkedMsmeId},msme_id.eq.${ctx.linkedMsmeId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    msmeId = msmeId ?? byLinkedMsme?.id ?? null;
    msmePublicId = msmePublicId ?? byLinkedMsme?.msme_id ?? null;
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
    logProviderAccessAudit({
      route,
      source,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: null,
      resolvedMsmePublicId: msmePublicId,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerRow: null,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "no_owned_msme_found_after_lookup",
    });
    redirect("/access-denied");
  }

  const { data: msme } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,state,lga,sector,verification_status,contact_email")
    .eq("id", msmeId)
    .maybeSingle();

  if (!msme) {
    logProviderAccessAudit({
      route,
      source,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: msmeId,
      resolvedMsmePublicId: msmePublicId,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerRow: null,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "owned_msme_not_found_in_table",
    });
    redirect("/access-denied");
  }

  const providerLookupCandidates = [msme.msme_id, msme.id, ctx.linkedProviderId].filter((value): value is string => Boolean(value));
  let provider: {
    id: string;
    msme_id: string;
    display_name: string;
    short_description: string | null;
    long_description: string | null;
    logo_url: string | null;
    slug: string;
    trust_score: number;
  } | null = null;

  for (const candidate of providerLookupCandidates) {
    const { data: providerMatch } = await supabase
      .from("provider_profiles")
      .select("id,msme_id,display_name,short_description,long_description,logo_url,slug,trust_score")
      .eq("msme_id", candidate)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (providerMatch) {
      provider = providerMatch;
      break;
    }
  }

  if (!provider && ctx.linkedProviderId) {
    const { data: providerById } = await supabase
      .from("provider_profiles")
      .select("id,msme_id,display_name,short_description,long_description,logo_url,slug,trust_score")
      .eq("id", ctx.linkedProviderId)
      .maybeSingle();

    const ownsProvider = Boolean(providerById?.msme_id && [msme.id, msme.msme_id].includes(providerById.msme_id));
    if (providerById && ownsProvider) {
      provider = providerById;
    }
  }

  if (!provider) {
    logProviderAccessAudit({
      route,
      source,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: msme.id,
      resolvedMsmePublicId: msme.msme_id,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerRow: null,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "provider_profile_not_found_for_owned_msme",
    });
    redirect("/access-denied");
  }

  logProviderAccessAudit({
    route,
    source,
    email: ctx.email,
    role: ctx.role,
    resolvedUserId: resolvedAppUserId,
    resolvedMsmeId: msme.id,
    resolvedMsmePublicId: msme.msme_id,
    linkedMsmeId: ctx.linkedMsmeId,
    linkedProviderId: ctx.linkedProviderId,
    providerRow: {
      id: provider.id,
      msme_id: provider.msme_id ?? null,
      display_name: provider.display_name,
    },
    resolvedProviderMsmeId: provider.msme_id ?? null,
    decision: "allow",
    reason: "msme_role_and_owned_provider_profile_resolved_via_msme_id_chain",
  });

  return {
    role: ctx.role,
    appUserId: resolvedAppUserId,
    msme,
    provider: {
      ...provider,
      trust_score: Number(provider.trust_score ?? 0),
    },
  };
}
