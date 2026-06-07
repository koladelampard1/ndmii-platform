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
  reason: string;
};

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
      reason: "Administrative compatibility access; operational ownership is not implied.",
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
  const scope = await resolveImpactAccessScope(ctx);
  let allowed = false;

  if (["unrestricted", "administrative", "aggregate", "approved_data", "legacy_fallback"].includes(scope.mode)) {
    allowed = true;
  } else if (scope.mode === "assigned") {
    allowed = scope.programmeIds.includes(programmeId);
  }

  const explanation: ProgrammeAccessExplanation = {
    allowed,
    programmeId,
    role: ctx.role,
    mode: scope.mode,
    assignmentCount: scope.assignmentCount,
    fallbackToLegacy: scope.fallbackToLegacy,
    reason: scope.mode === "assigned" && !allowed
      ? "Programme is outside the user's active assignment portfolio."
      : scope.reason,
  };
  logScopeDiagnostic("programme_access_decision", explanation);
  return explanation;
}

export async function canAccessProgramme(ctx: UserContext, programmeId: string): Promise<boolean> {
  return (await explainProgrammeAccess(ctx, programmeId)).allowed;
}
