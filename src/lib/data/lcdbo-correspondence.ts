import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isPlatformAdmin, type UserContext } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { getCurrentUserContext } from "@/lib/auth/session";
import { recordPlatformEvent } from "@/lib/data/platform-foundation";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { assertCorrespondenceTransition, canTransitionCorrespondence } from "@/lib/lcdbo-correspondence/state-machine";
import {
  CORRESPONDENCE_ROLE_GROUPS,
  LCDBO_CORRESPONDENCE_CANONICAL_ORIGIN,
  LCDBO_CORRESPONDENCE_MODULE_KEY,
  type CorrespondenceAccessMode,
  type CorrespondenceDirection,
  type CorrespondenceIssuer,
  type CorrespondenceRepresentativeRole,
  type CorrespondenceSensitivity,
  type CorrespondenceStatus,
  type LcdboCorrespondenceRecord,
  type LcdboCorrespondenceSummary,
  type LcdboCorrespondenceTemplate,
  type LcdboCorrespondenceContact,
  type LcdboCorrespondenceDelegation,
  type LcdboCorrespondenceNotificationJob,
  type LcdboCorrespondenceRepresentativeAuthority,
  type PublicCorrespondenceVerification,
} from "@/lib/lcdbo-correspondence/types";
import {
  approvalRoleForRepresentative,
  counterpartyRoleForRepresentative,
  counterpartyStatusForRepresentative,
  issuerForRepresentativeInstitution,
  representativeInstitutionFromRole,
  signatureRoleForRepresentative,
  simplifiedStatusForRecord,
} from "@/lib/lcdbo-correspondence/representative-workflow";
import { assertDelegationIsSafe } from "@/lib/lcdbo-correspondence/delegations";
import { createCorrespondenceEmailAdapter } from "@/lib/lcdbo-correspondence/email";
import { assertDeliveryEvidenceOperation } from "@/lib/lcdbo-correspondence/evidence";
import { planCorrespondenceReminderJobs } from "@/lib/lcdbo-correspondence/reminders";
import {
  createVerificationToken,
  normalizeVerificationInput,
  safeCsvValue,
  sanitizePublicCorrespondenceText,
  sha256Hex,
} from "@/lib/lcdbo-correspondence/security";
import { parsePlaceholderSchema, validateTemplatePlaceholders } from "@/lib/lcdbo-correspondence/templates";
import {
  correspondencePdfHash,
  createCorrespondencePdf,
  createCorrespondencePdfWithSignatureAssets,
  type CorrespondenceSignatureBlock,
} from "@/lib/lcdbo-correspondence/pdf";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { Programme } from "@/types/platform";

type Client = SupabaseClient<any>;

export type LcdboCorrespondenceAccess = {
  ctx: UserContext;
  programme: Programme;
  supabase: Client;
  roles: string[];
  canAdminister: boolean;
  canExport: boolean;
};

export type CorrespondenceRegisterFilters = {
  q?: string | null;
  status?: string | null;
  direction?: string | null;
  issuer?: string | null;
  page?: number;
  pageSize?: number;
};

const USER_SELECT = "id,full_name,email,role";
const RECORD_SELECT = `
  *,
  owner:users!lcdbo_correspondence_records_owner_id_fkey(${USER_SELECT}),
  requester:users!lcdbo_correspondence_records_requester_id_fkey(${USER_SELECT}),
  drafter:users!lcdbo_correspondence_records_drafter_id_fkey(${USER_SELECT}),
  assignee:users!lcdbo_correspondence_records_current_assignee_id_fkey(${USER_SELECT})
`;
const DELEGATION_SELECT = `
  *,
  delegator:users!lcdbo_correspondence_delegations_delegator_id_fkey(${USER_SELECT}),
  delegate:users!lcdbo_correspondence_delegations_delegate_id_fkey(${USER_SELECT})
`;
// The representative workflow uses institution_id directly. Avoid embedding the
// institution relation here because a stale or differently named PostgREST
// relationship must not prevent a representative's authority from resolving.
const REPRESENTATIVE_AUTHORITY_SELECT = "*";

async function clientOrService(client?: Client) {
  return client ?? await createServiceRoleSupabaseClient();
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function requiredText(value: FormDataEntryValue | null, label: string) {
  const text = optionalText(value);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function allowedRolesFor(mode: CorrespondenceAccessMode) {
  return CORRESPONDENCE_ROLE_GROUPS[mode] as readonly string[];
}

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now().toString(36)}`;
}

async function getCorrespondenceRequestMeta() {
  const headerStore = await headers();
  const requestId = headerStore.get("x-dbin-request-id") ?? createRequestId();
  const pathname = headerStore.get("x-dbin-pathname") ?? headerStore.get("next-url") ?? "/dashboard/correspondence";
  const safePath = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/dashboard/correspondence";
  return { requestId, safePath };
}

async function redirectToCorrespondenceLogin(): Promise<never> {
  const { requestId, safePath } = await getCorrespondenceRequestMeta();
  redirect(`/login?next=${encodeURIComponent(safePath)}&reason=session_required&requestId=${encodeURIComponent(requestId)}`);
}

async function redirectToCorrespondenceAccessDenied(reason: string): Promise<never> {
  const { requestId, safePath } = await getCorrespondenceRequestMeta();
  redirect(`/access-denied?workspace=correspondence&returnTo=${encodeURIComponent(safePath)}&reason=${encodeURIComponent(reason)}&requestId=${encodeURIComponent(requestId)}`);
}

async function redirectToCorrespondenceServerError(reason: string): Promise<never> {
  const { requestId } = await getCorrespondenceRequestMeta();
  redirect(`/server-error?source=correspondence&reason=${encodeURIComponent(reason)}&requestId=${encodeURIComponent(requestId)}`);
}

function metadataWithGovernance(metadata: Record<string, unknown> = {}) {
  return {
    ...metadata,
    governance_note: "Official issuance requires LCDBO reference, required approvals, protected signature events, immutable final issued PDF and a recorded dispatch event.",
  };
}

const CORRESPONDENCE_DOCUMENT_BUCKET = "lcdbo-correspondence-documents";

function finalSignatureBlocks(record: LcdboCorrespondenceRecord): CorrespondenceSignatureBlock[] {
  const versionId = record.current_version_id ?? record.issued_version_id;
  return (record.signatures ?? [])
    .filter((signature) => !versionId || signature.document_version_id === versionId)
    .sort((a, b) => a.signature_role.localeCompare(b.signature_role))
    .map((signature) => ({
      role: signature.signature_role,
      name: "Authorised institutional representative",
      organisation: signature.signature_role.includes("rmrdc") ? "RMRDC" : signature.signature_role.includes("roseate") ? "Roseate Forte Nigeria Limited" : "LCDBO Joint Secretariat",
      signedAt: signature.signed_at,
      testOnly: signature.signature_mode === "test_adapter",
      assetRef: signature.signature_asset_ref,
    }));
}

async function loadProtectedSignatureAssets(blocks: CorrespondenceSignatureBlock[]) {
  const storage = await createServiceRoleSupabaseClient();
  return Promise.all(blocks.filter((block) => !block.testOnly && block.assetRef).map(async (block) => {
    const path = block.assetRef!;
    if (!path.startsWith("signature-assets/") || path.includes("..")) throw new Error("Protected signature asset path is invalid.");
    const download = await storage.storage.from(CORRESPONDENCE_DOCUMENT_BUCKET).download(path);
    if (download.error || !download.data) throw download.error ?? new Error("Protected signature asset could not be loaded.");
    const contentType = download.data.type === "image/jpeg" ? "image/jpeg" : download.data.type === "image/png" ? "image/png" : null;
    if (!contentType) throw new Error("Protected signature asset must be a PNG or JPEG image.");
    return { role: block.role, bytes: new Uint8Array(await download.data.arrayBuffer()), contentType: contentType as "image/png" | "image/jpeg" };
  }));
}

async function storeImmutableFinalPdf(record: LcdboCorrespondenceRecord, bytes: Uint8Array, hash: string) {
  if (!record.current_version_id) throw new Error("A current version is required for final document storage.");
  const storage = await createServiceRoleSupabaseClient();
  const path = `final/${record.id}/${record.current_version_id}-${hash}.pdf`;
  const upload = await storage.storage.from(CORRESPONDENCE_DOCUMENT_BUCKET).upload(path, Buffer.from(bytes), {
    contentType: "application/pdf",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error;
  if (upload.error) {
    const existing = await storage.storage.from(CORRESPONDENCE_DOCUMENT_BUCKET).download(path);
    if (existing.error || !existing.data) throw existing.error ?? new Error("Stored final PDF could not be verified.");
    const existingHash = correspondencePdfHash(new Uint8Array(await existing.data.arrayBuffer()));
    if (existingHash !== hash) throw new Error("Immutable final PDF path already contains different content.");
  }
  return path;
}

export function isMissingLcdboCorrespondenceSchema(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  const code = candidate?.code ?? "";
  const message = candidate?.message ?? "";
  return ["42P01", "PGRST200", "PGRST205"].includes(code)
    || /lcdbo_correspondence_.*does not exist|could not find .*lcdbo_correspondence_/i.test(message);
}

export async function requireLcdboCorrespondenceAccess(mode: CorrespondenceAccessMode = "view", client?: Client): Promise<LcdboCorrespondenceAccess> {
  const ctx = await getCurrentUserContext();
  if (!ctx.appUserId || ctx.role === "public") await redirectToCorrespondenceLogin();

  const supabase = await clientOrService(client);
  let programme: Programme | null = null;
  try {
    programme = await getLcdboProgramme(supabase);
  } catch (error) {
    const { requestId } = await getCorrespondenceRequestMeta();
    console.error("[lcdbo-correspondence-access:error]", {
      requestId,
      operation: "get_lcdbo_programme",
      error: error instanceof Error ? error.message : String(error),
    });
    return redirectToCorrespondenceServerError("programme_lookup_failed");
  }
  if (!programme) return redirectToCorrespondenceServerError("programme_unavailable");

  const permission = await canUseWorkspaceModule({
    ctx,
    moduleKey: LCDBO_CORRESPONDENCE_MODULE_KEY,
    allowedRoles: allowedRolesFor(mode),
    scopeType: "programme",
    scopeId: programme.id,
    programmeId: programme.id,
    institutionId: programme.owning_institution_id,
  }).catch(() => ({ allowed: false, roles: [] as string[], source: "denied" as const, module: { allowed: false, status: null, source: "missing" as const } }));

  const canAdminister = isPlatformAdmin(ctx.role) || permission.roles.some((role) => (CORRESPONDENCE_ROLE_GROUPS.administer as readonly string[]).includes(role));
  const canExport = canAdminister || permission.roles.some((role) => (CORRESPONDENCE_ROLE_GROUPS.export as readonly string[]).includes(role));
  const allowed = isPlatformAdmin(ctx.role) || permission.allowed;
  if (!allowed) return redirectToCorrespondenceAccessDenied("MODULE_DENIED");
  return { ctx, programme, supabase, roles: permission.roles, canAdminister, canExport };
}

export async function getCorrespondenceRepresentativeAuthority(input: {
  actorUserId: string;
  programmeId: string;
  client: Client;
}) {
  const now = new Date().toISOString();
  const { data, error } = await input.client
    .from("lcdbo_correspondence_representative_authorities")
    .select(REPRESENTATIVE_AUTHORITY_SELECT)
    .eq("programme_id", input.programmeId)
    .eq("user_id", input.actorUserId)
    .eq("authority_status", "active")
    .lte("authority_starts_at", now)
    .order("is_primary", { ascending: false })
    .order("assigned_at", { ascending: false })
    .limit(5);
  if (error) {
    if (isMissingLcdboCorrespondenceSchema(error)) {
      const { requestId } = await getCorrespondenceRequestMeta();
      console.error("[lcdbo-correspondence-authority:error]", {
        requestId,
        actorUserId: input.actorUserId,
        programmeId: input.programmeId,
        source: "direct_select",
        code: error.code ?? null,
        reason: "representative_schema_unavailable",
      });
    } else {
      throw error;
    }
  }
  const directAuthority = ((data as LcdboCorrespondenceRepresentativeAuthority[] | null) ?? []).find((authority) => !authority.authority_ends_at || authority.authority_ends_at > now) ?? null;
  if (directAuthority) return directAuthority;

  // The security-definer helper resolves only the currently authenticated user's
  // authority. It provides a safe recovery path if a stale table policy prevents
  // the user's own row from being returned by the direct select.
  const rpcResult = await input.client.rpc("lcdbo_correspondence_current_representative_authority", {
    target_programme_id: input.programmeId,
    target_institution_id: null,
  });
  const rpcAuthority = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
  if (rpcResult.error || !rpcAuthority?.authority_id) {
    const { requestId } = await getCorrespondenceRequestMeta();
    console.warn("[lcdbo-correspondence-authority:unavailable]", {
      requestId,
      actorUserId: input.actorUserId,
      programmeId: input.programmeId,
      directRows: data?.length ?? 0,
      rpcCode: rpcResult.error?.code ?? null,
      reason: rpcResult.error ? "authority_rpc_failed" : "no_active_authority",
    });
    return null;
  }

  const service = await createServiceRoleSupabaseClient();
  const fallback = await service
    .from("lcdbo_correspondence_representative_authorities")
    .select(REPRESENTATIVE_AUTHORITY_SELECT)
    .eq("id", rpcAuthority.authority_id)
    .eq("user_id", input.actorUserId)
    .eq("programme_id", input.programmeId)
    .eq("authority_status", "active")
    .maybeSingle();
  if (fallback.error) throw fallback.error;
  const resolved = fallback.data as LcdboCorrespondenceRepresentativeAuthority | null;
  if (!resolved || (resolved.authority_ends_at && resolved.authority_ends_at <= now)) return null;
  const { requestId } = await getCorrespondenceRequestMeta();
  console.warn("[lcdbo-correspondence-authority:recovered]", {
    requestId,
    actorUserId: input.actorUserId,
    programmeId: input.programmeId,
    authorityId: resolved.id,
    reason: "direct_select_empty_rpc_confirmed",
  });
  return resolved;
}

async function getPrimaryCounterpartyRepresentative(input: {
  programmeId: string;
  representativeRole: CorrespondenceRepresentativeRole;
  client: Client;
}) {
  const now = new Date().toISOString();
  const { data, error } = await input.client
    .from("lcdbo_correspondence_representative_authorities")
    .select("user_id,institution_id,authority_ends_at")
    .eq("programme_id", input.programmeId)
    .eq("representative_role", input.representativeRole)
    .eq("authority_status", "active")
    .eq("is_primary", true)
    .lte("authority_starts_at", now)
    .order("assigned_at", { ascending: false })
    .limit(5);
  if (error && !isMissingLcdboCorrespondenceSchema(error)) throw error;
  const authority = ((data as Array<{ user_id: string; institution_id: string; authority_ends_at: string | null }> | null) ?? []).find((item) => !item.authority_ends_at || item.authority_ends_at > now);
  return authority ? { user_id: authority.user_id, institution_id: authority.institution_id } : null;
}

async function enqueueRepresentativeNotification(input: {
  programmeId: string;
  recordId: string;
  recipientUserId: string | null;
  jobType: "representative_counterparty_action" | "representative_returned_for_correction" | "representative_rejected" | "representative_ready_to_send";
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  client: Client;
}) {
  const { data, error } = await input.client.from("lcdbo_correspondence_notification_jobs").upsert({
    programme_id: input.programmeId,
    record_id: input.recordId,
    job_type: input.jobType,
    idempotency_key: input.idempotencyKey,
    recipient_user_id: input.recipientUserId,
    status: "pending",
    metadata: {
      ...input.metadata,
      email_status: "pending_configuration",
      protected_signature_assets_attached: false,
    },
  }, { onConflict: "idempotency_key" }).select("id").single();
  if (error) throw error;
  if (data?.id) await deliverCorrespondenceNotificationJob(data.id).catch((notificationError) => {
    console.error("[lcdbo-correspondence-notification:error]", { jobId: data.id, error: notificationError instanceof Error ? notificationError.message : String(notificationError) });
  });
}

function notificationCopy(jobType: string, metadata: Record<string, unknown>) {
  const reference = String(metadata.reference ?? "LCDBO correspondence");
  const subject = String(metadata.subject ?? "Official correspondence");
  const messages: Record<string, string> = {
    representative_counterparty_action: "A letter requires your review and institutional approval.",
    representative_returned_for_correction: "A letter has been returned to you for correction.",
    representative_rejected: "A letter has been rejected. Open the record to review the reason.",
    representative_ready_to_send: "Both institutions have approved the letter and it is ready to send.",
    review_due_soon: "A correspondence review is due soon.",
    review_overdue: "A correspondence review is overdue.",
    response_due_three_days: "A correspondence response is due in three days.",
    response_due_one_day: "A correspondence response is due tomorrow.",
    response_overdue: "A correspondence response is overdue.",
  };
  const path = String(metadata.secure_path ?? "/dashboard/correspondence");
  return {
    subject: `[LCDBO] ${reference} — action update`,
    body: `${messages[jobType] ?? "There is an update on an LCDBO correspondence record."}\n\n${subject}\n\nOpen the secure workspace: https://www.dbin.ng${path.startsWith("/") ? path : "/dashboard/correspondence"}`,
  };
}

