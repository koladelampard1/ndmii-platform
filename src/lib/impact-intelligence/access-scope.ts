import type { UserContext } from "@/lib/auth/authorization";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type ImpactAccessMode =
  | "unrestricted"
  | "administrative"
  | "aggregate"
  | "approved_data"
  | "assigned"
  | "legacy_fallback"
  | "delegated_field_scope"
  | "denied";

export type ImpactAccessScope = {
  role: UserContext["role"];
  mode: ImpactAccessMode;
  programmeIds: string[];
  assignmentCount: number;
  fallbackToLegacy: boolean;
  readOnly: boolean;
  reason: string;
};

export type ProgrammeAccessExplanation = {
  allowed: boolean;
  programmeId: string;
  role: UserContext["role"];
  mode: ImpactAccessMode;
  assignmentCount: number;
  fallbackToLegacy: boolean;
  legacyFallbackUsed: boolean;
  action: "read" | "write";
  reason: string;
};

export type ProgrammeScopeFilter = {
  mode: "all" | "assigned" | "none";
  programmeIds: string[];
  assignmentCount: number;
  legacyFallbackUsed: boolean;
  reason: string;
};

export type ProgrammeScopeDiagnostic = {
  role: UserContext["role"];
  appUserId: string | null;
  programmeId: string | null;
  action: "read" | "write";
  resource: string;
  decision: "allow" | "deny" | "would_allow" | "would_deny";
  reason: string;
  legacyFallbackUsed: boolean;
  assignmentCount: number;
};

const programmeScopeFilterCache = new WeakMap<UserContext, ProgrammeScopeFilter>();

function logScopeDiagnostic(
  operation: string,
  input: {
    role: UserContext["role"];
    mode?: ImpactAccessMode;
    assignmentCount?: number;
    programmeId?: string;
    allowed?: boolean;
    fallbackToLegacy?: boolean;
    reason?: string;
  },
) {
  console.info("[impact-access-scope]", {
    operation,
    role: input.role,
    mode: input.mode ?? null,
    assignmentCount: input.assignmentCount ?? null,
    programmeId: input.programmeId ?? null,
    allowed: input.allowed ?? null,
    fallbackToLegacy: input.fallbackToLegacy ?? false,
    reason: input.reason ?? null,
  });
}

function staticScope(ctx: UserContext): ImpactAccessScope | null {
  if (ctx.role === "super_admin") {
    return {
      role: ctx.role,
      mode: "unrestricted",
      programmeIds: [],
      assignmentCount: 0,
      fallbackToLegacy: false,
      readOnly: false,
      reason: "Super administrator platform scope.",
    };
  }
  if (ctx.role === "admin") {
    return {
      role: ctx.role,
      mode: "administrative",
      programmeIds: [],
      assignmentCount: 0,
      fallbackToLegacy: false,
      readOnly: false,
      reason: "administrative_access: compatibility access retained; operational ownership is not implied.",
    };
  }
  if (ctx.role === "boi_executive") {
    return {
      role: ctx.role,
      mode: "aggregate",
      programmeIds: [],
      assignmentCount: 0,
      fallbackToLegacy: false,
      readOnly: true,
      reason: "National aggregate and approved read scope.",
    };
  }
  if (ctx.role === "auditor") {
    return {
      role: ctx.role,
      mode: "unrestricted",
      programmeIds: [],
      assignmentCount: 0,
      fallbackToLegacy: false,
      readOnly: true,
      reason: "Institutional audit read scope.",
    };
  }
  if (ctx.role === "data_analyst") {
    return {
      role: ctx.role,
      mode: "approved_data",
      programmeIds: [],
      assignmentCount: 0,
      fallbackToLegacy: false,
      readOnly: true,
      reason: "Approved and verified operational data scope.",
    };
  }
  if (ctx.role === "field_officer") {
    return {
      role: ctx.role,
      mode: "delegated_field_scope",
      programmeIds: [],
      assignmentCount: 0,
      fallbackToLegacy: false,
      readOnly: false,
      reason: "Programme access remains delegated to existing beneficiary and visit assignment checks.",
    };
  }
  return null;
}

