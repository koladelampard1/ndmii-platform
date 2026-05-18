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
    passport_photo_url: string | null;
    passport_photo_path?: string | null;
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
  if (payload.decision === "allow") return;
  const safePayload: Omit<ProviderAccessAuditLog, "email"> = {
    route: payload.route,
    source: payload.source,
    component: payload.component,
    role: payload.role,
    resolvedUserId: payload.resolvedUserId,
    resolvedMsmeId: payload.resolvedMsmeId,
    resolvedMsmePublicId: payload.resolvedMsmePublicId,
    linkedMsmeId: payload.linkedMsmeId,
    linkedProviderId: payload.linkedProviderId,
    providerLookupKeyUsed: payload.providerLookupKeyUsed,
    providerRowFound: payload.providerRowFound,
    providerRow: payload.providerRow,
    resolvedProviderMsmeId: payload.resolvedProviderMsmeId,
    decision: payload.decision,
    reason: payload.reason,
    queryClientUsed: payload.queryClientUsed,
    providerQuery: payload.providerQuery,
    providerQueryResultLength: payload.providerQueryResultLength,
    providerQueryError: payload.providerQueryError,
  };
  console.info("[provider-rbac]", {
    ...safePayload,
    hasEmail: Boolean(payload.email),
  });
}

function logProviderWorkspaceFailure(message: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  const safePayload = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (key.toLowerCase().includes("email")) return [key, Boolean(value)];
      return [key, value];
    }),
  );
  console.info(`[provider-workspace] ${message}`, safePayload);
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

type OwnedMsmeRow = {
  id: string;
  msme_id: string;
  business_name: string;
  owner_name: string;
  state: string;
  lga: string | null;
  sector: string;
  verification_status: string;
  contact_email: string | null;
  passport_photo_url: string | null;
  passport_photo_path?: string | null;
  created_by: string | null;
};

type ProviderProfileRow = {
  id: string;
  msme_id?: string | null;
  slug?: string | null;
  public_slug?: string | null;
  display_name?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  tagline?: string | null;
  description?: string | null;
  logo_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  is_verified?: boolean | null;
  is_active?: boolean | null;
  trust_score?: number | null;
};

function normalizeProviderProfile(row: ProviderProfileRow, msme: OwnedMsmeRow): ProviderWorkspaceContext["provider"] {
  const generatedSlug = buildProviderSlug(msme.business_name || msme.owner_name || "provider", msme.msme_id);
  const displayName = row.display_name || msme.business_name || msme.owner_name || "NDMII MSME Provider";
  const publicSlug = row.public_slug ?? row.slug ?? generatedSlug;
  const description =
    row.description ??
    row.long_description ??
    `${displayName} is registered on the NDMII platform and is preparing marketplace information.`;
  const tagline = row.tagline ?? row.short_description ?? `NDMII registered MSME in ${msme.state}.`;

  return {
    id: row.id,
    msme_id: row.msme_id ?? msme.id,
    display_name: displayName,
    short_description: row.short_description ?? tagline ?? description,
    long_description: row.long_description ?? description,
    logo_url: row.logo_url ?? null,
    slug: publicSlug || row.id,
    trust_score: Number(row.trust_score ?? 0),
    public_slug: publicSlug,
    tagline,
    description,
    contact_email: row.contact_email ?? msme.contact_email ?? null,
    contact_phone: row.contact_phone ?? null,
    website: row.website ?? null,
    is_verified: row.is_verified ?? ["approved", "verified"].includes((msme.verification_status ?? "").toLowerCase()),
    is_active: row.is_active ?? true,
  };
}

function buildMinimalProviderProfile(msme: OwnedMsmeRow): ProviderWorkspaceContext["provider"] {
  const generatedSlug = buildProviderSlug(msme.business_name || msme.owner_name || "provider", msme.msme_id);
  return normalizeProviderProfile(
    {
      id: msme.id,
      msme_id: msme.id,
      display_name: msme.business_name || msme.owner_name || "NDMII MSME Provider",
      public_slug: generatedSlug,
      contact_email: msme.contact_email,
      logo_url: null,
      is_active: true,
      is_verified: ["approved", "verified"].includes((msme.verification_status ?? "").toLowerCase()),
    },
    msme,
  );
}