export async function deliverCorrespondenceNotificationJob(jobId: string) {
  const service = await createServiceRoleSupabaseClient();
  const { data: job, error: jobError } = await service.from("lcdbo_correspondence_notification_jobs").select("*").eq("id", jobId).single();
  if (jobError || !job) throw jobError ?? new Error("Notification job not found.");
  if (job.status === "sent" || job.status === "skipped") return job;
  const attempts = Number(job.attempts ?? 0) + 1;
  if (!job.recipient_user_id) {
    await service.from("lcdbo_correspondence_notification_jobs").update({ status: "skipped", attempts, processed_at: new Date().toISOString(), last_error: "No recipient was assigned." }).eq("id", job.id);
    return job;
  }
  const { data: recipient, error: recipientError } = await service.from("users").select("email").eq("id", job.recipient_user_id).single();
  if (recipientError || !recipient?.email) {
    await service.from("lcdbo_correspondence_notification_jobs").update({ status: "failed", attempts, last_error: "Recipient email is unavailable." }).eq("id", job.id);
    throw recipientError ?? new Error("Recipient email is unavailable.");
  }
  const metadata = (job.metadata ?? {}) as Record<string, unknown>;
  const copy = notificationCopy(job.job_type, metadata);
  try {
    await createCorrespondenceEmailAdapter().send({
      recordId: String(job.record_id ?? job.id),
      reference: String(metadata.reference ?? job.id),
      to: [recipient.email],
      subject: copy.subject,
      body: copy.body,
      senderIdentity: "LCDBO Correspondence",
      idempotencyKey: job.idempotency_key,
    });
    await service.from("lcdbo_correspondence_notification_jobs").update({ status: "sent", attempts, processed_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
  } catch (error) {
    await service.from("lcdbo_correspondence_notification_jobs").update({ status: "failed", attempts, last_error: error instanceof Error ? error.message.slice(0, 500) : "Notification delivery failed." }).eq("id", job.id);
    throw error;
  }
  return job;
}

export async function processCorrespondenceNotificationJobs(limit = 25) {
  const service = await createServiceRoleSupabaseClient();
  const { data, error } = await service.from("lcdbo_correspondence_notification_jobs").select("id").in("status", ["pending", "failed"]).lte("scheduled_for", new Date().toISOString()).lt("attempts", 5).order("scheduled_for", { ascending: true }).limit(Math.min(100, Math.max(1, limit)));
  if (error) throw error;
  const results = [];
  for (const job of data ?? []) {
    try { await deliverCorrespondenceNotificationJob(job.id); results.push({ id: job.id, status: "sent" }); }
    catch (deliveryError) { results.push({ id: job.id, status: "failed", error: deliveryError instanceof Error ? deliveryError.message : String(deliveryError) }); }
  }
  return results;
}

async function recordCorrespondenceEvent(input: {
  actorUserId: string;
  programmeId: string;
  recordId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: Record<string, unknown>;
  client: Client;
}) {
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: `lcdbo.correspondence.${input.eventType}`,
    entityType: "lcdbo_correspondence_record",
    entityId: input.recordId,
    scopeType: "programme",
    scopeId: input.programmeId,
    metadata: {
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? null,
      ...(input.metadata ?? {}),
    },
    client: input.client,
  });
}

