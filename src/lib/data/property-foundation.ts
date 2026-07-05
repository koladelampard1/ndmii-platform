import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlatformAdmin, type UserContext } from "@/lib/auth/authorization";
import { canAccessModule, recordPlatformEvent, resolveEffectiveRoles, type ModuleAccessCheck } from "@/lib/data/platform-foundation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ScopeType } from "@/types/platform";
import type {
  Property,
  PropertyAddress,
  PropertyCategory,
  PropertyClaim,
  PropertyDocument,
  PropertyEvent,
  PropertyIdentityCredential,
  PropertyModuleKey,
  PropertyOwner,
  PropertyScopedRole,
  PropertyWard,
  PropertyDistrict,
  PropertyCommunity,
  PropertyVillage,
  SurveyBlock,
} from "@/types/property";

type Client = SupabaseClient<any>;

export const PROPERTY_MODULE_KEYS = [
  "property_registry",
  "property_verification",
  "property_documents",
  "property_intelligence",
  "property_public_explorer",
  "property_registry_operations",
  "property_gis",
] as const satisfies readonly PropertyModuleKey[];

export const PROPERTY_SCOPED_ROLES = [
  "property_admin",
  "land_registry_officer",
  "survey_officer",
  "gis_officer",
  "property_reviewer",
  "valuation_officer",
  "document_verifier",
  "title_issuer",
  "property_data_analyst",
  "property_auditor",
  "executive_observer",
] as const satisfies readonly PropertyScopedRole[];

export const PROPERTY_REVIEW_ROLES = [
  "property_admin",
  "land_registry_officer",
  "property_reviewer",
  "document_verifier",
  "title_issuer",
  "property_auditor",
] as const satisfies readonly PropertyScopedRole[];

export const PROPERTY_INTELLIGENCE_ROLES = [
  "property_admin",
  "property_data_analyst",
  "property_auditor",
  "executive_observer",
] as const satisfies readonly PropertyScopedRole[];

export const PROPERTY_OPERATION_ROLES = [
  "property_admin",
  "land_registry_officer",
  "survey_officer",
  "property_reviewer",
  "document_verifier",
  "title_issuer",
] as const satisfies readonly PropertyScopedRole[];

export type PropertyRegistryFoundation = {
  categories: PropertyCategory[];
  wards: PropertyWard[];
  districts: PropertyDistrict[];
  communities: PropertyCommunity[];
  villages: PropertyVillage[];
  surveyBlocks: SurveyBlock[];
};

export type PropertyDetail = Property & {
  addresses: PropertyAddress[];
  owners: PropertyOwner[];
  credentials: PropertyIdentityCredential[];
  documents: PropertyDocument[];
};

export type PropertyPermissionResult = {
  allowed: boolean;
  roles: string[];
  source: "platform_admin" | "global_role" | "scoped_role" | "module" | "denied";
  module?: ModuleAccessCheck;
};

export type PropertyWorkspaceAccessResult = {
  allowed: boolean;
  source: "platform_admin" | "msme" | "scoped_role" | "module_missing" | "module_inactive" | "denied";
  roles: string[];
  moduleStatus: string | null;
};

async function service(client?: Client) {
  return client ?? await createServiceRoleSupabaseClient();
}

function normalizeNpin(value: string) {
  return value.trim().toUpperCase();
}

