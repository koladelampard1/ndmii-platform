import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";

export const LCDBO_INTELLIGENCE_ROLES = ["programme_officer", "admin", "super_admin", "boi_executive", "auditor", "data_analyst", "institution_admin", "executive", "observer"] as const;

export async function requireLcdboIntelligenceAccess() {
  const ctx = await getCurrentUserContext();
  const programme = await getLcdboProgramme();
  if (!ctx.appUserId || !programme || ctx.role === "msme") redirect("/access-denied");
  const access = await canUseWorkspaceModule({
    ctx,
    moduleKey: LCDBO_MODULE_KEY,
    allowedRoles: LCDBO_INTELLIGENCE_ROLES,
    scopeType: "programme",
    scopeId: programme.id,
    programmeId: programme.id,
    institutionId: programme.owning_institution_id,
  }).catch(() => ({ allowed: isPlatformAdmin(ctx.role) }));
  if (!isPlatformAdmin(ctx.role) && !access.allowed) redirect("/access-denied");
  return { ctx, programme };
}