export async function getCorrespondenceWorkspaceSnapshot(client?: Client) {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) return { summary: emptySummary(), records: [], myQueue: [], templates: [], contacts: [], delegations: [], jobs: [], users: [] };
  try {
    const [recordsResult, templatesResult, contactsResult, delegationsResult, jobsResult, usersResult] = await Promise.all([
      supabase.from("lcdbo_correspondence_records").select(RECORD_SELECT).eq("programme_id", programme.id).order("updated_at", { ascending: false }).limit(20),
      supabase.from("lcdbo_correspondence_templates").select("*").eq("programme_id", programme.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("lcdbo_correspondence_contacts").select("*").eq("programme_id", programme.id).order("updated_at", { ascending: false }).limit(50),
      supabase.from("lcdbo_correspondence_delegations").select(DELEGATION_SELECT).eq("programme_id", programme.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("lcdbo_correspondence_notification_jobs").select("*").eq("programme_id", programme.id).order("scheduled_for", { ascending: false }).limit(25),
      supabase.from("users").select(USER_SELECT).in("role", ["admin", "super_admin", "programme_officer", "workspace_user", "data_analyst", "auditor"]).order("full_name", { ascending: true }).limit(100),
    ]);
    if (recordsResult.error) throw recordsResult.error;
    if (templatesResult.error) throw templatesResult.error;
    if (contactsResult.error) throw contactsResult.error;
    if (delegationsResult.error) throw delegationsResult.error;
    if (jobsResult.error) throw jobsResult.error;
    if (usersResult.error) throw usersResult.error;
    const records = (recordsResult.data ?? []) as LcdboCorrespondenceRecord[];
    return {
      summary: summarizeCorrespondence(records),
      records,
      myQueue: records.filter((record) => ["in_review", "awaiting_approval", "awaiting_signature", "ready_for_dispatch", "dispatch_failed"].includes(record.status)),
      templates: (templatesResult.data ?? []) as LcdboCorrespondenceTemplate[],
      contacts: (contactsResult.data ?? []) as LcdboCorrespondenceContact[],
      delegations: (delegationsResult.data ?? []) as LcdboCorrespondenceDelegation[],
      jobs: (jobsResult.data ?? []) as LcdboCorrespondenceNotificationJob[],
      users: usersResult.data ?? [],
    };
  } catch (error) {
    if (isMissingLcdboCorrespondenceSchema(error)) return { summary: emptySummary(), records: [], myQueue: [], templates: [], contacts: [], delegations: [], jobs: [], users: [], schemaUnavailable: true };
    throw error;
  }
}

export async function getCorrespondenceRegister(filters: CorrespondenceRegisterFilters = {}, client?: Client) {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) return { records: [], total: 0, page: 1, pageSize: filters.pageSize ?? 20 };
  const page = Math.max(1, Number(filters.page ?? 1));
  const pageSize = Math.min(50, Math.max(10, Number(filters.pageSize ?? 20)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("lcdbo_correspondence_records")
    .select(RECORD_SELECT, { count: "exact" })
    .eq("programme_id", programme.id);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.direction) query = query.eq("direction", filters.direction);
  if (filters.issuer) query = query.eq("issuer", filters.issuer);
  const q = String(filters.q ?? "").replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
  if (q) query = query.or(`reference.ilike.%${q}%,subject.ilike.%${q}%,correspondence_type.ilike.%${q}%`);
  const { data, error, count } = await query.order("updated_at", { ascending: false }).range(from, to);
  if (error) {
    if (isMissingLcdboCorrespondenceSchema(error)) return { records: [], total: 0, page, pageSize, schemaUnavailable: true };
    throw error;
  }
  return { records: (data ?? []) as LcdboCorrespondenceRecord[], total: count ?? 0, page, pageSize };
}

export async function getCorrespondenceRecord(id: string, client?: Client) {
  const supabase = await clientOrService(client);
  const { data, error } = await supabase
    .from("lcdbo_correspondence_records")
    .select(`
      ${RECORD_SELECT},
      versions:lcdbo_correspondence_document_versions!lcdbo_correspondence_document_versions_record_id_fkey(*),
      actions:lcdbo_correspondence_workflow_actions(*),
      approvals:lcdbo_correspondence_approvals(*),
      signatures:lcdbo_correspondence_signature_events(id,record_id,document_version_id,signatory_id,signature_role,signature_asset_ref,document_hash,signed_pdf_path,signed_at,signature_mode),
      dispatches:lcdbo_correspondence_dispatch_events(*),
      responses:lcdbo_correspondence_responses(*),
      delivery_evidence:lcdbo_correspondence_delivery_evidence(*),
      relationships:lcdbo_correspondence_relationships!lcdbo_correspondence_relationships_source_record_id_fkey(*)
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingLcdboCorrespondenceSchema(error)) return null;
    throw error;
  }
  return data as LcdboCorrespondenceRecord | null;
}

export async function getCorrespondenceContact(contactId: string, client?: Client) {
  const supabase = await clientOrService(client);
  const { data: contact, error } = await supabase
    .from("lcdbo_correspondence_contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle();
  if (error) {
    if (isMissingLcdboCorrespondenceSchema(error)) return null;
    throw error;
  }
  if (!contact) return null;
  const history = await supabase
    .from("lcdbo_correspondence_records")
    .select(RECORD_SELECT)
    .eq("programme_id", contact.programme_id)
    .contains("metadata", { contact_snapshot: { contact_id: contactId } })
    .order("updated_at", { ascending: false })
    .limit(50);
  if (history.error && !isMissingLcdboCorrespondenceSchema(history.error)) throw history.error;
  return {
    contact: contact as LcdboCorrespondenceContact,
    history: (history.data ?? []) as LcdboCorrespondenceRecord[],
  };
}

export async function getCorrespondenceTemplate(templateId: string, client?: Client) {
  const supabase = await clientOrService(client);
  const { data: template, error } = await supabase
    .from("lcdbo_correspondence_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (error) {
    if (isMissingLcdboCorrespondenceSchema(error)) return null;
    throw error;
  }
  if (!template) return null;
  const versions = await supabase
    .from("lcdbo_correspondence_templates")
    .select("*")
    .eq("programme_id", template.programme_id)
    .eq("template_key", template.template_key)
    .order("created_at", { ascending: false });
  if (versions.error && !isMissingLcdboCorrespondenceSchema(versions.error)) throw versions.error;
  return {
    template: template as LcdboCorrespondenceTemplate,
    versions: (versions.data ?? []) as LcdboCorrespondenceTemplate[],
  };
}

export async function createCorrespondenceRecord(input: {
  formData: FormData;
  actorUserId: string;
  programmeId: string;
  client: Client;
}) {
  const direction = requiredText(input.formData.get("direction"), "Direction") as CorrespondenceDirection;
  const issuer = requiredText(input.formData.get("issuer"), "Issuer") as CorrespondenceIssuer;
  const subject = requiredText(input.formData.get("subject"), "Subject");
  const body = optionalText(input.formData.get("body")) ?? "";
  const referenceResult = await input.client.rpc("generate_lcdbo_correspondence_reference", {
    target_issuer: issuer,
    target_direction: direction,
  });
  if (referenceResult.error || !referenceResult.data) throw referenceResult.error ?? new Error("Unable to generate correspondence reference.");
  const reference = String(referenceResult.data);
  const now = new Date().toISOString();
  const contactId = optionalText(input.formData.get("contact_id"));
  const selectedContact = contactId
    ? await input.client.from("lcdbo_correspondence_contacts").select("*").eq("id", contactId).maybeSingle()
    : null;
  if (selectedContact?.error) throw selectedContact.error;
  const contactSnapshot = selectedContact?.data ? {
    contact_id: selectedContact.data.id,
    name: selectedContact.data.name,
    organisation: selectedContact.data.organisation,
    email: selectedContact.data.email,
    phone: selectedContact.data.phone,
    address: selectedContact.data.address,
  } : null;
  const templateId = optionalText(input.formData.get("template_id"));
  const selectedTemplate = templateId
    ? await input.client.from("lcdbo_correspondence_templates").select("*").eq("id", templateId).eq("status", "approved").maybeSingle()
    : null;
  if (selectedTemplate?.error) throw selectedTemplate.error;
  if (templateId && !selectedTemplate?.data) throw new Error("Only approved templates can be selected for new correspondence.");

  const { data: record, error } = await input.client
    .from("lcdbo_correspondence_records")
    .insert({
      programme_id: input.programmeId,
      reference,
      direction,
      issuer,
      correspondence_type: optionalText(input.formData.get("correspondence_type")) ?? "official_letter",
      subject,
      summary: optionalText(input.formData.get("summary")),
      sensitivity: (optionalText(input.formData.get("sensitivity")) ?? "internal") as CorrespondenceSensitivity,
      status: direction === "IN" ? "delivered" : "draft",
      owner_id: optionalText(input.formData.get("owner_id")) ?? input.actorUserId,
      requester_id: input.actorUserId,
      drafter_id: input.actorUserId,
      current_assignee_id: optionalText(input.formData.get("current_assignee_id")) ?? input.actorUserId,
      due_at: optionalText(input.formData.get("due_at")),
      response_required: input.formData.get("response_required") === "on",
      response_due_at: optionalText(input.formData.get("response_due_at")),
      received_at: direction === "IN" ? now : null,
      metadata: metadataWithGovernance({
        contact_snapshot: contactSnapshot,
        recipient_name: contactSnapshot?.name ?? optionalText(input.formData.get("recipient_name")),
        recipient_organisation: contactSnapshot?.organisation ?? optionalText(input.formData.get("recipient_organisation")),
        template_snapshot: selectedTemplate?.data ? {
          template_id: selectedTemplate.data.id,
          template_key: selectedTemplate.data.template_key,
          version: selectedTemplate.data.version,
          issuer: selectedTemplate.data.issuer,
        } : null,
      }),
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
    .select("*")
    .single();
  if (error || !record) throw error ?? new Error("Unable to create correspondence record.");

  if (body || direction === "OUT") {
    const documentHash = sha256Hex(`${reference}:${subject}:${body}`);
    const version = await input.client
      .from("lcdbo_correspondence_document_versions")
      .insert({
        record_id: record.id,
        template_id: selectedTemplate?.data?.id ?? null,
        version_number: 1,
        version_label: "v1",
        body,
        document_hash: documentHash,
        content: { subject, body },
        created_by: input.actorUserId,
      })
      .select("*")
      .single();
    if (version.error || !version.data) throw version.error ?? new Error("Unable to create document version.");
    await input.client.from("lcdbo_correspondence_records").update({ current_version_id: version.data.id }).eq("id", record.id);
  }

  await input.client.from("lcdbo_correspondence_workflow_actions").insert({
    record_id: record.id,
    action_type: "created",
    from_status: null,
    to_status: record.status,
    actor_user_id: input.actorUserId,
    note: "Correspondence record created.",
    metadata: { direction, issuer },
  });
  await recordCorrespondenceEvent({ actorUserId: input.actorUserId, programmeId: input.programmeId, recordId: record.id, eventType: "created", toStatus: record.status, metadata: { reference }, client: input.client });
  return record as LcdboCorrespondenceRecord;
}

export async function createRepresentativeCorrespondenceLetter(input: {
  formData: FormData;
  actorUserId: string;
  programmeId: string;
  client: Client;
}) {
  const authority = await getCorrespondenceRepresentativeAuthority(input);
  if (!authority) throw new Error("An active institutional representative authority is required.");
  const institution = representativeInstitutionFromRole(authority.representative_role);
  if (!institution) throw new Error("Unsupported representative role.");

  const issuer = issuerForRepresentativeInstitution(institution);
  const referenceResult = await input.client.rpc("generate_lcdbo_correspondence_reference", {
    target_issuer: issuer,
    target_direction: "OUT",
  });
  if (referenceResult.error || !referenceResult.data) throw referenceResult.error ?? new Error("Unable to generate correspondence reference.");

  const subject = requiredText(input.formData.get("subject"), "Subject");
  const body = requiredText(input.formData.get("body"), "Letter body");
  const responseRequired = input.formData.get("response_required") === "on";
  const responseDueAt = optionalText(input.formData.get("response_due_at"));
  const templateId = optionalText(input.formData.get("template_id"));
  const selectedTemplate = templateId
    ? await input.client.from("lcdbo_correspondence_templates").select("*").eq("id", templateId).eq("status", "approved").maybeSingle()
    : null;
  if (templateId && !selectedTemplate?.data) throw new Error("Only approved templates can be selected for new correspondence.");
  const { data: record, error } = await input.client
    .from("lcdbo_correspondence_records")
    .insert({
      programme_id: input.programmeId,
      reference: referenceResult.data,
      direction: "OUT",
      issuer,
      correspondence_type: optionalText(input.formData.get("correspondence_type")) ?? "joint_letter",
      subject,
      summary: optionalText(input.formData.get("summary")),
      sensitivity: (optionalText(input.formData.get("sensitivity")) ?? "internal") as CorrespondenceSensitivity,
      status: "draft",
      simplified_status: "draft",
      owner_id: input.actorUserId,
      requester_id: input.actorUserId,
      drafter_id: input.actorUserId,
      current_assignee_id: input.actorUserId,
      initiating_institution_id: authority.institution_id,
      action_institution_id: authority.institution_id,
      response_required: responseRequired,
      response_due_at: responseRequired && responseDueAt ? responseDueAt : null,
      metadata: metadataWithGovernance({
        workflow_model: "two_party_representative",
        initiating_representative_role: authority.representative_role,
        institution_scope: institution,
        template_snapshot: selectedTemplate?.data ? {
          template_id: selectedTemplate.data.id,
          template_key: selectedTemplate.data.template_key,
          version: selectedTemplate.data.version,
          issuer: selectedTemplate.data.issuer,
        } : null,
      }),
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
    .select("*")
    .single();
  if (error || !record) throw error ?? new Error("Unable to create representative correspondence.");

  const documentHash = sha256Hex(`${record.reference}:${subject}:${body}`);
  const version = await input.client
    .from("lcdbo_correspondence_document_versions")
    .insert({
      record_id: record.id,
      template_id: selectedTemplate?.data?.id ?? null,
      version_number: 1,
      version_label: "v1",
      body,
      document_hash: documentHash,
      content: { subject, body },
      created_by: input.actorUserId,
      metadata: { workflow_model: "two_party_representative", protected_content: true },
    })
    .select("*")
    .single();
  if (version.error || !version.data) throw version.error ?? new Error("Unable to create document version.");

  await input.client.from("lcdbo_correspondence_records").update({ current_version_id: version.data.id }).eq("id", record.id);
  await input.client.from("lcdbo_correspondence_workflow_actions").insert({
    record_id: record.id,
    document_version_id: version.data.id,
    action_type: "created",
    from_status: null,
    to_status: "draft",
    actor_user_id: input.actorUserId,
    note: "Representative letter created.",
    metadata: { workflow_model: "two_party_representative", representative_role: authority.representative_role },
  });
  await recordCorrespondenceEvent({
    actorUserId: input.actorUserId,
    programmeId: input.programmeId,
    recordId: record.id,
    eventType: "representative.created",
    toStatus: "draft",
    metadata: { reference: record.reference, representative_role: authority.representative_role },
    client: input.client,
  });
  return { ...(record as LcdboCorrespondenceRecord), current_version_id: version.data.id };
}

export async function adoptLegacyRepresentativeLetter(input: {
  recordId: string;
  actorUserId: string;
  programmeId: string;
  client: Client;
}) {
  const authority = await getCorrespondenceRepresentativeAuthority(input);
  if (!authority) throw new Error("An active representative authority is required to recover this letter.");
  const record = await getCorrespondenceRecord(input.recordId, input.client);
  if (!record?.current_version_id) throw new Error("A document version is required before recovery.");
  if (record.programme_id !== input.programmeId) throw new Error("This letter belongs to a different programme.");
  if (record.created_by !== input.actorUserId) throw new Error("Only the representative who created this letter may recover it.");
  if (record.metadata?.workflow_model === "two_party_representative") throw new Error("This letter already uses the representative workflow.");
  if (!["draft", "in_review", "awaiting_approval"].includes(record.status)) throw new Error("This legacy letter can no longer be safely recovered.");
  if ((record.approvals?.length ?? 0) > 0 || (record.signatures?.length ?? 0) > 0 || (record.dispatches?.length ?? 0) > 0) {
    throw new Error("A letter with approval, signature or dispatch events cannot be converted automatically.");
  }
  const version = record.versions?.find((candidate) => candidate.id === record.current_version_id) ?? record.versions?.[0];
  if (!version || version.is_frozen) throw new Error("A frozen legacy document cannot be converted automatically.");
  const institution = representativeInstitutionFromRole(authority.representative_role);
  if (!institution) throw new Error("Unsupported representative role.");

  const update = await input.client.from("lcdbo_correspondence_records").update({
    issuer: issuerForRepresentativeInstitution(institution),
    status: "draft",
    simplified_status: "draft",
    owner_id: input.actorUserId,
    requester_id: input.actorUserId,
    drafter_id: input.actorUserId,
    current_assignee_id: input.actorUserId,
    initiating_institution_id: authority.institution_id,
    action_institution_id: authority.institution_id,
    metadata: {
      ...(record.metadata ?? {}),
      workflow_model: "two_party_representative",
      simplified_status: "draft",
      initiating_representative_role: authority.representative_role,
      institution_scope: institution,
      recovered_from_legacy_status: record.status,
    },
    updated_by: input.actorUserId,
    updated_at: new Date().toISOString(),
  }).eq("id", input.recordId);
  if (update.error) throw update.error;

  const versionUpdate = await input.client.from("lcdbo_correspondence_document_versions").update({
    metadata: { ...(version.metadata ?? {}), workflow_model: "two_party_representative", protected_content: true },
  }).eq("id", version.id);
  if (versionUpdate.error) throw versionUpdate.error;

  const action = await input.client.from("lcdbo_correspondence_workflow_actions").insert({
    record_id: input.recordId,
    document_version_id: version.id,
    action_type: "representative_workflow_recovered",
    from_status: record.status,
    to_status: "draft",
    actor_user_id: input.actorUserId,
    assigned_to: input.actorUserId,
    note: "Legacy draft converted to the two-party representative workflow.",
    metadata: { workflow_model: "two_party_representative", previous_status: record.status },
  });
  if (action.error) throw action.error;
  await recordCorrespondenceEvent({
    actorUserId: input.actorUserId,
    programmeId: input.programmeId,
    recordId: input.recordId,
    eventType: "representative.workflow_recovered",
    fromStatus: record.status,
    toStatus: "draft",
    metadata: { previous_status: record.status },
    client: input.client,
  });
}

async function insertRepresentativeSignature(input: {
  record: LcdboCorrespondenceRecord;
  authority: LcdboCorrespondenceRepresentativeAuthority;
  actorUserId: string;
  client: Client;
}) {
  if (!input.authority.can_apply_signature) throw new Error("This representative is not authorised to apply institutional signatures.");
  const isProductionSignature = process.env.NODE_ENV === "production";
  if (isProductionSignature && !input.authority.signature_asset_ref) throw new Error("A protected institutional signature asset must be assigned before production approval.");
  const version = input.record.versions?.find((candidate) => candidate.id === input.record.current_version_id) ?? input.record.versions?.[0];
  if (!version?.id || !version.document_hash) throw new Error("A hashed document version is required before signature.");
  const signatureRole = signatureRoleForRepresentative(input.authority.representative_role);
  const existingSignature = input.record.signatures?.find((signature) => signature.signature_role === signatureRole && signature.document_version_id === version.id);
  if (existingSignature) throw new Error("Signature replay is not allowed for the same document version and institution.");
  const { error } = await input.client.from("lcdbo_correspondence_signature_events").insert({
    record_id: input.record.id,
    document_version_id: version.id,
    signatory_id: input.actorUserId,
    signature_role: signatureRole,
    signature_asset_ref: input.authority.signature_asset_ref,
    document_hash: version.document_hash,
    signed_pdf_path: null,
    signature_mode: isProductionSignature ? "protected_asset" : "test_adapter",
    metadata: {
      workflow_model: "two_party_representative",
      representative_authority_id: input.authority.id,
      representative_role: input.authority.representative_role,
      institution_id: input.authority.institution_id,
      private_asset_publicly_exposed: false,
      test_only: !isProductionSignature,
    },
  });
  if (error) throw error;
  await input.client.from("lcdbo_correspondence_document_versions").update({ is_frozen: true, frozen_at: new Date().toISOString() }).eq("id", version.id);
  return { version, signatureRole };
}

async function generateRepresentativeFinalDocument(input: {
  record: LcdboCorrespondenceRecord;
  actorUserId: string;
  client: Client;
}) {
  const version = input.record.versions?.find((candidate) => candidate.id === input.record.current_version_id) ?? input.record.versions?.[0];
  if (!version?.document_hash) throw new Error("Final document requires a hashed current version.");
  const signatures = input.record.signatures ?? [];
  const hasRmrdcSignature = signatures.some((signature) => signature.signature_role === "rmrdc_signatory" && signature.document_version_id === version.id);
  const hasRoseateSignature = signatures.some((signature) => signature.signature_role === "roseate_signatory" && signature.document_version_id === version.id);
  if (!hasRmrdcSignature || !hasRoseateSignature) throw new Error("Both institutional signatures are required before final generation.");
  const token = createVerificationToken(input.record.reference, version.document_hash);
  const canonicalUrl = `${LCDBO_CORRESPONDENCE_CANONICAL_ORIGIN}/verify/${token}`;
  const signatureBlocks = finalSignatureBlocks(input.record);
  const signatureAssets = await loadProtectedSignatureAssets(signatureBlocks);
  const finalPdf = await createCorrespondencePdfWithSignatureAssets(input.record, {
    mode: "final",
    verificationToken: token,
    dispatchReference: input.record.reference,
    signatureBlocks,
  }, signatureAssets);
  const finalPdfHash = correspondencePdfHash(finalPdf);
  const finalPdfPath = await storeImmutableFinalPdf(input.record, finalPdf, finalPdfHash);
  const verification = await input.client.from("lcdbo_correspondence_verification_records").insert({
    record_id: input.record.id,
    verification_token: token,
    canonical_url: canonicalUrl,
    document_hash: finalPdfHash,
    status: "valid",
    metadata: {
      workflow_model: "two_party_representative",
      reference: input.record.reference,
      final_pdf_hash: finalPdfHash,
      byte_length: finalPdf.length,
      storage_status: "stored_immutable",
      final_pdf_path: finalPdfPath,
    },
  }).select("*").single();
  if (verification.error || !verification.data) throw verification.error ?? new Error("Unable to create verification record.");
  const finalRecordUpdate = await input.client.from("lcdbo_correspondence_records").update({
    status: "ready_for_dispatch",
    simplified_status: "ready_to_send",
    action_institution_id: input.record.initiating_institution_id,
    issued_version_id: version.id,
    verification_record_id: verification.data.id,
    final_pdf_hash: finalPdfHash,
    final_pdf_path: finalPdfPath,
    final_pdf_generated_at: new Date().toISOString(),
    metadata: {
      ...(input.record.metadata ?? {}),
      simplified_status: "ready_to_send",
      verification_token: token,
      final_pdf_hash: finalPdfHash,
      final_pdf_byte_length: finalPdf.length,
    },
    updated_by: input.actorUserId,
    updated_at: new Date().toISOString(),
  }).eq("id", input.record.id);
  if (finalRecordUpdate.error) throw finalRecordUpdate.error;
  return { finalPdfHash, token };
}

export async function submitRepresentativeLetterToCounterparty(input: {
  recordId: string;
  actorUserId: string;
  programmeId: string;
  client: Client;
}) {
  const authority = await getCorrespondenceRepresentativeAuthority(input);
  if (!authority) throw new Error("An active representative authority is required.");
  const record = await getCorrespondenceRecord(input.recordId, input.client);
  if (!record?.current_version_id) throw new Error("A document version is required before submission.");
  if (record.initiating_institution_id !== authority.institution_id) throw new Error("Only the initiating representative may submit this letter.");
  if (!["draft", "revision_requested"].includes(record.status)) throw new Error("Only drafts or returned letters can be submitted.");
  if (!["draft", "returned_for_correction"].includes(simplifiedStatusForRecord(record))) throw new Error("This letter is not awaiting initiator action.");

  const approvalRole = approvalRoleForRepresentative(authority.representative_role);
  const { error: approvalError } = await input.client.from("lcdbo_correspondence_approvals").upsert({
    record_id: input.recordId,
    document_version_id: record.current_version_id,
    approval_role: approvalRole,
    approver_id: input.actorUserId,
    decision: "approved",
    decision_note: "Representative approved and applied institutional signature.",
    metadata: { workflow_model: "two_party_representative", representative_authority_id: authority.id },
  }, { onConflict: "record_id,document_version_id,approval_role" });
  if (approvalError) throw approvalError;

  await insertRepresentativeSignature({ record, authority, actorUserId: input.actorUserId, client: input.client });
  const counterpartyRole = counterpartyRoleForRepresentative(authority.representative_role);
  const counterpartyAuthority = await getPrimaryCounterpartyRepresentative({ programmeId: input.programmeId, representativeRole: counterpartyRole, client: input.client });
  const toStatus = counterpartyStatusForRepresentative(authority.representative_role);
  await input.client.from("lcdbo_correspondence_records").update({
    status: "awaiting_signature",
    simplified_status: toStatus,
    action_institution_id: counterpartyAuthority?.institution_id ?? null,
    current_assignee_id: counterpartyAuthority?.user_id ?? null,
    metadata: {
      ...(record.metadata ?? {}),
      simplified_status: toStatus,
      awaiting_representative_role: counterpartyRole,
    },
    updated_by: input.actorUserId,
    updated_at: new Date().toISOString(),
  }).eq("id", input.recordId);
  await input.client.from("lcdbo_correspondence_workflow_actions").insert({
    record_id: input.recordId,
    document_version_id: record.current_version_id,
    action_type: "signature_requested",
    from_status: record.status,
    to_status: "awaiting_signature",
    actor_user_id: input.actorUserId,
    assigned_to: counterpartyAuthority?.user_id ?? null,
    note: "Representative signed and sent to the counterparty for countersignature.",
    metadata: { workflow_model: "two_party_representative", simplified_status: toStatus, counterparty_role: counterpartyRole },
  });
  await enqueueRepresentativeNotification({
    programmeId: input.programmeId,
    recordId: input.recordId,
    recipientUserId: counterpartyAuthority?.user_id ?? null,
    jobType: "representative_counterparty_action",
    idempotencyKey: `representative-counterparty:${input.recordId}:${record.current_version_id}:${counterpartyRole}`,
    metadata: { subject: record.subject, reference: record.reference, action_required: "Review and countersign", secure_path: `/dashboard/correspondence/${input.recordId}` },
    client: input.client,
  });
}

export async function saveRepresentativeDraftVersion(input: {
  recordId: string;
  formData: FormData;
  actorUserId: string;
  programmeId: string;
  client: Client;
}) {
  const authority = await getCorrespondenceRepresentativeAuthority(input);
  if (!authority) throw new Error("An active representative authority is required.");
  const record = await getCorrespondenceRecord(input.recordId, input.client);
  if (!record?.current_version_id) throw new Error("A document version is required before editing.");
  if (record.initiating_institution_id !== authority.institution_id) throw new Error("Only the initiating representative may revise this letter.");
  if (!["draft", "revision_requested"].includes(record.status)) throw new Error("Only draft or returned letters can be revised.");
  if (!["draft", "returned_for_correction"].includes(simplifiedStatusForRecord(record))) throw new Error("This letter is not open for representative revision.");

  const subject = requiredText(input.formData.get("subject"), "Subject");
  const body = requiredText(input.formData.get("body"), "Letter body");
  const summary = optionalText(input.formData.get("summary"));
  const currentVersion = record.versions?.find((candidate) => candidate.id === record.current_version_id) ?? record.versions?.[0];
  if (!currentVersion) throw new Error("Current document version could not be resolved.");
  const documentHash = sha256Hex(`${record.reference}:${subject}:${body}`);
  const content = { subject, body, recipient: currentVersion.content?.recipient ?? (record.metadata?.recipient_snapshot ?? null) };
  let nextVersionId = currentVersion.id;
  let actionType = "draft_updated";

  if (currentVersion.is_frozen) {
    const nextVersionNumber = Math.max(0, ...(record.versions ?? []).map((version) => Number(version.version_number) || 0)) + 1;
    const { data: nextVersion, error: nextVersionError } = await input.client
      .from("lcdbo_correspondence_document_versions")
      .insert({
        record_id: input.recordId,
        template_id: currentVersion.template_id,
        version_number: nextVersionNumber,
        version_label: `v${nextVersionNumber}`,
        body,
        content,
        document_hash: documentHash,
        is_frozen: false,
        created_by: input.actorUserId,
        metadata: { workflow_model: "two_party_representative", corrected_from_version_id: currentVersion.id, protected_content: true },
      })
      .select("*")
      .single();
    if (nextVersionError || !nextVersion) throw nextVersionError ?? new Error("Unable to create corrected document version.");
    nextVersionId = nextVersion.id;
    actionType = "corrected_version_created";
  } else {
    const { error: versionError } = await input.client
      .from("lcdbo_correspondence_document_versions")
      .update({
        body,
        content,
        document_hash: documentHash,
        metadata: { ...(currentVersion.metadata ?? {}), workflow_model: "two_party_representative", protected_content: true },
      })
      .eq("id", currentVersion.id);
    if (versionError) throw versionError;
  }

  const { error: recordError } = await input.client
    .from("lcdbo_correspondence_records")
    .update({
      subject,
      summary,
      status: record.status === "revision_requested" ? "revision_requested" : "draft",
      simplified_status: "draft",
      current_version_id: nextVersionId,
      action_institution_id: authority.institution_id,
      current_assignee_id: input.actorUserId,
      metadata: {
        ...(record.metadata ?? {}),
        simplified_status: "draft",
        corrected_after_return: record.status === "revision_requested",
        signature_invalidated_by_return: false,
      },
      updated_by: input.actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.recordId);
  if (recordError) throw recordError;

  const { error: actionError } = await input.client.from("lcdbo_correspondence_workflow_actions").insert({
    record_id: input.recordId,
    document_version_id: nextVersionId,
    action_type: actionType,
    from_status: record.status,
    to_status: record.status === "revision_requested" ? "revision_requested" : "draft",
    actor_user_id: input.actorUserId,
    note: currentVersion.is_frozen ? "Representative created a corrected document version." : "Representative updated the draft document.",
    metadata: { workflow_model: "two_party_representative", document_hash: documentHash },
  });
  if (actionError) throw actionError;
}

export async function decideRepresentativeCounterpartyLetter(input: {
  recordId: string;
  actorUserId: string;
  programmeId: string;
  decision: "approved" | "revision_requested" | "rejected";
  note?: string | null;
  client: Client;
}) {
  const authority = await getCorrespondenceRepresentativeAuthority(input);
  if (!authority) throw new Error("An active representative authority is required.");
  const record = await getCorrespondenceRecord(input.recordId, input.client);
  if (!record?.current_version_id) throw new Error("A document version is required before decision.");
  if (record.action_institution_id && record.action_institution_id !== authority.institution_id) throw new Error("This correspondence is not assigned to your institution.");
  const expectedStatus = counterpartyStatusForRepresentative(counterpartyRoleForRepresentative(authority.representative_role));
  if (simplifiedStatusForRecord(record) !== expectedStatus && record.current_assignee_id !== input.actorUserId) {
    throw new Error("This correspondence is not awaiting your institution.");
  }
  if (input.decision !== "approved" && !input.note?.trim()) throw new Error("Return and rejection require a reason.");

  const approvalRole = approvalRoleForRepresentative(authority.representative_role);
  const { error: approvalError } = await input.client.from("lcdbo_correspondence_approvals").upsert({
    record_id: input.recordId,
    document_version_id: record.current_version_id,
    approval_role: approvalRole,
    approver_id: input.actorUserId,
    decision: input.decision,
    decision_note: input.note ?? null,
    metadata: { workflow_model: "two_party_representative", representative_authority_id: authority.id },
  }, { onConflict: "record_id,document_version_id,approval_role" });
  if (approvalError) throw approvalError;

  if (input.decision === "rejected") {
    await transitionCorrespondenceRecord({ recordId: input.recordId, toStatus: "rejected", actionType: "rejected", actorUserId: input.actorUserId, note: input.note, client: input.client });
    await input.client.from("lcdbo_correspondence_records").update({ simplified_status: "rejected", updated_by: input.actorUserId }).eq("id", input.recordId);
    await enqueueRepresentativeNotification({ programmeId: input.programmeId, recordId: input.recordId, recipientUserId: record.created_by, jobType: "representative_rejected", idempotencyKey: `representative-rejected:${input.recordId}:${record.current_version_id}`, metadata: { reference: record.reference, subject: record.subject, reason_required: true }, client: input.client });
    return;
  }

  if (input.decision === "revision_requested") {
    await transitionCorrespondenceRecord({ recordId: input.recordId, toStatus: "revision_requested", actionType: "revision_requested", actorUserId: input.actorUserId, note: input.note, client: input.client });
    await input.client.from("lcdbo_correspondence_records").update({
      simplified_status: "returned_for_correction",
      action_institution_id: record.initiating_institution_id,
      current_assignee_id: record.created_by,
      metadata: { ...(record.metadata ?? {}), simplified_status: "returned_for_correction", signature_invalidated_by_return: true },
      updated_by: input.actorUserId,
    }).eq("id", input.recordId);
    await enqueueRepresentativeNotification({ programmeId: input.programmeId, recordId: input.recordId, recipientUserId: record.created_by, jobType: "representative_returned_for_correction", idempotencyKey: `representative-returned:${input.recordId}:${record.current_version_id}`, metadata: { reference: record.reference, subject: record.subject, correction_reason: input.note ?? null }, client: input.client });
    return;
  }

  await insertRepresentativeSignature({ record, authority, actorUserId: input.actorUserId, client: input.client });
  const refreshed = await getCorrespondenceRecord(input.recordId, input.client);
  if (!refreshed) throw new Error("Correspondence record not found after signature.");
  const final = await generateRepresentativeFinalDocument({ record: refreshed, actorUserId: input.actorUserId, client: input.client });
  await input.client.from("lcdbo_correspondence_workflow_actions").insert({
    record_id: input.recordId,
    document_version_id: refreshed.current_version_id,
    action_type: "ready_for_dispatch",
    from_status: "awaiting_signature",
    to_status: "ready_for_dispatch",
    actor_user_id: input.actorUserId,
    assigned_to: refreshed.created_by,
    note: "Both representatives signed. Final joint document is ready to send.",
    metadata: { workflow_model: "two_party_representative", simplified_status: "ready_to_send", final_pdf_hash: final.finalPdfHash },
  });
  await enqueueRepresentativeNotification({ programmeId: input.programmeId, recordId: input.recordId, recipientUserId: refreshed.created_by, jobType: "representative_ready_to_send", idempotencyKey: `representative-ready:${input.recordId}:${refreshed.current_version_id}`, metadata: { reference: refreshed.reference, subject: refreshed.subject, final_pdf_hash: final.finalPdfHash, secure_path: `/dashboard/correspondence/${input.recordId}` }, client: input.client });
}

export async function transitionCorrespondenceRecord(input: {
  recordId: string;
  toStatus: CorrespondenceStatus;
  actionType: string;
  actorUserId: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
  client: Client;
}) {
  const existing = await getCorrespondenceRecord(input.recordId, input.client);
  if (!existing) throw new Error("Correspondence record not found.");
  assertCorrespondenceTransition(existing.status, input.toStatus);
  const patch: Record<string, unknown> = {
    status: input.toStatus,
    updated_by: input.actorUserId,
    updated_at: new Date().toISOString(),
  };
  if (input.toStatus === "ready_for_dispatch" && !existing.signatures?.length) throw new Error("Required protected signature event is required before dispatch readiness.");
  if (input.toStatus === "sent" && !existing.dispatches?.length) throw new Error("Recorded dispatch event is required before official issuance.");
  if (input.toStatus === "closed") patch.closed_at = new Date().toISOString();
  const { data, error } = await input.client.from("lcdbo_correspondence_records").update(patch).eq("id", input.recordId).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to update correspondence status.");
  await input.client.from("lcdbo_correspondence_workflow_actions").insert({
    record_id: input.recordId,
    document_version_id: existing.current_version_id,
    action_type: input.actionType,
    from_status: existing.status,
    to_status: input.toStatus,
    actor_user_id: input.actorUserId,
    note: input.note ?? null,
    metadata: input.metadata ?? {},
  });
  await recordCorrespondenceEvent({
    actorUserId: input.actorUserId,
    programmeId: existing.programme_id,
    recordId: input.recordId,
    eventType: input.actionType,
    fromStatus: existing.status,
    toStatus: input.toStatus,
    metadata: input.metadata,
    client: input.client,
  });
  return data as LcdboCorrespondenceRecord;
}

export async function recordCorrespondenceApproval(input: {
  recordId: string;
  decision: "approved" | "rejected" | "revision_requested";
  approvalRole: string;
  actorUserId: string;
  note?: string | null;
  client: Client;
}) {
  const record = await getCorrespondenceRecord(input.recordId, input.client);
  if (!record?.current_version_id) throw new Error("A document version is required before approval.");
  if (record.created_by === input.actorUserId && input.decision === "approved") throw new Error("Creator cannot approve their own correspondence.");
  const latestVersion = record.versions?.find((version) => version.id === record.current_version_id) ?? record.versions?.[0];
  if (!latestVersion) throw new Error("Document version not found.");
  const { error } = await input.client.from("lcdbo_correspondence_approvals").upsert({
    record_id: input.recordId,
    document_version_id: latestVersion.id,
    approval_role: input.approvalRole,
    approver_id: input.actorUserId,
    decision: input.decision,
    decision_note: input.note ?? null,
    metadata: { version_label: latestVersion.version_label },
  }, { onConflict: "record_id,document_version_id,approval_role" });
  if (error) throw error;
  const approvals = [...(record.approvals ?? []), { approval_role: input.approvalRole, decision: input.decision }];
  const hasRmrdc = approvals.some((approval) => approval.approval_role === "rmrdc_reviewer" && approval.decision === "approved");
  const hasRoseate = approvals.some((approval) => approval.approval_role === "roseate_reviewer" && approval.decision === "approved");
  const hasJoint = approvals.some((approval) => approval.approval_role === "joint_secretariat" && approval.decision === "approved");
  const toStatus = input.decision === "approved" && (hasJoint || (hasRmrdc && hasRoseate)) ? "awaiting_signature" : input.decision === "approved" ? "awaiting_approval" : input.decision === "rejected" ? "rejected" : "revision_requested";
  return transitionCorrespondenceRecord({
    recordId: input.recordId,
    toStatus,
    actionType: input.decision === "approved" ? "approved" : input.decision,
    actorUserId: input.actorUserId,
    note: input.note,
    client: input.client,
  });
}

export async function recordCorrespondenceSignature(input: {
  recordId: string;
  actorUserId: string;
  signatureRole: string;
  client: Client;
}) {
  const record = await getCorrespondenceRecord(input.recordId, input.client);
  if (!record?.current_version_id) throw new Error("A frozen document version is required for signature.");
  if (record.status !== "awaiting_signature") throw new Error("Correspondence must be awaiting signature.");
  const version = record.versions?.find((candidate) => candidate.id === record.current_version_id) ?? record.versions?.[0];
  if (!version?.document_hash) throw new Error("Document hash is required before signature.");
  if (process.env.NODE_ENV === "production") throw new Error("Legacy signature entry is disabled in production. Use an authorised institutional representative approval.");
  const existingSignature = record.signatures?.find((signature) => signature.signature_role === input.signatureRole && signature.document_version_id === version.id);
  if (existingSignature) throw new Error("Signature replay is not allowed for the same document version and role.");
  const approvals = record.approvals ?? [];
  const requiredApprovalSatisfied = approvals.some((approval) => approval.decision === "approved" && ["joint_secretariat", "rmrdc_reviewer", "roseate_reviewer"].includes(approval.approval_role));
  if (!requiredApprovalSatisfied) throw new Error("Required approvals must be recorded before signing.");
  const { error } = await input.client.from("lcdbo_correspondence_signature_events").insert({
    record_id: input.recordId,
    document_version_id: version.id,
    signatory_id: input.actorUserId,
    signature_role: input.signatureRole,
    document_hash: version.document_hash,
    signed_pdf_path: null,
    signature_mode: "test_adapter",
    metadata: { signature_policy: "server_side_only", private_asset_publicly_exposed: false },
  });
  if (error) throw error;
  await input.client.from("lcdbo_correspondence_document_versions").update({ is_frozen: true, frozen_at: new Date().toISOString() }).eq("id", version.id);
  const signatures = [...(record.signatures ?? []), {
    signature_role: input.signatureRole,
    signatory_id: input.actorUserId,
    signed_at: new Date().toISOString(),
    document_hash: version.document_hash,
  }];
  const hasRmrdcSignature = signatures.some((signature) => signature.signature_role === "rmrdc_signatory");
  const hasRoseateSignature = signatures.some((signature) => signature.signature_role === "roseate_signatory");
  const hasDelegateSignature = signatures.some((signature) => signature.signature_role === "signatory_delegate" || signature.signature_role === "joint_signatory");
  const nextStatus = hasDelegateSignature || (hasRmrdcSignature && hasRoseateSignature) ? "signed" : "awaiting_signature";
  return transitionCorrespondenceRecord({
    recordId: input.recordId,
    toStatus: nextStatus,
    actionType: "signed",
    actorUserId: input.actorUserId,
    note: "Protected signature event recorded.",
    metadata: { signature_role: input.signatureRole, document_hash: version.document_hash },
    client: input.client,
  });
}

export async function recordCorrespondenceDispatch(input: {
  recordId: string;
  actorUserId: string;
  channel: string;
  trackingNumber?: string | null;
  note?: string | null;
  providerAccepted?: boolean;
  client: Client;
}) {
  if (input.channel === "email" && !input.providerAccepted) throw new Error("Email dispatch must be accepted by the approved provider before it can be recorded.");
  const record = await getCorrespondenceRecord(input.recordId, input.client);
  if (!record) throw new Error("Correspondence record not found.");
  if (!["signed", "ready_for_dispatch", "dispatch_failed"].includes(record.status)) throw new Error("Correspondence is not ready for dispatch.");
  const representativeWorkflow = record.metadata?.workflow_model === "two_party_representative";
  const currentSignatures = (record.signatures ?? []).filter((signature) => signature.document_version_id === record.current_version_id);
  if (!currentSignatures.length) throw new Error("Required protected signature event is required before dispatch.");
  if (representativeWorkflow && (!currentSignatures.some((signature) => signature.signature_role === "rmrdc_signatory") || !currentSignatures.some((signature) => signature.signature_role === "roseate_signatory"))) {
    throw new Error("Both institutional approvals are required before dispatch.");
  }
  if (representativeWorkflow && (!record.final_pdf_path || !record.final_pdf_hash)) throw new Error("The immutable final PDF must be stored before dispatch.");
  const channelRequiresProviderTracking = ["courier", "official_portal"].includes(input.channel);
  const providerTracking = String(input.trackingNumber ?? "").trim();
  if (channelRequiresProviderTracking && !providerTracking) throw new Error("Provider or courier tracking identifier is required for this dispatch channel.");
  const dispatchReference = providerTracking || record.reference;
  const { error } = await input.client.from("lcdbo_correspondence_dispatch_events").insert({
    record_id: input.recordId,
    dispatch_channel: input.channel,
    tracking_number: dispatchReference,
    status: "sent",
    dispatch_note: input.note ?? null,
    dispatched_by: input.actorUserId,
  });
  if (error) throw error;
  const issuedVersion = record.current_version_id;
  const version = record.versions?.find((candidate) => candidate.id === issuedVersion) ?? record.versions?.[0];
  if (!version?.document_hash) throw new Error("Issued document hash is required.");
  const token = typeof record.metadata?.verification_token === "string"
    ? record.metadata.verification_token
    : createVerificationToken(record.reference, version.document_hash);
  const canonicalUrl = `${LCDBO_CORRESPONDENCE_CANONICAL_ORIGIN}/verify/${token}`;
  const finalPdf = await generateCorrespondenceFinalPdf(input.recordId, input.client);
  const finalPdfHash = correspondencePdfHash(finalPdf);
  let verificationRecordId = record.verification_record_id;
  if (!verificationRecordId) {
    const verification = await input.client.from("lcdbo_correspondence_verification_records").insert({
      record_id: input.recordId,
      verification_token: token,
      canonical_url: canonicalUrl,
      document_hash: finalPdfHash,
      status: "valid",
      metadata: { reference: record.reference, final_pdf_hash: finalPdfHash, byte_length: finalPdf.length },
    }).select("*").single();
    if (verification.error || !verification.data) throw verification.error ?? new Error("Unable to create verification record.");
    verificationRecordId = verification.data.id;
  }
  await input.client.from("lcdbo_correspondence_records").update({
    issued_at: new Date().toISOString(),
    dispatched_at: new Date().toISOString(),
    issued_version_id: issuedVersion,
    verification_record_id: verificationRecordId,
    simplified_status: "sent",
    metadata: {
      ...(record.metadata ?? {}),
      verification_token: token,
      final_pdf_hash: finalPdfHash,
      final_pdf_byte_length: finalPdf.length,
      dispatch_reference: dispatchReference,
      dispatch_provider_tracking: providerTracking || null,
    },
  }).eq("id", input.recordId);
  return transitionCorrespondenceRecord({
    recordId: input.recordId,
    toStatus: "sent",
    actionType: "dispatch_recorded",
    actorUserId: input.actorUserId,
    note: input.note,
    metadata: { dispatch_reference: dispatchReference, provider_tracking: providerTracking || null, verification_token: token, final_pdf_hash: finalPdfHash },
    client: input.client,
  });
}

export async function upsertCorrespondenceContact(input: {
  formData: FormData;
  actorUserId: string;
  programmeId: string;
  client: Client;
}) {
  const contactId = optionalText(input.formData.get("contact_id"));
  const name = requiredText(input.formData.get("name"), "Contact name");
  const email = optionalText(input.formData.get("email"));
  const phone = optionalText(input.formData.get("phone"));
  if (!email && !phone) throw new Error("At least one contact channel is required.");
  const payload = {
    programme_id: input.programmeId,
    contact_type: optionalText(input.formData.get("contact_type")) ?? "external",
    name,
    organisation: optionalText(input.formData.get("organisation")),
    role_title: optionalText(input.formData.get("role_title")),
    email,
    phone,
    address: optionalText(input.formData.get("address")),
    state: optionalText(input.formData.get("state")),
    country: optionalText(input.formData.get("country")) ?? "Nigeria",
    status: optionalText(input.formData.get("status")) ?? "active",
    metadata: metadataWithGovernance({ last_action: contactId ? "updated" : "created" }),
    updated_by: input.actorUserId,
  };
  if (!contactId) {
    let duplicateQuery = input.client
      .from("lcdbo_correspondence_contacts")
      .select("id")
      .eq("programme_id", input.programmeId)
      .ilike("name", name);
    if (email) duplicateQuery = duplicateQuery.eq("email", email);
    const { data: duplicate, error: duplicateError } = await duplicateQuery.limit(1).maybeSingle();
    if (duplicateError && !isMissingLcdboCorrespondenceSchema(duplicateError)) throw duplicateError;
    if (duplicate?.id) throw new Error("A matching correspondence contact already exists.");
  }
  const query = contactId
    ? input.client.from("lcdbo_correspondence_contacts").update(payload).eq("id", contactId)
    : input.client.from("lcdbo_correspondence_contacts").insert({ ...payload, created_by: input.actorUserId });
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save correspondence contact.");
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: contactId ? "lcdbo.correspondence.contact.updated" : "lcdbo.correspondence.contact.created",
    entityType: "lcdbo_correspondence_contact",
    entityId: data.id,
    scopeType: "programme",
    scopeId: input.programmeId,
    metadata: { name, organisation: payload.organisation, contact_type: payload.contact_type },
    client: input.client,
  });
  return data as LcdboCorrespondenceContact;
}

export async function transitionCorrespondenceContactStatus(input: {
  contactId: string;
  status: "active" | "inactive" | "archived";
  actorUserId: string;
  note?: string | null;
  client: Client;
}) {
  const { data: contact, error: fetchError } = await input.client
    .from("lcdbo_correspondence_contacts")
    .select("*")
    .eq("id", input.contactId)
    .single();
  if (fetchError || !contact) throw fetchError ?? new Error("Contact not found.");
  if (!["active", "inactive", "archived"].includes(input.status)) throw new Error("Unsupported contact status.");
  const { data, error } = await input.client
    .from("lcdbo_correspondence_contacts")
    .update({
      status: input.status,
      updated_by: input.actorUserId,
      metadata: {
        ...(contact.metadata ?? {}),
        lifecycle: {
          from_status: contact.status,
          to_status: input.status,
          note: input.note ?? null,
          updated_by: input.actorUserId,
          updated_at: new Date().toISOString(),
        },
      },
    })
    .eq("id", input.contactId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Unable to update contact status.");
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: `lcdbo.correspondence.contact.${input.status}`,
    entityType: "lcdbo_correspondence_contact",
    entityId: input.contactId,
    scopeType: "programme",
    scopeId: contact.programme_id,
    metadata: { from_status: contact.status, to_status: input.status, note: input.note ?? null },
    client: input.client,
  });
  return data as LcdboCorrespondenceContact;
}

export async function upsertCorrespondenceTemplate(input: {
  formData: FormData;
  actorUserId: string;
  programmeId: string;
  client: Client;
}) {
  const templateId = optionalText(input.formData.get("template_id"));
  const bodyTemplate = requiredText(input.formData.get("body_template"), "Template body");
  const placeholderSchema = parsePlaceholderSchema(optionalText(input.formData.get("placeholder_schema")));
  const validation = validateTemplatePlaceholders(bodyTemplate, placeholderSchema);
  if (!validation.ok) throw new Error(`Template is missing required placeholders: ${validation.missing.join(", ")}`);
  const payload = {
    programme_id: input.programmeId,
    template_key: requiredText(input.formData.get("template_key"), "Template key"),
    name: requiredText(input.formData.get("name"), "Template name"),
    issuer: requiredText(input.formData.get("issuer"), "Issuer") as CorrespondenceIssuer,
    correspondence_type: optionalText(input.formData.get("correspondence_type")) ?? "official_letter",
    version: optionalText(input.formData.get("version")) ?? "1.0",
    placeholder_schema: placeholderSchema,
    body_template: bodyTemplate,
    signature_config: {
      required_signatures: String(input.formData.get("required_signatures") ?? "joint").trim() || "joint",
    },
    metadata: metadataWithGovernance({ placeholders: validation.present }),
  };
  if (templateId) {
    const { data: existingTemplate, error: existingError } = await input.client.from("lcdbo_correspondence_templates").select("status").eq("id", templateId).single();
    if (existingError || !existingTemplate) throw existingError ?? new Error("Template not found.");
    if (["approved", "retired"].includes(existingTemplate.status)) throw new Error("Approved or retired templates cannot be edited; create a new version instead.");
  }
  const query = templateId
    ? input.client.from("lcdbo_correspondence_templates").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", templateId)
    : input.client.from("lcdbo_correspondence_templates").insert({ ...payload, status: "draft" });
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save correspondence template.");
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: templateId ? "lcdbo.correspondence.template.updated" : "lcdbo.correspondence.template.created",
    entityType: "lcdbo_correspondence_template",
    entityId: data.id,
    scopeType: "programme",
    scopeId: input.programmeId,
    metadata: { template_key: payload.template_key, issuer: payload.issuer },
    client: input.client,
  });
  return data as LcdboCorrespondenceTemplate;
}

export async function transitionCorrespondenceTemplate(input: {
  templateId: string;
  action: "submit" | "approve" | "reject" | "retire";
  actorUserId: string;
  note?: string | null;
  client: Client;
}) {
  const { data: template, error: fetchError } = await input.client.from("lcdbo_correspondence_templates").select("*").eq("id", input.templateId).single();
  if (fetchError || !template) throw fetchError ?? new Error("Template not found.");
  const currentStatus = String(template.status);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.action === "submit") {
    if (!["draft", "rejected"].includes(currentStatus)) throw new Error("Only draft or rejected templates can be submitted.");
    patch.status = "pending_approval";
    patch.submitted_for_approval_at = new Date().toISOString();
  } else if (input.action === "approve") {
    if (currentStatus !== "pending_approval") throw new Error("Only pending templates can be approved.");
    patch.status = "approved";
    patch.approved_by = input.actorUserId;
    patch.approved_at = new Date().toISOString();
  } else if (input.action === "reject") {
    if (currentStatus !== "pending_approval") throw new Error("Only pending templates can be rejected.");
    patch.status = "rejected";
    patch.rejected_by = input.actorUserId;
    patch.rejected_at = new Date().toISOString();
    patch.rejection_note = input.note ?? null;
  } else {
    if (currentStatus !== "approved") throw new Error("Only approved templates can be retired.");
    patch.status = "retired";
    patch.retired_by = input.actorUserId;
    patch.retired_at = new Date().toISOString();
  }
  const { data, error } = await input.client.from("lcdbo_correspondence_templates").update(patch).eq("id", input.templateId).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to update correspondence template.");
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: `lcdbo.correspondence.template.${input.action}`,
    entityType: "lcdbo_correspondence_template",
    entityId: input.templateId,
    scopeType: "programme",
    scopeId: template.programme_id,
    metadata: { from_status: currentStatus, to_status: patch.status, note: input.note ?? null },
    client: input.client,
  });
  return data as LcdboCorrespondenceTemplate;
}

export async function upsertCorrespondenceDelegation(input: {
  formData: FormData;
  actorUserId: string;
  programmeId: string;
  client: Client;
}) {
  const delegationId = optionalText(input.formData.get("delegation_id"));
  const delegatorId = requiredText(input.formData.get("delegator_id"), "Delegator");
  const delegateId = requiredText(input.formData.get("delegate_id"), "Delegate");
  const payload = {
    programme_id: input.programmeId,
    delegator_id: delegatorId,
    delegate_id: delegateId,
    delegation_role: requiredText(input.formData.get("delegation_role"), "Delegation role"),
    organisation: optionalText(input.formData.get("organisation")),
    correspondence_scope: {
      issuer: optionalText(input.formData.get("issuer_scope")) ?? "any",
      sensitivity: optionalText(input.formData.get("sensitivity_scope")) ?? "internal",
    },
    starts_at: optionalText(input.formData.get("starts_at")) ?? new Date().toISOString(),
    expires_at: optionalText(input.formData.get("expires_at")),
    reason: requiredText(input.formData.get("reason"), "Reason"),
    metadata: metadataWithGovernance({ delegation_policy: "time_bound_and_audited" }),
  };
  if (delegatorId === delegateId) throw new Error("Delegator and delegate must be different users.");
  const query = delegationId
    ? input.client.from("lcdbo_correspondence_delegations").update(payload).eq("id", delegationId)
    : input.client.from("lcdbo_correspondence_delegations").insert({ ...payload, status: "active", created_by: input.actorUserId });
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save delegation.");
  assertDelegationIsSafe(data);
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: delegationId ? "lcdbo.correspondence.delegation.updated" : "lcdbo.correspondence.delegation.created",
    entityType: "lcdbo_correspondence_delegation",
    entityId: data.id,
    scopeType: "programme",
    scopeId: input.programmeId,
    metadata: { delegation_role: payload.delegation_role, organisation: payload.organisation },
    client: input.client,
  });
  return data as LcdboCorrespondenceDelegation;
}

export async function transitionCorrespondenceDelegation(input: {
  delegationId: string;
  action: "approve" | "revoke" | "expire";
  actorUserId: string;
  note?: string | null;
  client: Client;
}) {
  const { data: delegation, error: fetchError } = await input.client.from("lcdbo_correspondence_delegations").select("*").eq("id", input.delegationId).single();
  if (fetchError || !delegation) throw fetchError ?? new Error("Delegation not found.");
  if (delegation.created_by === input.actorUserId && input.action === "approve") throw new Error("Creator cannot approve their own delegation.");
  const patch: Record<string, unknown> = {};
  if (input.action === "approve") {
    assertDelegationIsSafe(delegation);
    patch.approved_by = input.actorUserId;
    patch.approved_at = new Date().toISOString();
    patch.status = "active";
  } else if (input.action === "revoke") {
    patch.revoked_by = input.actorUserId;
    patch.revoked_at = new Date().toISOString();
    patch.status = "revoked";
  } else {
    patch.status = "expired";
  }
  const { data, error } = await input.client.from("lcdbo_correspondence_delegations").update(patch).eq("id", input.delegationId).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to update delegation.");
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: `lcdbo.correspondence.delegation.${input.action}`,
    entityType: "lcdbo_correspondence_delegation",
    entityId: input.delegationId,
    scopeType: "programme",
    scopeId: delegation.programme_id,
    metadata: { note: input.note ?? null },
    client: input.client,
  });
  return data as LcdboCorrespondenceDelegation;
}

export async function recordCorrespondenceDeliveryEvidence(input: {
  formData: FormData;
  actorUserId: string;
  client: Client;
}) {
  const recordId = requiredText(input.formData.get("record_id"), "Record");
  const dispatchEventId = requiredText(input.formData.get("dispatch_event_id"), "Dispatch event");
  const record = await getCorrespondenceRecord(recordId, input.client);
  if (!record) throw new Error("Correspondence record not found.");
  const note = optionalText(input.formData.get("delivery_note"));
  const receivingPerson = optionalText(input.formData.get("receiving_person"));
  let filePath = optionalText(input.formData.get("file_path"));
  let fileName = optionalText(input.formData.get("file_name"));
  let fileSize = Number(optionalText(input.formData.get("file_size")) ?? 0) || null;
  let mimeType = optionalText(input.formData.get("mime_type"));
  let fileHash = optionalText(input.formData.get("file_hash"));
  const evidenceFile = input.formData.get("evidence_file");
  if (evidenceFile instanceof File && evidenceFile.size > 0) {
    const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);
    if (!allowedMimeTypes.has(evidenceFile.type)) throw new Error("Unsupported evidence file type.");
    if (evidenceFile.size > 10 * 1024 * 1024) throw new Error("Evidence file must be 10MB or smaller.");
    const bytes = Buffer.from(await evidenceFile.arrayBuffer());
    fileHash = sha256Hex(bytes);
    fileName = evidenceFile.name;
    fileSize = evidenceFile.size;
    mimeType = evidenceFile.type;
    filePath = `delivery-evidence/${recordId}/${Date.now()}-${fileHash.slice(0, 12)}-${evidenceFile.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const upload = await input.client.storage.from("lcdbo-correspondence-documents").upload(filePath, bytes, {
      contentType: evidenceFile.type,
      upsert: false,
    });
    if (upload.error) throw upload.error;
  }
  if (!note && !receivingPerson && !filePath) throw new Error("Delivery evidence requires a note, receiving person or file path.");
  const requestedStatus = optionalText(input.formData.get("record_status")) === "acknowledged" ? "acknowledged" : "delivered";
  const supersedesEvidenceId = optionalText(input.formData.get("supersedes_evidence_id"));
  if (supersedesEvidenceId) {
    const { data: previous, error: previousError } = await input.client
      .from("lcdbo_correspondence_delivery_evidence")
      .select("id,record_id,status")
      .eq("id", supersedesEvidenceId)
      .single();
    if (previousError || !previous) throw previousError ?? new Error("Previous evidence record not found.");
    if (previous.record_id !== recordId) throw new Error("Replacement evidence must belong to the same correspondence record.");
    assertDeliveryEvidenceOperation(previous.status, "replace");
  }
  if (requestedStatus !== record.status && !canTransitionCorrespondence(record.status, requestedStatus)) {
    throw new Error(`Delivery evidence cannot move correspondence from ${record.status} to ${requestedStatus}.`);
  }
  const { data, error } = await input.client.from("lcdbo_correspondence_delivery_evidence").insert({
    record_id: recordId,
    dispatch_event_id: dispatchEventId,
    evidence_type: optionalText(input.formData.get("evidence_type")) ?? "delivery_note",
    file_path: filePath,
    file_name: fileName,
    file_size: fileSize,
    mime_type: mimeType,
    file_hash: fileHash,
    receiving_person: receivingPerson,
    delivery_note: note,
    captured_by: input.actorUserId,
    supersedes_evidence_id: supersedesEvidenceId,
    status: "active",
    malware_scan_status: filePath ? "pending" : "not_required",
    metadata: metadataWithGovernance({
      evidence_source: filePath ? "private_storage_reference" : "operator_attestation",
      malware_status_contract: "pending evidence is private and must be scanned or explicitly marked not_required before operational reliance",
      replaces_evidence_id: supersedesEvidenceId,
    }),
  }).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to record delivery evidence.");
  if (supersedesEvidenceId) {
    const supersede = await input.client.from("lcdbo_correspondence_delivery_evidence").update({
      status: "superseded",
      invalidated_by: input.actorUserId,
      invalidated_at: new Date().toISOString(),
      invalidation_note: `Replaced by evidence ${data.id}`,
    }).eq("id", supersedesEvidenceId).eq("status", "active");
    if (supersede.error) throw supersede.error;
  }
  await input.client.from("lcdbo_correspondence_dispatch_events").update({
    status: optionalText(input.formData.get("dispatch_status")) ?? "delivered",
    delivered_at: new Date().toISOString(),
  }).eq("id", dispatchEventId);
  if (requestedStatus !== record.status) {
    await transitionCorrespondenceRecord({
      recordId,
      toStatus: requestedStatus,
      actionType: "delivery_recorded",
      actorUserId: input.actorUserId,
      note,
      metadata: { evidence_id: data.id, receiving_person: receivingPerson },
      client: input.client,
    });
  } else {
    await input.client.from("lcdbo_correspondence_workflow_actions").insert({
      record_id: recordId,
      document_version_id: record.current_version_id,
      action_type: "delivery_recorded",
      from_status: record.status,
      to_status: record.status,
      actor_user_id: input.actorUserId,
      note,
      metadata: { evidence_id: data.id, receiving_person: receivingPerson },
    });
    await recordCorrespondenceEvent({ actorUserId: input.actorUserId, programmeId: record.programme_id, recordId, eventType: "delivery_recorded", fromStatus: record.status, toStatus: record.status, metadata: { evidence_id: data.id }, client: input.client });
  }
  return data;
}

export async function transitionCorrespondenceDeliveryEvidence(input: {
  evidenceId: string;
  action: "invalidate";
  actorUserId: string;
  note?: string | null;
  client: Client;
}) {
  const { data: evidence, error: fetchError } = await input.client
    .from("lcdbo_correspondence_delivery_evidence")
    .select("*")
    .eq("id", input.evidenceId)
    .single();
  if (fetchError || !evidence) throw fetchError ?? new Error("Delivery evidence not found.");
  assertDeliveryEvidenceOperation(evidence.status, "invalidate");
  const record = await getCorrespondenceRecord(evidence.record_id, input.client);
  if (!record) throw new Error("Correspondence record not found.");
  const { data, error } = await input.client.from("lcdbo_correspondence_delivery_evidence").update({
    status: "invalidated",
    invalidated_by: input.actorUserId,
    invalidated_at: new Date().toISOString(),
    invalidation_note: input.note ?? null,
  }).eq("id", input.evidenceId).eq("status", "active").select("*").single();
  if (error || !data) throw error ?? new Error("Unable to invalidate delivery evidence.");
  await input.client.from("lcdbo_correspondence_workflow_actions").insert({
    record_id: evidence.record_id,
    document_version_id: record.current_version_id,
    action_type: "delivery_evidence_invalidated",
    from_status: record.status,
    to_status: record.status,
    actor_user_id: input.actorUserId,
    note: input.note ?? null,
    metadata: { evidence_id: input.evidenceId },
  });
  await recordCorrespondenceEvent({
    actorUserId: input.actorUserId,
    programmeId: record.programme_id,
    recordId: evidence.record_id,
    eventType: "delivery_evidence_invalidated",
    fromStatus: record.status,
    toStatus: record.status,
    metadata: { evidence_id: input.evidenceId, note: input.note ?? null },
    client: input.client,
  });
  return data;
}

export async function createDeliveryEvidenceDownloadUrl(input: {
  evidenceId: string;
  actorUserId: string;
  client: Client;
}) {
  const { data: evidence, error } = await input.client
    .from("lcdbo_correspondence_delivery_evidence")
    .select("*, record:lcdbo_correspondence_records(programme_id,status,reference)")
    .eq("id", input.evidenceId)
    .single();
  if (error || !evidence) throw error ?? new Error("Delivery evidence not found.");
  if (!evidence.file_path) throw new Error("This delivery evidence has no private file attached.");
  assertDeliveryEvidenceOperation(evidence.status, "download");
  const signed = await input.client.storage
    .from("lcdbo-correspondence-documents")
    .createSignedUrl(evidence.file_path, 300);
  if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error("Unable to create private evidence download URL.");
  const record = asOne(evidence.record) as { programme_id: string; reference: string; status: string } | null;
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: "lcdbo.correspondence.delivery_evidence.downloaded",
    entityType: "lcdbo_correspondence_delivery_evidence",
    entityId: input.evidenceId,
    scopeType: "programme",
    scopeId: record?.programme_id ?? input.evidenceId,
    metadata: {
      record_reference: record?.reference ?? null,
      evidence_status: evidence.status,
      malware_scan_status: evidence.malware_scan_status,
      expires_in_seconds: 300,
    },
    client: input.client,
  });
  return signed.data.signedUrl;
}

