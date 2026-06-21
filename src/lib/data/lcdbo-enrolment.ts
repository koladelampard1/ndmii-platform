import type { SupabaseClient } from "@supabase/supabase-js";
import { recordPlatformEvent } from "@/lib/data/platform-foundation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { LCDBO_PROGRAMME_SLUG } from "@/lib/lcdbo/content";
import type {
  ClusterInterestStatus,
  ClusterMember,
  IndustrialCluster,
  PlatformEvent,
  Programme,
  ProgrammeEnrolment,
  ProgrammeEnrolmentStatus,
} from "@/types/platform";

type Client = SupabaseClient<any>;

export type LcdboMsmeSummary = {
  id: string;
  msme_id: string;
  business_name: string;
  owner_name: string;
  sector: string;
  state: string;
  lga: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  registration_context?: Record<string, unknown> | null;
};

export type LcdboEnrolmentQueueItem = ProgrammeEnrolment & { msme: LcdboMsmeSummary | null };
export type LcdboClusterInterestQueueItem = ClusterMember & {
  msme: LcdboMsmeSummary | null;
  cluster: IndustrialCluster | null;
};

const ENROLMENT_REVIEW_STATUSES = new Set<ProgrammeEnrolmentStatus>(["active", "rejected", "suspended"]);
const INTEREST_REVIEW_STATUSES = new Set<ClusterInterestStatus>(["accepted", "rejected", "waitlisted", "under_review"]);

function embeddedRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function clientOrService(client?: Client) {
  return client ?? await createServiceRoleSupabaseClient();
}

export async function getLcdboProgramme(client?: Client): Promise<Programme | null> {
  const supabase = await clientOrService(client);
  const { data, error } = await supabase
    .from("programmes")
    .select("*")
    .eq("slug", LCDBO_PROGRAMME_SLUG)
    .maybeSingle();
  if (error) throw error;
  return (data as Programme | null) ?? null;
}

export async function getMsmeLcdboEnrolment(msmeId: string, client?: Client): Promise<ProgrammeEnrolment | null> {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) return null;
  const { data, error } = await supabase
    .from("programme_enrolments")
    .select("*")
    .eq("programme_id", programme.id)
    .eq("msme_id", msmeId)
    .eq("enrolment_type", "msme")
    .maybeSingle();
  if (error) throw error;
  return (data as ProgrammeEnrolment | null) ?? null;
}

export async function createLcdboEnrolment(input: {
  msmeId: string;
  actorUserId: string;
  source?: string;
  applicationNote?: string | null;
  client?: Client;
}): Promise<ProgrammeEnrolment> {
  const supabase = await clientOrService(input.client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) throw new Error("LCDBO programme is not configured.");

  const existing = await getMsmeLcdboEnrolment(input.msmeId, supabase);
  const shouldRecordCreated = !existing || ["rejected", "withdrawn"].includes(existing.status);
  const metadata = { programme: "lcdbo", source: input.source?.trim() || "lcdbo_msme_workspace" };
  const payload = {
    programme_id: programme.id,
    msme_id: input.msmeId,
    enrolment_type: "msme",
    status: existing && ["active", "suspended"].includes(existing.status) ? existing.status : "pending_review",
    enrolled_by: input.actorUserId,
    exited_at: null,
    application_note: input.applicationNote?.trim() || null,
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    metadata: { ...(existing?.metadata ?? {}), ...metadata },
  };

  const query = existing
    ? supabase.from("programme_enrolments").update(payload).eq("id", existing.id)
    : supabase.from("programme_enrolments").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to create LCDBO enrolment.");

  if (shouldRecordCreated) {
    await recordPlatformEvent({
      actorUserId: input.actorUserId,
      eventType: "lcdbo.enrolment.created",
      entityType: "programme_enrolment",
      entityId: data.id,
      scopeType: "programme",
      scopeId: programme.id,
      metadata: { msme_id: input.msmeId, source: metadata.source },
      client: supabase,
    });
  }
  return data as ProgrammeEnrolment;
}

