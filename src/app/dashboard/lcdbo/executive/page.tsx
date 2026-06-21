import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getLcdboClusterInterestQueue, getLcdboEnrolmentQueue, getLcdboProgramme, getLcdboRecentActivity, listLcdboClusters } from "@/lib/data/lcdbo-enrolment";
import { getLcdboOperationsMetrics } from "@/lib/data/lcdbo-operations";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";
import { LcdboExecutiveDashboard } from "@/components/lcdbo/lcdbo-executive-dashboard";

const EXECUTIVE_ROLES = ["programme_officer", "admin", "super_admin", "boi_executive", "auditor", "data_analyst", "institution_admin", "executive", "observer"] as const;

export default async function LcdboExecutivePage() {
  const ctx = await getCurrentUserContext();
  const programme = await getLcdboProgramme();
  if (!ctx.appUserId || !programme) redirect("/access-denied");
  const access = await canUseWorkspaceModule({ ctx, moduleKey: LCDBO_MODULE_KEY, allowedRoles: EXECUTIVE_ROLES, scopeType: "programme", scopeId: programme.id, programmeId: programme.id, institutionId: programme.owning_institution_id }).catch(() => ({ allowed: isPlatformAdmin(ctx.role) }));
  if (!isPlatformAdmin(ctx.role) && !access.allowed) redirect("/access-denied");

  const supabase = await createServiceRoleSupabaseClient();
  const [enrolments, interests, clusters, operations, publicData] = await Promise.all([
    getLcdboEnrolmentQueue(supabase),
    getLcdboClusterInterestQueue(supabase),
    listLcdboClusters(supabase),
    getLcdboOperationsMetrics(supabase),
    loadLcdboPublicData(),
  ]);
  const activity = await getLcdboRecentActivity(programme.id, clusters.map((cluster) => cluster.id), supabase);
  const topSectors = countBy(enrolments.map((item) => item.msme?.sector).filter(Boolean) as string[]);
  const topStates = countBy(enrolments.map((item) => item.msme?.state).filter(Boolean) as string[]);
  const statesCovered = new Set(enrolments.map((item) => item.msme?.state).filter(Boolean)).size;
  const documentsPending = operations.documents.filter((item) => ["requested", "submitted", "rejected"].includes(item.status)).length;
  const pendingReviews = enrolments.filter((item) => item.status === "pending_review").length + interests.filter((item) => ["interested", "under_review", "waitlisted"].includes(item.status)).length;
  const partners = publicData.partners.filter((item) => ["roseate-forte-nigeria-limited", "rmrdc", "nassi", "nse", "boi", "afcfta"].includes(item.slug)).map((item) => item.name);

  return <LcdboExecutiveDashboard
    metrics={{ enrolments: enrolments.length, clusters: clusters.length, activeParticipants: operations.active, documentsPending, readinessCompleted: operations.assessments.size, statesCovered, strategicPartners: partners.length, pendingReviews }}
    pipeline={[
      { label: "Applications", value: enrolments.length },
      { label: "Review", value: enrolments.filter((item) => item.status === "pending_review").length },
      { label: "Cluster interest", value: interests.length },
      { label: "Assessment", value: operations.assessments.size },
      { label: "Documents", value: operations.documents.length },
      { label: "Placement", value: operations.placed },
      { label: "Active", value: operations.active },
    ]}
    topSectors={topSectors}
    topStates={topStates}
    recentActivity={activity}
    partners={partners}
  />;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}