function activeRole(status: string | null | undefined, expiresAt: string | null | undefined) {
  if (status !== "active") return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export async function loadPropertyRegistryFoundation(client?: Client): Promise<PropertyRegistryFoundation> {
  const supabase = await service(client);
  const [categories, wards, districts, communities, villages, surveyBlocks] = await Promise.all([
    supabase.from("property_categories").select("*").eq("status", "active").order("name"),
    supabase.from("property_wards").select("*").eq("status", "active").order("name"),
    supabase.from("property_districts").select("*").eq("status", "active").order("name"),
    supabase.from("property_communities").select("*").eq("status", "active").order("name"),
    supabase.from("property_villages").select("*").eq("status", "active").order("name"),
    supabase.from("survey_blocks").select("*").eq("status", "active").order("name"),
  ]);

  for (const result of [categories, wards, districts, communities, villages, surveyBlocks]) {
    if (result.error) throw result.error;
  }

  return {
    categories: (categories.data ?? []) as PropertyCategory[],
    wards: (wards.data ?? []) as PropertyWard[],
    districts: (districts.data ?? []) as PropertyDistrict[],
    communities: (communities.data ?? []) as PropertyCommunity[],
    villages: (villages.data ?? []) as PropertyVillage[],
    surveyBlocks: (surveyBlocks.data ?? []) as SurveyBlock[],
  };
}

export async function listPropertyModules(client?: Client) {
  const supabase = await service(client);
  const { data, error } = await supabase
    .from("platform_modules")
    .select("*")
    .in("module_key", [...PROPERTY_MODULE_KEYS])
    .order("module_key");
  if (error) throw error;
  return data ?? [];
}

export async function canAccessPropertyModule(input: {
  moduleKey: PropertyModuleKey;
  institutionId?: string | null;
  client?: Client;
}) {
  return canAccessModule({
    moduleKey: input.moduleKey,
    institutionId: input.institutionId,
    client: input.client,
  });
}

export async function canAccessPropertyRegistrationWorkspace(input: {
  ctx: UserContext;
  client?: Client;
}): Promise<PropertyWorkspaceAccessResult> {
  const supabase = await service(input.client);
  if (!input.ctx.appUserId || input.ctx.role === "public") {
    return { allowed: false, source: "denied", roles: [input.ctx.role], moduleStatus: null };
  }

  const { data: module, error: moduleError } = await supabase
    .from("platform_modules")
    .select("id,status")
    .eq("module_key", "property_registry")
    .maybeSingle();
  if (moduleError) throw moduleError;
  if (!module) return { allowed: false, source: "module_missing", roles: [input.ctx.role], moduleStatus: null };
  if (!["active", "preview"].includes(module.status)) {
    return { allowed: false, source: "module_inactive", roles: [input.ctx.role], moduleStatus: module.status };
  }

  if (isPlatformAdmin(input.ctx.role)) {
    return { allowed: true, source: "platform_admin", roles: [input.ctx.role], moduleStatus: module.status };
  }
  if (input.ctx.role === "msme") {
    return { allowed: true, source: "msme", roles: [input.ctx.role], moduleStatus: module.status };
  }

  const effective = await resolveEffectiveRoles({
    userId: input.ctx.appUserId,
    globalRole: input.ctx.role,
    client: supabase,
  });
  const hasPropertyRole = effective.scopedRoles
    .filter((assignment) => activeRole(assignment.status, assignment.expires_at))
    .some((assignment) => PROPERTY_SCOPED_ROLES.includes(assignment.role as PropertyScopedRole));

  return {
    allowed: hasPropertyRole,
    source: hasPropertyRole ? "scoped_role" : "denied",
    roles: effective.roles,
    moduleStatus: module.status,
  };
}

export async function resolvePropertyPermission(input: {
  ctx: UserContext;
  allowedRoles?: readonly PropertyScopedRole[];
  scopeType?: ScopeType;
  scopeId?: string | null;
  institutionId?: string | null;
  moduleKey?: PropertyModuleKey;
  client?: Client;
}): Promise<PropertyPermissionResult> {
  if (isPlatformAdmin(input.ctx.role)) {
    const moduleAccess = input.moduleKey
      ? await canAccessPropertyModule({ moduleKey: input.moduleKey, institutionId: input.institutionId, client: input.client })
      : undefined;
    return {
      allowed: moduleAccess ? moduleAccess.allowed : true,
      roles: [input.ctx.role],
      source: moduleAccess && !moduleAccess.allowed ? "denied" : "platform_admin",
      module: moduleAccess,
    };
  }

  const allowedRoles = input.allowedRoles ?? PROPERTY_SCOPED_ROLES;
  if (!input.ctx.appUserId) return { allowed: false, roles: [input.ctx.role], source: "denied" };

  const effective = await resolveEffectiveRoles({
    userId: input.ctx.appUserId,
    globalRole: input.ctx.role,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    institutionId: input.institutionId,
    client: input.client,
  });
  const roleAllowed = effective.scopedRoles
    .filter((assignment) => activeRole(assignment.status, assignment.expires_at))
    .some((assignment) => allowedRoles.includes(assignment.role as PropertyScopedRole));

  if (!roleAllowed) {
    return { allowed: false, roles: effective.roles, source: "denied" };
  }

  const moduleAccess = input.moduleKey
    ? await canAccessPropertyModule({ moduleKey: input.moduleKey, institutionId: input.institutionId, client: input.client })
    : undefined;

  return {
    allowed: moduleAccess ? moduleAccess.allowed : true,
    roles: effective.roles,
    source: moduleAccess && !moduleAccess.allowed ? "denied" : "scoped_role",
    module: moduleAccess,
  };
}

export async function generatePropertyNpin(stateId: string, client?: Client) {
  const supabase = await service(client);
  const { data, error } = await supabase.rpc("generate_property_npin", { target_state_id: stateId });
  if (error) throw error;
  return String(data);
}

export async function generatePropertyApplicationReference(client?: Client) {
  const supabase = await service(client);
  const { data, error } = await supabase.rpc("generate_property_application_reference");
  if (error) throw error;
  return String(data);
}

export async function generatePropertyCaseReference(client?: Client) {
  const supabase = await service(client);
  const { data, error } = await supabase.rpc("generate_property_case_reference");
  if (error) throw error;
  return String(data);
}

export async function getPropertyById(propertyId: string, client?: Client): Promise<Property | null> {
  const supabase = await service(client);
  const { data, error } = await supabase.from("properties").select("*").eq("id", propertyId).maybeSingle();
  if (error) throw error;
  return data as Property | null;
}

export async function getPropertyByNpin(npin: string, client?: Client): Promise<Property | null> {
  const supabase = await service(client);
  const { data, error } = await supabase.from("properties").select("*").eq("npin", normalizeNpin(npin)).maybeSingle();
  if (error) throw error;
  return data as Property | null;
}

export async function listProperties(input: {
  stateId?: string | null;
  lgaId?: string | null;
  status?: Property["status"] | null;
  registryInstitutionId?: string | null;
  limit?: number;
  client?: Client;
} = {}): Promise<Property[]> {
  const supabase = await service(input.client);
  let query = supabase.from("properties").select("*").order("created_at", { ascending: false }).limit(input.limit ?? 50);
  if (input.stateId) query = query.eq("state_id", input.stateId);
  if (input.lgaId) query = query.eq("lga_id", input.lgaId);
  if (input.status) query = query.eq("status", input.status);
  if (input.registryInstitutionId) query = query.eq("registry_institution_id", input.registryInstitutionId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Property[];
}

export async function getPropertyDetail(propertyId: string, client?: Client): Promise<PropertyDetail | null> {
  const supabase = await service(client);
  const [property, addresses, owners, credentials, documents] = await Promise.all([
    supabase.from("properties").select("*").eq("id", propertyId).maybeSingle(),
    supabase.from("property_addresses").select("*").eq("property_id", propertyId).order("is_primary", { ascending: false }),
    supabase.from("property_owners").select("*").eq("property_id", propertyId).order("is_primary", { ascending: false }),
    supabase.from("property_identity_credentials").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }),
    supabase.from("property_documents").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }),
  ]);

  for (const result of [property, addresses, owners, credentials, documents]) {
    if (result.error) throw result.error;
  }
  if (!property.data) return null;

  return {
    ...(property.data as Property),
    addresses: (addresses.data ?? []) as PropertyAddress[],
    owners: (owners.data ?? []) as PropertyOwner[],
    credentials: (credentials.data ?? []) as PropertyIdentityCredential[],
    documents: (documents.data ?? []) as PropertyDocument[],
  };
}

