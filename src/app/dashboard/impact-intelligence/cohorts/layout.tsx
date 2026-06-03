import type { ReactNode } from "react";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";

const COHORT_ROUTE_ROLES = ["admin", "super_admin", "boi_executive", "programme_officer", "auditor", "field_officer"] as const;

export default async function CohortsLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceRole([...COHORT_ROUTE_ROLES], "/dashboard/impact-intelligence/cohorts");
  return children;
}
