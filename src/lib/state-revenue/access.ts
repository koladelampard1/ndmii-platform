import { requireWorkspaceAccess } from "@/lib/workspaces/workspace-access-server";
import { EKIRS_JURISDICTION, type StateRevenueJurisdictionId } from "@/lib/state-revenue/jurisdictions";

export const STATE_REVENUE_SCOPED_ROLES = [
  "state_revenue_executive",
  "state_revenue_admin",
  "registration_reviewer",
  "field_supervisor",
  "field_officer",
  "taxpayer_support_officer",
  "data_analyst",
  "auditor",
  "observer",
] as const;

export const STATE_REVENUE_MANAGEMENT_ROLES = [
  "state_revenue_executive",
  "state_revenue_admin",
  "registration_reviewer",
  "field_supervisor",
  "taxpayer_support_officer",
] as const;

export const STATE_REVENUE_EXPORT_ROLES = [
  "state_revenue_executive",
  "state_revenue_admin",
  "data_analyst",
  "auditor",
] as const;

export const stateRevenueDisclosure = EKIRS_JURISDICTION.demonstration.disclosure;

export async function requireStateRevenueWorkspaceAccess(
  jurisdictionId: StateRevenueJurisdictionId = "ekiti",
  pathname = "/dashboard/ekirs",
) {
  if (jurisdictionId !== "ekiti") {
    throw new Error("Unsupported state revenue jurisdiction.");
  }
  return requireWorkspaceAccess("ekirs", pathname);
}
