import { isPlatformAdmin, type UserContext } from "@/lib/auth/authorization";
import {
  canAccessModule,
  resolveEffectiveRoles,
  type ModuleAccessCheck,
} from "@/lib/data/platform-foundation";
import type { PlatformModuleKey, ScopeType } from "@/types/platform";
import type { UserRole } from "@/types/roles";

export type ScopedPermissionInput = {
  ctx: UserContext;
  allowedRoles: readonly string[];
  scopeType?: ScopeType;
  scopeId?: string | null;
  institutionId?: string | null;
};

export type ScopedPermissionResult = {
  allowed: boolean;
  roles: string[];
  source: "platform_admin" | "global_role" | "scoped_role" | "denied";
};

export async function resolveScopedPermission(input: ScopedPermissionInput): Promise<ScopedPermissionResult> {
  if (isPlatformAdmin(input.ctx.role)) {
    return { allowed: true, roles: [input.ctx.role], source: "platform_admin" };
  }

  if (input.allowedRoles.includes(input.ctx.role)) {
    return { allowed: true, roles: [input.ctx.role], source: "global_role" };
  }

  const effective = await resolveEffectiveRoles({
    userId: input.ctx.appUserId,
    globalRole: input.ctx.role,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    institutionId: input.institutionId,
  });
  const scopedAllowed = effective.scopedRoles.some((assignment) => input.allowedRoles.includes(assignment.role));

  return {
    allowed: scopedAllowed,
    roles: effective.roles,
    source: scopedAllowed ? "scoped_role" : "denied",
  };
}

export async function hasAnyScopedRole(input: {
  userId: string | null;
  globalRole: UserRole;
  roles: readonly string[];
  scopeType?: ScopeType;
  scopeId?: string | null;
  institutionId?: string | null;
}) {
  if (isPlatformAdmin(input.globalRole)) return true;
  if (input.roles.includes(input.globalRole)) return true;
  const effective = await resolveEffectiveRoles({
    userId: input.userId,
    globalRole: input.globalRole,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    institutionId: input.institutionId,
  });
  return effective.roles.some((role) => input.roles.includes(role));
}

export async function canUseWorkspaceModule(input: {
  ctx: UserContext;
  moduleKey: PlatformModuleKey;
  allowedRoles: readonly string[];
  scopeType?: ScopeType;
  scopeId?: string | null;
  institutionId?: string | null;
  programmeId?: string | null;
}): Promise<ScopedPermissionResult & { module: ModuleAccessCheck }> {
  const permission = await resolveScopedPermission(input);
  if (!permission.allowed) {
    return {
      ...permission,
      module: { allowed: false, status: null, source: "missing" },
    };
  }

  const moduleAccess = await canAccessModule({
    moduleKey: input.moduleKey,
    institutionId: input.institutionId,
    programmeId: input.programmeId,
  });

  return {
    allowed: moduleAccess.allowed,
    roles: permission.roles,
    source: moduleAccess.allowed ? permission.source : "denied",
    module: moduleAccess,
  };
}
