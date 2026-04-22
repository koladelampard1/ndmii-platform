import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

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
    public_slug: string | null;
    tagline: string | null;
    description: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    website: string | null;
    is_verified: boolean | null;
    is_active: boolean | null;
  };
};

type ProviderAccessAuditLog = {
  route: string;
  source: string;
  component: string;
  email: string | null;
  role: string;
  resolvedUserId: string | null;
  resolvedMsmeId: string | null;
  resolvedMsmePublicId: string | null;
  linkedMsmeId: string | null;
  linkedProviderId: string | null;
  providerLookupKeyUsed: string | null;
  providerRowFound: boolean;
  providerRow: {
    id: string;
    msme_id: string | null;
    display_name: string;
  } | null;
  resolvedProviderMsmeId: string | null;
  decision: "allow" | "deny";
  reason: string;
  queryClientUsed?: "server_anon" | "service_role";
  providerQuery?: {
    table: "provider_profiles";
    select: string;
    filters: {
      msme_id?: string | null;
      id?: string | null;
    };
  } | null;
  providerQueryResultLength?: number | null;
  providerQueryError?: string | null;
};

function logProviderAccessAudit(payload: ProviderAccessAuditLog) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[provider-rbac]", payload);
}

function denyProviderWorkspaceAccess(payload: ProviderAccessAuditLog): never {
  logProviderAccessAudit(payload);
  redirect("/access-denied");
}

function buildProviderSlug(businessName: string, msmePublicId: string): string {
  const businessSlug = businessName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const idSlug = msmePublicId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return [businessSlug || "provider", idSlug || "msme"].join("-");
}

