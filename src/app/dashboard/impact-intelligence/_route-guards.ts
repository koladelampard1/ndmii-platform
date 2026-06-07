import { redirect } from "next/navigation";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";
import { canAccessRoute } from "@/lib/impact-intelligence/permissions";

const IMPACT_INTELLIGENCE_ROLES = [
  "admin",
  "super_admin",
  "boi_executive",
  "programme_officer",
  "assessment_officer",
  "field_officer",
  "data_analyst",
  "auditor",
] as const;

const IMPACT_PORTFOLIO_ROLES = [
  "admin",
  "super_admin",
  "boi_executive",
  "programme_officer",
  "assessment_officer",
  "data_analyst",
  "auditor",
] as const;

export async function requireImpactRoute(pathname: string) {
  const ctx = await requireWorkspaceRole([...IMPACT_INTELLIGENCE_ROLES], pathname);
  if (!canAccessRoute(ctx.role, pathname)) redirect("/access-denied");
  return ctx;
}

export async function requireImpactPortfolioRoute(pathname: string) {
  const ctx = await requireWorkspaceRole([...IMPACT_PORTFOLIO_ROLES], pathname);
  if (!canAccessRoute(ctx.role, pathname)) redirect("/access-denied");
  return ctx;
}
