import { ReactNode } from "react";
import { requireImpactRoute } from "./_route-guards";
import { ImpactIntelligenceShell } from "./impact-intelligence-shell";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";
import { isPlatformAdmin } from "@/lib/auth/authorization";

export default async function ImpactIntelligenceLayout({ children }: { children: ReactNode }) {
  const ctx = await requireImpactRoute("/dashboard/impact-intelligence");
  const isBoiWorkspaceUser = ctx.role === "boi_executive";
  const programme = await getLcdboProgramme().catch(() => null);
  const lcdboAccess = !isBoiWorkspaceUser && programme
    ? await canUseWorkspaceModule({ ctx, moduleKey: LCDBO_MODULE_KEY, allowedRoles: ["programme_officer", "admin", "super_admin", "institution_admin"], scopeType: "programme", scopeId: programme.id, programmeId: programme.id, institutionId: programme.owning_institution_id }).catch(() => ({ allowed: false }))
    : { allowed: false };
  const lcdboExecutiveAccess = !isBoiWorkspaceUser && programme
    ? await canUseWorkspaceModule({ ctx, moduleKey: LCDBO_MODULE_KEY, allowedRoles: ["programme_officer", "admin", "super_admin", "auditor", "data_analyst", "institution_admin", "executive", "observer"], scopeType: "programme", scopeId: programme.id, programmeId: programme.id, institutionId: programme.owning_institution_id }).catch(() => ({ allowed: false }))
    : { allowed: false };
  return (
    <ImpactIntelligenceShell role={ctx.role} fullName={ctx.fullName} email={ctx.email} canAccessLcdbo={isPlatformAdmin(ctx.role) || lcdboAccess.allowed} canAccessLcdboExecutive={isPlatformAdmin(ctx.role) || lcdboExecutiveAccess.allowed}>
      {children}
    </ImpactIntelligenceShell>
  );
}
