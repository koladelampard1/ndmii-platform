"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import {
  assignClusterOfficer,
  createClusterReadinessAssessment,
  createDocumentRequest,
  DOCUMENT_TYPES,
  PARTICIPATION_STATUSES,
  reviewDocumentSubmission,
  submitDocumentRequest,
  updateClusterParticipationStatus,
  type LcdboDocumentType,
  type ParticipationStatus,
} from "@/lib/data/lcdbo-operations";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

async function requireOperationalAccess(clusterMemberId: string, assignmentOnly = false) {
  const ctx = await getCurrentUserContext();
  const programme = await getLcdboProgramme();
  if (!programme || !ctx.appUserId) redirect("/access-denied");
  const permission = await canUseWorkspaceModule({ ctx, moduleKey: LCDBO_MODULE_KEY, allowedRoles: ["programme_officer", "admin", "super_admin", "institution_admin"], scopeType: "programme", scopeId: programme.id, programmeId: programme.id, institutionId: programme.owning_institution_id }).catch(() => ({ allowed: false }));
  const canManage = isPlatformAdmin(ctx.role) || permission.allowed;
  const supabase = await createServiceRoleSupabaseClient();
  const { data: member } = await supabase.from("cluster_members").select("id,msme_id,cluster_id,assigned_officer_id,industrial_clusters!inner(programme_id)").eq("id", clusterMemberId).eq("industrial_clusters.programme_id", programme.id).maybeSingle();
  if (!member || (!canManage && (assignmentOnly || member.assigned_officer_id !== ctx.appUserId))) redirect("/access-denied");
  return { ctx, programme, supabase, member, canManage };
}

function done(message: string): never {
  revalidatePath("/dashboard/lcdbo");
  revalidatePath("/dashboard/msme/lcdbo");
  redirect(`/dashboard/lcdbo?success=${encodeURIComponent(message)}`);
}

export async function participationStatusAction(formData: FormData) {
  const memberId = String(formData.get("cluster_member_id") ?? "");
  const { ctx, supabase } = await requireOperationalAccess(memberId);
  const status = String(formData.get("status") ?? "") as ParticipationStatus;
  if (!(PARTICIPATION_STATUSES as readonly string[]).includes(status)) redirect("/dashboard/lcdbo?error=invalid_status");
  await updateClusterParticipationStatus({ clusterMemberId: memberId, status, actorUserId: ctx.appUserId!, note: String(formData.get("note") ?? ""), client: supabase });
  done("participation_status_updated");
}

export async function officerAssignmentAction(formData: FormData) {
  const memberId = String(formData.get("cluster_member_id") ?? "");
  const { ctx, supabase } = await requireOperationalAccess(memberId, true);
  await assignClusterOfficer({ clusterMemberId: memberId, officerUserId: String(formData.get("officer_user_id") ?? ""), actorUserId: ctx.appUserId!, notes: String(formData.get("assignment_notes") ?? ""), client: supabase });
  done("officer_assignment_updated");
}

export async function readinessAssessmentAction(formData: FormData) {
  const memberId = String(formData.get("cluster_member_id") ?? "");
  const { ctx, supabase, member } = await requireOperationalAccess(memberId);
  const score = (name: string) => Number(formData.get(name));
  await createClusterReadinessAssessment({
    clusterMemberId: memberId,
    msmeId: member.msme_id,
    assessorId: ctx.appUserId!,
    scores: {
      production_capacity: score("production_capacity"), equipment_readiness: score("equipment_readiness"),
      workforce_readiness: score("workforce_readiness"), finance_readiness: score("finance_readiness"),
      compliance_readiness: score("compliance_readiness"), market_readiness: score("market_readiness"),
      export_readiness: score("export_readiness"), digital_readiness: score("digital_readiness"),
    },
    assessmentNotes: String(formData.get("assessment_notes") ?? ""),
    recommendedSupport: String(formData.get("recommended_support") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    client: supabase,
  });
  done("readiness_assessment_created");
}

export async function documentRequestAction(formData: FormData) {
  const memberId = String(formData.get("cluster_member_id") ?? "");
  const { ctx, supabase } = await requireOperationalAccess(memberId);
  const documentType = String(formData.get("document_type") ?? "") as LcdboDocumentType;
  if (!(DOCUMENT_TYPES as readonly string[]).includes(documentType)) redirect("/dashboard/lcdbo?error=invalid_document_type");
  await createDocumentRequest({ clusterMemberId: memberId, requestedBy: ctx.appUserId!, documentType, title: String(formData.get("title") ?? ""), description: String(formData.get("description") ?? ""), dueDate: String(formData.get("due_date") ?? ""), client: supabase });
  done("document_request_created");
}

export async function documentReviewAction(formData: FormData) {
  const memberId = String(formData.get("cluster_member_id") ?? "");
  const { ctx, supabase } = await requireOperationalAccess(memberId);
  const status = String(formData.get("status") ?? "");
  if (!['accepted', 'rejected'].includes(status)) redirect("/dashboard/lcdbo?error=invalid_review_status");
  await reviewDocumentSubmission({ submissionId: String(formData.get("submission_id") ?? ""), status: status as "accepted" | "rejected", reviewedBy: ctx.appUserId!, reviewNotes: String(formData.get("review_notes") ?? ""), client: supabase });
  done(`document_${status}`);
}

export async function msmeDocumentSubmissionAction(formData: FormData) {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "msme" || !ctx.appUserId || !ctx.linkedMsmeId) redirect("/access-denied");
  const requestId = String(formData.get("request_id") ?? "");
  const supabase = await createServiceRoleSupabaseClient();
  const { data: request } = await supabase.from("lcdbo_document_requests").select("id,cluster_member_id,cluster_members!inner(msme_id)").eq("id", requestId).eq("cluster_members.msme_id", ctx.linkedMsmeId).maybeSingle();
  if (!request) redirect("/access-denied");
  await submitDocumentRequest({ requestId, msmeId: ctx.linkedMsmeId, submittedBy: ctx.appUserId, fileUrl: String(formData.get("file_url") ?? ""), notes: String(formData.get("notes") ?? ""), client: supabase });
  revalidatePath("/dashboard/msme/lcdbo");
  revalidatePath("/dashboard/lcdbo");
  redirect("/dashboard/msme/lcdbo?success=document_submitted");
}