export async function listPropertyOwners(propertyId: string, client?: Client): Promise<PropertyOwner[]> {
  const supabase = await service(client);
  const { data, error } = await supabase
    .from("property_owners")
    .select("*")
    .eq("property_id", propertyId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PropertyOwner[];
}

export async function listPropertyClaims(input: {
  propertyId?: string | null;
  claimantUserId?: string | null;
  status?: PropertyClaim["status"] | null;
  limit?: number;
  client?: Client;
} = {}): Promise<PropertyClaim[]> {
  const supabase = await service(input.client);
  let query = supabase.from("property_claims").select("*").order("created_at", { ascending: false }).limit(input.limit ?? 50);
  if (input.propertyId) query = query.eq("property_id", input.propertyId);
  if (input.claimantUserId) query = query.eq("claimant_user_id", input.claimantUserId);
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PropertyClaim[];
}

export async function getActivePropertyCredential(propertyId: string, client?: Client): Promise<PropertyIdentityCredential | null> {
  const supabase = await service(client);
  const { data, error } = await supabase
    .from("property_identity_credentials")
    .select("*")
    .eq("property_id", propertyId)
    .eq("status", "issued")
    .maybeSingle();
  if (error) throw error;
  return data as PropertyIdentityCredential | null;
}

export async function getPropertyCredentialByTokenHash(tokenHash: string, client?: Client): Promise<PropertyIdentityCredential | null> {
  const supabase = await service(client);
  const { data, error } = await supabase
    .from("property_identity_credentials")
    .select("*")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data as PropertyIdentityCredential | null;
}

export async function listPropertyDocuments(propertyId: string, client?: Client): Promise<PropertyDocument[]> {
  const supabase = await service(client);
  const { data, error } = await supabase
    .from("property_documents")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PropertyDocument[];
}

export async function recordPropertyEvent(input: {
  propertyId?: string | null;
  eventType: string;
  entityType?: string;
  entityId?: string | null;
  actorUserId?: string | null;
  actorInstitutionId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  scopeType?: ScopeType | null;
  scopeId?: string | null;
  client?: Client;
}): Promise<PropertyEvent | null> {
  const supabase = await service(input.client);
  const { data, error } = await supabase
    .from("property_events")
    .insert({
      property_id: input.propertyId ?? null,
      event_type: input.eventType,
      entity_type: input.entityType ?? "property",
      entity_id: input.entityId ?? input.propertyId ?? null,
      actor_user_id: input.actorUserId ?? null,
      actor_institution_id: input.actorInstitutionId ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    console.warn("[property-event] insert failed", {
      eventType: input.eventType,
      propertyId: input.propertyId,
      error: error.message,
    });
    return null;
  }

  await recordPlatformEvent({
    actorUserId: input.actorUserId ?? null,
    actorInstitutionId: input.actorInstitutionId ?? null,
    eventType: input.eventType,
    entityType: input.entityType ?? "property",
    entityId: input.entityId ?? input.propertyId ?? null,
    scopeType: input.scopeType ?? (input.propertyId ? "property" : null),
    scopeId: input.scopeId ?? input.propertyId ?? null,
    metadata: {
      property_id: input.propertyId ?? null,
      ...(input.metadata ?? {}),
    },
    client: supabase,
  });

  return data as PropertyEvent;
}
