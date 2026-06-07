import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";

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
  return requireWorkspaceRole([...IMPACT_INTELLIGENCE_ROLES], pathname);
}

export async function requireImpactPortfolioRoute(pathname: string) {
  return requireWorkspaceRole([...IMPACT_PORTFOLIO_ROLES], pathname);
}
