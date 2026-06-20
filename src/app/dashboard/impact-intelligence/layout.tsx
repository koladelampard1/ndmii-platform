import { ReactNode } from "react";
import { requireImpactRoute } from "./_route-guards";
import { ImpactIntelligenceShell } from "./impact-intelligence-shell";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";
import { isPlatformAdmin } from "@/lib/auth/authorization";

export default async function ImpactIntelligenceLayout({ children }: { children: ReactNode }) {
  const ctx = await requireImpactRoute("/dashboard/impact-intelligence");
  const programme = await getLcdboProgramme().catch(() => null);
  const lcdboAccess = programme
    ? await canUseWorkspaceModule({ ctx, moduleKey: LCDBO_MODULE_KEY, allowedRoles: ["programme_officer", "admin", "super_admin", "institution_admin"], scopeType: "programme", scopeId: programme.id, programmeId: programme.id, institutionId: programme.owning_institution_id }).catch(() => ({ allowed: false }))
    : { allowed: false };
  return (
    <ImpactIntelligenceShell role={ctx.role} fullName={ctx.fullName} email={ctx.email} canAccessLcdbo={isPlatformAdmin(ctx.role) || lcdboAccess.allowed}>
      {children}
    </ImpactIntelligenceShell>
  );
}
