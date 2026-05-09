import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getProviderWorkspaceContext, type ProviderWorkspaceContext } from "@/lib/data/provider-operations";
import {
  businessPlanToText,
  generateBusinessPlan,
  type BusinessPlanAnswers,
  type BusinessPlanPurpose,
  type GeneratedBusinessPlan,
} from "@/lib/msme/business-plan-generator";

export type { BusinessPlanAnswers, BusinessPlanPurpose, GeneratedBusinessPlan };

const allowedPurposes: BusinessPlanPurpose[] = ["loan_application", "grant_application", "investor_pitch", "internal_planning"];
const maxAnswerLength = 1600;
const maxAnswers = 80;

export type BusinessPlanSession = {
  id: string;
  msme_id: string;
  created_by: string | null;
  purpose: BusinessPlanPurpose;
  status: "draft" | "generated";
  business_name: string | null;
  answers_json: BusinessPlanAnswers;
  generated_plan_json: GeneratedBusinessPlan | null;
  generated_plan_text: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessPlanVersion = {
  id: string;
  business_plan_session_id: string;
  version_number: number;
  generated_plan_json: GeneratedBusinessPlan | null;
  generated_plan_text: string | null;
  created_at: string;
};

function assertPurpose(value: unknown): BusinessPlanPurpose {
  return allowedPurposes.includes(value as BusinessPlanPurpose) ? (value as BusinessPlanPurpose) : "loan_application";
}

function cleanText(value: unknown, limit = maxAnswerLength) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function sanitizeBusinessPlanAnswers(value: unknown): BusinessPlanAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const entries = Object.entries(value as Record<string, unknown>).slice(0, maxAnswers);
  return entries.reduce<BusinessPlanAnswers>((acc, [key, rawValue]) => {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    if (!safeKey) return acc;
    acc[safeKey] = cleanText(rawValue);
    return acc;
  }, {});
}

function normalizeSession(row: Record<string, unknown>): BusinessPlanSession {
  return {
    id: String(row.id),
    msme_id: String(row.msme_id),
    created_by: row.created_by ? String(row.created_by) : null,
    purpose: assertPurpose(row.purpose),
    status: row.status === "generated" ? "generated" : "draft",
    business_name: row.business_name ? String(row.business_name) : null,
    answers_json: sanitizeBusinessPlanAnswers(row.answers_json),
    generated_plan_json: row.generated_plan_json as GeneratedBusinessPlan | null,
    generated_plan_text: row.generated_plan_text ? String(row.generated_plan_text) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function canAccessSession(workspace: ProviderWorkspaceContext, session: { msme_id: string }) {
  return workspace.role === "admin" || session.msme_id === workspace.msme.id;
}

export async function listBusinessPlanSessions(workspace: ProviderWorkspaceContext) {
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("business_plan_sessions")
    .select("id,msme_id,created_by,purpose,status,business_name,answers_json,generated_plan_json,generated_plan_text,created_at,updated_at")
    .eq("msme_id", workspace.msme.id)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeSession(row));
}

export async function createBusinessPlanSession(workspace: ProviderWorkspaceContext, purpose: BusinessPlanPurpose = "loan_application") {
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("business_plan_sessions")
    .insert({
      msme_id: workspace.msme.id,
      created_by: workspace.appUserId,
      purpose,
      status: "draft",
      business_name: workspace.msme.business_name || workspace.provider.display_name,
      answers_json: {},
    })
    .select("id,msme_id,created_by,purpose,status,business_name,answers_json,generated_plan_json,generated_plan_text,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return normalizeSession(data);
}

export async function ensureBusinessPlanDraft(workspace: ProviderWorkspaceContext) {
  const sessions = await listBusinessPlanSessions(workspace);
  const draft = sessions.find((session) => session.status === "draft");
  if (draft) return { session: draft, sessions };

  const session = await createBusinessPlanSession(workspace);
  return { session, sessions: [session, ...sessions] };
}

export async function getBusinessPlanSession(sessionId: string, workspace: ProviderWorkspaceContext) {
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("business_plan_sessions")
    .select("id,msme_id,created_by,purpose,status,business_name,answers_json,generated_plan_json,generated_plan_text,created_at,updated_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const session = normalizeSession(data);
  if (!canAccessSession(workspace, session)) return null;
  return session;
}

export async function getBusinessPlanVersions(sessionId: string, workspace: ProviderWorkspaceContext) {
  const session = await getBusinessPlanSession(sessionId, workspace);
  if (!session) return [];

  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("business_plan_versions")
    .select("id,business_plan_session_id,version_number,generated_plan_json,generated_plan_text,created_at")
    .eq("business_plan_session_id", session.id)
    .order("version_number", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BusinessPlanVersion[];
}

export async function updateBusinessPlanSession({
  sessionId,
  workspace,
  answers,
  purpose,
}: {
  sessionId: string;
  workspace: ProviderWorkspaceContext;
  answers?: unknown;
  purpose?: unknown;
}) {
  const session = await getBusinessPlanSession(sessionId, workspace);
  if (!session) return null;

  const supabase = await createServiceRoleSupabaseClient();
  const payload: Record<string, unknown> = {};
  if (answers !== undefined) payload.answers_json = sanitizeBusinessPlanAnswers(answers);
  if (purpose !== undefined) payload.purpose = assertPurpose(purpose);
  payload.business_name = workspace.msme.business_name || workspace.provider.display_name || session.business_name;

  const { data, error } = await supabase
    .from("business_plan_sessions")
    .update(payload)
    .eq("id", sessionId)
    .select("id,msme_id,created_by,purpose,status,business_name,answers_json,generated_plan_json,generated_plan_text,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return normalizeSession(data);
}

export async function generateAndPersistBusinessPlan(sessionId: string, workspace: ProviderWorkspaceContext) {
  const session = await getBusinessPlanSession(sessionId, workspace);
  if (!session) return null;

  const plan = generateBusinessPlan({
    answers: session.answers_json,
    businessName: workspace.msme.business_name || workspace.provider.display_name || session.business_name || "MSME Business",
    msmeId: workspace.msme.msme_id,
    purpose: session.purpose,
  });
  const planText = businessPlanToText(plan);
  const supabase = await createServiceRoleSupabaseClient();

  const { count, error: countError } = await supabase
    .from("business_plan_versions")
    .select("id", { count: "exact", head: true })
    .eq("business_plan_session_id", sessionId);
  if (countError) throw new Error(countError.message);

  const versionNumber = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("business_plan_sessions")
    .update({
      status: "generated",
      business_name: plan.businessName,
      generated_plan_json: plan,
      generated_plan_text: planText,
    })
    .eq("id", sessionId)
    .select("id,msme_id,created_by,purpose,status,business_name,answers_json,generated_plan_json,generated_plan_text,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);

  const { error: versionError } = await supabase.from("business_plan_versions").insert({
    business_plan_session_id: sessionId,
    version_number: versionNumber,
    generated_plan_json: plan,
    generated_plan_text: planText,
  });
  if (versionError) throw new Error(versionError.message);

  return normalizeSession(data);
}

export async function getBusinessPlanWorkspace() {
  return getProviderWorkspaceContext();
}