export async function updateLcdboEnrolmentStatus(input: {
  enrolmentId: string;
  status: ProgrammeEnrolmentStatus;
  actorUserId: string;
  reviewNote?: string | null;
  client?: Client;
}): Promise<ProgrammeEnrolment> {
  const supabase = await clientOrService(input.client);
  if (![...ENROLMENT_REVIEW_STATUSES, "withdrawn"].includes(input.status)) throw new Error("Unsupported enrolment status.");
  const { data: existing, error: lookupError } = await supabase
    .from("programme_enrolments")
    .select("*")
    .eq("id", input.enrolmentId)
    .maybeSingle();
  if (lookupError || !existing) throw lookupError ?? new Error("Enrolment not found.");

  const isWithdrawal = input.status === "withdrawn";
  const { data, error } = await supabase
    .from("programme_enrolments")
    .update({
      status: input.status,
      review_note: isWithdrawal ? existing.review_note : input.reviewNote?.trim() || null,
      reviewed_by: isWithdrawal ? existing.reviewed_by : input.actorUserId,
      reviewed_at: isWithdrawal ? existing.reviewed_at : new Date().toISOString(),
      exited_at: isWithdrawal ? new Date().toISOString() : null,
    })
    .eq("id", input.enrolmentId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Unable to update LCDBO enrolment.");

  const eventStatus = input.status === "active" ? "approved" : input.status;
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: `lcdbo.enrolment.${eventStatus}`,
    entityType: "programme_enrolment",
    entityId: data.id,
    scopeType: "programme",
    scopeId: data.programme_id,
    metadata: { msme_id: data.msme_id, review_note: input.reviewNote?.trim() || null },
    client: supabase,
  });
  return data as ProgrammeEnrolment;
}

export async function getLcdboEnrolmentQueue(client?: Client): Promise<LcdboEnrolmentQueueItem[]> {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) return [];
  const { data, error } = await supabase
    .from("programme_enrolments")
    .select("*,msmes(id,msme_id,business_name,owner_name,sector,state,lga,contact_email,contact_phone,registration_context)")
    .eq("programme_id", programme.id)
    .eq("enrolment_type", "msme")
    .order("enrolled_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, msme: embeddedRow(row.msmes) })) as LcdboEnrolmentQueueItem[];
}

export async function listLcdboClusters(client?: Client): Promise<IndustrialCluster[]> {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) return [];
  const { data, error } = await supabase
    .from("industrial_clusters")
    .select("*")
    .eq("programme_id", programme.id)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as IndustrialCluster[];
}

export async function getMsmeLcdboClusterInterests(msmeId: string, client?: Client): Promise<ClusterMember[]> {
  const supabase = await clientOrService(client);
  const clusters = await listLcdboClusters(supabase);
  if (!clusters.length) return [];
  const { data, error } = await supabase
    .from("cluster_members")
    .select("*")
    .eq("msme_id", msmeId)
    .in("cluster_id", clusters.map((cluster) => cluster.id))
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClusterMember[];
}