export async function recordCorrespondenceResponse(input: {
  formData: FormData;
  actorUserId: string;
  client: Client;
}) {
  const recordId = requiredText(input.formData.get("record_id"), "Record");
  const record = await getCorrespondenceRecord(recordId, input.client);
  if (!record) throw new Error("Correspondence record not found.");
  if (!record.response_required) throw new Error("This correspondence does not require a response.");
  if (["closed", "cancelled", "revoked"].includes(record.status)) throw new Error("Terminal correspondence cannot receive new responses.");
  const { data, error } = await input.client.from("lcdbo_correspondence_responses").insert({
    record_id: recordId,
    response_reference: optionalText(input.formData.get("response_reference")),
    response_summary: requiredText(input.formData.get("response_summary"), "Response summary"),
    response_document_path: optionalText(input.formData.get("response_document_path")),
    received_by: input.actorUserId,
    metadata: metadataWithGovernance({ response_channel: optionalText(input.formData.get("response_channel")) ?? "manual_register" }),
  }).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to record response.");
  await transitionCorrespondenceRecord({
    recordId,
    toStatus: "response_received",
    actionType: "response_recorded",
    actorUserId: input.actorUserId,
    note: optionalText(input.formData.get("response_summary")),
    metadata: { response_id: data.id },
    client: input.client,
  });
  return data;
}

