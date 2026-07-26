import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlatformAdmin, normalizeUserRole } from "@/lib/auth/authorization";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type {
  ConsentDataCategory,
  EffectiveRoleResolution,
  IndustrialCluster,
  Institution,
  Lga,
  PlatformEvent,
  PlatformModule,
  PlatformModuleKey,
  Programme,
  RoleAssignment,
  ScopeType,
  State,
} from "@/types/platform";
import type { UserRole } from "@/types/roles";

type Client = SupabaseClient<any>;

type PlatformEventInput = {
  actorUserId?: string | null;
  actorInstitutionId?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  scopeType?: ScopeType | null;
  scopeId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  client?: Client;
};

export type PlatformWorkspaceFoundation = {
  institutions: Institution[];
  programmes: Programme[];
  clusters: IndustrialCluster[];
  modules: PlatformModule[];
};

export type GeographyCatalog = {
  states: State[];
  lgas: Lga[];
};

export type ModuleAccessCheck = {
  allowed: boolean;
  status: string | null;
  source: "programme" | "institution" | "module" | "missing";
};

const ACTIVE_ROLE_STATUS = "active";
const ACTIVE_MODULE_STATUSES = new Set(["enabled", "preview"]);

function isActiveAssignment(row: Pick<RoleAssignment, "status" | "expires_at">) {
  if (row.status !== ACTIVE_ROLE_STATUS) return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

export async function loadPlatformWorkspaceFoundation(client?: Client): Promise<PlatformWorkspaceFoundation> {
  const supabase = client ?? await createServiceRoleSupabaseClient();
  const [institutions, programmes, clusters, modules] = await Promise.all([
    supabase.from("institutions").select("*").order("name", { ascending: true }),
    supabase.from("programmes").select("*").order("created_at", { ascending: true }),
    supabase.from("industrial_clusters").select("*").order("created_at", { ascending: true }),
    supabase.from("platform_modules").select("*").order("module_key", { ascending: true }),
  ]);

  return {
    institutions: (institutions.data ?? []) as Institution[],
    programmes: (programmes.data ?? []) as Programme[],
    clusters: (clusters.data ?? []) as IndustrialCluster[],
    modules: (modules.data ?? []) as PlatformModule[],
  };
}

export async function loadGeographyCatalog(client?: Client): Promise<GeographyCatalog> {
  const supabase = client ?? await createServiceRoleSupabaseClient();
  const [states, lgas] = await Promise.all([
    supabase.from("states").select("*").order("name", { ascending: true }),
    supabase.from("lgas").select("*").order("name", { ascending: true }),
  ]);

  return {
    states: (states.data ?? []) as State[],
    lgas: (lgas.data ?? []) as Lga[],
  };
}

export async function getInstitutionBySlug(slug: string, client?: Client): Promise<Institution | null> {
  const supabase = client ?? await createServiceRoleSupabaseClient();
  const { data } = await supabase.from("institutions").select("*").eq("slug", slug).maybeSingle();
  return (data as Institution | null) ?? null;
}

export async function getProgrammeBySlug(slug: string, client?: Client): Promise<Programme | null> {
  const supabase = client ?? await createServiceRoleSupabaseClient();
  const { data } = await supabase.from("programmes").select("*").eq("slug", slug).maybeSingle();
  return (data as Programme | null) ?? null;
}

export async function listProgrammesForInstitution(institutionId: string, client?: Client): Promise<Programme[]> {
  const supabase = client ?? await createServiceRoleSupabaseClient();
  const [{ data: owned }, { data: partnered }] = await Promise.all([
    supabase.from("programmes").select("*").eq("owning_institution_id", institutionId).order("created_at", { ascending: false }),
    supabase
      .from("programme_partners")
      .select("programmes(*)")
      .eq("institution_id", institutionId)
      .eq("status", "active"),
  ]);

  const rows = new Map<string, Programme>();
  for (const row of (owned ?? []) as Programme[]) rows.set(row.id, row);
  for (const row of partnered ?? []) {
    const programme = Array.isArray(row.programmes) ? row.programmes[0] : row.programmes;
    if (programme?.id) rows.set(programme.id, programme as Programme);
  }
  return [...rows.values()];
}

export async function listClustersForProgramme(programmeId: string, client?: Client): Promise<IndustrialCluster[]> {
  const supabase = client ?? await createServiceRoleSupabaseClient();
  const { data } = await supabase
    .from("industrial_clusters")
    .select("*")
    .eq("programme_id", programmeId)
    .order("created_at", { ascending: false });
  return (data ?? []) as IndustrialCluster[];
}

export async function listRoleAssignmentsForUser(userId: string, client?: Client): Promise<RoleAssignment[]> {
  const supabase = client ?? await createServiceRoleSupabaseClient();
  const { data } = await supabase
    .from("role_assignments")
    .select("*")
    .eq("user_id", userId)
    .eq("status", ACTIVE_ROLE_STATUS)
    .order("assigned_at", { ascending: false });
  return ((data ?? []) as RoleAssignment[]).filter(isActiveAssignment);
}

export async function resolveEffectiveRoles(input: {
  userId: string | null;
  globalRole: UserRole | string | null | undefined;
  scopeType?: ScopeType;
  scopeId?: string | null;
  institutionId?: string | null;
  client?: Client;
}): Promise<EffectiveRoleResolution> {
  const globalRole = normalizeUserRole(input.globalRole, "public");
  const platformAdmin = isPlatformAdmin(globalRole);
  if (!input.userId) {
    return { globalRole, scopedRoles: [], roles: [globalRole], isPlatformAdmin: platformAdmin };
  }

  const assignments = await listRoleAssignmentsForUser(input.userId, input.client);
  const scopedRoles = assignments.filter((assignment) => {
    if (assignment.scope_type === "global") return true;
    if (input.institutionId && assignment.institution_id === input.institutionId) return true;
    if (!input.scopeType) return false;
    if (assignment.scope_type !== input.scopeType) return false;
    if (input.scopeId && assignment.scope_id !== input.scopeId) return false;
    return Boolean(assignment.scope_id || assignment.institution_id);
  });

  const roles = [...new Set([globalRole, ...scopedRoles.map((row) => row.role)])];
  return { globalRole, scopedRoles, roles, isPlatformAdmin: platformAdmin };
}

export async function canAccessModule(input: {
  moduleKey: PlatformModuleKey;
  institutionId?: string | null;
  programmeId?: string | null;
  client?: Client;
}): Promise<ModuleAccessCheck> {
  const supabase = input.client ?? await createServiceRoleSupabaseClient();
  const { data: module } = await supabase
    .from("platform_modules")
    .select("id,status")
    .eq("module_key", input.moduleKey)
    .maybeSingle();

  if (!module?.id) return { allowed: false, status: null, source: "missing" };

  if (input.programmeId) {
    const { data } = await supabase
      .from("programme_module_access")
      .select("status")
      .eq("programme_id", input.programmeId)
      .eq("module_id", module.id)
      .maybeSingle();
    if (data?.status) {
      return { allowed: ACTIVE_MODULE_STATUSES.has(data.status), status: data.status, source: "programme" };
    }
  }

  if (input.institutionId) {
    const { data } = await supabase
      .from("institution_module_access")
      .select("status")
      .eq("institution_id", input.institutionId)
      .eq("module_id", module.id)
      .maybeSingle();
    if (data?.status) {
      return { allowed: ACTIVE_MODULE_STATUSES.has(data.status), status: data.status, source: "institution" };
    }
  }

  return { allowed: module.status === "active", status: module.status, source: "module" };
}

export async function recordPlatformEvent(input: PlatformEventInput): Promise<PlatformEvent | null> {
  const supabase = input.client ?? await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("platform_events")
    .insert({
      actor_user_id: input.actorUserId ?? null,
      actor_institution_id: input.actorInstitutionId ?? null,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      scope_type: input.scopeType ?? null,
      scope_id: input.scopeId ?? null,
      metadata: input.metadata ?? {},
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.warn("[platform-event] insert failed", {
      eventType: input.eventType,
      entityType: input.entityType,
      error: error.message,
    });
    return null;
  }
  return data as PlatformEvent;
}

const SENSITIVE_AUDIT_METADATA_KEY = /(password|token|secret|service.*key|authorization|cookie|session|nin|bvn)/i;

function sanitizeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => sanitizeAuditMetadata(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_AUDIT_METADATA_KEY.test(key))
        .map(([key, entry]) => [key, sanitizeAuditMetadata(entry)]),
    );
  }
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  return value;
}