export async function createLcdboClusterInterest(input: {
  msmeId: string;
  clusterId: string;
  actorUserId: string;
  interestReason: string;
  capacitySummary?: string | null;
  productOrService: string;
  currentLocation: string;
  preferredSupport: string[];
  client?: Client;
}): Promise<ClusterMember> {
  const supabase = await clientOrService(input.client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) throw new Error("LCDBO programme is not configured.");
  const { data: cluster, error: clusterError } = await supabase
    .from("industrial_clusters")
    .select("id,programme_id")
    .eq("id", input.clusterId)
    .eq("programme_id", programme.id)
    .maybeSingle();
  if (clusterError || !cluster) throw clusterError ?? new Error("Select a valid LCDBO cluster.");

  const { data: existing } = await supabase
    .from("cluster_members")
    .select("id,status,metadata")
    .eq("cluster_id", input.clusterId)
    .eq("msme_id", input.msmeId)
    .eq("member_type", "msme")
    .maybeSingle();
  const payload = {
    cluster_id: input.clusterId,
    msme_id: input.msmeId,
    institution_id: null,
    member_type: "msme",
    role: "applicant",
    status: existing && existing.status === "accepted" ? "accepted" : "interested",
    exited_at: null,
    interest_reason: input.interestReason.trim(),
    capacity_summary: input.capacitySummary?.trim() || null,
    product_or_service: input.productOrService.trim(),
    current_location: input.currentLocation.trim(),
    preferred_support: input.preferredSupport,
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    metadata: { ...(existing?.metadata ?? {}), source: "lcdbo_msme_workspace" },
  };
  const query = existing
    ? supabase.from("cluster_members").update(payload).eq("id", existing.id)
    : supabase.from("cluster_members").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to submit cluster interest.");

  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: "lcdbo.cluster_interest.created",
    entityType: "cluster_member",
    entityId: data.id,
    scopeType: "cluster",
    scopeId: input.clusterId,
    metadata: { programme_id: programme.id, msme_id: input.msmeId },
    client: supabase,
  });
  return data as ClusterMember;
}

export async function updateLcdboClusterInterestStatus(input: {
  interestId: string;
  status: ClusterInterestStatus;
  actorUserId: string;
  reviewNote?: string | null;
  client?: Client;
}): Promise<ClusterMember> {
  const supabase = await clientOrService(input.client);
  if (![...INTEREST_REVIEW_STATUSES, "withdrawn"].includes(input.status)) throw new Error("Unsupported cluster interest status.");
  const { data: existing, error: lookupError } = await supabase.from("cluster_members").select("*").eq("id", input.interestId).maybeSingle();
  if (lookupError || !existing) throw lookupError ?? new Error("Cluster interest not found.");
  const isWithdrawal = input.status === "withdrawn";
  const { data, error } = await supabase
    .from("cluster_members")
    .update({
      status: input.status,
      review_note: isWithdrawal ? existing.review_note : input.reviewNote?.trim() || null,
      reviewed_by: isWithdrawal ? existing.reviewed_by : input.actorUserId,
      reviewed_at: isWithdrawal ? existing.reviewed_at : new Date().toISOString(),
      exited_at: isWithdrawal ? new Date().toISOString() : null,
    })
    .eq("id", input.interestId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Unable to update cluster interest.");

  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: `lcdbo.cluster_interest.${input.status}`,
    entityType: "cluster_member",
    entityId: data.id,
    scopeType: "cluster",
    scopeId: data.cluster_id,
    metadata: { msme_id: data.msme_id, review_note: input.reviewNote?.trim() || null },
    client: supabase,
  });
  return data as ClusterMember;
}

export async function getLcdboClusterInterestQueue(client?: Client): Promise<LcdboClusterInterestQueueItem[]> {
  const supabase = await clientOrService(client);
  const clusters = await listLcdboClusters(supabase);
  if (!clusters.length) return [];
  const { data, error } = await supabase
    .from("cluster_members")
    .select("*,msmes(id,msme_id,business_name,owner_name,sector,state,lga,contact_email,contact_phone,registration_context),industrial_clusters(*)")
    .in("cluster_id", clusters.map((cluster) => cluster.id))
    .eq("member_type", "msme")
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    msme: embeddedRow(row.msmes),
    cluster: embeddedRow(row.industrial_clusters),
  })) as LcdboClusterInterestQueueItem[];
}

export async function getLcdboRecentActivity(programmeId: string, clusterIds: string[], client?: Client): Promise<PlatformEvent[]> {
  const supabase = await clientOrService(client);
  const { data, error } = await supabase
    .from("platform_events")
    .select("*")
    .like("event_type", "lcdbo.%")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  const clusterSet = new Set(clusterIds);
  return ((data ?? []) as PlatformEvent[])
    .filter((event) => (
      (event.scope_type === "programme" && event.scope_id === programmeId)
      || (event.scope_type === "cluster" && Boolean(event.scope_id && clusterSet.has(event.scope_id)))
    ))
    .slice(0, 12);
}
