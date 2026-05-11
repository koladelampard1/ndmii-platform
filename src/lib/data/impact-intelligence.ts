import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";

type ImpactQueryOptions = {
  limit?: number;
};

export const IMPACT_READ_ROLES: UserRole[] = ["admin", "boi_executive", "programme_officer", "assessment_officer", "auditor"];
export const IMPACT_WRITE_ROLES: UserRole[] = ["admin", "programme_officer"];

export const PROGRAMME_STATUSES = ["draft", "active", "paused", "completed", "archived"] as const;
export const INTERVENTION_STATUSES = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
export const INTERVENTION_STAGES = ["intake", "eligibility", "approval", "disbursement", "monitoring", "closure"] as const;

export type ProgrammeStatus = (typeof PROGRAMME_STATUSES)[number];
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];
export type InterventionStage = (typeof INTERVENTION_STAGES)[number];

export type ImpactProgramme = {
  id: string;
  name: string;
  programme_code: string | null;
  sponsor_name: string | null;
  description: string | null;
  status: ProgrammeStatus | string | null;
  start_date: string | null;
  end_date: string | null;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ImpactIntervention = {
  id: string;
  programme_id: string | null;
  msme_id: string | null;
  intervention_type: string;
  title: string;
  description: string | null;
  status: InterventionStatus | string | null;
  approved_amount: number | null;
  disbursed_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  assigned_to_user_id: string | null;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
};

export type ImpactInterventionEvent = {
  id: string;
  intervention_id: string;
  programme_id: string | null;
  msme_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  from_stage: string | null;
  to_stage: string | null;
  title: string;
  note: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  created_at: string;
};

export type ImpactAssessment = {
  id: string;
  programme_id: string | null;
  intervention_id: string | null;
  msme_id: string | null;
  assessment_type: string | null;
  status: string | null;
  conducted_by_user_id: string | null;
  conducted_at: string | null;
  created_at: string | null;
};

export type ImpactFieldVisit = {
  id: string;
  programme_id: string | null;
  intervention_id: string | null;
  msme_id: string | null;
  visit_date: string | null;
  status: string | null;
  assigned_to_user_id: string | null;
  created_at: string | null;
};

export type ImpactReport = {
  id: string;
  programme_id: string | null;
  title: string;
  report_type: string | null;
  status: string | null;
  generated_by_user_id: string | null;
  created_at: string | null;
};

export type MsmePickerOption = {
  id: string;
  business_name: string;
  msme_id: string | null;
  state: string | null;
  sector: string | null;
};

function logImpactDataError(source: string, error: { message?: string } | null) {
  if (process.env.NODE_ENV === "production" || !error) return;
  console.info(`[impact-intelligence] ${source}`, { error: error.message });
}

function requireImpactWrite(ctx: UserContext) {
  if (!IMPACT_WRITE_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to manage impact intelligence records.");
  }
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numericValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normaliseStage(value: string | null): InterventionStage {
  return INTERVENTION_STAGES.includes(value as InterventionStage) ? (value as InterventionStage) : "intake";
}

function normaliseStatus(value: string | null): InterventionStatus {
  return INTERVENTION_STATUSES.includes(value as InterventionStatus) ? (value as InterventionStatus) : "planned";
}

async function logActivity(params: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("activity_logs").insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  });
  logImpactDataError("activity_log_insert_failed", error);
}

export function parseProgrammeForm(formData: FormData) {
  const name = textValue(formData, "name");
  if (!name) throw new Error("Programme name is required.");

  const rawStatus = textValue(formData, "status") ?? "draft";
  const status = PROGRAMME_STATUSES.includes(rawStatus as ProgrammeStatus) ? rawStatus : "draft";

  return {
    name,
    programme_code: textValue(formData, "programme_code"),
    sponsor_name: textValue(formData, "sponsor_name"),
    description: textValue(formData, "description"),
    status,
    start_date: textValue(formData, "start_date"),
    end_date: textValue(formData, "end_date"),
  };
}

export function parseInterventionForm(formData: FormData) {
  const title = textValue(formData, "title");
  if (!title) throw new Error("Intervention title is required.");

  const msmeId = textValue(formData, "msme_id");
  if (!msmeId) throw new Error("Select an MSME beneficiary.");

  const stage = normaliseStage(textValue(formData, "stage"));

  return {
    programme_id: textValue(formData, "programme_id"),
    msme_id: msmeId,
    intervention_type: textValue(formData, "intervention_type") ?? "support",
    title,
    description: textValue(formData, "description"),
    status: normaliseStatus(textValue(formData, "status")),
    approved_amount: numericValue(formData, "approved_amount"),
    disbursed_amount: numericValue(formData, "disbursed_amount"),
    start_date: textValue(formData, "start_date"),
    end_date: textValue(formData, "end_date"),
    metadata: { stage },
  };
}