export async function getProviderWorkspaceContext(): Promise<ProviderWorkspaceContext> {
  const ctx = await getCurrentUserContext();
  const route = "/dashboard/msme/*";
  const source = "src/lib/data/provider-operations.ts#getProviderWorkspaceContext";
  const component = "ProviderWorkspaceGuard";
  if (!["msme", "admin"].includes(ctx.role)) {
    denyProviderWorkspaceAccess({
      route,
      source,
      component,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: ctx.appUserId,
      resolvedMsmeId: null,
      resolvedMsmePublicId: null,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerLookupKeyUsed: null,
      providerRowFound: false,
      providerRow: null,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "role_not_allowed_for_provider_workspace",
    });
  }

  const supabase = await createServiceRoleSupabaseClient();
  const queryClientUsed: "server_anon" | "service_role" = "service_role";
  logProviderAccessAudit({
    route,
    source,
    component,
    email: ctx.email,
    role: ctx.role,
    resolvedUserId: ctx.appUserId,
    resolvedMsmeId: null,
    resolvedMsmePublicId: null,
    linkedMsmeId: ctx.linkedMsmeId,
    linkedProviderId: ctx.linkedProviderId,
    providerLookupKeyUsed: null,
    providerRowFound: false,
    providerRow: null,
    resolvedProviderMsmeId: null,
    decision: "allow",
    reason: "provider_workspace_query_client_resolved",
    queryClientUsed,
    providerQuery: null,
    providerQueryResultLength: null,
    providerQueryError: null,
  });
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

    const providerLinkedMsmeRef = byProvider?.msme_id ?? null;
    if (providerLinkedMsmeRef) {
      const { data: byProviderMsmeRef } = await supabase
        .from("msmes")
        .select("id,msme_id")
        .or(`id.eq.${providerLinkedMsmeRef},msme_id.eq.${providerLinkedMsmeRef}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      msmeId = byProviderMsmeRef?.id ?? null;
      msmePublicId = byProviderMsmeRef?.msme_id ?? null;
    }
  }

  if (!msmeId) {
    denyProviderWorkspaceAccess({
      route,
      source,
      component,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: null,
      resolvedMsmePublicId: msmePublicId,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerLookupKeyUsed: null,
      providerRowFound: false,
      providerRow: null,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "no_owned_msme_found_after_lookup",
      queryClientUsed,
      providerQuery: null,
      providerQueryResultLength: null,
      providerQueryError: null,
    });
  }

  const { data: msme } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,state,lga,sector,verification_status,contact_email,created_by")
    .eq("id", msmeId)
    .maybeSingle();

  if (!msme) {
    denyProviderWorkspaceAccess({
      route,
      source,
      component,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: msmeId,
      resolvedMsmePublicId: msmePublicId,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerLookupKeyUsed: null,
      providerRowFound: false,
      providerRow: null,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "owned_msme_not_found_in_table",
      queryClientUsed,
      providerQuery: null,
      providerQueryResultLength: null,
      providerQueryError: null,
    });
  }

  const isMsmeOwnedByLinkedUser = Boolean(ctx.role === "msme" && resolvedAppUserId && msme.created_by === resolvedAppUserId);
  const isMsmeOwnedByContactEmail = Boolean(
    ctx.role === "msme"
    && ctx.email
    && msme.contact_email
    && msme.contact_email.trim().toLowerCase() === ctx.email.trim().toLowerCase()
  );

  if (ctx.role === "msme" && !isMsmeOwnedByLinkedUser && !isMsmeOwnedByContactEmail) {
    denyProviderWorkspaceAccess({
      route,
      source,
      component,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: msme.id,
      resolvedMsmePublicId: msme.msme_id,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerLookupKeyUsed: null,
      providerRowFound: false,
      providerRow: null,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "msme_user_not_owner_by_created_by_or_contact_email",
      queryClientUsed,
      providerQuery: null,
      providerQueryResultLength: null,
      providerQueryError: null,
    });
  }

  const providerLookupKey = msme.msme_id;
  const providerSelect =
    "id,msme_id,public_slug,display_name,tagline,description,contact_email,contact_phone,website,is_verified,is_active,created_at,updated_at";
  let provider: {
    id: string;
    msme_id: string;
    public_slug: string | null;
    display_name: string;
    tagline: string | null;
    description: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    website: string | null;
    is_verified: boolean | null;
    is_active: boolean | null;
  } | null = null;
  let providerQueryResultLength = 0;
  let providerQueryError: string | null = null;

  const { data: providerByMsmePublicIdRows, error: providerByMsmePublicIdError } = await supabase
    .from("provider_profiles")
    .select(providerSelect)
    .eq("msme_id", providerLookupKey)
    .order("updated_at", { ascending: false })
    .limit(10);

  providerQueryResultLength = providerByMsmePublicIdRows?.length ?? 0;
  providerQueryError = providerByMsmePublicIdError?.message ?? null;
  provider = providerByMsmePublicIdRows?.[0] ?? null;
  if (process.env.NODE_ENV !== "production") {
    console.info("[provider-workspace-query]", {
      source,
      route,
        providerProfilesSchemaUsed: {
          table: "provider_profiles",
          lookupColumn: "msme_id(public MSME ID)",
          selectColumns: providerSelect.split(","),
        },
      select: providerSelect,
      lookupField: "msme_id",
      lookupValue: providerLookupKey,
      providerQueryError,
      providerRow: provider,
    });
  }

  logProviderAccessAudit({
    route,
    source,
    component,
    email: ctx.email,
    role: ctx.role,
    resolvedUserId: resolvedAppUserId,
    resolvedMsmeId: msme.id,
    resolvedMsmePublicId: msme.msme_id,
    linkedMsmeId: ctx.linkedMsmeId,
    linkedProviderId: ctx.linkedProviderId,
    providerLookupKeyUsed: providerLookupKey,
    providerRowFound: providerQueryResultLength > 0,
    providerRow: provider
      ? {
          id: provider.id,
          msme_id: provider.msme_id ?? null,
          display_name: provider.display_name,
        }
      : null,
    resolvedProviderMsmeId: provider?.msme_id ?? null,
    decision: provider ? "allow" : "deny",
    reason: provider
      ? "provider_profile_found_via_msme_public_id_lookup"
      : "provider_profile_lookup_by_msme_public_id_returned_no_rows",
    queryClientUsed,
    providerQuery: {
      table: "provider_profiles",
      select: providerSelect,
      filters: {
        msme_id: providerLookupKey,
      },
    },
    providerQueryResultLength,
    providerQueryError,
  });

  if (!provider && ctx.linkedProviderId) {
    const { data: providerByIdRows, error: providerByIdError } = await supabase
      .from("provider_profiles")
      .select(providerSelect)
      .eq("id", ctx.linkedProviderId)
      .limit(10);
    const providerById = providerByIdRows?.[0] ?? null;
    providerQueryResultLength = providerByIdRows?.length ?? 0;
    providerQueryError = providerByIdError?.message ?? null;
    if (process.env.NODE_ENV !== "production") {
      console.info("[provider-workspace-query]", {
        source,
        route,
        select: providerSelect,
        lookupField: "id",
        lookupValue: ctx.linkedProviderId,
        providerQueryError,
        providerRow: providerById,
      });
    }

    const ownsProvider = Boolean(providerById?.msme_id && providerById.msme_id === msme.msme_id);
    if (providerById && ownsProvider) {
      provider = providerById;
    }

    logProviderAccessAudit({
      route,
      source,
      component,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: msme.id,
      resolvedMsmePublicId: msme.msme_id,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerLookupKeyUsed: providerLookupKey,
      providerRowFound: providerQueryResultLength > 0,
      providerRow: providerById
        ? {
            id: providerById.id,
            msme_id: providerById.msme_id ?? null,
            display_name: providerById.display_name,
          }
        : null,
      resolvedProviderMsmeId: providerById?.msme_id ?? null,
      decision: provider ? "allow" : "deny",
      reason: provider
        ? "provider_profile_found_via_linked_provider_id_fallback"
        : "provider_profile_lookup_by_linked_provider_id_returned_no_owned_rows",
      queryClientUsed,
      providerQuery: {
        table: "provider_profiles",
        select: providerSelect,
        filters: {
          id: ctx.linkedProviderId,
        },
      },
      providerQueryResultLength,
      providerQueryError,
    });
  }

  if (!provider) {
    const generatedSlug = buildProviderSlug(msme.business_name || msme.owner_name || "provider", msme.msme_id);
    const provisioningPayload = {
      msme_id: msme.msme_id,
      public_slug: generatedSlug,
      display_name: msme.business_name || msme.owner_name || "NDMII MSME Provider",
      tagline: `NDMII registered MSME in ${msme.state}.`,
      description: `${msme.business_name || msme.owner_name || "This MSME"} is registered on the NDMII platform and is preparing marketplace information.`,
      contact_email: msme.contact_email ?? null,
      contact_phone: null,
      website: null,
      is_verified: ["approved", "verified"].includes((msme.verification_status ?? "").toLowerCase()),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (process.env.NODE_ENV !== "production") {
      console.info("[provider-workspace-provision-attempt]", {
        source,
        route,
        providerProfilesSchemaUsed: {
          table: "provider_profiles",
          lookupColumn: "msme_id(public MSME ID)",
          insertColumns: Object.keys(provisioningPayload),
        },
        lookupKeyUsed: providerLookupKey,
        provisioningPayload,
      });
    }

    const { data: provisionedProvider, error: provisionError } = await supabase
      .from("provider_profiles")
      .upsert(
        provisioningPayload,
        { onConflict: "msme_id" }
      )
      .select(providerSelect)
      .maybeSingle();

    if (!provisionError && provisionedProvider) {
      provider = provisionedProvider;
      providerQueryResultLength = 1;
      providerQueryError = null;
      if (process.env.NODE_ENV !== "production") {
        console.info("[provider-workspace-provision-success]", {
          source,
          route,
          lookupKeyUsed: providerLookupKey,
          createdProviderProfileId: provisionedProvider.id,
        });
      }
      logProviderAccessAudit({
        route,
        source,
        component,
        email: ctx.email,
        role: ctx.role,
        resolvedUserId: resolvedAppUserId,
        resolvedMsmeId: msme.id,
        resolvedMsmePublicId: msme.msme_id,
        linkedMsmeId: ctx.linkedMsmeId,
        linkedProviderId: ctx.linkedProviderId,
        providerLookupKeyUsed: providerLookupKey,
        providerRowFound: true,
        providerRow: {
          id: provider.id,
          msme_id: provider.msme_id ?? null,
          display_name: provider.display_name,
        },
        resolvedProviderMsmeId: provider.msme_id ?? null,
        decision: "allow",
        reason: "provider_profile_auto_provisioned_for_authenticated_msme",
        queryClientUsed,
        providerQuery: {
          table: "provider_profiles",
          select: providerSelect,
          filters: {
            msme_id: providerLookupKey,
          },
        },
        providerQueryResultLength,
        providerQueryError,
      });
    } else if (process.env.NODE_ENV !== "production") {
      console.info("[provider-workspace-provision]", {
        source,
        route,
        email: ctx.email,
        role: ctx.role,
        msmeId: msme.id,
        msmePublicId: msme.msme_id,
        generatedSlug,
        provisionError: provisionError?.message ?? null,
      });
    }
  }

  if (!provider) {
    denyProviderWorkspaceAccess({
      route,
      source,
      component,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: msme.id,
      resolvedMsmePublicId: msme.msme_id,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerLookupKeyUsed: providerLookupKey,
      providerRowFound: false,
      providerRow: null,
      resolvedProviderMsmeId: null,
      decision: "deny",
      reason: "provider_profile_not_found_for_owned_msme",
      queryClientUsed,
      providerQuery: {
        table: "provider_profiles",
        select: providerSelect,
        filters: {
          msme_id: providerLookupKey,
          id: ctx.linkedProviderId,
        },
      },
      providerQueryResultLength,
      providerQueryError,
    });
  }

  const ownsProvider = provider.msme_id === msme.msme_id;
  if (!ownsProvider) {
    denyProviderWorkspaceAccess({
      route,
      source,
      component,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: msme.id,
      resolvedMsmePublicId: msme.msme_id,
      linkedMsmeId: ctx.linkedMsmeId,
      linkedProviderId: ctx.linkedProviderId,
      providerLookupKeyUsed: providerLookupKey,
      providerRowFound: true,
      providerRow: {
        id: provider.id,
        msme_id: provider.msme_id ?? null,
        display_name: provider.display_name,
      },
      resolvedProviderMsmeId: provider.msme_id ?? null,
      decision: "deny",
      reason: "provider_profile_msme_id_does_not_match_owned_msme",
      queryClientUsed,
      providerQuery: {
        table: "provider_profiles",
        select: providerSelect,
        filters: {
          msme_id: providerLookupKey,
          id: ctx.linkedProviderId,
        },
      },
      providerQueryResultLength,
      providerQueryError,
    });
  }

  logProviderAccessAudit({
    route,
    source,
    component,
    email: ctx.email,
    role: ctx.role,
    resolvedUserId: resolvedAppUserId,
    resolvedMsmeId: msme.id,
    resolvedMsmePublicId: msme.msme_id,
    linkedMsmeId: ctx.linkedMsmeId,
    linkedProviderId: ctx.linkedProviderId,
    providerLookupKeyUsed: providerLookupKey,
    providerRowFound: true,
    providerRow: {
      id: provider.id,
      msme_id: provider.msme_id ?? null,
      display_name: provider.display_name,
    },
    resolvedProviderMsmeId: provider.msme_id ?? null,
    decision: "allow",
    reason: "msme_role_and_owned_provider_profile_resolved_via_msme_id_chain",
    queryClientUsed,
    providerQuery: {
      table: "provider_profiles",
      select: providerSelect,
      filters: {
        msme_id: providerLookupKey,
      },
    },
    providerQueryResultLength,
    providerQueryError,
  });

  return {
    role: ctx.role,
    appUserId: resolvedAppUserId,
    msme,
    provider: {
      ...provider,
      short_description: provider.tagline ?? provider.description ?? null,
      long_description: provider.description ?? null,
      slug: provider.public_slug ?? provider.id,
      trust_score: 0,
      logo_url: null,
    },
  };
}