export async function updateCorrespondenceResponseExpectation(input: {
  formData: FormData;
  actorUserId: string;
  client: Client;
}) {
  const recordId = requiredText(input.formData.get("record_id"), "Record");
  const record = await getCorrespondenceRecord(recordId, input.client);
  if (!record) throw new Error("Correspondence record not found.");
  const action = optionalText(input.formData.get("response_action")) ?? "require";
  const reason = requiredText(input.formData.get("reason"), "Reason");
  const responseRequired = action !== "waive";
  const responseDueAt = responseRequired ? requiredText(input.formData.get("response_due_at"), "Response deadline") : null;
  const { data, error } = await input.client.from("lcdbo_correspondence_records").update({
    response_required: responseRequired,
    response_due_at: responseDueAt,
    owner_id: optionalText(input.formData.get("owner_id")) ?? record.owner_id,
    updated_by: input.actorUserId,
    metadata: {
      ...(record.metadata ?? {}),
      response_expectation: {
        action,
        reason,
        updated_by: input.actorUserId,
        updated_at: new Date().toISOString(),
      },
    },
  }).eq("id", recordId).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to update response expectation.");
  await input.client.from("lcdbo_correspondence_workflow_actions").insert({
    record_id: recordId,
    document_version_id: record.current_version_id,
    action_type: action === "waive" ? "closed" : "updated",
    from_status: record.status,
    to_status: record.status,
    actor_user_id: input.actorUserId,
    note: reason,
    metadata: { response_required: responseRequired, response_due_at: responseDueAt, response_action: action },
  });
  await recordCorrespondenceEvent({
    actorUserId: input.actorUserId,
    programmeId: record.programme_id,
    recordId,
    eventType: action === "waive" ? "response_waived" : "response_expectation_updated",
    fromStatus: record.status,
    toStatus: record.status,
    metadata: { reason, response_due_at: responseDueAt },
    client: input.client,
  });
  return data as LcdboCorrespondenceRecord;
}