export async function recordTrustedLcdboDeliveryEvent(input: Omit<PlatformEventInput, "client">): Promise<PlatformEvent> {
  if (!input.eventType.startsWith("lcdbo.delivery.")) {
    throw new Error("Unsupported LCDBO delivery audit event namespace.");
  }
  if (!input.actorUserId) {
    throw new Error("Verified actor identity is required for LCDBO delivery audit events.");
  }

  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("platform_events")
    .insert({
      actor_user_id: input.actorUserId,
      actor_institution_id: input.actorInstitutionId ?? null,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      scope_type: input.scopeType ?? null,
      scope_id: input.scopeId ?? null,
      metadata: sanitizeAuditMetadata(input.metadata ?? {}) as Record<string, unknown>,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[platform-event] trusted LCDBO delivery insert failed", {
      eventType: input.eventType,
      entityType: input.entityType,
      error: error?.message ?? "No platform event returned.",
    });
    throw new Error("Unable to record the LCDBO delivery audit event.");
  }

  return data as PlatformEvent;
}

export async function hasActiveConsent(input: {
  subjectType: "msme" | "business" | "user" | "institution";
  subjectId: string;
  granteeType: "institution" | "investor" | "programme" | "partner" | "government_agency";
  granteeId: string;
  requiredCategories?: ConsentDataCategory[];
  client?: Client;
}) {
  const supabase = input.client ?? await createServiceRoleSupabaseClient();
  const { data } = await supabase
    .from("consent_records")
    .select("id,data_categories,expires_at,status")
    .eq("subject_type", input.subjectType)
    .eq("subject_id", input.subjectId)
    .eq("grantee_type", input.granteeType)
    .eq("grantee_id", input.granteeId)
    .eq("status", "granted")
    .order("granted_at", { ascending: false });

  const now = Date.now();
  return ((data ?? []) as Array<{ data_categories: ConsentDataCategory[]; expires_at: string | null }>).some((row) => {
    if (row.expires_at && new Date(row.expires_at).getTime() <= now) return false;
    if (!input.requiredCategories?.length) return true;
    return input.requiredCategories.every((category) => row.data_categories.includes(category));
  });
}