async function loadAssignedProgrammeIds(ctx: UserContext): Promise<string[]> {
  if (!ctx.appUserId) return [];
  const supabase = await createServiceRoleSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("impact_user_programme_assignments")
    .select("programme_id")
    .eq("user_id", ctx.appUserId)
    .eq("assignment_role", ctx.role)
    .eq("status", "active")
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gte.${now}`);
  if (error) throw new Error(`Programme assignments unavailable: ${error.message}`);
  return Array.from(new Set((data ?? []).map((row) => String(row.programme_id))));
}

export async function getAssignedProgrammeIds(ctx: UserContext): Promise<string[]> {
  if (!["programme_officer", "assessment_officer"].includes(ctx.role)) return [];
  try {
    return await loadAssignedProgrammeIds(ctx);
  } catch (error) {
    logScopeDiagnostic("assignment_lookup_failed", {
      role: ctx.role,
      fallbackToLegacy: true,
      reason: error instanceof Error ? error.message : "Unknown assignment lookup error.",
    });
    return [];
  }
}

export async function resolveImpactAccessScope(ctx: UserContext): Promise<ImpactAccessScope> {
  const fixed = staticScope(ctx);
  if (fixed) {
    logScopeDiagnostic("scope_resolved", fixed);
    return fixed;
  }

  if (ctx.role === "programme_officer" || ctx.role === "assessment_officer") {
    let programmeIds: string[] = [];
    let lookupFailed = false;
    try {
      programmeIds = await loadAssignedProgrammeIds(ctx);
    } catch (error) {
      lookupFailed = true;
      logScopeDiagnostic("assignment_lookup_failed", {
        role: ctx.role,
        fallbackToLegacy: true,
        reason: error instanceof Error ? error.message : "Unknown assignment lookup error.",
      });
    }

    const scope: ImpactAccessScope = programmeIds.length > 0
      ? {
          role: ctx.role,
          mode: "assigned",
          programmeIds,
          assignmentCount: programmeIds.length,
          fallbackToLegacy: false,
          readOnly: false,
          reason: "Active programme assignments resolved.",
        }
      : {
          role: ctx.role,
          mode: "legacy_fallback",
          programmeIds: [],
          assignmentCount: 0,
          fallbackToLegacy: true,
          readOnly: false,
          reason: lookupFailed
            ? "Assignment source unavailable; retaining legacy broad access in shadow mode."
            : "No active programme assignments; retaining legacy broad access in shadow mode.",
        };
    logScopeDiagnostic(scope.fallbackToLegacy ? "legacy_fallback" : "scope_resolved", scope);
    return scope;
  }

  const denied: ImpactAccessScope = {
    role: ctx.role,
    mode: "denied",
    programmeIds: [],
    assignmentCount: 0,
    fallbackToLegacy: false,
    readOnly: true,
    reason: "Role has no Impact Intelligence programme scope.",
  };
  logScopeDiagnostic("scope_resolved", denied);
  return denied;
}

export async function explainProgrammeAccess(
  ctx: UserContext,
  programmeId: string,
): Promise<ProgrammeAccessExplanation> {
  return explainScopeDecision(ctx, programmeId, "read");
}

export async function canAccessProgramme(ctx: UserContext, programmeId: string): Promise<boolean> {
  return canReadProgrammeResource(ctx, programmeId);
}

export function decideProgrammeScope(
  scope: ImpactAccessScope,
  programmeId: string,
  action: "read" | "write",
): ProgrammeAccessExplanation {
  const broadRead = ["unrestricted", "administrative", "aggregate", "approved_data", "legacy_fallback"].includes(scope.mode);
  const broadWrite = ["unrestricted", "administrative", "legacy_fallback"].includes(scope.mode);
  const assigned = scope.mode === "assigned" && scope.programmeIds.includes(programmeId);
  const allowed = action === "read" ? broadRead || assigned : (broadWrite || assigned) && !scope.readOnly;
  let reason = scope.reason;
  if (scope.mode === "assigned" && !assigned) {
    reason = "Programme is outside the user's active assignment portfolio.";
  } else if (action === "write" && scope.readOnly) {
    reason = "Role has read-only Impact Intelligence scope.";
  } else if (scope.mode === "delegated_field_scope") {
    reason = "Field officers do not receive broad programme access; beneficiary and visit assignments remain authoritative.";
  }
  return {
    allowed,
    programmeId,
    role: scope.role,
    mode: scope.mode,
    assignmentCount: scope.assignmentCount,
    fallbackToLegacy: scope.fallbackToLegacy,
    legacyFallbackUsed: scope.fallbackToLegacy,
    action,
    reason,
  };
}

export async function getProgrammeScopeFilter(ctx: UserContext): Promise<ProgrammeScopeFilter> {
  const scope = await resolveImpactAccessScope(ctx);
  let filter: ProgrammeScopeFilter;
  if (scope.mode === "assigned") {
    filter = {
      mode: "assigned",
      programmeIds: scope.programmeIds,
      assignmentCount: scope.assignmentCount,
      legacyFallbackUsed: false,
      reason: scope.reason,
    };
  } else if (scope.mode === "denied" || scope.mode === "delegated_field_scope") {
    filter = {
      mode: "none",
      programmeIds: [],
      assignmentCount: scope.assignmentCount,
      legacyFallbackUsed: false,
      reason: scope.reason,
    };
  } else {
    filter = {
      mode: "all",
      programmeIds: [],
      assignmentCount: scope.assignmentCount,
      legacyFallbackUsed: scope.fallbackToLegacy,
      reason: scope.reason,
    };
  }
  programmeScopeFilterCache.set(ctx, filter);
  return filter;
}

type ProgrammeFilterQuery<T> = T & {
  in(column: string, values: string[]): T;
  eq(column: string, value: string): T;
};

export function applyProgrammeScope<T>(
  query: T,
  ctx: UserContext,
  columnName = "programme_id",
): T {
  const filter = programmeScopeFilterCache.get(ctx);
  if (!filter) {
    logScopeDiagnostic("scope_filter_not_preloaded", {
      role: ctx.role,
      fallbackToLegacy: true,
      reason: "Programme scope filter was not preloaded; retaining the existing query in shadow mode.",
    });
    return query;
  }
  if (filter.mode === "assigned") {
    return (query as ProgrammeFilterQuery<T>).in(columnName, filter.programmeIds);
  }
  if (filter.mode === "none") {
    return (query as ProgrammeFilterQuery<T>).eq(columnName, "00000000-0000-0000-0000-000000000000");
  }
  return query;
}

export async function explainScopeDecision(
  ctx: UserContext,
  programmeId: string,
  action: "read" | "write",
): Promise<ProgrammeAccessExplanation> {
  const explanation = decideProgrammeScope(await resolveImpactAccessScope(ctx), programmeId, action);
  logScopeDiagnostic("programme_access_decision", explanation);
  return explanation;
}

export async function canReadProgrammeResource(ctx: UserContext, programmeId: string): Promise<boolean> {
  return (await explainScopeDecision(ctx, programmeId, "read")).allowed;
}

export async function canWriteProgrammeResource(ctx: UserContext, programmeId: string): Promise<boolean> {
  return (await explainScopeDecision(ctx, programmeId, "write")).allowed;
}

export async function logProgrammeScopeShadowDecision(params: {
  ctx: UserContext;
  programmeId: string | null | undefined;
  action: "read" | "write";
  resource: string;
  legacyAllowed: boolean;
}) {
  if (!params.programmeId) return null;
  const explanation = await explainScopeDecision(params.ctx, params.programmeId, params.action);
  let decision: ProgrammeScopeDiagnostic["decision"] = explanation.allowed ? "allow" : "deny";
  if (params.legacyAllowed && !explanation.allowed) decision = "would_deny";
  if (!params.legacyAllowed && explanation.allowed) decision = "would_allow";
  const diagnostic: ProgrammeScopeDiagnostic = {
    role: params.ctx.role,
    appUserId: params.ctx.appUserId,
    programmeId: params.programmeId,
    action: params.action,
    resource: params.resource,
    decision,
    reason: explanation.reason,
    legacyFallbackUsed: explanation.legacyFallbackUsed,
    assignmentCount: explanation.assignmentCount,
  };
  console.info("[impact-rbac-shadow]", decision, diagnostic);
  return diagnostic;
}