export async function createCorrespondenceRelationship(input: {
  formData: FormData;
  actorUserId: string;
  client: Client;
}) {
  const sourceRecordId = requiredText(input.formData.get("source_record_id"), "Source record");
  const targetRecordId = requiredText(input.formData.get("target_record_id"), "Target record");
  if (sourceRecordId === targetRecordId) throw new Error("A correspondence record cannot be related to itself.");
  const sourceRecord = await getCorrespondenceRecord(sourceRecordId, input.client);
  if (!sourceRecord) throw new Error("Source correspondence record not found.");
  const targetRecord = await getCorrespondenceRecord(targetRecordId, input.client);
  if (!targetRecord) throw new Error("Target correspondence record not found.");
  if (sourceRecord.programme_id !== targetRecord.programme_id) throw new Error("Related correspondence must belong to the same programme scope.");
  const { data, error } = await input.client.from("lcdbo_correspondence_relationships").insert({
    source_record_id: sourceRecordId,
    target_record_id: targetRecordId,
    relationship_type: optionalText(input.formData.get("relationship_type")) ?? "related_to",
    note: optionalText(input.formData.get("note")),
    created_by: input.actorUserId,
  }).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to create correspondence relationship.");
  await recordCorrespondenceEvent({
    actorUserId: input.actorUserId,
    programmeId: sourceRecord.programme_id,
    recordId: sourceRecordId,
    eventType: "relationship_created",
    metadata: { relationship_id: data.id, target_record_id: targetRecordId, relationship_type: data.relationship_type },
    client: input.client,
  });
  return data;
}

