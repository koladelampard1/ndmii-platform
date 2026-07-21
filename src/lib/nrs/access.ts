import { redirect } from "next/navigation";
import type { UserContext } from "@/lib/auth/authorization";

export const NRS_ACCESS_ROLES = ["nrs_officer", "firs_officer", "admin", "super_admin"] as const;

export function canAccessNrsWorkspace(ctx: Pick<UserContext, "role">) {
  return NRS_ACCESS_ROLES.includes(ctx.role as (typeof NRS_ACCESS_ROLES)[number]);
}

export function requireNrsWorkspace(ctx: Pick<UserContext, "role">) {
  if (!canAccessNrsWorkspace(ctx)) redirect("/access-denied");
}

export function nrsWorkspaceDisclosure() {
  return "DBIN readiness view. Official filing, assessment and remittance remain in NRS or approved partner systems.";
}

export function formatNrsStatus(value: string | null | undefined) {
  return String(value ?? "unavailable").replace(/[_-]/g, " ");
}