function providerMatchesOwnedMsme(provider: ProviderProfileRow | null, msme: OwnedMsmeRow, email: string | null) {
  if (!provider) return false;
  const providerMsmeId = provider.msme_id?.trim();
  const providerEmail = provider.contact_email?.trim().toLowerCase();
  return (
    providerMsmeId === msme.id ||
    providerMsmeId === msme.msme_id ||
    Boolean(email && providerEmail && providerEmail === email.trim().toLowerCase())
  );
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

  let msme: OwnedMsmeRow | null = null;
  const msmeSelect = "id,msme_id,business_name,owner_name,state,lga,sector,verification_status,contact_email,passport_photo_url,passport_photo_path,created_by";

  if (resolvedAppUserId) {
    const { data: byOwner, error: byOwnerError } = await supabase
      .from("msmes")
      .select(msmeSelect)
      .eq("created_by", resolvedAppUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byOwnerError) {
      logProviderWorkspaceFailure("owned_msme_created_by_lookup_failed", {
        source,
        route,
        resolvedAppUserId,
        error: byOwnerError.message,
      });
    }
    msme = byOwner ?? null;
  }

  if (!msme && ctx.email) {
    const { data: byEmail, error: byEmailError } = await supabase
      .from("msmes")
      .select(msmeSelect)
      .eq("contact_email", ctx.email.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byEmailError) {
      logProviderWorkspaceFailure("owned_msme_contact_email_lookup_failed", {
        source,
        route,
        email: ctx.email,
        error: byEmailError.message,
      });
    }
    msme = byEmail ?? null;
  }

  if (!msme && ctx.role === "admin" && ctx.linkedMsmeId) {
    const { data: byLinkedMsme, error: byLinkedMsmeError } = await supabase
      .from("msmes")
      .select(msmeSelect)
      .or(`id.eq.${ctx.linkedMsmeId},msme_id.eq.${ctx.linkedMsmeId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byLinkedMsmeError) {
      logProviderWorkspaceFailure("admin_linked_msme_lookup_failed", {
        source,
        route,
        linkedMsmeId: ctx.linkedMsmeId,
        error: byLinkedMsmeError.message,
      });
    }
    msme = byLinkedMsme ?? null;
  }

  if (!msme) {
    denyProviderWorkspaceAccess({
      route,
      source,
      component,
      email: ctx.email,
      role: ctx.role,
      resolvedUserId: resolvedAppUserId,
      resolvedMsmeId: null,
      resolvedMsmePublicId: null,
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

  const ownedMsme: OwnedMsmeRow = msme;
  const providerSelect = "*";
  let provider: ProviderProfileRow | null = null;
  let providerLookupKeyUsed: "msmes.id" | "msmes.msme_id" | "contact_email" | "linked_provider_id" | "auto_provisioned" | "minimal_msme_fallback" | null = null;
  let providerQueryResultLength = 0;
  let providerQueryError: string | null = null;

  async function fetchProviderBy(
    lookupKey: typeof providerLookupKeyUsed,
    query: { field: "msme_id" | "contact_email" | "id"; value: string },
  ) {
    const { data, error } = await supabase
      .from("provider_profiles")
      .select(providerSelect)
      .eq(query.field, query.value)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) {
      providerQueryError = error.message;
      logProviderWorkspaceFailure("provider_profile_lookup_failed", {
        source,
        route,
        lookupKey,
        field: query.field,
        code: error.code ?? null,
        error: error.message,
      });
      return null;
    }

    providerQueryResultLength = data?.length ?? 0;
    const rows = ((data ?? []) as ProviderProfileRow[]).filter((row) => providerMatchesOwnedMsme(row, ownedMsme, ctx.email));
    const matched = rows[0] ?? null;
    if (matched) {
      providerLookupKeyUsed = lookupKey;
      return matched;
    }
    return null;
  }

  provider =
    (await fetchProviderBy("msmes.id", { field: "msme_id", value: ownedMsme.id })) ??
    (await fetchProviderBy("msmes.msme_id", { field: "msme_id", value: ownedMsme.msme_id })) ??
    (ctx.email ? await fetchProviderBy("contact_email", { field: "contact_email", value: ctx.email.trim().toLowerCase() }) : null);

  if (!provider && ctx.linkedProviderId) {
    provider = await fetchProviderBy("linked_provider_id", { field: "id", value: ctx.linkedProviderId });
  }

  if (!provider) {
    const generatedSlug = buildProviderSlug(ownedMsme.business_name || ownedMsme.owner_name || "provider", ownedMsme.msme_id);
    const commonPayload = {
      display_name: ownedMsme.business_name || ownedMsme.owner_name || "NDMII MSME Provider",
      public_slug: generatedSlug,
      tagline: `NDMII registered MSME in ${ownedMsme.state}.`,
      description: `${ownedMsme.business_name || ownedMsme.owner_name || "This MSME"} is registered on the NDMII platform and is preparing marketplace information.`,
      contact_email: ownedMsme.contact_email ?? null,
      contact_phone: null,
      website: null,
      is_verified: ["approved", "verified"].includes((ownedMsme.verification_status ?? "").toLowerCase()),
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const modernPayload = {
      ...commonPayload,
      msme_id: ownedMsme.id,
      slug: generatedSlug,
      short_description: commonPayload.tagline,
      long_description: commonPayload.description,
      logo_url: null,
      trust_score: 80,
      is_featured: false,
    };
    const livePayload = {
      ...commonPayload,
      msme_id: ownedMsme.msme_id,
      logo_url: null,
    };
    const liveUuidPayload = {
      ...commonPayload,
      msme_id: ownedMsme.id,
      logo_url: null,
    };

    const provisioningAttempts = [modernPayload, livePayload, liveUuidPayload];
    let provisionErrorMessage: string | null = null;

    for (const payload of provisioningAttempts) {
      const { data: insertedRows, error } = await supabase
        .from("provider_profiles")
        .insert(payload)
        .select(providerSelect)
        .limit(1);
      if (!error && insertedRows?.[0]) {
        const inserted = insertedRows[0] as ProviderProfileRow;
        if (providerMatchesOwnedMsme(inserted, ownedMsme, ctx.email)) {
          provider = inserted;
          providerLookupKeyUsed = "auto_provisioned";
          providerQueryResultLength = 1;
          providerQueryError = null;
          break;
        }
      }
      provisionErrorMessage = error?.message ?? provisionErrorMessage;
    }

    if (!provider) {
      provider =
        (await fetchProviderBy("msmes.id", { field: "msme_id", value: ownedMsme.id })) ??
        (await fetchProviderBy("msmes.msme_id", { field: "msme_id", value: ownedMsme.msme_id })) ??
        (ctx.email ? await fetchProviderBy("contact_email", { field: "contact_email", value: ctx.email.trim().toLowerCase() }) : null);
    }

    if (!provider) {
      providerQueryError = provisionErrorMessage ?? providerQueryError;
      providerLookupKeyUsed = "minimal_msme_fallback";
      logProviderWorkspaceFailure("provider_profile_using_minimal_msme_fallback", {
        source,
        route,
        email: ctx.email,
        ownedMsmeId: ownedMsme.id,
        msmePublicId: ownedMsme.msme_id,
        provisionError: provisionErrorMessage,
      });
    }
  }

  const resolvedProvider = provider ? normalizeProviderProfile(provider, ownedMsme) : buildMinimalProviderProfile(ownedMsme);

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
    providerLookupKeyUsed,
    providerRowFound: Boolean(provider),
    providerRow: provider
      ? {
          id: provider.id,
          msme_id: provider.msme_id ?? null,
          display_name: provider.display_name ?? resolvedProvider.display_name,
        }
      : {
          id: resolvedProvider.id,
          msme_id: resolvedProvider.msme_id,
          display_name: resolvedProvider.display_name,
        },
    resolvedProviderMsmeId: provider?.msme_id ?? resolvedProvider.msme_id,
    decision: "allow",
    reason: provider ? "provider_profile_resolved_with_launch_compatibility_lookup" : "minimal_msme_provider_fallback_for_launch_access",
    queryClientUsed,
    providerQuery: {
      table: "provider_profiles",
      select: providerSelect,
      filters: {
        msme_id: ownedMsme.id,
      },
    },
    providerQueryResultLength,
    providerQueryError,
  });

  return {
    role: ctx.role,
    appUserId: resolvedAppUserId,
    msme,
    provider: resolvedProvider,
  };
}