export async function generateCorrespondenceNotificationJobs(input: {
  actorUserId: string;
  programmeId: string;
  client: Client;
  now?: Date;
}) {
  const { data: records, error } = await input.client
    .from("lcdbo_correspondence_records")
    .select("id,reference,status,due_at,response_required,response_due_at,current_assignee_id,owner_id")
    .eq("programme_id", input.programmeId)
    .limit(500);
  if (error) throw error;
  const planned = planCorrespondenceReminderJobs((records ?? []) as LcdboCorrespondenceRecord[], input.now ?? new Date());
  if (!planned.length) return [];
  const payload = planned.map((job) => ({
    programme_id: input.programmeId,
    record_id: job.recordId,
    job_type: job.jobType,
    idempotency_key: job.idempotencyKey,
    recipient_user_id: job.recipientUserId,
    scheduled_for: job.scheduledFor,
    metadata: metadataWithGovernance(job.metadata),
  }));
  const { data, error: insertError } = await input.client
    .from("lcdbo_correspondence_notification_jobs")
    .upsert(payload, { onConflict: "idempotency_key" })
    .select("*");
  if (insertError) throw insertError;
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: "lcdbo.correspondence.reminder_jobs.generated",
    entityType: "lcdbo_correspondence_notification_job",
    entityId: input.programmeId,
    scopeType: "programme",
    scopeId: input.programmeId,
    metadata: { planned_count: planned.length },
    client: input.client,
  });
  return (data ?? []) as LcdboCorrespondenceNotificationJob[];
}