export async function listImpactProgrammes(options: ImpactQueryOptions = {}): Promise<ImpactProgramme[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_programmes")
    .select("id,name,programme_code,sponsor_name,description,status,start_date,end_date,created_by_user_id,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  logImpactDataError("list_programmes_failed", error);
  return (data ?? []) as ImpactProgramme[];
}

export async function getImpactProgrammeDetail(id: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: programme, error }, { data: interventions }, { data: enrolments }] = await Promise.all([
    supabase
      .from("impact_programmes")
      .select("id,name,programme_code,sponsor_name,description,status,start_date,end_date,created_by_user_id,created_at,updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("impact_interventions")
      .select("id,programme_id,msme_id,intervention_type,title,description,status,approved_amount,disbursed_amount,start_date,end_date,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata,msmes(id,business_name,msme_id,state,sector)")
      .eq("programme_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("impact_programme_msmes")
      .select("id,programme_id,msme_id,enrollment_status,enrolled_at,msmes(id,business_name,msme_id,state,sector)")
      .eq("programme_id", id)
      .order("enrolled_at", { ascending: false }),
  ]);

  logImpactDataError("get_programme_failed", error);
  return {
    programme: programme as ImpactProgramme | null,
    interventions: (interventions ?? []) as unknown as ImpactIntervention[],
    enrolments: enrolments ?? [],
  };
}

export async function createImpactProgramme(ctx: UserContext, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createServerSupabaseClient();
  const payload = { ...parseProgrammeForm(formData), created_by_user_id: ctx.appUserId };
  const { data, error } = await supabase.from("impact_programmes").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_programme_created", entityType: "impact_programme", entityId: data.id, metadata: { role: ctx.role } });
  return data.id as string;
}

export async function listImpactInterventions(options: ImpactQueryOptions = {}): Promise<ImpactIntervention[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_interventions")
    .select("id,programme_id,msme_id,intervention_type,title,description,status,approved_amount,disbursed_amount,start_date,end_date,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata,impact_programmes(id,name,programme_code),msmes(id,business_name,msme_id,state,sector)")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  logImpactDataError("list_interventions_failed", error);
  return (data ?? []) as unknown as ImpactIntervention[];
}

export async function getImpactInterventionDetail(id: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: intervention, error }, { data: events }] = await Promise.all([
    supabase
      .from("impact_interventions")
      .select("id,programme_id,msme_id,intervention_type,title,description,status,approved_amount,disbursed_amount,start_date,end_date,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata,impact_programmes(id,name,programme_code),msmes(id,business_name,msme_id,state,sector)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("impact_intervention_events")
      .select("id,intervention_id,programme_id,msme_id,event_type,from_status,to_status,from_stage,to_stage,title,note,actor_user_id,actor_role,created_at")
      .eq("intervention_id", id)
      .order("created_at", { ascending: false }),
  ]);

  logImpactDataError("get_intervention_failed", error);
  return {
    intervention: intervention as unknown as ImpactIntervention | null,
    events: (events ?? []) as ImpactInterventionEvent[],
  };
}

export async function createImpactIntervention(ctx: UserContext, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createServerSupabaseClient();
  const payload = { ...parseInterventionForm(formData), created_by_user_id: ctx.appUserId };
  const { data, error } = await supabase.from("impact_interventions").insert(payload).select("id,programme_id,msme_id,status,metadata").single();
  if (error) throw new Error(error.message);

  if (payload.programme_id) {
    await supabase.from("impact_programme_msmes").upsert({
      programme_id: payload.programme_id,
      msme_id: payload.msme_id,
      enrollment_status: "active",
      created_by_user_id: ctx.appUserId,
    }, { onConflict: "programme_id,msme_id" });
  }

  await appendImpactInterventionEvent(ctx, data.id, {
    programmeId: data.programme_id,
    msmeId: data.msme_id,
    eventType: "created",
    title: "Intervention created",
    note: `Initial status: ${data.status}`,
    toStatus: data.status,
    toStage: String((data.metadata as Record<string, unknown> | null)?.stage ?? "intake"),
  });
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_intervention_created", entityType: "impact_intervention", entityId: data.id, metadata: { role: ctx.role } });
  return data.id as string;
}

