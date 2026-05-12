import { ReactNode } from "react";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";

const IMPACT_INTELLIGENCE_ROLES = [
  "admin",
  "boi_executive",
  "programme_officer",
  "assessment_officer",
  "field_officer",
  "auditor",
] as const;

export default async function ImpactIntelligenceLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceRole([...IMPACT_INTELLIGENCE_ROLES], "/dashboard/impact-intelligence");
  return children;
}