export async function sendCorrespondenceEmailDispatch(input: {
  formData: FormData;
  actorUserId: string;
  client: Client;
}) {
  const recordId = requiredText(input.formData.get("record_id"), "Record");
  const record = await getCorrespondenceRecord(recordId, input.client);
  if (!record) throw new Error("Correspondence record not found.");
  if (!["signed", "ready_for_dispatch", "dispatch_failed"].includes(record.status)) throw new Error("Only signed correspondence can be emailed through dispatch.");
  const to = requiredText(input.formData.get("to_recipients"), "Recipient email").split(",").map((email) => email.trim()).filter(Boolean);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to.length || to.some((email) => !emailPattern.test(email))) throw new Error("Enter valid recipient email addresses.");
  const finalPdf = await generateCorrespondenceFinalPdf(recordId, input.client);
  const payload = {
    recordId,
    reference: record.reference,
    to,
    cc: optionalText(input.formData.get("cc_recipients"))?.split(",").map((email) => email.trim()).filter(Boolean) ?? [],
    subject: requiredText(input.formData.get("subject"), "Email subject"),
    body: requiredText(input.formData.get("body"), "Email body"),
    senderIdentity: optionalText(input.formData.get("sender_identity")) ?? "LCDBO Joint Secretariat",
    attachments: [{ filename: `${record.reference.replaceAll("/", "-")}.pdf`, content: Buffer.from(finalPdf).toString("base64") }],
  };
  const adapter = createCorrespondenceEmailAdapter();
  const result = await adapter.send(payload);
  const { data, error } = await input.client.from("lcdbo_correspondence_email_dispatch_attempts").upsert({
    record_id: recordId,
    idempotency_key: result.idempotencyKey,
    provider: result.provider,
    provider_message_id: result.providerMessageId,
    sender_identity: payload.senderIdentity,
    to_recipients: payload.to,
    cc_recipients: payload.cc,
    subject: payload.subject,
    body: payload.body,
    status: result.status,
    attempted_by: input.actorUserId,
    metadata: metadataWithGovernance({ reference: record.reference }),
  }, { onConflict: "idempotency_key" }).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to record email dispatch attempt.");
  if (result.status === "sent_to_provider") {
    await recordCorrespondenceDispatch({
      recordId,
      actorUserId: input.actorUserId,
      channel: "email",
      trackingNumber: result.providerMessageId ?? record.reference,
      note: `Accepted by ${result.provider}.`,
      providerAccepted: true,
      client: input.client,
    });
  }
  return data;
}

export async function generateCorrespondenceDraftPdf(recordId: string, client?: Client) {
  const supabase = await clientOrService(client);
  const record = await getCorrespondenceRecord(recordId, supabase);
  if (!record) throw new Error("Correspondence record not found.");
  return await createCorrespondencePdf(record, { mode: "draft" });
}

export async function generateCorrespondenceFinalPdf(recordId: string, client?: Client) {
  const supabase = await clientOrService(client);
  const record = await getCorrespondenceRecord(recordId, supabase);
  if (!record) throw new Error("Correspondence record not found.");
  if (!record.issued_version_id || !record.verification_record_id || !record.final_pdf_path || !record.final_pdf_hash) throw new Error("Final PDF is unavailable until the immutable issued document is stored.");
  const storage = await createServiceRoleSupabaseClient();
  const downloaded = await storage.storage.from(CORRESPONDENCE_DOCUMENT_BUCKET).download(record.final_pdf_path);
  if (downloaded.error || !downloaded.data) throw downloaded.error ?? new Error("Stored final PDF is unavailable.");
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (correspondencePdfHash(bytes) !== record.final_pdf_hash) throw new Error("Stored final PDF failed its integrity check.");
  return bytes;
}

export async function getPublicCorrespondenceVerification(input: string, client?: Client): Promise<PublicCorrespondenceVerification | null> {
  const supabase = await clientOrService(client);
  const tokenOrReference = normalizeVerificationInput(input);
  if (!tokenOrReference) return null;
  const byToken = await supabase
    .from("lcdbo_correspondence_verification_records")
    .select("verification_token,canonical_url,document_hash,status,issued_at,record:lcdbo_correspondence_records(reference,subject,issuer,issued_at)")
    .eq("verification_token", tokenOrReference)
    .maybeSingle();
  if (byToken.error) {
    if (isMissingLcdboCorrespondenceSchema(byToken.error)) return null;
    throw byToken.error;
  }
  const row = byToken.data as any;
  if (!row?.record) return null;
  const record = asOne(row.record) as { reference: string; subject: string; issuer: CorrespondenceIssuer; issued_at: string | null };
  return {
    reference: record.reference,
    subject: sanitizePublicCorrespondenceText(record.subject),
    issuer: record.issuer,
    status: row.status,
    issuedAt: record.issued_at ?? row.issued_at ?? null,
    documentHash: row.document_hash,
    verificationUrl: row.canonical_url,
  };
}

export function correspondenceCsv(records: LcdboCorrespondenceRecord[]) {
  const rows = [
    ["Reference", "Issuer", "Direction", "Status", "Subject", "Owner", "Updated"].map(safeCsvValue).join(","),
    ...records.map((record) => [
      record.reference,
      record.issuer,
      record.direction,
      record.status,
      record.subject,
      record.owner?.full_name ?? record.owner?.email ?? "",
      record.updated_at,
    ].map(safeCsvValue).join(",")),
  ];
  return rows.join("\n");
}

function emptySummary(): LcdboCorrespondenceSummary {
  return { total: 0, awaitingApproval: 0, awaitingSignature: 0, readyForDispatch: 0, sent: 0, overdueResponses: 0, myQueue: 0 };
}

function summarizeCorrespondence(records: LcdboCorrespondenceRecord[]): LcdboCorrespondenceSummary {
  const now = Date.now();
  return {
    total: records.length,
    awaitingApproval: records.filter((record) => record.status === "awaiting_approval").length,
    awaitingSignature: records.filter((record) => record.status === "awaiting_signature").length,
    readyForDispatch: records.filter((record) => record.status === "ready_for_dispatch").length,
    sent: records.filter((record) => ["sent", "delivered", "acknowledged", "response_received", "closed"].includes(record.status)).length,
    overdueResponses: records.filter((record) => record.response_required && record.response_due_at && new Date(record.response_due_at).getTime() < now && !["response_received", "closed"].includes(record.status)).length,
    myQueue: records.filter((record) => ["in_review", "awaiting_approval", "awaiting_signature", "ready_for_dispatch", "dispatch_failed"].includes(record.status)).length,
  };
}