export async function updateImpactInterventionStatus(ctx: UserContext, interventionId: string, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createServerSupabaseClient();
  const { intervention } = await getImpactInterventionDetail(interventionId);
  if (!intervention) throw new Error("Intervention not found.");

  const nextStatus = normaliseStatus(textValue(formData, "status"));
  const nextStage = normaliseStage(textValue(formData, "stage"));
  const currentMetadata = (intervention.metadata ?? {}) as Record<string, unknown>;
  const currentStage = String(currentMetadata.stage ?? "intake");
  const note = textValue(formData, "note");

  const { error } = await supabase
    .from("impact_interventions")
    .update({ status: nextStatus, metadata: { ...currentMetadata, stage: nextStage } })
    .eq("id", interventionId);
  if (error) throw new Error(error.message);

  await appendImpactInterventionEvent(ctx, interventionId, {
    programmeId: intervention.programme_id,
    msmeId: intervention.msme_id,
    eventType: nextStatus !== intervention.status ? "status_changed" : "stage_changed",
    title: "Intervention progress updated",
    note,
    fromStatus: intervention.status,
    toStatus: nextStatus,
    fromStage: currentStage,
    toStage: nextStage,
  });
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_intervention_status_updated", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role, status: nextStatus, stage: nextStage } });
}

export async function appendImpactInterventionEvent(ctx: UserContext, interventionId: string, params: {
  programmeId?: string | null;
  msmeId?: string | null;
  eventType?: string;
  title: string;
  note?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromStage?: string | null;
  toStage?: string | null;
}) {
  requireImpactWrite(ctx);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("impact_intervention_events").insert({
    intervention_id: interventionId,
    programme_id: params.programmeId ?? null,
    msme_id: params.msmeId ?? null,
    event_type: params.eventType ?? "note",
    title: params.title,
    note: params.note ?? null,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    from_stage: params.fromStage ?? null,
    to_stage: params.toStage ?? null,
    actor_user_id: ctx.appUserId,
    actor_role: ctx.role,
  });
  if (error) throw new Error(error.message);
}

export async function appendImpactInterventionNote(ctx: UserContext, interventionId: string, formData: FormData) {
  requireImpactWrite(ctx);
  const { intervention } = await getImpactInterventionDetail(interventionId);
  if (!intervention) throw new Error("Intervention not found.");
  const note = textValue(formData, "note");
  if (!note) throw new Error("Timeline note is required.");
  await appendImpactInterventionEvent(ctx, interventionId, {
    programmeId: intervention.programme_id,
    msmeId: intervention.msme_id,
    eventType: "note",
    title: textValue(formData, "title") ?? "Operational note",
    note,
  });
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_intervention_event_added", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role } });
}

export async function listMsmePickerOptions(options: ImpactQueryOptions = {}): Promise<MsmePickerOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("msmes")
    .select("id,business_name,msme_id,state,sector")
    .order("business_name", { ascending: true })
    .limit(options.limit ?? 100);

  logImpactDataError("list_msme_picker_failed", error);
  return (data ?? []) as MsmePickerOption[];
}

export function getInterventionStage(intervention: Pick<ImpactIntervention, "metadata">) {
  const value = intervention.metadata?.stage;
  return typeof value === "string" && value ? value : "intake";
}

export async function listImpactAssessments(options: ImpactQueryOptions = {}): Promise<ImpactAssessment[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_assessments")
    .select("id,programme_id,intervention_id,msme_id,assessment_type,status,conducted_by_user_id,conducted_at,created_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 25);

  logImpactDataError("list_assessments_failed", error);
  return (data ?? []) as ImpactAssessment[];
}

export async function listImpactFieldVisits(options: ImpactQueryOptions = {}): Promise<ImpactFieldVisit[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_field_visits")
    .select("id,programme_id,intervention_id,msme_id,visit_date,status,assigned_to_user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 25);

  logImpactDataError("list_field_visits_failed", error);
  return (data ?? []) as ImpactFieldVisit[];
}

export async function listImpactReports(options: ImpactQueryOptions = {}): Promise<ImpactReport[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_reports")
    .select("id,programme_id,title,report_type,status,generated_by_user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 25);

  logImpactDataError("list_reports_failed", error);
  return (data ?? []) as ImpactReport[];
}
