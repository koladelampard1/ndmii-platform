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
  email: string | null;
  role: string;
  resolvedUserId: string | null;
  resolvedMsmeId: string | null;
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
  if (!["msme", "admin"].includes(ctx.role)) {
    logProviderAccessAudit({
      route,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: ctx.appUserId,
      resolvedMsmeId: null,
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
  if (ctx.role === "admin") {
    msmeId = ctx.linkedMsmeId;
  }

  if (!msmeId && resolvedAppUserId) {
    const { data: byOwner } = await supabase
      .from("msmes")
      .select("id")
      .eq("created_by", resolvedAppUserId)
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
    logProviderAccessAudit({
      route,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: null,
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
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: msmeId,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "owned_msme_not_found_in_table",
    });
    redirect("/access-denied");
  }

  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,display_name,short_description,long_description,logo_url,slug,trust_score")
    .eq("msme_id", msme.id)
    .maybeSingle();

  if (!provider) {
    logProviderAccessAudit({
      route,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: msme.id,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "provider_profile_not_found_for_owned_msme",
    });
    redirect("/access-denied");
  }

  logProviderAccessAudit({
    route,
    email: ctx.email,
    role: ctx.role,
    resolvedUserId: resolvedAppUserId,
    resolvedMsmeId: msme.id,
    resolvedProviderMsmeId: provider.msme_id ?? null,
    decision: "allow",
    reason: "msme_role_and_owned_provider_profile_resolved",
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
