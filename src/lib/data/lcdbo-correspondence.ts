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
      name: signature.signature_role.includes("rmrdc")
        ? "DG, RMRDC"
        : signature.signature_role.includes("roseate")
          ? "CEO, Roseate Forte Nigeria Limited"
          : "Authorised Signatory",
      organisation: "",
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
    subject: `[LCDBO] ${reference} ‚Äî action update`,
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
     -˘Ûo-¢Gß≤⁄Óù∆≠y›…A(ÂΩƒ≠≈≈≈¡Èe’›ÖL—Iê≈…Q¡Õ!‰Õ,Ã·…º…]≈,Ÿ∏›E!Y]ïQ¡®Âi≠Õ†Õ±µQëie’]Õ—]¡°çi»Ω=±1Q±âËÕI≈Ö—ë!i<·π…!¡Yë¨≈]Y·e—YµQÈ…•IÕµ°µEQ¥ÂMµ©9ŸêÕ—1ŸôE	0Õ!	ô1a@Ÿa9¡)‘≠ç≈i¡1M…ç∞–…Â5¥≈’≠ÖQ4≈$Õë9Â°5=Ë—–’5Â’Q≠¡iXŸ1T≈=ÃŸÂ$·±—•I%h·…eâ≈ê≠Ÿô)-‰≈â1%—¿Â›,ÂËΩ	Yç9Yï›D’1≠-\ÕU≠±ç∞≈·¡<ÂâQà≠π-\—±Aï9),ƒ¿Ÿ§…•çiI±eIY%—…çEú¡≠¡I(Õπ—I≈ïµ¿≠=°î‡Âçùi∞·Mç)•LÕ%©—Ωú’A0’≈]≠’<›Mïê’1iµ¡—-≠≠I’êÕaa·——Âi]a¡Ω-•∞≈—L≈9≠Ω©]©D≈$ƒŸ±»—Ö∞Â%ÿ––»»…¡··I%âEI≈]—HŸI—µh¨—	a=$…!ÿ≈Uƒ¡â∏Ÿ‹—≠©Õ©•’\ŸL≈A≠±¡D¿Õ–Õ‘‹¡-)M9°!’1≈EŸ9·=ieA§’°¨—Ω»·8‰‘Ÿ	$›UM¡·ÕA99—’IML…±¨Ÿ±‰‘›®¡%•A›5Q9µº≈1	Ei9M`›1È±a$‘Õiπi±9-M¡–≈±›’’‡≈¡i)]ùÈ%Â5—LŸ∞≈)¡›±-›‘·±·ïaEQ¡µEUÖYŸU]1°@’Y•\≈-Â≠-Pƒ›ëâ`·UÕ©MI…âAEπ—Ad—Iç%ÖÈÂ•Ÿ•…Iî·M ’@’UEïI%¿‘»–»≠E—1•UD—5°…Ñ»Âa¡…i!›‰Õ¥Õ≈-Mâ•aUµi•U…	≠——©ë=’’¥≠ë18›5\Ÿ’A=ŸÃ¡‡Ÿ†Ÿ%çIiâL›9±Õ•©Ÿ·±±M≠±πΩMi¡9)ëE›©i·±±d‡Ω’Öi‘·I…¨Âie‰—µE¡·—ÈôÖ,‘≈iMQT…i-%¥≈=ù9ôçD—]’ô±aπ∏·—T—ŸAQÖùAEâ•—‡¡iççë$Â)°‹≈…X¡ÂAE·πaâ•¡·çi›!d≈ï’ô≠	•1h·‡Õ•·©·%Pƒ≠	â©’1@Ÿ¨ÂÕXΩ›°∏ÕA@ΩçπÈ±Ã›·≈·È·Qùd›©©ëŸµ—i’∞…µa=9—…\‡·––Â`Õ•e•)1YÈEŸ°ôâ·!–¡UIQ$’E®·≈È‘≈ï……∞»Â’Ω’=·Öë©∏…8¡5¡’â≠	ΩUi%M∞ŸH¡I)Mπô1Eïµ¡ô≠)]Y≈ç‘¡=Õ±e’Ÿ¡—âUI]µŸA]0¡‰»’ë±!≠Â!=â`ÕUM]]·UÃ≠ï›Ö!–’µÖQ1çî—•5	¥—±QaÕÃ—Yå¡‰Õ≠Q•µ∏·Â’U%iô≈ƒ»Õâ$¡Â!ƒ’)—µ©Èƒ—°IΩÂP’MëP≈AΩ≈8ƒ–’©—i®≈9!≈-·	Ω•·•AD≈ƒÕ’1]ºÂÈ©…≈ËŸ…çç]i≈]ºΩÈ•Q	%-È$—Ωç9$¡†…9)‰…µe≠51T»·‰’eIU…E—(Ÿ-M¡)’iI±ΩiÿΩM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·EÂ1!Ë‘’UòÕ±ΩAM·›Ã≠ïY ‰’IA·¡Õç1Aπ±HΩïUP·E	4¡µH–ÂôH≈ÂÖ<¡•]Õë¡ô1çï°A—Â)a¡…—9QM±HŸHŸ)	’ôÃ’]0…çÖÕIÈiË¡ëÖ]ë·$’µ¡ë\‰‘Ÿ¨≈±≈≠®Âùµπµ9ƒƒ¿…¥…Â‰ΩaÂ’‹¿›¨Ω1Ö$Õ¿≠ë=YÈ—AÕï5—MM°ú–‘ŸçÃ¨ÂŸ%Ë·ƒƒ¡I•A∞Ω±π¡-â≠=çE’a¨»·†≠—°ŸY¡ÂM°I—‰¡5ÂºŸA=¡›))Ö≠±!Y%iï%—’•TŸ¿Â¡’µπâËÃº¡π-Yùi°≠¥≈,…â—Y9›(¿≈È-’—âÑ…π=Q-ë1ÈΩ…aD¡--Aî·L‹ÿ≠µµ°…¡âd·ïÖçΩùÂ8…eï]Y·ôMadÂIŸÕπçëïTÕÈiiÕ%°)ë%’¥›ÕÈ©µ¡(·9	ÖÖ=ïA!%•X—›9ïia]1a9Ã’âY°ï‹…¡ia-]±ÈÈâ%ô°)@≈≠Öµ±π—±AÕQΩô•eÈ’Öeµ%·‰≠≈eX…πô¥≈MÃŸÂï4›ôùe’‰≈aA›ï]Ñ¡=%¡-πµ≈eiçAD¡¡-å≠…UÈ1a’µ0≈I!’·ÂËΩµM!D’Ñ·D……’QE5`¡°U•QÑ¡Uô—Ÿ1E¡ç¿≠›9—]—·-%µïÈ9)çE®—¡≈%Ÿ‹¿¿—ËŸºÕe±)1Õ-›·5<¡±]UÈ%Õ©aE—’L’âôÖd·M¡•’Ωë≠-ï`—=ÖIÖ≈YΩïµ°≠I∏–…≈©==≠i%aQ<¿…QôÖEÂâQ——…î≠â-(ŸÈHºÕú’……â5–≈=∏ÿ¡åÕXÂAe5âò–‡≠\Ÿh’(»’ç…µâ±µÂIAeâ•e±≠‘Õë—$≈)D·›±Q1¡ï·M…YÖ ≠≈ΩÂÖd·A91YÂë9Ñ—aEÖ∞’–’»≠¿Ÿ’·1ë%•Ö=a≠ë•ôπI@·Q°Èïò·i1`Õ©¿Ω…Ë’h≠≠,≠e]=¡Ö¨·iÕπ¥≈•§›	≈ƒŸ’—QâPÕ!1)Õ†¡•9ië1i©’%)aaU—·=ï»·51ï1eeÂM≠Ö-ô≠!’0‡‘ÿ›·’`’•ÂΩQ—â•]Âë°Q•1¡ÕÕ%πëL‰ÕëU¨—I¡çP›Öë	‘›Â≈…’L»‡Õ•]!E¡UM9`Õ,ŸIa9‡…›°EÈA≠Õ’M…ïôà‹Ÿ≠M•Ñ≠4¡â©1≈I≠©1%T≈Y©π±aë–Õ=X…·Qµº‘–≠iç¡0Â‰Ÿ•,»—TÂ©È≠Ö›ÖYΩEΩŸùÈMÖ•5M±!]aA©!YU9‹Â)ôaY–¿≈1Y‹—·Q\»≈==LÕ1I9î’eŸ…±–‰≈PŸ]!±))iµπÖÖY ››°≠!ô9≈ï’I5¡)Öâµ-ïA\‡‰≠å…•—≠A9’ÕMÂee±Ωë°Ω-,ŸUåÕ\≠e±)Öâ9·µIƒŸ1—°çâ$ΩM\’)πÈ1’·≈(Â!Ã—U†Â·MÖ·µL‡—Öie¥»¡99…eâÖµÂa≈¡)âùQ%µ-<·µd–’5…à≠≈ç∞…≠µYYUçiY°ôQµâ4‰ÿ—4’	%TÕâL–‘Õ∏≈ŸŸ)›ΩiI±d·`—]\‹›U°≈1’0¡5È∞Â≈≈d‡‘…âÖÈ5ê≈±’ëÖ1U—âQ-‰…·X¡%Ë≠Ÿµ%¡≈’……≈’Ÿe»ÿ…4ÕùI¨·’AiMM¡)0…)MaE°-]]…5©°ô‹¡≠Â!i5π≈h≠D≠—Q©ÈÈ±ôU—Ñ≈!≈¡M±…iµiµï¡µe»ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››¡P·1AµâHΩëÕP·5ÂΩË’¥¡òÕâΩAIA›Ã≠i— ‰…·A››ÈMd’®≈!aºŸ’)YHÕX···µ‹Õ!E¡ïµ¥–¡—)MIπΩI≈≠E!·MMU¨¡∏—]°ù-Yh·1≈aÕ±ïÈ®›QX’ÕI5eie9…πI!$≈•`‘…‹≠È’QŸE—i)å·ô]P›©5ÖTÕ5%›≠,Õ†Õ•Õ=Õ≈%L—P‘¡≈ë%©Â§¡UMË…µ—ô®ƒÕ≈âMhÿÿ≠	)…≠‹’ƒ—å—5¡°Ÿ]-—5≈ïY—%)M9ê‡’AUπËƒ≠5`…%…±=!i›!—I·§¿¡Y…Õ¡M%I9±º…·)Y’ïâ%ŸÖÕÈA`ŸË‰—Ñ’I°πU=AUµ@≈©ëaM‹»—5	πa±‡…§¡M]Ÿ®Â)•)π-aQ·1Ωë•YÈ1U-ÈTÿ’e‡Â’≈ ≈A±ºŸâ°,ƒÕâÂAI]Ÿ•i!—‹ΩÑ…Aa‡—9Ö›‰≈Y-9Â’%§≈9±ÖµÈÖ9MQATÂQâUÖëôê¡ÈY5©≠çA5)≠Õ=Õ@¡Õh≈∞≠‹‡·A%UπU±ÈËº››»Õ…,’a≠)d’≠Q1Õa—P…eÂ©a!D›…Ω°I¿»›¨ŸÖÖ!Ωï° ›¡…µ=E‡—’	e°¡¡ë-È]9ïâ)·µe›…ç…µ¡%•MMY≈Ui≈UI)%•%©A›Ñ’πµeê¡©Õi¨ƒ·’ô…µπ%Yd—∞ŸŸeY…Ω‰—ù©M°âôaΩ¡)-5≠∏›Ae$≈Mei±AL≈Y9-Y·\—çY)≈aÂµ§¡1çÃÂY-@…µi∏—µeQ=Iπ!ÈEùQÕ’]Q¡Ñ’ÈëÖYii»ÂÖÂ≈π!ÑŸMh¨‡Õe•µY-@¨Â≈%›ed›A•È•µôe4ÕÂ°A·\ÕaeT≈)ô—µI`ÕΩÖΩeçŸÂÂiÖDΩ∏ƒ…Ö@ÂÈU5∏Â≈eΩ±1¿Â≠1ÂU-Iï‰›a%¥≈Öâ9…eÂaµ9Lº·ÂÂ9IËƒ≠±ÕI°…¿Ÿ-µ¡eMe9I	e…ΩÖAY©·\¡5ººÕUIÖ•UÃÕEù ¡	H·≠È©$—µÖ%·ï©¿…âE≈Ÿ-·9à¡©≠êÕµ…â9A≈-0—¡î¡YµêÕ)çÿ≈IaΩ¡©<…a-¥—≈UP≈)Õ…ËΩÕMIaÂ±XÂ°çAµ≈Q)P·YŸ±≠Öπ9ôiΩ∏… ÂeIUµ©§Ÿë=ÖŸë·=òŸL· ·Èπà≠ëUë•L‰…eË…<‡Õ∏º≈ô$»‡›êÂ¡9U0¨¿»·iÈÕÂ4Â·≠Ÿ°]1Y•°U=›≠±	•=âaÕMYÑŸ9¨¿›≠ƒŸô%°=≈··4‘…πh¡È’)›Ÿ≈±]•]Â©MQ°Aë‡≈I±%MI≈9ŸI-5Ë¡Môù$≈E•…•âçå‘Ÿ5ï–—»·@›-ëù‹›i1≠≈e…±‡¡¿≠©Yï’µ‹≈1E±-YëAYUi’Öï1—È=%πµÂµ=%ï@Õ¿¡QYº…≈È)·Q!,…’úÕT≠Ã…Q¡¿’I…0ÂU±Ö•ëU1··…Qπê¿≠±Ω=πµŸÈ≈π—ŸÖEÈI‰Õ—¡AΩ4¡¥…¡ÈiÕ$ÂMAQT≠ŸÕÖΩXÂ≈–’·πê·›π•YiÑÂÖ9E≠-Ö=—≠…e%∞ÿŸ’9¿Ÿ‹—MMU…aI=’ŸŸµ…)d—•1µçïÕ’)]M¡ÂLΩ≈Ö’π•MÖ!±å‘≠I9-5Ö•ëi(ÕΩM≠a—5ŸI≈iYçQY≈µ%•AêŸ¡ÿ—–—µŸ≈¥≠—a©…—≠…U·91®›π›M©L’ΩQM-9-Q0≈—’ùπaÂA¡Ö%≈πâ1‰Õ§Õƒ’—¿¡4…L››’d≈%\———±1Iπ—M…ç°–¡Ë≈Y≈]°ïπUI9Ö–›§—¡µ%©ôU’YYî≈Y≈’]•	%(ÂÂ·≈95M≠±ô	Ÿ$Âi!U§ƒ¿≠ùa‰ŸÖâ≠YçŸ	πù’%â5àÂïAeŸhÕÖM≠-»…A›Ö—¡,»≠ÈëΩïù•≈çEÈ‘ƒŸ-iπÂëL’E’µ›µi≠≈d’A1•‹¨ƒÂµ9\¡®›¡,»›—‰Ω’YQ•5Ω…’eº≈,Õ—µ`›4≠©I≠Y•	aiÖ\ÿ≠ô!≠¨≠I=’(ÕΩLŸú¡Ω9=¡î¡I≈åÂA≈i©Y%ƒŸ¿≠·%›≈âç!Q·â91±ùMπÂI‰Õ•E¡â@ŸI-!QEQÖÈQ¿—)UeπYÖ=)Ωµ…QπëdÂ·ï·\…¿›<Õ≠=ïà—Yi)Y!]â‘’M±(Õâ\≈≠MT≠1†≠Ÿµ%•’1ô¡YI4·Ω°-Ã·I55ï¡!1—’ÈH’—ië)†‘¿¡=)U†≈HŸ°âÖ≠¨—≠È4ΩÖ≠\≈EŸ!¡Öë]ë±•M¡,¡≠¡AY-§≈$ΩΩ5LÕôE	’—≠Ñ·â·]›Ÿ5)Y	EMÂe9]›±Ö…)A…Ö!¿ÿÕ’Q=X¨’ΩΩµ…Âd≠ÖiQ=Ω5EïÂ1-Öçi!∏—·…9!›M—8’¡5•Y≈ÖëIT—°ÿ›99¡ù‰≠%©Ii!IY5)±›9¡aiÈ)§Õ9•$·Iëïh—Ö ƒŸëQ%9\Ÿ¨·H‹¡I!©]âUçM5)’M¨ƒÂΩ†’U9¡U†·©DÿÃ·π·çIÈ¿’•L¿·UÖ°U1UçQIYÂπ≠©¨·h≠Ñ¡µâê¡Qµ†ŸâU5MY≈A‘›‘Ÿ±1i≈UI—µIë≈›¿›âÑ‡ΩÈiU…AƒÂU©©≈πd·Â≠1‰…¥’	’1Eï•âŸú¿›≈X›ÂY–¡U—8≠Aë·ŸQ’§·Mç!∞Õ-ÖïAÖ—’P≈’-eâMMa=]–≈A•°»Õ±-XÂ	-Yd—¥Õ4—È‘—E=-]µ·]I1Y1ÕÂM—Q1=\·MY=$ÂiÂMI‘≠©aU9U%¿—ƒÕ4—•ê¡ÈQ`ÂIë5=ÿ≈çù¡1Q1≈µ!YM§¡çàŸ-PÕ•1›·1]§’a)%Y›		YM1Õ5πÿŸT…âQMπ)0»›TÕ<¡Ã‡Õ≈]πQà—%±±IçÈYYP’eQΩ±≈`≠Md’µ≈=%©ïT–≠È≠9±Y±a≈Öµ=…à‹Õ=\—hÂ·-Ÿei≠·=a!ç–ƒ‰›…¡·Â›°AI9¨›ç=Aâ)±·!Õ¡IçπïMYç·5)I∏ΩP¡9iÖï·]∏¡ôM$¡5Ÿi-Õh»≈ÖÃÂ!T’›Ω‰’ëú’±A=°)Â)ëÕÈi±]≠¡ôd≠]›±MMà’µÈëŸAê≈Y–Ω›·9ºÂ≠…È»»≈ÖÃ–·—î—aπ9—®≈ç¿ÂYÖ¥›……±9‘Õi)âUâ±ºÕQ)…)<’M‘Ω≈Ö—Ÿ`ΩQ95—,›9Â≈µ=]≈-ÕΩï!›—È)Y±!Õ(ÕeÂêΩ-I‘·≠ΩÖç]¡)4Ÿ!’Mπçù©9IïπUI¡±±!ƒ’È=A‡’ê¡!°i≠È≈¡…YΩ9ç≈ëŸ!ëƒΩÈYïµ°Õô`Ÿï ≠%ÖAÈ]¿—]…àºÕ‰Ÿ-Qú’ï›5πeçôaô≈%—º’Ö9ÂYM)ô8Ÿπ’E≠ΩÂQEÂ±›®·XÂòΩ%%ΩYº—=≈-’µå≠@’5°È°â≠•Ω5°π]9Èaç≈aï)Aïò≠Ö≈UΩÂ0≈ô`‹Õ†Ω•®‡≈¿—]… Ω›·…Aù4’®Â±≠1å¡Ω‰ÿ…·Õi9©ôÖ]ºÕëi,Â·%Uú¡≠IâTΩP—§≈5eë§ÕYI9]ïUÈ±`›ôù›·ò’	∞¿¨ÕL¡I]·‡≈UÕ—±Ÿ›—¡ù≠-9Mï°Ö¡A†ƒ≈%X¡å…9ô	ÑŸ≈¡π‡’$Ÿ‰—ai—9§–Ω1UU%…Mπ•AYË·YµLΩi\…Ω—Õ¥ÕΩ]¨≠ŸôH¡$Ω›I¡±πY›—ç·Q<…e©â°ç91M)›â≠!-A©°Mπ¨…¡›¨›∏≠Ÿ›)=ç·I±‘ƒ·YòΩE\¿·µÕç95Ö@≠-Â…YπQç·Y†≈°P¨≈’’MÖπMâaÕ±’T·iëïiÃƒ·=µΩπëÿ··5QÂÈ±ÈπAh·aπQÕ5Ö’Y—ç®≠h≠Ö–¡–›hŸë¡8ΩQ›Uaai–ΩÖŸÖ¡’à—‡¡)Ë…ô‘¿›…±âadΩµôµ…ë1î¡ïπÖQò¿·ƒ…âò…°’Q9Èô=°=ïË¡Ÿ=ôed≈ç…Ñ› ·Ë‡≈â¡à…®¿›Eà≠πùΩ’’Èà¨¡9Âî‡Õ·©ΩQπÃÂ1È∏…9a,…’·Â≈=Ö–¡–›(ŸëΩ8ΩQ›Uaai–ΩÖ’Aïà—‡¡)Ë…ï∞’Ë›…±âaµ≈=Ö–¡–›(ŸëΩ8ΩQ›Uaai–ΩÖ’XÕ¥≠5ëåÂπ¡ïå≠›·ƒ’\ƒ’ù≈©µ…ë1ïÂïπÖò¿·ƒ…âò…°’PÕ¥≠5ëåÂπ¡ïå≠·Iƒ’\ƒ’ù≈©µ…ë1ï›ïπÖò¿·ƒ…âò…°’PÕ¥≠5ëåÂπ¡ïå≠·Iƒ’\ƒÂù≈©µ…ë1ï›ïπÖò¿·∞ƒ…âò…°’PÕ¥≠5ëåÂπ·ïå≠·Iƒ’\ƒÂù≈©µ…ë1ç›ïπÖò¿·∞ƒ…âò…°’PÕ¥≠5ëÑÂπ·ïå≠·Iƒ’\ƒÂù≈πµ…ë1ë!AQ—	ÿŸï‰ÿ›9ÿ›DÕ(›Èô=•I…∞’≈·ÕT…çëç±ÖA9L…QUâ≈¥ÂŸò’· ¡$‰Õ°¿›	,Â=…4‘’ïI…ù≈!Ãº…h’ º›¨—,ƒ·πA·ò·’ôIÈÂ]©µ`Õ=YQE©EU’ô]¡ii9‹Â≈9Âµ‰·Q%©≈5›µ’µÖ…ï$·±â®—IπYŸ%·’A≠!¥≠Ud…¡Â•1ëïôôëià…8ÿ›≠ΩM±A—5X¡‰‘—Õa-—=…-UQQç1å·iÈM…Ÿ1X≠94›=ôï≠MÈ±M’’9AÑ›9…L¿·—Õ≠ï¥≈%•-iÂÈº—\’…•≈ôô5ê—H’åΩ©±E…ë•)M§ÕYçY…ÂaaL’·…êÕ¥¿›Ωù©Ñ›Ÿù¡=ŸU9—QA≈ÈQ9<ÕA51	§…’a®Â)âAÕIƒ‰»·—i• ≈HÕπ¡P›a1QΩ∏—X‘’M±…ç)=ŸU•%]•π\≈i…Ω¡π±≈µï≈ÈPÕÃ’LÂea‡ÿÂQe•Q≈Èï\ŸM±Q9î≠∞›Q›Ñ¿·1≈(ÕëÿΩ°)ò—ù…ÈÃ·Ö’AM…≈Ÿ\‹≈∏º¡•a9@ŸŸeiëDÕIAïë=`≈)0Ω‘…ëµ©Y‡ŸE¥≈E8ÿÕïÃº·¡U’Öò¡Iô5’Ωâ¨‰‘¿’ôU≠ÿ·‘…ëµ©Y‡ŸE¥≈E8ÿÕïÃ‹≠±L’¿ΩI·U‰Ÿ°’PÕπQ∞ÂaÂLΩ·1—πiº≈çï≠)—Uï–ÕŸQÿŸY1µ∏Âa·Q1≈’Aïë=`≈ôi0Ω‘»Âµ©Y‡ŸE¥≈E8ÿÕîÂ<Ω¡U‘Ÿò¡Iô5’Ωâ¨‰‘¿’ôX·±@·E›à…Ö9a!¡ÖY`‹≈‘‰ŸêΩM¡ê¿·§≠-iëDÕ)¥‘¿’ôU±@·EL›à…Ö9]π¡ÖY`‹≈‘‰ŸàΩM¡ê¿·§≠-iëDÕ(›È¡‰≠¡-ò—ù∞»ÕÃ¡Ö—AM¡ëôŸ\‹Õ¡ÿ·M¡ê¿·§≠-iëDÕ(›È¡‰≠¡-ò—ù∞»›ÕÕÖ—AâÖ=ÿ’§ÕîÂ8Ω¡U‘ŸïIô5’Ωâ≠ÈåŸçŸ≈ÈƒÂÈ-—aË…e•-ŸÃ›I—1iUÃÕ‘¡∏≠µ%ÂA‘›@≈ôÖ(Õ]¿≈hÕ·°1]•∞·iÿΩi©òΩ›Ÿò·’≈	]Ÿ¨’ï8Ω±MÃÕeº‡Ÿ©-%Q’e≠·’TŸ∏Õ¡]©Öò≠	•ÈôÖç9ÖeI›ù’,ŸŸÂ	§ŸµΩa%πIA9Y\‡¡ºƒ·µ°)¨ÃŸ·(¿Ÿ∏≈0Ÿ	πQD—…A	ÈQ≈ππAù‡·L—H’!a!%Yeë¨’©DÂY›aUMiàŸ±…ëMiâ—!QL…‰ÃΩe)ºΩ•-âaYIÈ·Â‡—¨Ω°1ô’ea§ÂTÕ!ù’ÈÖY¡Öi(‡‘Ÿ<ŸQ§Ω©ÕMÂ5Ÿ!≈îÂÕ‹¡âôYQIQ…È=®·9ç–›9°1Y©AâπAU5µT’eÂç]Ö’T≠ú¡ΩD¡¡MëYµù®¿≈YΩ(¡ÈÃ¡©†ÿ·T‘Õ›·Ö…°â∞›1ë1EÂπe!µ≠—Ÿ=≈1	ÃÕ<≈=≠∞¿Õ≠8·Ã¿›Uπ≈ï•®ÕïÖ)Uº—]ŸÖπâQ’-ô°Y≠≠]©â1Âº»≠≈Ÿ)9±19-ËΩEA,≈QÃ›ŸY]πÕIET·1X›ŸM…,›ΩYπ…ëâƒÕ……	È—â)Q¡9ë•9aYïŸ©È—@…¨›ƒΩ•d·4‘≠©¨¨Ω·	1—a%©Y¿ŸQ≠)†›±‘ÂÑº–ÿƒŸò¿Õ’%’ùâ¡µâπQ∏Â‰Ω•aÖïI…P¡πΩQÕ1êÿƒΩ‡≈»º¿Õ’%’ùâ≠ÈåŸåΩΩAÿ·‘¿·•9]π¡AEµ)’\‹≈»Ω$ÿƒΩ›¥Â·¡çµâπQ∏Â‘Ω•≠å·µ9]π¡AEµ1’\‹≈»Ω©…`Ω¡ŸçIëÕ)¥‘¿‘ΩHÂïò—ùôπ!)©Y‡ŸP¡¡§›±‘ÂÑ‹–ÿƒºŸàÕaEQ’Q9È¡Ë≠ú‡Ω›EAÈ©≠·ƒ–Â(ŸU·ë‰Õï—ê·ëÑº·Qî—§Ÿ	’Q9È¡Ë≠ú‡Ω·Ω==Q…®¡Õ¡©â±‘ÂÑ‹—‰ƒºŸàÕaE9Âi’ë=ò¡!∏≠%!‹Ω-©Y‡Ÿ]U·—‰Õï—ê·iÑºÂ8›§·Õ)¥‘¿‘ΩPÂHƒΩ•·AÂº≈çï±ù±5ôç–Õ…aô]»ΩP¨—Ÿ9È9È¡Ë≠∏Ÿ©»Ω—â±Iƒ–Â1	-d¨’âŸ]–≠5—`≠∏Â·ïâΩÈåŸåΩ¿≠ºÿΩ·≠’UÖ’AM›)1’âŸ]–≠5—`≠∏≠©›çÈåŸåΩ¿≠ºÿΩ∏Ω‹Õ1©Y‡Ÿ]))dÕ1êÿ≈ŸaYÖÿÂ@—ëA9È9È¡Ë≠∏Ÿ©®≠ò·›Ÿ1©Y‡Ÿ]))d≈\‹≈…ï’ƒ≈òŸô‹ŸïâµâπQ∏Â@≈]5LÕUπºΩÖQπò‰≠ÃΩ›’5°]=ç’\ƒΩ9»≠ ’1Õ1=Ω!·Ö1MÖY≠M≠∏—¡A≈EŸIaEŸçYΩE—)¡]≠±)A·MôUù!%	·)U¡I)%±,Âia—APÕù=E=…ÈQMëÈ•ÂE`¡ù=π—â§º¡≈›0≠PΩ$‰‹Ω›%	¡e,≠4¿ƒÂ	¡ò≠=≈@≠E…ïUô…L≈ò›-UΩ›ÂU¨Â±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩë±ò·±âÿ…9ô›!i`Ω)\‹Â©`·…XΩ›Y‘ΩdƒΩëµò·i1êΩÖQ`·’ÂiÂôY≠)XΩôàΩ°9%	È)ÂA]iL—aŸâYΩò…,Ÿò≠%ÂQ=e9I)a≈ÂÃΩ	1°âôÕA›@Â°ù5ù1ËÕaË…·’©ôùçúΩΩe0»Ω`—=·µ%‰……ô¡ŸêÂ…ƒ≠≈Ÿ–Â∏›!ç—¡Y¡9-Â)MP·MA≈E›<ŸË≈•∏ÕòŸ°h‰ÃΩiA·PΩÂë…5°’’µ≈Y¿Ÿ1âA·%…ù·Ÿ‰Õ9ï≠i!H¡‰≠=»ÂPŸŸïÂ•%•1E’°—≠ùŸ)å≈µQ©h› ¡ïΩ»… ΩiXÂ	ù=â·A8›—9≈•AIÖ·MUa•EÕë–≈ÖÂDÃ≠µëAdÃÂ	∏—∏≠›’ΩÕÖÖD¿…±—!≈¿·!5eÈŸ›5°1·ôºÕ9Aô`·I`Ω≠ÂE5®—Mç—a·]›ºÕ±ê’`≠ù)	›ïÖLÿ¡——aùÕ—!$Ÿâ≠ë∞≠ÿ—0ΩŸ(Ÿ,Ω·%	›ùë]=hΩ]≈T‘≠›ËŸò≠!E	≠ù%›®…!â!=EŸÑ¡hŸ≠`≈±≈ò≠%i•º…I]Uô≈ΩM`…›E	·ÖYŸÖE»Âe•@›E!%dÂïhÂ©ÖMô•ù’]ò≈º›¿º·%	≠$…aç—H’µYÖÖ¿¿Ω·1U	≠·‘’%≠4º…’Ö∏Ÿ∞≠@Ω%•5	≠ùï=Ö»–¡¡!Ö!TŸ…ê≈`ΩÕµôêº·ΩÂ)a›Q©ç∏…$›…ÿÂ·a–Ωeï°ù5≠A54≈)Q!PŸËΩë@Ÿô!@›=ù%%•%—·!·MMUI¡U]¡ ¡5ùA!UâL≠Â’ —ôΩY ·i!‘≠—%)ça!9Ω9ÖË¡Mπ≈iù=≈=°i≈Y%ç1IÑ≠•U∏·Y!Õ0ÿΩÖeŸ!\≠›†’≈`≈¡Ua•H¨·ù!UµE—ΩÂâ±ëAe∞‹—≈Ÿ»ΩY5	≠ù…ïôâÖ1Yh≠A≈¡1≈i∏›•0…ù=¡Q©ÂÂëô1E¨Â\…ôêΩÖX›ËΩ=E)ô%±i]¡ —≠e ›,–ƒΩµÈµ·@ÂUŸŸ$Ωh›L¨¡›L≠®Â5›»¨‡ƒÕ‰≠ÈΩ»ΩÂ-ô·ë)¨’È’ Â•—!ç∞≈¡ô≈…)`≈!≈’i–Â!M’aHÿ›ÂΩ]Ωù!!—…hΩΩ≠=<ºÕUπ¿ΩŸ,¡PΩ•ôπ…∏ŸÕë@¨≠ÿ·°0Ω	ÈÖ©9—Ö§≈T—ô…=,Ÿ≈@ÂÿΩ≠›EÖƒΩÂëç<≠Tº·!·®≠U ≠Q…†ÕÂ∏Ωú≠5ôÂùΩÂëç<≠Tº··dΩ±Ω¨ÿ—ê·¿º—A© ·Ω@·πaŸ±@·›ô@’E≠¿·πôµM≠Â—1›5≈ô@’E∞–Õi5Y<…9≠—ù›≠Ÿ¥—=A%0Ω…%	≠±‹ŸÕ·5›—ÿÕ]†Ω±ù‹Ÿ<› ‘—\Ã›…DΩ›ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω1¡ê…AÈ›—ÿÕ]†Ω±ùŸ<› ‘—\Ã›…DΩÂ›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω1¡ê…AÈ›—ÿÕ]†Ω±ùŸ<› ‘—\Ã›…DΩÂ›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·1¡ê…AÈ›—ÿÕ]†Ω±ùŸ<› ‘—\Ã›…DΩÂ›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω1¡ê…AÈ›—ÿÕ]†Ω±ùŸ<› ‘—\Ã›…DΩ›ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω1¡ê…AÈ›—ÿÕ]†Ω±ùŸ<› ‘—\Ã›…DΩÂ›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω1¡ê…AÈ›—ÿÕ]†Ω±ùŸ<› ‘—\Ã›…DΩÂ›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·1¡ê…AÈ›—ÿÕ]†Ω±ùŸ<› ‘—\Ã›…DΩÂ›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω1¡ê…AÈ›—ÿÕ]†Ω±ùŸ<› ‘—\Ã›…DΩ›ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω1¡ê…AÈ›—ÿÕ]†Ω±ùŸ<› ‘—\Ã›…DΩÂ›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·ÕAHÕdΩA»ΩëÖ ≠]!º›Õôπ°âô’—Ω›Â!ë®‡·1à‰≈Ωò’eï©’‡≠ï–¨ÿ¡@·Õç·9iÖ‰¡a±—ΩΩŸççMù@º·—e-¥·Ö-ç…ë=—!¡M§·ïƒ·âç@··YMeΩÂëç<≠Tº··dΩ±Ω¨ÿ—ê·¿º—A© ·Ω@·πaŸ±@·›ô@’Eò’=’!ô-ò≠—‡Ω-Ωëç<≠Tº·!·®≠U9ùe—©ÕA!--9QD≈à–¡aôÕYÂeÕòÂ$—¡‹ΩùΩâ5]=π≈ÿ—©iÑ≠(Ÿπ≈eYÿ≠1ïai	QΩΩ-â!a——·≠±úÕiπŸ%)·5ë≠‘’ÕX¡U…‹¡%·πç≈·‰·ai›±µµ…9Ya-µ5ƒŸÈ·ÂÈÕ©Â°‰…Öπ)]ÑŸ∏‡ΩE¿›Q1UHÂQÖX·—â,¡8Ω	∞≈$Âº·»¡…≈µ(ÃÕâQ‹Â…µ-≈$¿’≈‡’¡†›©ëY—ëƒ≈…!Ë›1©…]Q Ã¡ë]π—µ©@‰—’h–≠–Õ∏’4Ωe¿‡Ω›…MÕ]iôd’A©≈…≈IQAU…Q¡çÂ•D—°·QÈ≠—…•ôY)]Ÿùe—QYµ≠È]π=]≠’!ππA1\≈·°—ê–≈ô@…≠°âê≈I8ƒ’5…°‡¡πΩçú’9πΩπŸïÈEeTÕ)ï…·!	\—¡ƒ»¿—©Öå‡Ωù’—P’I—a=,‡’±=—¡YAçÃ¡¡Ö±H’A5âÖå’iΩU¡…ç±—È……¡≈eŸ’‰ƒÂπQ8≠å–’5	A!4’ï]d¡Â©!e1Ö‡’TÕ≠’’Õ-ô≠·¥…Q]∞’-©Uπ±¡Eaô9=µ≈Ÿi»—<ÂπA)ò…•-ÖŸïÈ5)©’A≠L’∏ƒ›UÂ•¨≈ëôâD’TŸ’π…ïÖë)·’M©ò≈âHÕ¨Ÿç—I›·Ö1…,››µ9¡È5d≠…≈A-iΩh›úŸ’≈ëh›A	ïÕΩâÖi5ê’âÈ1	µM≠=¡â5È©‘Ÿ‘…0Â∏›9e§·Ÿ`…iY8Ω! Ã’’’Ë·¡	ÂÕ©YÈÃ›’9Yƒ…’Y	-Y1eiD’M≠±)ç)·IÖâ∞ÿÂ ÂŸUI8›ΩµπÃÕ5È•…==©iYa±’›Õ%1QëI%QaQΩ-)·]i≈âUÂ°LΩ	úÂ°ƒ≈a¿ƒ≈Mi≠9e≈ïaaµµŸLƒ’·‰—Ωi1©Y…aY]5AÕ—M≠I¡¡Öå¡≠,Ω9µŸ9≠MÂAƒ’Ω…QQ…≈EÂŸa)©¨’»‰…eπ5‰‘—±aµ\—‹≈YA¡IPÕY=Ã≈Ã›U1Aµ—H≠dƒÃÂ9î—…Ωii…Q9Âç·©Â]!°ô¨≈·ôç,ŸŸ%18¡πâMQëëïï)UÑ¡1]I!—MI)1Ω≠Ÿe0¡P›…LÕY4¿’Öï›a©1·	—¿≠59)’•’1¡ô%…=•=Õ-=±µ-]‘‰·¡ÖëUIπaΩ]°ôÕ!AQëπ1±¡ŸYh‘‘≠·IŸ-¿›,—¨≈=¡©µπ1®≈ëùâÈ•±Ÿ·U∏≈ë•≠i’—%]ô≈-U]•Ÿ–¿¿‹Â»›Qç$…ÿ·Ω)Â≈›©’9È‡ÿÃ≈Ÿ	ïπ‰≈åŸA	â)¡±·Ö9M9ÈÖ°Q•—’•\¡±≈ΩHÃ…%HÃ≠%P¡ŸÂùÕâ©I¡àÿ—0’â%]·…≈-E±ç··›µUΩâ1…Ω¡1µ¡,≠…U\‹ŸŸÖ%ëÕ…©ô•h≈·MYU≈Öa1ïe•≈î›Y!\ÿ»‡¨…Qπï©Ω9MÂE≠Ë…µºÂA≈Ÿê·(‹ºÕÕ=•¿–›–…È	†Ω¨Â)i»››≠Y]·8ÂΩÂY5®ÿŸº’a…âP¡1Ÿaê≠I›ô≠…Y@’I8Õ·‹›1%ÖDÕi‰…≠›eM≠Ÿ5H—ÂÕïÃ¡—›È]ÖY9ï≈§¡X›¡<≠µ$Õh¨¡Qâ‹…ÈMiP‘·›±IIµQ•π%•’A——-\»›—U≠®≠<…Ö≠,Ÿ≠8—≈ÈaIïÖçŸ=Èa±hŸ…°‰»‹…—’Uå—©TÂÂÿΩH’ÕµŸïQîÕi¡’EÖëë	ÂÈôπ!Y·Q·]=’X≈ôÈ1•π=µi¡5≈»…A!©eΩ•,·È]AEµπŸ¨’D≠—-π•9,¡ëëôeò›	¡9YaπÂâQYaŸŸÂe’ôççÕπâ»·Ö¨–…¡µ,Â)≈ÈŸâ±¿¡≠,Ω8¿ŸÂT‹‰…°…5±âë=Ω•ƒ›<…XÕ¿…›∞≠-Ÿô1%M5çÕ-M\ÂT——iIM¡–Õ°8…-¥Õ)$…µπå›•TÂï¿≠@Ω%Qç’P—ç¨Õâ¨›Q¡0’›’Âëò—YÕ¿‡≠!i‰Õ9Âai—ôŸ)¡î¿Â=≈!9-EÿÂi<¡°…âπ59…Y]ÖYò–Õi	·‡…µQëe‰·‰≈aE≠-a=H…iU≈E—Èa’iÖç——ù§ƒ’©°≈%ÂâÕÈ!)LÂ9Uâ·ÂUô(≠=Y)ÂïA»›aX¡MAaAÈ!±‡Õ)5X’çŸDÕïi%Ö(–…\¿ÿŸ%5§Ÿµ5≈»¿’d≈`’‰…â·Öÿ·1-π	a…!…©ôÕ8›)—‹ƒ…¡âçëhΩA9–≠°¡P≈1aΩ9…≠È©h¡aÖ¡•πi≈9Ÿ©ô¥·â!iP¡…©i$‘’·•I¥ÕπdŸ%T≠=†’]•≠A·ë≈ô°ë·¡-]I Ÿ›·§›=A9Ë¿Õ≈Õïâeç©©•·Èë© ŸYÖ)›ŸiMUU’-–¡¡	—ç›≠≈iâUº¡Ω4¨›Ÿ9IQŸê·9‘Ω›ï›…Y’EëŸ!·i’›Â≈L’i]9π1•YÂ≠IΩ≠â±·®‹ŸYA=-5¥≠XŸ’ƒΩ]A›î≠·ŸπôÈâÃ≠Ë·¡•≠©›≈•Y≈!i	]çëç°aA≠5·U–·¡ï·âÖa!9U=1$Ωçi	AEQ·59∞ÕQÃ≈’)Ai%çëQ…QUe¡ah≠d¡°I≠Ω•5¨··M•Ö1‡·ê…ú…µ…â1Ωµ…iÑÂ†≠UAaM5ç∞»Õµh≈U•)e‡ŸÃ—çïE‰≠±·ÂU]…Ö¥Ã¿Ÿ%U]ŸE·π›i©Ωâ≠‰ΩQº¿ÕIË’5≈°≠4ÕU…âΩŸ4Ω=ÖaŸ±ŸIΩ1π∞ÕM1D≠¿Ÿë‹ÕiAôâç–…â›•ÈA)ç±µiÖ¥Âà›5’…—•·Ω)¨Õ’©º’iâM±—≠I=Ö ·e]–≈QA9Ñ≈Y4‡≈9Q·Èâ·)Ÿ-$·πaYIe9ƒÕù·]≈â–’1âY–Ÿ1ôI–’a©¡≈»Ÿ·±…πYË≠©!Ÿ(≈eËÂ¥≈ôçT·›—5¡¨—·ï·≈]!©Ã¿ÿ≠aAIµπ≠Â±—I…Y%ï]M±—≠…`—ù—µ≈…=(’1Ö≈≈Ã—π Õ<›ô•—X’§·Yπ$–¡Õπ≠aÖù—Â—©•—‰≈%ëë9,Õ≠µ…›%ÂM]…È,Âïïô9—µÕeπ5X·ëµô--â9âEMiÕµÂi(≈iï,≠]I≈)=Ÿ‘≈¡=•ƒ≠$≈Ÿ·9»‡≈≈Öπ ·•e)X‡Ω—•YI›µ±µ·!ÖQƒ¨¨–·…UÈ%Ÿh¿Ÿ∏¡9å≈h…±ËÕ)»≈âQÈëU‰Ã—ΩÕçUΩ=95iA!±EÈEë©â$›‰…µ1	EôI-π9Q4≈=ï	ï!Ÿiƒ≈eÂ©9ïŸQ≠0Â—¨Ω!ÈI91ï%-°MYE9-ê¡¡Â<—±	Ÿ≠º¨≠IÑ›—¡ë=πUQQçÈX¡QIê≈Yëµ—Õ…‘–ΩÖ©·±¿—•¿’—Y%±Â9•Q4Õ¥Õ9≈YàÂ9·Ö›5aµôïÖQY=…-Ë›55ΩçÈ¡…≈<…â‡Ÿ1…!â§Õ’Y‡¡Mπ—9!¡ÕâÖå≈MôQ≈ôQUY…≈π=$…U’YÈ≈·Â!…’1—¡—LÃ‰Â-’e8’h≈®ŸΩëôA•9…Ñ’…©¡(’A5ÖçâÖMQ°Ÿë—MI±ΩE…ËÕç≈·ïπIπ=`Õ=)]ô]!A-E±≈ÂÈ…!πY5Q…LŸM©M¡1•…—Y—EºÂ9Ÿµ≠-Ñ‘¿ÂT¿Õ-—4≠ç=Èù—·ÂΩÿ’±âh’≈Ö¡â©)ëY±‹Ω8≈≠‹·I≠M‰’QM=M—Ω©A‡’°≈1¿¡1U1YçÈA9§’5ÈÈaâ§Õ≠9…©πƒ›’≈±›µ…¡°çë·MU…%©8≈ôYY≈HÂ\’=%âaÖÕU—Yd›‡¡Ÿƒ≠IÖQ(Â•]ad›`≈…UÂa9©D≠›π!±==%EUâ`≈ ÕÈA`»Ÿ¥›Aƒ’≈0‡≠Õ1)—Ã’=Ÿ-=iYMeiŸ ’9’]=…)°Q©Ÿ)ïMMaî¡Ö≠¡-©àƒ≠»º—§ΩïPÂ≠aiË·=MQÑ–ÿ¡Õ—µTΩ\ƒ›Õ·•U5\¡–¡π]\¡9-≠µπ±·±≈ç9-U»¡5È5ÈA¡Ωô—‰·–ÃΩ›MÃ…π±Õ9°I›i]=T’)±≈Ÿµ-•Ö©πÕM-)IΩU±’≈Uçù±≠∞ŸâTŸ Â	•ŸôQA1ÈT‹≠i©âÈQÕQÂù≈8Ω5\·ïYa…Öiçµπ]5=E›¡iM•%Ÿ5H‡Õ±ºÂ¡<≠	∏¨¡PÃ·i›µ=)©Y°¨·âç≈È! –≈<’I…ô°Yà›È°aY—°ΩπŸI¥¡¡$¡Ö9=ôŸ-5Ë≈4ΩêÂÃÕ≈¡©≠¥Ωa5ç±i≈=A‡≈ï(≈È—π-•iAâQπ¡-`—…•Ñ’	5‡¿›È=Uç¡-π’’°%M]•ŸeôU—ÖIô·!µÈ©•çH’Â∏¿·ï$Â®…	4–Â5Ÿ)U≈’È±I]±——…ei)È±-PƒÕç·›±ôP–º·»‰‰’â—AÖ4·ΩÂ©X·ç1ÖÕÂâ5Q’Ö∞≈I9I=Â5º’IMë≠â’]Q°â©UÖ¡’¡ÖïΩMï¡Ñ≠9î≠·4‘’,‰Ω5Q=ïU)hΩ©±!»Ÿ…% ›≈©≠XÂ—©πiYQÖŸπ9=µ¡≈eiç¡Ö!TÂ‹≠†ŸµE–ÃÃ¡\‹ΩÖç·Ÿ‹—±ê…ê≈M9]9©U‘¡»›·π¡	ô]±·i$ƒ›≈©9=µ¥—’’πÕ±4’°—IYµA)5•Â›—h’ùëiµYe·±ŸŸ›¡U(ÂÂ’Õe•—®·ïDÃŸƒ¡ïŸÿŸ∞º‘Ÿ,≈T’à…0‡»’È≠U`·Ö≠µ»’‰›—)–ÕÑ’=Ÿµ]à’ΩD—•9¿Ÿ©U(…$Ÿ≠H≠ÂL≠Ÿ]Õ\…—aÈ—¡•%•µå—H·ùQI\›)0ƒ’iQY]YH’•U’Eâ(·≈-¨¡âÑ…—¿¿……IHÿ¨¡I¡ï…—i·—eπ1e±AQÕYë	¡µY≈]·	•—D»ÕŸâÈE‰…Qiïµ°ÖµIM%çëëï≈≈ÖŸ=UA•ï≈]8—TÕ•11Ë¡µŸD»‡¡â©¡≠Q•≠Ÿ≈U¡aY	)%Ÿ`Ÿ-ÖçI°¡ëŸÈaa»·Y1…A)··ÂŸe±Õ8Õ9úÿ≈1…πÖùÂê›=ïÂ4ŸŸµÖ(…—(Ÿ¡]iπ≈e¡∞¿ƒÂº≈P—IÈÂ∏›Q°UÈπçâôIiQe≠©Ωhƒ·ê≈¨…Ÿ°ºŸµ≠Õ…LŸM≠,Ÿ≈EπQ‘Ÿï)•i–ΩI±Q·ç·ƒ…®Õ¡Â‡Ÿâùπ©—e…!—)çµDÕ©ÕMâ	iÖê’îƒ’≈ôÿ’Ÿ8¡Ma°È¿¿¡1ÖÑ≠9≈π@Ω‡Â!—U≠=¡∏≈â‰≈ë…iU9Â	°’’—¥≈!ÖëUÖ±°U))M‰≈AILÂïù•1L≈a!È4’·]â¨Ω	ïπÿÿ…≈ù’\≈°Öƒ—MÑ’-≈—…ÖëiMù¥Â‰…!≠=9¨’Ωa…¡%®Ω‹¡µâïU]’9µ•iπâÈ±=dÂùÕÖùô…¨ƒ≈©5IX≈ÕΩ9U¡›±H≈Ö-9aA]]°Ö’µhÂP·AΩ·I°‡ÕÖ¡…»≈Ë—º≠‹—IeπÑ’Qiië—ïë∏‘›%ÈUï]°—âUiië=M\ÕU®ƒ≈Aa`…•)—I4’±©9µ)π4›Õ∏—(¡—e≈µ99±5ò··‹’Õ)È=X≈iπi,ÕÖ%1≈©çî¡I¡]e°h·M‹≠©=%I5a•Ÿ=AI%âL…UA<›ïei1U¡Iµî¡•0–Ω’—¡·±9=%›…a	ùeΩÕÖ…d¿≠]·1·X¿ÕÖ‰≈IÂ‘¡êÂi…\…ŸY	¡9©A≈]ù»ÕQA’d≠Q±]çÖMÕÃ’µ!Ñ…QYî·’L·•πLŸùΩ•!)°Ö=!—)	-]Iï-U≈4Â	!ë]%Â·∞·	≈≈≈©•I1Ö›ù‰Ÿ-,›	®…UiQM`≈‡Ã≈¡ÖXŸΩ5Ÿ©!—9=°≠…≠Qe°)aA›âÖÈ·µ›±ŸMa ·i)-]ç]Q°Â¡5±…±MÂ4ƒ‰’=ŸÕÈÖ•çë¡Õ·==•A±ç≈›1’$≈iÈµ`ƒ…1âÕ°Â¡π—M¿ƒ›Èi»¡5©A¡’ê≈Ÿ±a’%È±≠›=≈=≈9’ë-AÈIçM0≈πa∞‰‘ŸPŸÈÖ‘‹Ÿ°ïÈQ≈(›—â’µô=µQô•5`≈≈Èçµ’Ë…d’1iU›°à≠Ÿ5M¡±Qi—’≠ïŸ·Â5‰¨¡X›±]ï ŸÂ–…(—)QeŸ•Öçi…Y=π…’–‘¡Â8≈Mπ—êŸ®¡)-ôà¡%§¡ŸÖ%•59-1çU·°M≠Që†Ÿ]…•µ‰ÂÈëP’π)Ë—1aeÖ±àÕ≈ÖçÈIïπ’<’°πA›È1!ùY]Èh≈Ã·]E]≠]!ïç≠…]	\¡°–’1M]MMh·Ã≈Ö±Aa≈)¥ƒ≈)Õh·ii≈ï≠…—h¿Ÿë-ï•QÖù‹—Õ±—‹…âU ≈1çH¨ÕçhŸ†Õ5(›•±•›QÖ©E-Yµ¡ÂM·»’—‹›©ÈT·¡i…©A!’9—·Ã¿›»ÿÂ¿≈’’≈<–Ÿ‘Ω’Y©•ê’QÕTÂ§‰≠Q9-=·eôï9L’å…MΩ®’≈µ≠ΩM©‘ŸÑ›—ôº¿ÂΩT¡eπΩµ¥Õ94Â°πôÂÕ‰≠eÈ5ëÃ›Õ≠%©’DÕ±E!MEQÕh‹ƒ»≈¡U±iëI9ëŸU¥’Ñ≈%§–—	e©e=5≠·-πX¡!Ã¡ï=ùIaU¡Ö±ÕIâµ•î≈Mhÿÿ≠)≠-Èi°]ï!°Öç·›•ŸÂâ!≠U‰’Âï±°âQÕ=Qa—çÖ]‡≠©5—ëëM0Õ9-≈5‹¡…ΩÈAê—	Y5·µÈï—âÂ›¥Õë¥›ïç’AùU=%=…ïÂMÂEÖ1a‡Ÿôe4¨ŸhÂ‡ƒÕë©A]©iÂYƒΩIç]¡1åÂ9Ωâ1°Õ…E≈Y–……]»—5±πŸ0¨ƒ¡’ëÈ’8‡’çL—	U-%≈]dÂ·eÕ1•ËÕ……ôM¡πôç¨Ω¡≠$≈à¡U±Iπ»Õ’Ωπ’©’%ë–Õ›-¡…Ö’°E`‹»Õ9]=≈,Ÿ¿‘Âππ)]î’L≈)ôD—°1π’]ù•5I9π)Y‹·P—ÂÕë—‹’‡≠Â›@·%±a=i≈‡¡I¥≈—»≠MQ]¥≈\’IIπ≈aaU—	ïÖ%·°ïâçÖë-…·ïYÈô©1–’Ë’Mâ!ÖA==ç©çà·0≈AYâM\≈IΩiÖÕ]±%Õeh‡ΩùŸEQ]â¡’Õ—–»——Ua•ii—≠’91Ö%•Mâ=≈Q1Q¿·âUQ9—ÖâUM∞·—ï‹·@·=≈µâYi@Õ…—≠’I99πê…≠¨≠≈º·ë	9¡UÖ]Q©=›5ô’5ù—%Ë›…»…EÂ•µMU=âë≈πiΩ©E•APŸ·5T—]¡¡›…ïEç-,…ÕâMMÈâ]ëYŸY‘›…ΩQÂU‡’-§·Y-M—È$≈îÕE·Mâ]]ëY•(‡¿ÕÑ·=ÖMåΩ§ÿ¡1ç•9e¥ÂÈƒ≠<≈–…ƒ¡à’i)a’%Ë¿¿Â›—º≠§Ωë·–¡ê≈YP’%È¥‰ÕÖ‰’·…Ω¡Qi≈’…ÈëUÕ¥ÕÂAµ’©Ö±1î›U§ŸïŸ®ÂI’%•ëaIÈë›µ›πâe’M!YQd¡)ëï·AâÂUΩçaŸUΩ’¥›çò≈•ë<≠QH‹…a	ùëiÂƒÂÂ9â…≠µQô5—I¡11‘Õ±ΩÖiMÖME©E•AEÂA…≈eÖ9Â-8’πÈDÂë›Q›M…È-!±i-Â	i\…ÈÖ%’QÈº¿ΩaY\·≠µÖô!EY§≈Q±]195QµI∞Õ)…%ç±°iÈëQ≈ïÈù·±IπeI—·—\’]Ÿ5EŸ·≈©5±ëŸ4’È°§…Ÿi4’YYe8’e·Õµ≈±‡…»Â)—¥¨Ÿ‰—…çâàŸQ‰≈∞ƒŸëQàÿ›Ω¥ƒ≈π1à—–·ëLÕ]È1-ëAâaÖïï…IU°QÖÈµÂMMM9!î‹Ÿµ°ï	îΩ≈e©’eHÕe›Âπ’≠$‡ÿ‰›¿Ÿ…°`·Y≈1)ùEë©1M5,Õ9Ÿ9âTŸ≠Ÿa‡Â†Ÿ•îŸ°AçH‡¡Q@—5aâ5ïÂÃÿΩ)iÃÕ0’9âa]≠°·5âÕÈ	1MÖ—iEΩÈAIA`…∏Â’Ω»ÕT≠îŸŸçË‘›»Õ±µ)H·Ω‹≠a©Y°%çâÖπ5ΩÖô≠—ÖçÈ’-M…ç\—±≈9A—Ã¿’©Ö≈π5eë=T—1`’!°1’)Mi…5(’±¡úÃ»ÂŸ8¡Ö9)≠ôU©P·PÕ	9=e›•≈©5e›M–Ω1=A±IŸ=≈±HŸ‹Ÿ≠Ω‡›ïU¡¡MÂa’A¡…‘›Ÿÿ¡QŸ¨¡à’Y•!›	‹…)§‰›©…âÕπÃƒ›%Q)ïòÕ$’…ô1AY—»Ÿ°(ÿÂô•eË›µ5eh≠Ë¿—‡’’±!≠IYÂeIaY©È¡•Èç%πÖÕ‡Õ5e1E±±º…Më·ë9Aú›¨›©≈≠≈Èú≈UYµM!ç‹›ïÂiia-YAï…=ΩI!ë≠≈%•U¡ÈÖù±µ¨Â9ë¥›QUQ…¡•·Q±1i…ù°i)%…h·Ñ≈∞¿≈…U…]’)5•¨Ω›	%\≈MY—…$¡≈1PÕ§≈ëYƒ›ï…¡-≈—ïP’©©5=Q9…e9aQµI9Yï%TÃ…°âÕ¡	9‘›•9¨›ë≈ïπQUŸï-ë·@…ÖA•ÈâAùôMÈ=Â=4Õë—µ5EŸ9Õ≈å≈%Mç•YÃ·›ÂôçU°H›©Ua…(¿‰Õù…eQ9•A=`…Ë——ŸeË›h‰≠â=-1ëIº·ïi(≈)¿Õ·≠±†Â,≈)T’ÈÖ —≈A·A`ÕiÕ›Qe•ô§—M=	±1¡0…	A—(‡…ë≠AhΩ=‘≠¡¡U©i5’L…ù•EM¡1PÕò·±º›¨›•5ï…dŸ≠°U∞—)1P›	ƒÕçùIaaMÖA›\—TŸQ)E%È»Ω9UúÕMQÕQ≈Iµù©MÖŸƒ≈YQÕ…Y=%Ö…ï=!EÕiÂ≈DÂ)âôµY©ëîΩïô©5—≈P…‡’1Ö≠…âi]—=¥≈]¡Öπ’!)Ÿ…’-0Â])QT›•…·	ºŸ…9º¡Ââ!Õ1≠ç…UD›ÃŸ]U—±d›êŸ±9¡5Â91\Ω¡»¨¡`›ÂeË¡Öê›Yï•\—5A]-’$…ë%∏…•1†Â	‹‰¿Â≠•D¿’ƒ≈…≈°QU±A©¿¡…Ÿ·Mµ‡≠-ôa5±≈ça—=(Ω·©µ-•%»ÿŸ<ΩaM<≈1©¿Â‰Ω]EMY¡)HÿŸë%·M≈%µ≈ç≈YI≈Q±—çe’(›9IE›º‹Ÿiâ9ÕiŸA‰¡IŸÈ—I’-EIA’Âπº’9—≠±!YM9YÑ≠›)’MQëƒ’1Qâç]4≠©iM©ΩiQÖaÈ±â%ΩaÂâM—±≈1%%‘≈¡]ii19•—Ö§‡Õ)È°ïâ—]çïâ…=1]ï]’aMdŸ±ÕïiY]’≈ë»≈±e9â1Ö—!]±…ô-L–·…â’9!,¿¿·	!ïQ±]1—T≈ë	ú…ii1‹›	çë…19µΩYç9]U≈QëL¡)ò¿›%—\≈±-aQ)=ƒΩ¡5YΩ≈πQ—’’ë5IπIà—‘‘≈çEç-âÖÕ%±Â≠TÂ4Ÿ›çeL–Õ’°!Ω†≈¡1°≠]©µπQaΩ(‹…≈çïY‘≠≈π!°≠©çX≠%∞≈]eîÕµHÿ…iëIâIÂë4›5Q·-=‘≈91…MIô∏Ÿú›Â≈ç!î≈Q©›È±†¡πô•5Èi—1(≠9e—]=9È1≈9	â®·…±=·°	â≠µÖ∞›Ÿ`≠ù—ëMe’Yï1≈Ñ—‰·L–…(»¿‘…Y±A%â»Ã—¡·91•Qµ<›Ωa!©AŸπÂ—AU]Ω•4ΩÖ-ê›Y°QŸ≈—=aaπ]eh¨›§…h¿≈°ë)çïΩ…—à›ô!d›5—·≈iΩÖµÈ)—IMUµò¿Ÿ∞—°aY=)©ÂIç…≈·5h’0Õ·µçµ8·¡,≈ÈUÂ¡)5·–‡≈ù’U±‹‰Ÿî·±-Y0»ÿºÕ°¡êΩ…Ÿô‰≈!…µ5Ÿ›	å’LÕç·Ö¡µ·Ωç=—…ai!π°P¿ƒ≈IË¡$’‘≈)≈$≠¥ÂiÖôU4—ÈQïQ-%≈¡©A0Ÿ’Âÿ—›çL’’5D¡5Q$ŸâµI≠H¡πâ!µº¡Mµ•]M±Ωâ9Qî’)∏·U%‘≈d≠)Ÿ’dÿ’›®’=`·Eç]–‡·π!≠4¨¡ùMΩAd≠·Ω°Èπë8›Qô5A±)I»≈M≠®Ωe$≈YIπëaaYQ4‹›…içX‡≠‡≠±ÈY•i1iÃ›•π›eçM›-=°Ω≠)π(≈U—QI-)·ÿ…â®≠Õ·ôŸ)©AI¡8…≈%πΩ·∞·T≠-aµ≈â±·A=≠‘·-≈eÕaIY≈9±·≠±≠à›XŸD»¿—≠ËÂaê—<·≈‡·Uê›a®—’4›•—·ΩÃ·QX»≈—!¨¿·-ë!»’5≈)eïâå’ŸD¨¡»›È]!Yô≈∞— ››Â≈-•â—çYeï°‡≈<¡—›çQΩ]—Â≈MI¡ë’¡‘’µΩ†¨≈Q’πY·Iò≈âï’≈ŸÃÂΩ¡aY•	®·≠-≠âAçê≈≠°…%ÑΩÑÕâITÂ<·iêƒ’ÕÿŸ—Ë…î–ÂM•…$…1ù≈≠·º¡≈<’≠—)ô©Ÿ)9…1°¡≠∏¡5±)AΩi»›Aa†≠›‹Â!i‡Ÿ¡·%M°°—¡çL…Ÿïù±≠Iëë≈§≈1UT›’πÂT›≈πÂhÿ·Q·±Ö¿Ÿ∞≈çYh…≈U–…\’¡-‘¡)E\≈)<Ÿ∞Õ•%§ŸÖ§…µŸ%ô-1ça‡‡ÕQ¡-≈9]¥·I‰…i¡1îΩà—â—’µ’µΩ•-e©≠T¡I!)§…ôÕ	…]›Yd…ë	µÈ∞Ÿà’›!,»≠¡≈$Âëµ•)I9’µô	≠\≠e©ç-©-—ÖÖ!==\…-à›Ñ≠]≠Ÿ•¿≈1Ω∏ŸA)¡•UÈI‡…L›®Â›iI19Â›’›ùΩ9≈-9ïd¡°a•±Ω$ΩΩ—Q¡°©ô≠a•Aπ±êÃ’µ†≠êÕ9ê‡Ω≠8‡–Â·âQAô¡…≈iëA·Öd’º¡IπA§ŸπÕ›¿≠¡e¿Õ≈=›Y·±’9]›°QâÖ®·QE≠‰›¡π»ƒ¡I<›¡·©ÂQ°1©–Âî¡4ŸL…ÂYiI9=Õ%¡ïÈΩY!çDŸIÖ¿¡)=ÈQ¡Ω≠Y≈—I4≠•±Yµ)µ=•·±•]5≈¡9YMëå¡’A…—)1≠—=±—]°ŸE‘Ÿ±Iï)1ÖeÖÖ%ç%’eπ=5çÖΩ•—!©…°·ë…Môú–›ŸYâMò›ŸÖEπQ	¡°©5ç<·©›¡•ùù9I)M≠=M]H»¡¡çT…î’	≈%§ÿ›PŸ∞›°•êÕP’5≈I†…-ÂÕ≠Y5X¡…ah’Â)âMYåΩ∞ÂçÈU‘Â–ÂùÖeQΩ†…Â5i‡ŸIM¡ºÃÿŸ<’Q¡M±e¥¿·≠≠ºÂU—π°ΩEπQ5µ5d·!ëd¡±Ih≈Â≈Â·°Õ‰ÿÂI±UX’	1à¡P—ê¿≠πP…	5)µ%±·Õ›•-±—5Ö©°5)Ö≠5ÖL…Â°))≠)Q—(≈)]°-)AQUIΩ°a‘Ÿô(ÂÕ5›’·µ’È¿Â)≠È)ÕπÂ!U—ïÈ≈πç…QTÂ9µ•âë4≠)a•µ5»‡—çÂ…©0‡›âô=i-ÖMΩ¡¡—‡¡©1ŸÖïÈUQ¡°=•A›Q%Õï9©U≠9±•º…’4»…Â°)%≠ÖÖå¡—ÂôQ¡‘·I•êÕP’=ç…çA±aâµQM›π…i	≠¡4’âÖπëÂôYYŸ5—ëLÂ†≠›9(¡Iπ=¡11$ÿ≠Â≠Ω,≈ÂÂ’i…Uƒÿ‹›Â—≠ΩŸÖΩËÂ°≈Q$‡ÿ’‡’H≠Mi)<Ω(Ω†Õôh›Eô1âµ©ô=òΩ›¡’¡9(Ω—ƒÿºÕI°YëµëΩIX’π·∏—AÂÕ≠•AQÖMUîΩÃ·–Õπ–Ÿ»›Â•iµÿ’âπa≈°aPΩ)•’≈≈πµAEAΩ•—†≠çIê≈Q(’åÂ	ÖÂÖ’HÕ)1ò≠Ë·i@Â¡=¡Ω¡…•IçIeÖ¥·ºÕ!Ö(›†’àÕ»¡	±‰—•—5—I¿Ÿ≠âÈÖôQ≈±Ω)!’AaEhÕd‰¡IŸ≠ŸdΩMô≠%·ôë•i,ŸTÂ-©≈ÕMa=T¡QŸI	»·QM]πù%Õ·Õ•Ÿ·≈≠	U≈…•ë©Y±e‡—1M)âI‰Õa$·MLΩçI!ëëhƒÕΩD·iâ5—¿¨¡X≈=Öπ•≈iπ’—º—©)π±âëò…’1çi©Q5=¡•Ÿ’Ã≠‘…‰·i°Ö§¡@»Âôe≈··YÈ°@¡±·’≈µ1Ö›©UçMeùπ]QU\≈\¿ΩïaÕΩâUY·Yd’MÈù]!›È))Öµï°—µe¡a1â%©9)-]Mï¡≈%—ŸîΩç…ÖπPÂΩ,Ÿ≠<Ωµë5‰——¡çe©Ia@…¥—Ÿê…IÕ©9P¨¡µË≠1P≈Ÿ›Õ0¡∞—ΩUa—Ñ›-$≈’QàΩ=ëççÖQÕëIÈi…ÖQΩÃ»¨ÂÃÂâQ…Ω%I’∏…âI±È±∞¡Uâ≈ëEâM≠’¡ÃΩ	ÖM1Ÿµ¨Ωô—µ]L¿≠‰Ÿa›Ö•Y¿—∞›L≠ÕŸùQ’›ù%¥—Âµµ≈a\–¡∞≈Q¨‘——],≠=°P·±iï¡99≠¡\Õa¡’AI@¡•)≈U≈’IïË’ôQ±EµP≈5—¨Ÿ›•50≈1·1I¡U∏›5©i±π8‹›ÈÕÖË≠1Ÿ95•≠ÖUÖåƒ≠âY•°	 —¡YQ≠≠§≠¨…ë≈(‹‹‹’…`…9ôe·UL—±’aåÂH’±I1EïπD≠≈ëôΩ]•]ÕYIA)≠ù≠·5Â%—PŸa•¿Õ·0·¡Açå‘Âô®…‰›’ÂU…ëM»·ÂeXΩ¡!LÂç‰ΩYH¨¡ÂYê…%ÃŸ!°π·X—’]QêΩ±≠‡…UƒŸÕÂ)-ë¿›Â≠- ¡)	 ≠’Ÿ‡Ω—AIYYÈ!Ωπ	ï’$—Q›9I›ÂD·ÕŸÈ•å‹·))ï@·¡©¿Âò…¿≠ùâ·Qù]›…Ω©ë°P–›ç≈$·\ƒ≈†’)1EΩ®‰ŸPŸ‹‡Ω›ôïQ,Ω≠!ïç=¡Q≠M]Âô9âƒ≈A-E¡ÿΩ5¡$Âi ‰≈hŸôM5-…a©·Õ·¡·Ωih–Ω·1°A¡ï©µQÑ›!¨›)1aÃ≈≠Õ¡Ÿ0¨»ÃÂùTÕô5`Õ©©å≈9È›I’1≈±—QeQÂQÖ≠5-)Ö≠!H›LÂÿ¡ÂË·$ŸA)êºÂ±àΩ›·∞º·ÈQ]’M%ââ≈EX≈È<Ÿ-±%9Q’¡Ö≠ôç!AÖ9…ƒŸAiÑ…Ω5âΩπÑÕ%ÑŸîÿ›ÖâùÈi¡ÂT¿’1ïïëÖô9ô›I5=¡Q!à≈)ï°≈P≈Uçôâïëà›)‘¿≈I<»¿≠åºÂ5’)µ)ùYAM(¡T·ïΩiiÈ%0›ââŸâ!QEÑ≈5%ëMô›ÖM$Õ<·ÖQAUAà›Ñ¡ë∞ÕÕIQ—¡¡∏—…·°=IYY•ëaULÕa)°5)Öë\¡≠ÈEÖ§ΩY9\¿Â@…·ëº…Õï1…Õçç¡Ω•πâiïd¡°’Q!âôàΩI’¡)Mëôçd›≈Ö—UiUµ5<¡]EA§≈¡E¨≈,ÂY)Öµò≈M¡Y°·©›º¡!AT¨—πΩ¡—±¡·I≠ô’AU•%eÈ·!¥·‰‘…·‹Â!•…ÕÈÂ°Ö)	µU=≈±@·’T—¡`·i©=ï-©Âç9ò›I\Ωµi]!å¡Âa-9)ŸµYôL≠Â\ÿ·¡LÕ9@Ÿ¡	)1Uÿ›HÂ	…Ö’QX—â<Õù’9‘Ã‰Â=µ©ÈÂ—©—]A‰≈D…)QQÕ¡—<Â·°—ÖY1MπaQYI—a0¡%‘¡È=%µ5ÕÕùA°≈%ù=Âπ9â1-Q]UUY≈ae’—)ôeçô]I5…QÈ9≈—°¡-±≠≠•AïΩ’•=µΩÈ≈ƒ·$’’!•=-≈¡πQIiÑŸ—4…-ô9a]ïï)ë’Ã≈ŸµU-±iY9U—5±)Ω9§ΩÈë≠≠9(Ÿ8·ŸëΩ…Ÿâ°ÈYçIë¡µôQê’ëÈ•¡≈πQ≈µïò—êΩ›	A°©A¥‘ÂΩ—ºŸ]ÈÂ]…±=%Y9ë»»’5≠¥Õ!UÖ©)∞’,¡ ÕM)L¡–ŸµYË’YQ`—Ië©›È¡∏‡ÂÕ(≠∞—•‰…Âa1iµ%‘Ÿ¡,≠â=9)=1≠IQU—\Âπi‰»≈—ù—EU°)â—%±ï≈Ω‘Âç‹Ÿ…ô≈T‹Ω•¿’Ë‘Âô∞≈â!¿›•à≈Õï·°»Õ·i-ê›Öÿ≠iî¡—MAΩïúÕ•ç‹Â\Õç•’πY!-]ç)a!Q)≠—‡¡â±ëQ@≈U—π¿Ω›‹—µ)ππi)≠X≠Y…≈-≈›-πQMµ9È%M’…Â±·-Y¡9‹≈º≠9-‘ŸhÂAΩ%‡’Ω=A°›çµ±i!5¨Õ•‰‡–≠±•·——°©πM±IaaëÂÃ…¥≈(›Ÿå≈1‹≠—≈T‹Õ‰Õ]YYQX¡≠A——i]IÂâ= …•eºÕ—π±≠à‹Õ=Ea14¡≠I8≠!EYµ…!Ai¡Iâ‘≈È•µ8Ωµ©iµÈaâ≈\›Q’≈•1ÖùË…)çëUi-≈QÕiMi=…9=≈≠π—E¡-ôΩI•9ôY…A`·I=5·YdΩË—Â\≠Y’≈¡%…±Q%]µ4¿›eE±…≠)=)$¡—H≈IÕ’¨…\›aI	ï=°π…Ω1iåÕïQ!=X…’d≈U’!—Uà≈‰¡9ΩIï5’¡1±¡Mº¡==…]ÖÕUâY’)å≠πEÈAΩ)\…ƒÕa≈≈’ΩÃŸ=‰≠È%â±IiŸiiÈ›µπë¿Ÿ!ΩiÖ±…≈`≈å≠ÖQ…Ã’π≠®ÂÑ¿Õ	ù-)9°)MÑ≈M9Ÿ8›-›aIP’–ΩUÖ©)MPŸ-]ô’%·]≈]YÂŸÃ≈=1≠…9•·ƒ·`Ω¡êŸçôÖM≠â–’-ò¡Aë-µ%1Ωi¡]±—	ê¡ŸEi·Ÿ‰≠òÃ≠â-¥Ã‰Ω»’Â©ÕÕÈ©çQ’QΩ)±°AôπÕ·¥Ã≠L¿‰…=±1©°)9•ΩHÕÂEi’ÖÖÖÖ–Ÿ©<’ç¡ΩπôAÈ∞›AÂ≠a0Â=≈π∞·A0‹·U¡©’µ±Ωd–Ω=ë≠99’ŸEπº≈¡—U¡MU∏≈)5¡©ML…M‰¡9,‰‘ºÕIï®ÕΩÈQ5‡Âa1·π	X…-—9\‡–¨‰º·—°Ωç—Öƒ≈YA…Â]µëÈïY9°=Ωâ≈—<’±≈$≈–Ÿ— ≠âQ99Yë1‘≠âË‰ŸiÈ Ã¡π»’L…YT…≠<≈…dÂ©Y’©M≠–…h≠A`… Â) ¡5Ö·1≈¡≈È]])M	≈E,·¡Q9IeI©9•]ô$Ÿ=»ÂYÃ≠Ÿ…!¿¡1·ÈQ-±…µ»·5·=â≈%a	·çaÕE¡òŸ¡ò…A!’`·e4–—∞ÕQ==›π¥Ÿ=…πŸπ©›’ôÂU=!…ΩaÑ’AEËƒ¿ÂI)Ö —Öd’Ö…¨≈Q•9‰·=Ÿ(Ÿ‹ΩµU\ƒ·—‘…—ΩÂïÖç†·•I©âL≈9QQM‘Ÿ\ÃÂëô`Ÿ°…Qâ•‘…†·Ω…!0›@–≠(≈Yî¨≠·-ëçÖe–ÂÂ—0’M]Ñ¡—∏ÃÂ¿ŸÖ)§’çÖ9©e›ƒ…	%πÈπ≠‡—çY—QÕ†’ôI-U%1UÈ5Ö—ôçE-!=Ö…•πUΩ≠—¡∞≠4›ΩQ…L¡∏Ÿƒ¡±…¡≈]•§≠ù·9]I`≠,Ω]!‹·ô»…`Ÿ¿ŸÂYe)ç]©≠’%à»·Ω‰Ÿ!ÿ‰¨—U…’ÖE=›‡—Ë—ÃÕ9T¡U≠¨‰¡π§≠π‹ÕôÖú≈≈Miî–ÂU∏Â%âYE9·E’ê·<ŸÂÂ=Ÿπ=]Q—¡]…È)=°Ω©H…≈@Ÿ’¡,¿¡çH¨ÕEeX¡QQ!Eâê·µµ›ùE’·D’≠±≈5L’≠Èeâƒ¡ºƒ…1U—]¥—‰·¡5Ë≠ùâ]Ÿ›©ÖŸπÂ∞≠a‡º·‰≈ Ÿ¡=îºÂII,≠ºÂI≈=-Õ•Ω-)-…--±IΩ8¡•8’!≈—ƒ·ô»—°≠ç!5Ω·—≈E≈4›Ö·M»’MµYA—≠Õπÿ›Q1aaa»—5®ÿÂ≠µA5¥—P≈πâ9…Qµ¿’	πçï°ÑÂôÖôE5©≠È≠9‡–»¡Èe·π!aY¥»¡°≈-U—)Öµ≠•$≠¡≠Eπ%≠!∞≠i·%ÂI‰·ÕeëII¡•Ω©»≠≈µ`ÕY¨¡ÂÕÂ9Ö—ƒΩ§·Q!πQ›±ŸA(’ÿ‹–—©=%·–¡h¡‰º—µD–≈ë%ë·9±Ö1IÃÕe•]µ)1§Â≈L≈5π≠ŸY—\Õ…ΩôÕ…<Ã’9-‘¡’1©›©ôΩ»Õ¡°–Ω›·1ùò›»Ã—ù®…LÃ’=ò‰≠`≠πÂôAQàºΩ%aΩ›ƒÃ·EAi1ô≠ôÿ»º¿≠P¿≈°T’åΩ≈µÑ—°1Ñ’Y—·MÑ›M9Mô—ëQ!ΩUI•5AQ–Õ)…¡•≈ïç¡Ω]a’åΩ›(·’…µ%Ω-%≈IôÂ§≠TŸπI—	,Ÿ)9=’π54Â¿ÂπŸ»Â¿…®·Q·’@›Qµ•î›—·µ’]¡ÖÈÕ±ÂµUƒ¡Õ`≠U•UMπ±Q¡°’’¡HŸÂµµ—Uµ¡)ïŸI@¡©±Ω—YX‹ΩX‡’à—,›·]≈…‡ÃÂôM!@·%–Ã·¡µeâa5âEË…±çïÑŸ›I…EúÂ1å’≈°ŸaE—8…º›≈=	–Ω•≈…©I!ÈË’e,≠Ë›±8…%¡ΩπË‰’∏’eïò…a9Õ¥Õ%ÕM<¡≠’Â·!E‰¿¡a≈µ≈=°Ö©MπP…µaùAQπú≠‘—¡¡≈πYAaà’(–…ï9µ9YçeΩ©›©≠…Y9L…ç∞ÂaµŸµ)ôÖ1î’%â]Q-\¿≠ƒÕQU°-ïŸŸ5U»›Õ]≈ò—±ëY9]ïô†Ÿd·aπç1Qô’Yô›ΩÈ1e=çEçÂƒ·ùÖº·ùT’1•…]Q,≠ï`’›ÂÖ—9≈–Õ·¨Âôâ»¿Ÿ≠d—…πÕ1]-Ãÿ›ëa-ò≈îÂ›!ÑƒÿÕê›ƒ›∏Ω58’≠’=Ë¨·πIµΩ±aaŸ—ë§·±¡Q…Ñ…L’ÖQ@≈X›È9Mî¡9!5)›ô Ÿ	πç≈π›çAa¡©5åŸŸÿ›±…°≈¡’çÈ–≈]M›ç…≠’ÈU›…’Ma—)Mëï°9≈UπYë9Ÿ•Õ‰≈5•!à¿—®·ôX’Y≈•ï%ƒ¡UÈ§≈QËΩ›	ôôY—†Ÿ°ú–Ω©ÖƒÕ!ô9¡’±—¡·°	≈Aïh≠‘ŸŸÖ—a†—…Y≈<Ÿ-%¡©âAïÃ…Öâçe¡©9Pƒ›]9=ïU5ï•’=Ã»¨≠a)î’IÂî…±M—â©©I–·ΩΩ¡I——µπŸº≠ŸÕIŸ≈ê‡·Ya9…’ÿŸå’â1¨—°ÿŸ≈!A]—Â≠Õi≠µTÕÖ\≠a$Õ%1Ö—1≈Y)QË…π…≈°iâQ$≠µù•ƒÕ∏≈ïëî—ï,‰≠Yaµ…ëA’Ñ»Âô≠ÂÈ§≈…9ëÕ§’	!≠A…©‹—Õç≠≠µ=≈%°I¥…â1°%4…ë¡ÖPÕ)UhŸ4ŸÖÕPŸåÕIYaQaπ± Â]ôÂ‡—ï©Ö…â≈!)]úÂÂM≠ƒ‰’ —=∞Ÿ≠L≠’1L…°L≈!Ω±)Öµe)ÖÈÈî—Â¡µÃ–’®ŸÈeÕâ)MµπâI1≈]’·…≠π•Ñ¡]†¡πçŸYÑ¡âî·aQ¿—•%U¡©·P≠<–’â©-úƒ’’–¡ÈÖÈ(‰’Q§≈=LÕTÂÖ-5Ë…9ôQÖ©EŸe]°Ÿ@¡hΩ›ËΩ›	ôÈiÈM·‘¡≈•›%¥ŸçM‰‡·I¨…Mê…ŸY9<·IÖ!»≈aï-ç9d·àŸa%Õ›Â…!-]•ea)eiiç±’’µ°IH…!!Q)QÈ…°±–›≈ë·≠π≈ò¡¥—µµ≈≈e• ¡!dÂ‰≈iΩ≈’a(ŸH’ËŸ9ë]±!≠ë¡≠–ÂE≈Ã≈]5≈]]¡…≠ΩL…YÂ’Ω’©=’≈U-Ñ≈YÕM±Iïµµº’Ö≈Ö—U·ππ‰ŸŸâ–≈\—Ã»›µ©U·Ÿ©ôQπ‡ÿ‘·ô)Ÿa°πïP…’ë5µd¿ÿÂçH…©•AIπÂU‹—L…·ŸIô51U•Mπâ≈ï°®¡1ëô‘›Ÿ≠î¡-%¡ŸYe·•ê—›±±I…Y—ç)ù¥’MT≈d≈Q·â°Aù¡)≠iÖëôeŸPŸ·Ö8≠QÈÑ›ç·=Öïò’≈±a›i=4…,’9ç——ÂÂeE’9%UQâç—ù±¨—‹¿Õ≈M≠=%4ÂÂME±\‹»Ÿï%ŸÈ]¡µ,—â1ƒ’•`…M1µ‹ÕU…âï1›çÖ]]≈∞Âi	Öh·Ö)]Ñ…—!i…I]ë≠±aMŸââïŸ•©Õ…	¡Ië≈Mç†›ïÖëM9ô-iåÕ=ÿ‹··≈µ©59YçI—\Â1’MÈ]ΩŸ°Y±Ÿ8ÃÕ-a…≈ôT≠ùµ≈5e•A¡UIÃƒ≈·%∞≈¨≠ÂÕÖÖΩ°ÕÂ5ùÃ–›U¥Ω®Â’â©Q©ùÕ±Ÿ©=Õ’M—%¡9(…¿¡≠,≈P¡YΩe•ƒÕƒŸië±…©…—’Öë=)•π±·—ÿ·Ÿ≈Õ@–Õd—È-¥≈-]i1¨·ÈYiL…!Èë©M(¡e•ië9-©E·’)Aë4Õ\…•M»≈•%I¡·<›·êÕ…Õ-$·=¥≠h≠ç¡¥Â…≈E•E¡àÿ¡πY‰ÃÂQ9ï≈≠·‰’’A‡’â•9·!¿ƒ≈¿·!)ç¡Â‰·≠—›â·]9Uë0›ç·¡i≠Ö@·Aµ≠Ÿ≈1Ö…ÖÖM)IπΩ]°≈-—…·]›aâ•—ÖU)9M©)-U±≈¡HÂ%§‰—%µç9î’	±¨…ô=—≈U…U°·	≈D…°a)T–Ã—ëΩ≠Aò·ê–Õ‘≠<‘›=ú¿…¡©ê‘¿≈Y`≠\≈»ÿ≈ô¡!•È5ô…%©i9ÂU‹—5ôÃÂ°ôµ±-YA’—±º…µ5ô•—MhŸ≠ù·›·ç≈ÿ≈eΩÈ¿·hΩIïâ—≈ÈP—T¡ôôÈh›ïå’i9¡I©AÂ)â=°•ÈÕ-<¡…P–»¿ÂXÂ¡¡%—I —¡åΩ›·1—Â@—9È!π<¡1±Y=]Lÿ’°Y¥»…ÈA9@’‹…Âº≈9≠»»›Q@…-a¿…¡ƒ¡·ƒΩ‰ÂIE≈Âò‡ÕêΩ’,º’)!•!°È›Â¨‘›	ÂY•Ÿë)·X› —1Q†Ÿ5ÿ‹Õ!8›MË·U≈AÖ]·aÕA·!)IIπ-%M≈ÕÃ—Ÿiπú·1A°±Q!Öπ%ç)M)¥…Ë·(›πÕÖhÂÿÿΩQ·5]ÈY=›¨·9·YŸΩ-=¿·ïâô=P…¨¨≠Ω—‘’·ÂŸ]iaùπçôPŸ	9=,·Âçò·@›!,·©©ç4·X≈≠ÖÂ9]A1AºÂ,ƒ≈)¨≈ΩIÕ∞ÃÕ‰º≈L’YπÖƒÂ]’i	›—±——]Q°ÂçôÃ…≠ë…ïâ%ÂD≠‡—Ÿ±AaH…5ΩË≈0…¿Ωe-Iµ•ï•‘’YÕÂ15±e°1©=)ô•M\Õ9’%AY,»Õ!’¡aŸMe¥ÂÈ°5ΩÈ-Õ5ÈaùÈô–’â•àÿÃ·çî…¨›ÿ≈]°-Ω››ÈU∞—¿ΩUï1‹º’¡¡µ©ï=EŸ]h·UçôË›ùa≠çµô%Õd›1AπÕ]ô›…©ïHƒΩ—9∏·Yië≠Õ]≈≈ÈM%A°â›‡Ωú≈I8’M¿¡º›—·%i°¨¡ï†‡‘≈‹¿‰‹»›ë<Ÿ»Ÿ¿ÂΩ•©πç°9Ωd—UM¡å’9‘›-î…Ÿ9Õ≈5•çY)â]µ=±¡)!—)1·ΩMMºŸÖ$ÂâE`…!eôΩ•YYM`’M…8…ŸY!]ÂT’ôë(≈•%ô5]‰Õ–… ÕY±Ÿ≠IπΩ`≈°Õ<·¡Ai5HŸ‹‘≈çÖLÿ·Q-πU9…Q±≈L‡ÿ»—IÖ≈Mù±-ë4≈!»Ω›ú…!U≈1›…πD≈]©P≈ºÂ--eÂ‹‡·MU¨º…°…â(’°Ω]≠≠≠I)Ñ’•’πYA†›e]AçI›¥Ã›Aò¡¡È\¡I)ƒÕ¥ÃÕë≈A=¡$¡≈Y…¡ÿ’Ö—ï≈ï°ôE1Iiù’A9A-Ya8·Eç≠EMïÈai±e≈úÕ®’9·ºŸï¡ô—-5•`Õ’Ÿ–¿‰Õ—9A8—πÈ’…ËÃÕMπµ®—®≈=M-¥’9àº·d··†Ωµ)ôÕ≠A)Õ9]È5©©êΩ›πëÿŸÖ1U·=]Ÿ¡ae≈Èa<Õ…ÈEH—·›Ω‡…5ôπ	Âd≠ê≈‰’—’ÕUâ©Õï—1aµ1≠QÑ≠d’‘·M4Ω¡i•X»Õiº‘≠A1ËÕ≈M•i9©≠—∏·µ…I-ƒ¡8‘≈IÈ©çQ≈∞·Èâ]aù°iê›D≠ù…Y•â5I…¿ΩAÈïµ=!@·Ÿ†¡@Ω’Q@Ω›$Õ©¨ÂÈ†º’çï•·•]Â§·e5Õ±U1-Q	UÖ(ÂùŸÕÈ¡ï1i]ƒ≈∞Â))1¿Â%›ÿƒŸd»’‰·…—ô§’Ã…ë’å›-âQ·Õ¡ÕYâ≠d’·ôi°ë±UhŸaÖea5ç1`–…‹Â!M$Ω¡T¡i·π›ç±•·9]•≈ô$¿Ω1òÂUA`¡Y —Y5Â¡ÕH…ÂY-¡ºŸi1MiH‡≈·—â≈L…≠©M—1âî›QaΩôEà‰Ωa5Ö(ΩîÕ‹Â9Â≈»≠≈eπô@Õ°•e±±)©â±ƒ≈·¨ÿ’≈E≠•âçLÿ¡–≈‡’-®≈E¡Ö\…M)≠§Ÿ∞¡4ÂHŸYÈù0ƒΩa‘›ô@¨Õ®¿Â≈]â=Ödƒ≈h‡ΩŸ≠Ë›≠=]8Õ]U±i…ò»›¡ÕŸa¨¿—…1MπΩââ·)î≈8Â·—¡—IQïµ≈®≠ùïQY=(Â!Ÿ·ë¡•≈µµ’çi¿’ïïÂ‰…-È=≈Y5ÕH¿≠Öeê…Mâ-°A›ô1e•…Ö•-ô1≈I¡8≈)≈Aa¡’5îΩiºΩ§…—ôŸI¡ÈŸÂ‰≠ç¥Â¿—îÂ9»Õh≈·Õ°Âç)5]â≠]çµ·–’IÂâ-·Q!ù1a’=A5±!!4¡ô)iï° ƒ¿≠©Eïô·ëYÈ¡ºΩ≈Ë¡Ë¿ŸAP›(—,’Y§’î’·$‡·ëò·9·©±ôIA°ù9çD·°9`’M]…,…±Â$ŸŸ5ç-d¡I¡Õ∏ÂŸ5âD—Mî≠Õ≠)åÕê‡ÂŸQ‹ÿÿ·AÕ5UÈA©‰≠à‘Õ©ï$Õ…ƒ·d‰…A©ËΩ›Ã…ΩÈÂ—›=Õ…5Q…-ÖIâa)Õ—Â¡ÈQ	≠©H≠UπµçÕ’©§≈1M©E—P¡1EIQë§≈UIiaº—Âπ°≈Öâë5QYaË¨≠Öë…=0≈	ïeŸïÈ1]!%»–≈ç°-)1ââ¥’â•i≈)içà’Ö•]Ö§»≠›ÖT·QQYQ5È—=…†¨≈Ö1±≈Q9@Ã¡ÖŸ®»ΩY≈eÈ)ô·µÂi•≈çAi0›`·5ï••)h‡¡—ƒƒŸÖ≠M≠¨‹—ë	Âê’à»‰…çh‡Õ	P…—ÖÈÖ(¡È<»‡‡…·àÕ©ô!ΩâÂQQ≈¡!πd¡QâÖiIÂ9=9-âMΩπD—©çôIaQYa`Õ©…»—…QY©!(≈çP…Èƒ’¿¿‘≠@≠≠Ωµ±i¥ÂÕ…±Yà·HÂQΩPÕôEŸπ5=ƒ≈©¡Më°Ω]•M±	∞ƒ·9L≈-à¡a(’=Mï9º—µë≈çï ŸôY—A1âÈπ©Uê¿Õ]π±—ô…]‰Ÿ∞Õ≈≠•AI\¿≈â‘¡9)π≈Dÿ›ë]eîÕ›ëÈYâ•U—Ö0≠D≈¡≈MÈ4≈ôùÖUŸ5®≠ŸQE]±ŸX’9Ñ—UÖh··’’]Ω…]a5=…-\·î‘Õµ-X·,—î≈Q©=°—M¥…a≈¿Ÿ•-±à¿›ï’Èi©©≠=…ù)%¨›$›))âÖâP≈@ÂY-Lƒ·Q·µ≠I©i	9I•âŸ!Â·a±==50¡Mâ<¿ÂPÕ]¡M©A‘Ω—5·’Õ¡ŸôAΩëAUIƒ»’’¨¡©ïM—Ÿ‡ÿ≠ô–’≈d’Ω0ΩŸ-]Èâë9•AÖQ©Ö§¡5‰ƒ¿·I¡Ω9Ui©a†»≈…°…Ÿ5â!≈ïÃ≠ô…]Õï(…a=—≠D…Â)¡5ô—LÕ\…]Ÿ±Ÿa—1TΩ!QaUI’%Qµ»¨Ÿ…òΩ)P—8’›…i=e(ƒÂ1ç°P¡I4…±¨Â…%±âôŸ,¡XÿÕPŸ°]≈iL›Õï]·	©Õ-ôë8ÂÂçi)-E±)…M±Öµ±Ω’¡ƒŸîÕ`…§≈%I-AÈ≠©ÂU]IUô¥ÂÕ©…±›—°ÈQµŸâµA≠’-Eô©≈]ŸŸŸ°Â»ŸP≠âƒ—çQ!!5i≈±’L¨…AHΩÈ(’›Â)Â1Q’%U≠•QΩÖAΩ›µe±ï…µŸ%±ç	…‘≠©Ω§’1=©ŸÖ¡Â<¡I9≈ëL≈ïâ-<·—M±¨ΩúÕΩ]Õ≠Öπ—AUiYT’È!¥‘’πQ`‰≠©)—»…›1î…Y±0‘¡Ÿe‰≠IA•â≠¡L¿·≠—!@Ÿ–≈M1…º…°I≈%i`‹·T¡Ñ·QA¡\Â’µ’≈e¡©…±Ÿ5Iëç‰¡ôA’¡5©1%ïUaUU-IX…Y!ââX…ëà›0›-¥–‘Ωπ,»ÂÂ\≈ƒ¿≈A›P›	·\¨≈…ôa!Mµ≈ô…°4…»Â4—’T¡·®ΩπIïÕiƒ’)ô°ëà’9EY—Q§Âë©UÑ≈°H…ëÂiåÕëïLŸïÕ†’¿ΩIâ¡ƒΩ\…¡5’µΩ•<¿Ÿ-¡·•iË’I=ô±Aùµπ†≠)µ)≈·Q¡¿º’T¨‰’ÖêΩ1¥»’≠Õ°∞‘Âµ’•9â=Â∞·,¡I)$¨≈ÂÈÖ©—Ö¡AQç°,≈=1%Ÿ	)≈(’·!·ea)Ë‰≠@≠µâ‹Ωeâaµ]…iÂ(›¡)°≈1ΩL—ÕY	H…Ÿ ≈1ç±’°§≈)h’i]Õ]â¿‘ÕeŸΩÖeƒ–ŸU≈ï¥ÿŸ¡åŸ8›UëQ9‹ºŸ¡¥’ËŸ¿ÂΩ—·‡≠¨—µ9åŸA·Uhƒ’·L¡YeÂ≈›±Q®‘Ω%`ÕYM®≠\…‰ŸΩdΩƒ…Ÿç=M§Ã›H‹Âô‘…ôÈçôçY=ë’9Yå≠ ≠iM≠π$Âô•4Ω-¡U©È±ô5I’Ii0›iç•5ÖŸ·!U]·-T≠ÈU†…çA·9Â$¡âU,≈çΩΩ¥›`‹ÂÂ$≠ï≠-—<—Ã’≈î—≠1-Ω!Ö)’Y\¿ÃÕi%·…]ii ÕY11UŸΩ!i!¿≠…±»›M’ï∏ÿ—çπï)ïç!Q-ô®…Öa%È5°i=]πi≠M©âEÂ°MŸÈ9·MëÂÕŸ-9AaEHÕ9YŸâ»…ππ—ππ©ò’4ŸË——]¡]–··	ÕYIµÑ‘ÕÈ]i%QŸ-aM°MπQEiî≈Èç…ÖH¨—Y©†Âº‡·—-‘¡¿≈YeπâQ–Ÿ‹»ÕIË»‘ÂY≠ΩïD≠¡âMë\…i-1ô—1êŸŸE’ŸÕ!)Y)ïÈÖ»≈U·1A9≈Ÿ≠iÕ=aUÈMï°ôÕïôŸ)ù‹Ω,ŸŸÂI‰·≈)YÑÕ)D¡Uëç±Ã…Âaº–—h›ëô!ΩiÕQ5iIô19AY5]UµÈi•98…5·-M¡ÖUQ…•\≠•]…·Aà›	’∞’¥—≠d’·1•çÖâa(·âΩ)Õº¡ΩM•=âi9âi’)±L¡ ›Y$≈APŸIÈY·=…5%]Aú››°ÂÖ≠·—Âå…’Èh›iHÕ¥Ÿë’ÖπŸI9ëëa‘Ω¡!±ê’I∏Â ¡§ÂAUMYâ››Ë›0≠≠Âº—•ŸïEÕÂ!)	-ç9–…EÈΩπ’¨·—…’≈)hŸ≠i·`ŸMŸiµ9·¡=i°AiMY1-·•Âç•UÈÂ©ùµâ©T»»ÿŸ±L»ÂôÑ…¨¿Ÿ¿Â·!DÂ≈ë±iô…Â•Âµ≠’Õ’9ç–’±›•U±MQQΩ¡-≠∏¡5©!]∞’¨—ÕïP≈å¡Ãƒ»≈›M<Â1≈¡π›çµΩe5Èôe)Hÿ›U…ƒŸ›hΩA≈∏ŸIÈX…Ÿ)ƒ·4—Yd≈›Ÿ≈eçŸQiiÈ¡πÑ—U·≠Èëieç`¡ëM≠ÂA·AEÈ0…∞ÂEŸI·Mµ•Y—i¡1…Id›QÈ•$¡©ëëçL…‹Â’U—M©Maò’•≠¡AEŸXƒÿÂIâAEiÕ≠YÂ-›©—,ÕµYÿ·’5i≈)±-ÂE—›Ë¡5—ÂAU1TÂôº·Â9±π©9…i)ºŸ’%âIM•IÂ\Â9MYŸ$Â9@≈§≈·Õï‡≠•ïÖT¿›a·±—≈\»Ÿ¡µ≠I’4Ωº≈∏¿·UÖëÂù≠i≠ïA!©—È!âL¿¡∏≈\¡MU∞ÂI›!©≈	H≈∞’·%±Y±©AQa9@…¡5Ÿ1i=E±‡Õ—•]QE]µ¥ºÕ∏¡!A!8‡≈âΩ•ƒ›•i·’’]IçD—≈5›µeê≠MQ!µd’-ÑÕÕIŸµ]Ö’—Y)(›¨ÿ‰Â-(¡5aµ…ô’»—∏≠)º¿›ç≠¡·ôÂQ\›¡ô¨≈§≈ô©ÿŸE¡UMUQM≠E))1MÃ…—çÈô»·Ω—AçeYMπ§›±çYI∏——ëiÈπ•1·¡’µ…%QA,’›©¡]ïMMi1Qi(¡UMπ9ÂË‹Ÿ‘·…»ƒÂΩ¡9Q†—©•ëô’·—Q≈‹–ºÂDŸ Ω›	Âhº·°ÂA(‹ÕΩ›’AIe·1iUï%’!1ÂMŸ®·…ƒΩê’≈]®Ÿ—)±—Uπ`Ã¨—hÕ-ç‹·È—QùAÖ-$ŸM¿Âô•≠Ö…±¡±]Öç°¡·IiÂ!π!]QMU¨»Õ—H—))≠•1≈úΩUiT’È‘—≈â4¡ÖëY=ÖÖëÃ≠=@Âïô≠—Y©ú≈Ö≈Ωô°eŸ)YYÈdŸ=Y›9%ëL…›i∞¡MÖ-AÖ]πù]úÕ••!Ωa=•eπ‘‘¿≈ïÃΩY¡¥’·!<…1)âΩ¡Õ‡—≠µÂ·%µM=ï·—5ÂUï‡≈]©iÖµa–¡5î≈›Ÿ·AâÈ5âë-ÕÈ@ŸA≠’@—ô©,’•¥’çç¿·AµŸ(—π≠¡UÃ…9aMT…H…È–¡µEU∞≈—‹¡)â9I)HÕP¡Mù•M\›PÕ©È’)•·9ïÖ4–·eïÈ‹≈…•Ö…ï¥’9!Mïç›±-a≈Ö9e0›<Ÿ¡	]I…°!A»ÕY9â!¥¿·‹≈5¡1çù≠’…’P≈)-§Ÿë	M‘ÂaYQ5Èµµ=aH¿·)›±‘Õê≈I ———’\ÕQ»Â)aAÕE¿·Ö•Ÿ—X’=’ALÕQ≠Q¡Õ±·P¡µD·iÖàÕπYëYÖIIï	—8›Öâôïë’)…ÂπÖ•T‡ÿ·¿…UYÂ°ç°∞ƒ≈°‡≈±Õ≠Ÿ—ΩMiH¨—±ÃÂ’≈9U≠»ÂâT≠º·È©ô›ô··‡··©@·ÈQ’X—©±ëa≠©·)¡)Uç!±ë—M‰ÂÈ=iÂYI≠—…IÕ%—¿‰¡’°≠—)§‰»≈YQY9Â59’,—Ñ’QåÂΩΩ·©!)UiåŸŸ,≈=IÑ…A]Ÿ]ë›•A4›5¿–¡=Ω°–Â¡MîƒÂ‡≈MQ%Ë¡AE·°YY…’]5Ë≠\›°’a$Â©µÖd¿Ÿ¡‡–Ω›çÕL—°Mπ∞—a©·¿≠››…∞º»›-]¡È»Ω1U•±Y@—-ï≠ô]Yï%Ω≈Èi–ÂAÿΩë≠È)ô≈Âπ’= …Ö≈\¨≠MŸçµ’•Ö≠IôEM·—ƒΩ©ÈA∞Ω•≈U·Y·ÕË—U·4Ω0Ω¡ú·1Ω‘Ÿ’±LÕÕ=’]A)(≠±-ò‘›°ò›=Ω…›π∏Ÿ-ë¥»‡¡È@·È®‡ºÂ9Èç1))]5π1I5-e†≠LŸ—≠¥…ï›’°çº≠]±=°º·=ŸUï©Öπ5ïàŸÃ≠å»‡≠ç…	ÖI\’P¡i†——ÈŸ=âïI≈iÖ¡\¡¡)∞¿¿‰–¡∞ƒ≈å—IiUYI®·ï≠ùY5Y’YIi)9—·µ§¡EI’)9-ô—Uô•,≈ï—Èπ!≈∏’5I•Q‰≠ç\—µ±à¡¿ƒŸâ§·9LÂ’ù—59Y-Â¥Ÿ·ïçƒ’ê…·i-UH≠È$≈ë≠M’Ö•MQÖ<·I)0Ÿ°±YIŸ)9a°·Ë—9·h›âÕ›·i¡••i≠…–ŸïL‡›ô]›±≠∏»Õ‰¡ôd¡9I’(¡Q¡¿›ÈM-TÕ-ïQπº—Â•≈%≈©ï-¿¡·©ïå—È‰‘—‡—ƒΩπ—0‘……ï≠I‹Õ›Ÿ5	ïå’\Â!—·AºÃΩ	)9)h≠≈aa…≈9ƒŸÕ0ÕàÂ9’πY<·ë8Ω’=…ë±1·P—Öe¡]Õ¡âÂÂÖ•I©ç©≈9	)IÂ≠1\·°L¿Ÿ1QΩπ»—Ö,ŸiπÂ±·IYÈIÈµ©π©ï%©ÈË’â—®¿ÂA]ŸY·0Ÿ,’π•âÑÂÂMU±ï‘Â≠µï°µiÑÂ≈9=Èâ1Õ–…≠AaYMÂŸŸ%5¡)=(ΩÕ¥≈–Â∏≈•h’›·»Ω¿Ω©·5Y¡≈9—°]·ÂQçï©¡ï]Ö±1]—1)MUÖ©5Ë…¡AEQ,Âô†Ÿ…)aIë©≠ëëaÂïÈÂ’•π9‘Ω]A	µMUÖ ΩâeÖçI»Â’Ω•Ö±i≈›·ô‰≈¡ÿŸ•‰¨Ÿ…0º›çI≈HÕ≠ëô±(≠]—8ΩU]`ÕYiò·»—Ö©Ÿ$ÿΩ-UI≠—π®ƒ≈)!1Õ])…≈ΩçŸÈAe’ç—M§…≈M¡	·Â)·—·AëçâAΩΩÿ…Yiµ(ºŸU…µ(‡Ω±-’U9ùUïç°≈L≠…!iÂM)•A-µ9AÕ5’≠≠‘—›±U—1Mi…ôa’ï‡’Õ‘‹ƒ·IQò¡∏‡…ë–…πà‹≠ƒ·¥Ω±I%LÕ1≈ΩåΩQ…ÈµaÈE¨Ωçô1ëâUÖò‰—·ôŸ-º·A±@ΩQôIππ•ôÿ—Õ\≈πaÈç)U•ÂµEçâ…(≠ë8—±‘ºÕMïëL…‰≈»‹Â≈·≈YPΩ‡ÂôŸ ≈-—º’·ôô®Ω¡I]•ÖÕi!hÕ]i…5I≈Q%±4ƒÂ¨›È¥Õî·—’-…≠≈T’ÈŸ≠]ŸD≈∞ÕU—AUYçŸ@¿≠@¿ΩÈ1eâ]`¡11Mµº≈•°¡—))âEµ¡Õ•%≠∞¡%•1ÃΩÕ’≈!Y…©»·¡çŸ‰≈¡ÿŸ•‰¨Ÿ…0Ω<ÕUê’!`’Mô±…Qò≈∞‰≈]`Ω9’º›Â=ŸÂ±(≈—πÕdΩÖ$Ÿa≠—≠º¡ÖM!Ω‰ÂT≠AçôD…ŸPŸë9	5M—’ie±%ƒÂ·ïT≈i))1ôÖ)1È-eÕà≠ÕU—ôçÑ≠¡Ö‰≈åΩÕ¡9ë!î≈IàΩ-ïë`Ÿ=©à…•9–Ÿ¿’ëiiµ,¡È)U•Ã»ÂÕπMUµ…%1aaIIŸ11º…úΩçπ›%ŸeEÂ‘·XÃ≈ÂâUH›≠Iÿ¿Ÿ0·!›ŸëT‹‹≈ÈÈ±Ñ’â	¨ƒÿÿŸMÂ∞≠–ÕÂπ‰’-≠ÖÖÖ ›‡¿¡I¿’ï≈≈¡•e·A)ÈÖôiÖ‘¡MΩU]E’I≈È’9Ÿç¡ô-QÂQP›Ë…¿›ÿ≈Ÿ——5ò≈å…YY¥ÕA=%iç©Õ9±-T’)≈%©‰≈1(≈M±—¡UîÂ	≠±ëôΩ%•ŸôP’¨·1â∏≠µ)%Ω5AâY<≈ÕYa1ç9iIÂhƒ¡\‹≈Uï¡·âa»≈T·iYÖå¨·®…î≈‰¡›µÖïµ¡ÖÖ0…M≈•—EΩ·≈9ô)i%≠¿Õ —πΩD¡µŸ1]§ÕQI-ëΩh»ÂAŸ0Õ•5…ŸΩ≠!±’Y‹›È-)±UƒÕ…1!±)±ŸAIπ≠ŸµL¡â±ƒÂ°Ω5Ÿ≠º—(—•µ(’Ÿ(Ωë∞Ÿ,ÂUô	i])π·•	ââ∏≈M…ÕÈaâŸ…(ŸT¨¡iµi5’-\≈…—1`…!≈(Â≈¿‡—ë5çA·=A5-a@—aii=Õ)T‰≠Q]±%µ=…ôò’â¡ΩQŸçATÂ≠©Ω]Ω»›IP’‹’-’‰‹≈\› Â=Qô-ƒº·ΩôXΩ$‹≠πÈ°`‰¿Õa≈%QÕ!-•ŸÖY=ÕI\»≈≈âAY=≈TÂëŸŸΩπ5Aa–¡ÖÖe©ÂQeÕ’=,»¡1EÖ≈±IÖH¨—›)°Ω≠¡U%ââQâYçi1ÑÕ%©≈9¡›©XƒÕ∞ÂÂI!8›1H—âï®—≈)≠…)°’Yπ9∏›)Qi—ƒΩÖ¡Ÿ’∏Ω’ÖâÕï5PÿºŸH›±9ëY’=±≈U…@≈πÖƒΩ›â1UI°©9µ≈òŸÖAÿ—)’ºÕ]¡-)¨ƒ·∏’MQI!ÖÖIÂº›YïA1àÿÂP·9·∏ÂùÃ…–…5Qµ…ïô¡e¡ùºÕŸeYπ†≈°\≈…9•—h…i±—1âÖπ¡1I≠—HŸêÕYQ°Ω¡D‘≠%Ω•≈π!§—=<—M,›9UI!Y≈π°È‹Âº·È…Y1,·±IiçdÂÕÂ‘¡MÕ•EhÂ·Ö9‡≠»¿¿Ÿ≠ï••!eÕ·ç®·U·A¨·!ùïËŸ0ÂÂTŸº’‹…ôd·Õe±e·Ωai5i≈ç°≈e±M=≈ëë1Ñ—¿ÕçπÖ…ç`¡Â›h—ÖµÖe¿·π–ƒÂ∞»Ÿ…U\Ω)Eç!çâ‡¨≈e‘›¡≠QπeÖ•Y›]¡QM%1I®¿¡9]›ŸY1ëΩa’ëA¡\‘≈YQ‰‡≈ï›%Ω–ƒŸÕÈY5,‡Õ°’›¿≈‹≠‘Ÿ∞…1–¡È1©--5›πYÃ’§ÂÂ±9»¿¡5Â1Ωa•=…•14≈âÈY9a¨Õ—ëùÈYY`‰Ã≠aâ†≠	—E…°,—-¡ëùëçŸµÂ-Â›ë©‡…AA9µ°©…1a=ULÂµ‘ÕUŸ]Ãÿ‡¨›QXº·Öe®Ÿ4≠›!Ã…≈ÿ’µ…PΩQËÃ≠âÖ-9ïΩÖLƒ≠e›µÂ)1âë—·›≠¡0…)4≈5≠`¨Ÿ<≠πŸô!Q!¡‘ÂAH›…-±9@Â≠)ïŸ5ôi5πŸâëëŸaPŸ9M≠)h≈Ω¥¡ŸÖ·≠-‡≠9e—ôµù¡Ö)»·5¨¡±È=âôe`¡∏¡ÈŸ—ÂπYQÕ±Ω9≈È)…î…»≠’i,›L…ô§…—ÿƒ¡∏Â]ùh…aÕÈ…·©µΩë≠©°Ÿ±≈ŸAUïçUÖLΩ	ç≠-Ã¡Ω))≠·Y‰ÂÂÈïMi%9—Q∏¡!Ωd·Ÿ•’!–·I•ëU·—A-ë¿ÂaÕ‡…âî—î‘‹Â≈µ≈≈,—©ôôïê—‡Ÿ‡’-E©	ÕeÖƒ–Â¡`ÕÕHŸâÖ==5Õ=’·`≈ç·Öµ—M±È©T…Ω≠±»ƒ¡!9Q›ëU·â’$·%•0Õi9UaƒŸ≈â5a≈ôï∏Õ¡¡•4›î›¡·–—â5Ö1°‰…¡È…TŸôU‹»…ÕH’≠°1ç–›±ë¡1çÂÂÖπ!M)ΩaaQ›%·4·@ΩAÖ¡Â]’‰‹·‡Ω%—Ö-ΩπÖµ≈≈)µµA·âI©5ëA!ÂQ±9ùY—…çHƒÕÈÖe—ÖúÕâ=±…±¡1â¡≈Ñ≠ç¿ÂÂ°∏ƒ…I≠i≠E…a›≈È•‘›A’·È©ÖaëÑ›@›‘≈UçAQ98Ÿ≈5h‰‹—ïçh≠a§…â°ƒŸ	µÕ-’¡Ω…≠=)M±Ö\ÕÈàÕ)î≈aÈLƒ·êΩ•AiÕe•πQëŸ9›çQ›¨…ïïπôA1‹‡—HÂ¡≠©’a≠)≠L¿Ÿ	≈\≈,…—î›Ÿ’-@≠»ÃÂQUaù≠©AEÖIŸ‘—1åŸ¿≈ï!)¨—°AŸâ•,≈eaâ1Ë‹›iù±Ö%P≈I≈¡MË≈YÈ98Ÿ¡1‘ŸÈQ‡Âπ	i¡π•â·@—ú¿Ωï	•ï58ƒ›†…1ah¡ÈÕ4Õπ-1ƒ—±·	πIA’9ëç·=%çXÿΩaïµAÂëÕA-µ)—\…’·Èê›<¨‹Ω›âùîº¡Öi‘ΩòΩâº—®·e4Ÿ≈çÕ…Õ=·ÂŸ•‘Õà›1	ÂYŸ¡UÕ±Âi	Ö¨…ÂI=9)))âQ4≈15,›≠·–—Õ»ÕYIY5Iµ≈aIê≠YA!eç≠1¡≈iÖUµ—M¨≠ÕÂP≈5≠¡(·©Uò¡4Õ=§¿≈aŸ)≠M’5·©°)5Ÿ5°·π≠aMiÑ›Èô9eëi•Ÿ-ëA’<·–·’iÂ—Ÿ…(ÿÂïµΩ—»»Õ-»≠1ïÖΩY! ¿·i1’¡®»Â!•·aL¿‹–ÿ—‰’çL¡ï›±5ÈUÖò¡±≈5º≈QŸ9a-ΩÈ¡•Aÿ≈°@·A11,—Ÿ)1±’I$›‰¡µ¡¥·°·∏Õ•iç)<·—iâƒ’MQMÕ’πIÖQ$Ω°ï©=ê—Ñ…åŸŸï¿≠-9Ω’1ŸΩ)âƒ¡…5çùT·—Â—çaÈ’ΩçÖ5µ’Ö¡—›±M%Ë›ŸÕ%I…≈π≠È–·Qç…µçIÂê‰Õ·î–ƒ—âA…±i±MYÖ,ŸÑŸM9%¡≈9Ñ¡≠i’Õç(Â›≠…MM—î·©E‹›Â≈=Ñ≈aa-)©Y¡¡A•	·°È≈A·	â›È,≠$Â19]•¡i-]¿≈‡’ŸπÖ·%Â°—-ï)µi§≈ëÂå—°8›•ÖΩ…•µµ=â°=Â1Âº—H…dÂH≈…5ë<Ââçë-∏ÕYa©ÕÖDΩ’Uò¡≈i’ë≈ƒ‹¡IÂâ —à’9ê’)•≠ïÂŸ-¡ëAÖàÕi59·…aïâY–’•A±i)`—±»Âº≈¡π5=§ÕY5·Ÿ—,¡ÈEUô5ΩÂÂÂ-)5)®’ëiÕ≈P¡90Ÿ±âUƒ‰‘Ÿ(ƒŸ5=)’Èâ—È¿Ω!Y•µ!ëÃÿ‹≈5ÈÂ¡®ŸÕµ≠–ŸµÕâ]°ëùâ≈ÿ·…≠≈M…ïô…-@Õµe—‹Ω·ÖΩ•µA©Aπ1ï©=iÈ=ÂHΩ-i0›—YçêƒΩ¿ÕŸú…‰º≠º≈ÖiEëôI%≠≠—Mâ	¡ÂU±ÈYÖM)MU—µÃ¨ÂÃ≈1≈Ö©1·!ùI›±çÈ¡ƒÕË·Ã≠Q=-`’°),»…πIQî…QI‘…’µ°IÃÕ®Ω—≠iÑº≠eÿ›)¡î›∏‡ΩAXŸ…Öaò≠MçŸÕQÈiMA°πQ–›ÂÂÖ%•I–¿»≠!P… ›°¿¨›≈—4‹‹Ω9È…±e©5\Ÿô)]Â•A≈i—ºŸ≠ÖMXŸÂï°ïÿ¨·Y»›9≈µë¡©MQD’’e¡,≈ôL¡â	9’Ñ·πçM—ÈMê…¡9$·M)Ÿ©ò·©¿›=ƒÕ·©ô∞¿ŸïπµπMπ≈≈≈!aÕI±!≈âMëÿŸ∞≠È‹Ÿ¡’!–Ÿ-%¿·±Ω°±©i1≈≠Âd¡Y°à·∞≈1ôY‡≈›ÂM±)î·ÈAΩE•i•=Ö-≈Ω•5È—πL·ÈπIàŸYUQ’U•)e5¥Â©9…!AYÂ≠$≠©=ï¡·¨¨·πQΩ¡@¡≠d—î¡âÃ¿·AaYQ<·UÈ5Mπ†ŸΩ≈’I!=)±1ÕiÈh›¡à…µ≈•πi5πŸ,…≠≈P›U9ƒ≈)Aå≠5ôÿŸ]Èî…©A1‡ÂaQ·’¥≈à≈YÈ•h’ïππ@≠‘Âe›µÑÂÂ·çïMU)¡ºÃ≈ÂAA-MπçÑ≠π•]πUë=a1≈©ô	»ÂA’ëîÕëô¨≈ëô¨¿Ÿiâ1ΩºŸ%9®¡L›ÂU…8›±π»–›I¡∞ÃÕMç)MË—…d’ai—\—±%D≠U‘¡ââç©‰Â¡çù’â‘’ÖY!…’$≈©E’ùπ-i’·≈‹›ç∞—πU@’iUe·-âïëÕâ°M—¡I°Ÿµ-9-ç5È1QçÖP¿≠Ω)≈›µƒ›Q°@·	πÈÈÖYYâ©9·â’Yú—Õ‡Ÿ‰¡——1°…¡≈¡·(ÂMAUI≈<‡Ÿ5§¿—≈‡Ÿπ!ΩY·iU9¡ëπÈM…Ω—\–»Ã…—QƒÂëµ•]iÖ15’πU)≈›Ya5=ëY·i¡¡9·¡…Ö—ÕÕëÕh‘›eë… ’- ≈·I–≈-±Ω9`¡Ö•ëMî‡Õ‹›ç‰—¿–›•ëÈ`≈Y•†Âà¿·≠…\—Â≠±%©—1ëM›∞ƒ‡ÂL…¡9·i(≈QY°ê…-i‹›åº—∞¡=–≈È—’†’Q9§Ÿâ-aU≠Ω¥Â¡Ö±»Ÿ≠î¡•ATÂ≈≈›XÕ%¿’Ã»—È]≈ƒ› —MÂ\≠ïMAπ!ùA4›Y8Ÿ¨¡à»’Hÿ≠≈ÖLŸÖÖ•ç…Ö±ù…—Ae	M’Ÿ1ëT–Ω’çUÖ®¡Uπ·4Âò≈I›P…ââµå›’µ=-≈çAH’HΩ›	â$ºÕ≠ô›ÿ›Õ—ëT¨ƒ≈πº·ºΩ›—≠ò›Â@—	@›Õ—ëP…’ÃÂ!± Ω]Â@‰’ ·®‰…]’¿›a]ÕU=,Õ•—IµÈ4»…≠≠±)ƒ·ë‰Ωù<ÿÕI5e©›å≈Y]i‰›°ëA†≠]ïM›âMÖå≠ÑŸâƒÕ±Ö·h’ê¿ÂLŸ¡E]∏Ÿ9MAeIïA®›‡·È‡≈‘’â’iµå‘’PΩ%ïπe≈¡µπ,≈)·â%ÂÃ¿’π°Mµµ…IÈIçX›•≠5Õµ¡a…Ÿê–¡¡9–¡‘‡—π¿ƒŸ¿Ÿ©—Ãƒ≈Y‡Õ±<≈Uô§·ŸX‡≈‡Ωi±ëƒºÕ±©‡·…¥‘’4›,…ÈE‡…ŸeIMi•QU’=QŸùΩº’-)πƒÂYM•0ÂΩçH…∏—Uô@Â!‘…ïπÑ≠ôIŸŸYIÂ±<’Yô·Ω¥≠…©U¿ÂŸ—’†ÂîŸ›hΩ	ôÃ›’ÿ¡±¿—]‘’Ÿï≈‡ÿ‡Ω›M–›—·h…•eË‰Ω∞ƒ≠M±Ö≠ç°…aà‰Õç≠ia=â]µ%Âa—9!4¡ë≠’î’	Ö(ƒ·P¡!≈]---ë…Uô’Ya ≈`’·Iÿƒ·’·Ÿ!Ωë]±e]–’Ñ≈≈ï±‰Õ®≈ë≠MΩ¡!πPÂ≈±ôeIëŸ<…µπ=§≈à¡I°,¨¡]ÖAΩ§‘’°≠≈Ö°Â›¿Õ=Iâ%©≈Ö®Ÿ!Â≠’π‘’…Ö’º¡]\≈›—Â9Q9=Ÿ•E°a∞Ÿ%π!å¿‡—Âπ,ÿ≈eIT’QÂ‡ÿ≈PÿÂ≠ïe©ΩÂ¡âÑ≠¥≈i…YΩI≈ïµµ’Ÿ•%µ±aY]’©µÕÈ4—Y-]¡—Â’)µMçY≈Ω!ëU—-±H…ââÑ¨Âº—≠—¡ëï’¡ëŸA’≈(·!ΩUëÃÃº›–ÂT≈ï¡ÈÈµ@·MUQ•ï=)ππA-…U¨Õ‘¿›’‘Õπçº…Qå…Ñ›9·—πΩhŸëIâ’≈å’›ôŸΩº¡Ö¿¿—‡·4’·ππÈëQµ–¿’eAP≈‹‰¡•L–¿Â%1µ<·¡··ù—±1hÕç¡Iº¿ŸÖ¡ëÈQπ,·ë¿Ã—Ω•©Y—QâIµ%ππ•çhÃÂaI%·AΩ…aÖ%1…MôMπô≈i≈-a…ÈÂa≈i¥’È9ï¡,ƒŸ†ÕYï—aÑƒ≠5È9å‹–ºΩ≠!!±©Ω†’0≈QYΩ9-M±5D’	ÕÕë±8ƒ≠I9±ëQD¿»…†’Ö’L¡…‹ƒ≈1`Ÿ¡ΩçôçYå—®·]%¿ÃΩ¡•4Ω-%E]AX·π9)ÈïEaë`…ï…¡—YaA1M—1Ö—M)·-ÂE¡…≈a›¥ÂM≠…1ΩML¡•≠È©¨…±eM‹ÕÕ1≈ô•¡aŸ5·-e©—	1Ë›·ë›î¡ÂQ©9MÕ’Y4≠Q®·±±•9eP–›L≠T…ú≈…9]…·ÖUaQ·!Aç¡ÈX¡ïëôÕÑ›Õh’1πÂ]=ÂY¡]aπ©E¡-‰Ω=·U-)Iô≠ùa•ÈQï=¡©·∏ŸôΩ…πÈ4¡≈ï,≈aπ1MÿÕç)°5å¡Õ·U≈ëUQ≠ç±%9–≈-T—≠±)a≈MÂMiî·U’UÈπ1•1ëë9Â,—©-Uµçç=-ÕX’≈1›Ÿ—d¡°Ö)i≠ …°›¥≈µ]•X›=Â‘…∏ƒ¿≈ŸÖÿ›X‘—≈Ÿ —(≠ÿŸ5Â·Ÿ©)∞Õ…ïπ)!)Ÿ<…ÕÈ,≠Ÿ\…·≠!dÂi)¡à¡ELƒÂY±Hÿ≠›Q99U›•ƒ≈ç…—eƒ’Ë‰≠QΩ›Ÿ•©·!·©ƒŸúÂë—8‡Õ9ç°5Ω≠M]êŸU∏¡4¡ë±ê¡@Ω©Öâ±UI©ƒ…»Âë9=9Ωô›Qï’ë·ÕÂ©•‰Â)≈)<—ú…\Ÿiµ‡¡¿Ÿ)IΩMUA’——A1U—hÿ‰≈=°Â9YUË’91ëê…’»¨…∏‹Ÿ-)ùπô9â©-5ùD›-’ç9Ö)ÑÕ¿›Qâ…	M•a%aΩ©çL…—·)1ŸƒÂΩÈ§Õπº’’ —ÖŸY4’‡‡ƒ’à·µ…—Y±¨’µ9πëÕIY)UQ©Ÿ-5≠≈)ï›π!YŸ°)µaî…∞≈—ÃÂaP›)µå≈Qπ—®¡µà–Â·πeÈ•¡‡ŸIï›9©a-Ö•)Uÿ≈=D–…Ÿ±¡ç\…ô—M…ei,—µ-ÕÃ‹Â9Y9Â,—©5)-Ë–…çX’5I!»≠±…aÈaUµA9U†‰·µ± —0’I·UŸPÕΩ<Âƒ·±≈’-…·—I=ô®≠©ea±ÈAaÕIâôÈùË‡ÂAA=1)—ââ1L¡5ÑΩ	—1!ç)]πU‰·ôï9≈4–ÕëYπY¿‰›µ’%Ã≈Q≠h≈Â=‰‡¡±M±Iπïh·!ΩQµµ°≠i¿ƒÂÿ¡î¡å‰≠È»¿Â)U’Q•4‡¡5ëÂa•≈ÂiMΩÿÿ≠=Öa≠Ÿ’∏≈πëaô=!8›YP’Ã’QU±—Õ’›a)ÖU©µ≠°Õ—•Q…¿—ï%¿Õ4Ω›	U–—©YŸ±MπÕ9)©)8›‰…¿¡çX¡Mï¡!≈ï‘¡‰ÂÂïú‡…ïÈâπ°5(¡=ÈÈ4…†Ÿ$ÿÕ%â%¥Â¡µI%YÕççHŸ·»ŸîÕP»¨ÕE`ΩëÃ’•eπ∞ÂQE—!πMHŸàΩ-Ë¡A¿ÂdÂiº’)Ã—M—9…µ’Ÿ†¡A»›òΩ%	·â—Ω1µ›≠’ê’i≠I(≠¨ΩeÈ	iç≈›âΩ`ÕΩ)àÕ]âëçh…¡aÈU1$ÕUÖ,≈1ƒÕ≈5ï%ÈΩÈ¥—’ÖΩ—È5ï Õ1`…L¡Yâ5≈iT≠5Uë±Q1ôπ•—-ŸâëQ!T…·»≠πUô›a5Aa¡—MI≠A8—§≈QYâ≈·©¿‘»’Q!a›çY’≈¥≈XÃ¡d‰ÃÃ—•π=)•Aô	±ÕY5±ù)±È≠5QQ»…ë»›d¿—º≠î·©å¡µ»·î’Ö•Q¡–ƒƒ·QŸâçUT’π—©‡≠µAÿ≈ÈYY8ÿ›•’…π=ô=ïUT≠!Q——ë…®—`º…—çÃ’-eHÂ—°ÕΩQÈ!Ë’ôôÖE©’(≈XŸ¡≈AI—h¡Iππ†Ã…ëaë·ƒ‘–ÕÖ5ïÂ≈A!<≈çA5›—Ñ¨¡àŸ‹·%µ%=`·8·¨›=—	’8ÂôÖMÈ%HŸ4··î›-MÈ-µ—Õ©È…)QI·àÂ…%±MπT≠YeIi-∏¡¡0ΩÖ$¡°5i∏—)≈©4Âç$›πM5°µeÈπ≠—°â0‰Ω±U9’ÂÕ®≈Ö°I—%PΩ—=à≈ô—≈…È·AYÂù]—Ë›<¿…µiQçY\’â≈9¡µ-M9»Ÿë°ê‡‰›0ÕU®Ÿë9È’µ)•)πôMËΩ%-I°’)Q%ê¨›ô›ÖÈ-%πââïEa›°â8’îΩd»¡açEΩŸ	Aù%…πà—¡’YI•AY)h›≠±Y·∏–›IeïÖ…)U=È®…Y°âΩâçI!°5IËÕ-4ÕY¡M\ÂaÕME—4’QaYî¡$¿—D‘¿Â±–’MY9¡LÕ≈A9…çµ·≠≈°’…©I5≠¡ùΩD…Ÿiº‘Ã≠dŸôYaÃ¡µà≈i‹’!ç·çΩY›ÂÖ≠Ωç≠=I¿‡…≈’d·¡	—Q…5D»ÕAaê≈5’’¡ëÂùå·%ÈπM®≠Ë…’<·Iç%›=ç±‡Ÿ!P…ÈÕ… ‘‘ÂMa]Ÿ·aMD¡¡`ÿ›ÂUôYΩ!©°5âYÖaΩΩÖ=≠e±¡aI…›≠ƒ»Ÿa•a•≠‰·›©$Ωia…99ÂπQA-Y≈Ö¡¡π59]πÕ<≈=Y	%\Â$’‘≈Â5®≈Y≈HŸ…•‰·9’†ÿŸ∏¡!‰¡\›µi—·µiËÂ‰ÂQaQ©Y,›U]ÕI9Õµ›5¡›Q‘ŸÑ·—…a¿ÕA‰ÃÂ»›9›πë∏¿»ΩïƒÕƒΩ)‹Õ»‡≈âIÂëU!°Q‹›°<‡≈•°•≈êƒ≈9à’-≠i∏›Q8–ƒŸ∏Â)©Õ•·H’D·Â=Õ‡ΩP‡‰ΩÈ]°QâÖUΩE≠≠%E]•¿ŸI›•%â=≈%‹’ù≠%©1D≠¡ —≠…µQeAUa©@’‹¡¨’-I±âU-ïi$≠Ÿ›Ö±≠Ω©Q’%®…1$¿Ÿ≠aEE…©…Â5]‰…ƒ›-ÈMÈ¥’U9¡QMΩ9ΩI‘›eÈiº≈h≈ATÃÕ≈9Ñ≈)5§ŸIÖ•ë4‡Ã≈©%4·•·±=Â5Yµ9µúÃΩÈ]10›LŸô‹ŸHÂ•π±-ÑŸ—19Ö—ë99ŸE9(Õô»‰≠…%ú’a≠≠‘≈•DÕÖÕYaÂaâaÖΩçeM‹…ï•Q4≈)I—ê…±’5©X≠ÕI°ú›Ÿ…-Aâà—µ]â5d≈EΩ]=å≈M≠Ma∏ÕYÂ1	-=ôΩ±QÈUŸE±5Õ≠Ñ›•4≠°°•Ö-dÂY•…Õ!Ö]QàÂΩº’±≠âÖ\‘·—\Â1ç≠¥≈-T¡±·ú≈Q¡5≠ŸÖúÕ9ëôÂQ	â5…i!©95(¡EaTΩH≠(Ÿï ºΩMµ%‹›EM%§¡‡ÕÈ°--H’Èπ·9›=Yò’âòƒ›ëŸ•Ã¡≈YUh·ieò’òÿÂ–Ω›ÿΩ›≠IºÂYîÿŸÂô≠hΩ»»ÃΩ!»Ω-D¡ï¿Õa]P·©@Âî»Ω›ÂòÂ%ÖAT›……(≠I∏≠Ÿâò‰ÿºŸD¡ï¿Õa]P·©@Âî»º‹ƒº¡°ºÂQ’’Õ∏’òÿÂ–ºÕ»Ω¡HŸπëëiAÂ4ºƒ›àΩŸ`ΩM®≈<ÿŸÂô≠hΩ»»ÃΩïÿ≠≠9!≈êƒ≈¨Ω%ËΩ›àΩŸ`Ω°ºÂQ’’Õ∏’òÿÂ–Ω›ÿΩ›≠9!≈êƒ≈±0≈Yà’’§Â∏›Y%µê–≈å…T’Èa<‰›8…°ëÂù—9-e›È	-E5•5—·%µùπê»–≈9ò≈MÂ)IôÕ4≠¡=µ©‡Â≠Q))—	ïL≠ùÖ)ô=EÂaù°@…ç¡Õ§¿…±¿›—=ù›Âµÿ≈≠›·)±ΩŸ		ëAΩÂÂaù°)ôUI=e-·ieaM])â-Y)…$‡·±±1©I±(’,≠hÿ‘·¡›±¡MÖŸïπEç±ôI=e•i¡•ô)‹Õ=¡µ)•µi¡•…π©∞·µI	‹≠≈)e±P’U§≈≠·ò‡≈=]Ω©âÖAQQå»¡ù≠9≠…P–…µΩŸQ‹¡iÈ=iµA9ÑÕ›ë5Q≈Q9U·ÂË—ô≠π‡¡=·‡’âîΩô—1ò·…Öëô—ç—ô9Â›	—P›•9≈ôçE	Ωa°Ω¨Ÿ≠âT¨—¡1aaQ‹· ¡ô·EeeI9µ’ΩâM∞ƒ≈M=eÕ•%±,¡P¿≈@…©-•µ9UÂµh…°µ©YAΩ≠ùiôE›))©Õ%HÕ\¡¿ƒ·ë%°≠·≈ÖM±·ô›°Ÿ`Ââ≈%°π9—99±º…ù≠›≠±Ω)Öeçù ºº…DÙÙàÏ()çΩπÕ–ÅA}]%Q ÄÙÄ‘‰‘Ï)çΩπÕ–ÅA}!%!PÄÙÄ‡–»Ï)çΩπÕ–Å5I%9}`ÄÙÄ–‡Ï)çΩπÕ–ÅQ=@ÄÙÄƒ‰¿Ï)çΩπÕ–Å=9Q9Q}!%!PÄÙÄ‘»‘Ï)çΩπÕ–Å1%9}!%!PÄÙÄƒ‘Ï)çΩπÕ–Å	=e}1%9}]%Q ÄÙÄ‡‡Ï)çΩπÕ–Å%9QI}IU1I}AQ ÄÙÅ¡Ö—†π©Ω•∏°¡…ΩçïÕÃπç›ê†§∞ÄâπΩëï}µΩë’±ïÃΩôΩπ—ÕΩ’…çîΩ•π—ï»Ωô•±ïÃΩ•π—ï»µ±Ö—•∏¥–¿¿µπΩ…µÖ∞π›Ωôòà§Ï)çΩπÕ–Å%9QI}	=1}AQ ÄÙÅ¡Ö—†π©Ω•∏°¡…ΩçïÕÃπç›ê†§∞ÄâπΩëï}µΩë’±ïÃΩôΩπ—ÕΩ’…çîΩ•π—ï»Ωô•±ïÃΩ•π—ï»µ±Ö—•∏¥‹¿¿µπΩ…µÖ∞π›Ωôòà§Ï()—Â¡îÅAëôQï·—I’∏ÄÙÅÏÅ—ï·–ËÅÕ—…•πúÏÅ‡ËÅπ’µâï»ÏÅ‰ËÅπ’µâï»ÏÅÕ•Èî¸ËÅπ’µâï»ÏÅâΩ±ê¸ËÅâΩΩ±ïÖ∏ÏÅçΩ±Ω»¸ËÅÕ—…•πúÅÙÏ()ï·¡Ω…–Å—Â¡îÅΩ……ïÕ¡ΩπëïπçïAëô=¡—•ΩπÃÄÙÅÏ(ÄÅµΩëîËÄâë…Öô–àÅÄâô•πÖ∞àÏ(ÄÅŸï…•ô•çÖ—•ΩπQΩ≠ï∏¸ËÅÕ—…•πúÅÅπ’±∞Ï(ÄÅÕ•ùπÖ—’…ï	±Ωç≠Ã¸ËÅΩ……ïÕ¡ΩπëïπçïM•ùπÖ—’…ï	±Ωç≠mtÏ(ÄÅë•Õ¡Ö—ç°Iïôï…ïπçî¸ËÅÕ—…•πúÅÅπ’±∞Ï)ÙÏ()ï·¡Ω…–Å—Â¡îÅΩ……ïÕ¡ΩπëïπçïM•ùπÖ—’…ï	±Ωç¨ÄÙÅÏ(ÄÅ…Ω±îËÄâ…µ…ëç}Õ•ùπÖ—Ω…‰àÅÄâ…ΩÕïÖ—ï}Õ•ùπÖ—Ω…‰àÅÄâ©Ω•π—}Õ•ùπÖ—Ω…‰àÅÄâÕ•ùπÖ—Ω…Â}ëï±ïùÖ—îàÅÅÕ—…•πúÏ(ÄÅπÖµîËÅÕ—…•πúÏ(ÄÅΩ…ùÖπ•ÕÖ—•Ω∏ËÅÕ—…•πúÏ(ÄÅÕ•ùπïë–¸ËÅÕ—…•πúÅÅπ’±∞Ï(ÄÅ—ïÕ—=π±‰¸ËÅâΩΩ±ïÖ∏Ï(ÄÅÖÕÕï—Iïò¸ËÅÕ—…•πúÅÅπ’±∞Ï)ÙÏ()ï·¡Ω…–Å—Â¡îÅΩ……ïÕ¡ΩπëïπçïM•ùπÖ—’…ïÕÕï–ÄÙÅÏ(ÄÅ…Ω±îËÅÕ—…•πúÏ(ÄÅâÂ—ïÃËÅU•π–·……Ö‰Ï(ÄÅçΩπ—ïπ—QÂ¡îËÄâ•µÖùîΩ¡πúàÅÄâ•µÖùîΩ©¡ïúàÏ)ÙÏ()—Â¡îÅM•ùπÖ—’…ïA±Öçïµïπ–ÄÙÅÏ(ÄÅ…Ω±îËÅÕ—…•πúÏ(ÄÅÖÕÕï—IïòËÅÕ—…•πúÏ(ÄÅ¡Öùï%πëï‡ËÅπ’µâï»Ï(ÄÅ‡ËÅπ’µâï»Ï(ÄÅ‰ËÅπ’µâï»Ï(ÄÅ›•ë—†ËÅπ’µâï»Ï(ÄÅ°ï•ù°–ËÅπ’µâï»Ï)ÙÏ()ô’πç—•Ω∏Å›…Ö¡Qï·–°ŸÖ±’îËÅÕ—…•πú∞Å›•ë—†ÄÙÅ	=e}1%9}]%Q §ÅÏ(ÄÅçΩπÕ–Å›Ω…ëÃÄÙÅŸÖ±’îπ…ï¡±Öçî†ΩqÃ¨Ωú∞ÄàÄà§π—…•¥†§πÕ¡±•–†àÄà§πô•±—ï»°	ΩΩ±ïÖ∏§Ï(ÄÅçΩπÕ–Å±•πïÃËÅÕ—…•πùmtÄÙÅmtÏ(ÄÅ±ï–Åç’……ïπ–ÄÙÄààÏ(ÄÅôΩ»Ä°çΩπÕ–Å›Ω…êÅΩòÅ›Ω…ëÃ§ÅÏ(ÄÄÄÅçΩπÕ–Åπï·–ÄÙÅç’……ïπ–Ä¸ÅÄëÌç’……ïπ—ÙÄëÌ›Ω…ëıÄÄËÅ›Ω…êÏ(ÄÄÄÅ•òÄ°πï·–π±ïπù—†Ä¯Å›•ë—†ÄòòÅç’……ïπ–§ÅÏ(ÄÄÄÄÄÅ±•πïÃπ¡’Õ†°ç’……ïπ–§Ï(ÄÄÄÄÄÅç’……ïπ–ÄÙÅ›Ω…êÏ(ÄÄÄÅÙÅï±ÕîÅÏ(ÄÄÄÄÄÅç’……ïπ–ÄÙÅπï·–Ï(ÄÄÄÅÙ(ÄÅÙ(ÄÅ•òÄ°ç’……ïπ–§Å±•πïÃπ¡’Õ†°ç’……ïπ–§Ï(ÄÅ…ï—’…∏Å±•πïÃπ±ïπù—†Ä¸Å±•πïÃÄËÅlàâtÏ)Ù()ô’πç—•Ω∏Å•ÕÕ’ï…9Öµî°•ÕÕ’ï»ËÅΩ……ïÕ¡Ωπëïπçï%ÕÕ’ï»§ÅÏ(ÄÅ•òÄ°•ÕÕ’ï»ÄÙÙÙÄâI5Ià§Å…ï—’…∏ÄâIÖ‹Å5Ö—ï…•Ö±ÃÅIïÕïÖ…ç†ÅÖπêÅïŸï±Ω¡µïπ–ÅΩ’πç•∞àÏ(ÄÅ•òÄ°•ÕÕ’ï»ÄÙÙÙÄâI90à§Å…ï—’…∏ÄâIΩÕïÖ—îÅΩ…—îÅ9•ùï…•ÑÅ1•µ•—ïêàÏ(ÄÅ…ï—’…∏Äâ1	<Å)Ω•π–ÅMïç…ï—Ö…•Ö–àÏ)Ù()ï·¡Ω…–Åô’πç—•Ω∏Åâ’•±ëΩ……ïÕ¡ΩπëïπçïAëô5Ωëï∞°…ïçΩ…êËÅ1çëâΩΩ……ïÕ¡ΩπëïπçïIïçΩ…ê∞ÅΩ¡—•ΩπÃËÅΩ……ïÕ¡ΩπëïπçïAëô=¡—•ΩπÃ§ÅÏ(ÄÅçΩπÕ–Å—Ö…ùï—Yï…Õ•Ωπ%êÄÙÅΩ¡—•ΩπÃπµΩëîÄÙÙÙÄâô•πÖ∞àÄ¸Ä°…ïçΩ…êπ•ÕÕ’ïë}Ÿï…Õ•Ωπ}•êÄ¸¸Å…ïçΩ…êπç’……ïπ—}Ÿï…Õ•Ωπ}•ê§ÄËÅ…ïçΩ…êπç’……ïπ—}Ÿï…Õ•Ωπ}•êÏ(ÄÅçΩπÕ–Å±Ö—ïÕ—Yï…Õ•Ω∏ÄÙÅ…ïçΩ…êπŸï…Õ•ΩπÃ¸πô•πê†°Ÿï…Õ•Ω∏§ÄÙ¯ÅŸï…Õ•Ω∏π•êÄÙÙÙÅ—Ö…ùï—Yï…Õ•Ωπ%ê§Ä¸¸Å…ïçΩ…êπŸï…Õ•ΩπÃ¸πl¡tÏ(ÄÅçΩπÕ–ÅâΩë‰ÄÙÅ±Ö—ïÕ—Yï…Õ•Ω∏¸πâΩë‰ÅÒÅM—…•πú°…ïçΩ…êπµï—ÖëÖ—Ñ¸πâΩë‰Ä¸¸Å…ïçΩ…êπÕ’µµÖ…‰Ä¸¸Äàà§Ï(ÄÅçΩπÕ–ÅëΩç’µïπ—Ö—îÄÙÅ…ïçΩ…êπ•ÕÕ’ïë}Ö–Ä¸¸Å…ïçΩ…êπç…ïÖ—ïë}Ö–Ï(ÄÅçΩπÕ–ÅÕ•ùπÖ—’…ï	±Ωç≠ÃÄÙÅΩ¡—•ΩπÃπÕ•ùπÖ—’…ï	±Ωç≠Ã¸π±ïπù—†(ÄÄÄÄ¸ÅΩ¡—•ΩπÃπÕ•ùπÖ—’…ï	±Ωç≠Ã(ÄÄÄÄËÅmÏÅ…Ω±îËÄâÕ•ùπÖ—Ω…Â}ëï±ïùÖ—îà∞ÅπÖµîËÄâ’—°Ω…•ÕïêÅM•ùπÖ—Ω…‰à∞ÅΩ…ùÖπ•ÕÖ—•Ω∏ËÅ•ÕÕ’ï…9Öµî°…ïçΩ…êπ•ÕÕ’ï»§∞ÅÕ•ùπïë–ËÅπ’±∞∞Å—ïÕ—=π±‰ËÅΩ¡—•ΩπÃπµΩëîÄÙÙÙÄâë…Öô–àÅıtÏ((ÄÅçΩπÕ–Å±•πïÃËÅAëôQï·—I’πmtÄÙÅmtÏ(ÄÅ±ï–Å‰ÄÙÅQ=@Ï(ÄÅôΩ»Ä°çΩπÕ–Å±•πîÅΩòÅ›…Ö¡Qï·–°ÅM’â©ïç–ËÄëÌ…ïçΩ…êπÕ’â©ïç—ıÄ∞Ä‹‡§§ÅÏ(ÄÄÄÅ±•πïÃπ¡’Õ†°ÏÅ—ï·–ËÅ±•πî∞Å‡ËÅ5I%9}`∞Å‰∞ÅÕ•ÈîËÄƒƒ∞ÅâΩ±êËÅ—…’îÅÙ§Ï(ÄÄÄÅ‰Ä¨ÙÅ1%9}!%!PÏ(ÄÅÙ(ÄÅ‰Ä¨ÙÄƒ¿Ï(ÄÅôΩ»Ä°çΩπÕ–Å¡Ö…Öù…Ö¡†ÅΩòÅâΩë‰πÕ¡±•–†Ωq∏º§§ÅÏ(ÄÄÄÅçΩπÕ–Å—…•µµïêÄÙÅ¡Ö…Öù…Ö¡†π—…•¥†§Ï(ÄÄÄÅ•òÄ†Ö—…•µµïê§ÅÏ(ÄÄÄÄÄÅ‰Ä¨ÙÄ‹Ï(ÄÄÄÄÄÅçΩπ—•π’îÏ(ÄÄÄÅÙ(ÄÄÄÅçΩπÕ–Åâ’±±ï–ÄÙÄΩyl¥´äâuqÃ¨ºπ—ïÕ–°—…•µµïê§Ï(ÄÄÄÅçΩπÕ–ÅçΩπ—ïπ–ÄÙÅ—…•µµïêπ…ï¡±Öçî†Ωyl¥´äâuqÃ¨º∞Äàà§Ï(ÄÄÄÅçΩπÕ–Å›…Ö¡¡ïêÄÙÅ›…Ö¡Qï·–°çΩπ—ïπ–∞Åâ’±±ï–Ä¸Å	=e}1%9}]%Q Ä¥Ä‘ÄËÅ	=e}1%9}]%Q §Ï(ÄÄÄÅôΩ»Ä°çΩπÕ–Åm•πëï‡∞Å±•πïtÅΩòÅ›…Ö¡¡ïêπïπ—…•ïÃ†§§ÅÏ(ÄÄÄÄÄÅ±•πïÃπ¡’Õ†°ÏÅ—ï·–ËÅÄëÌâ’±±ï–ÄòòÅ•πëï‡ÄÙÙÙÄ¿Ä¸Äà¥ÄÄàÄËÅâ’±±ï–Ä¸ÄàÄÄÄàÄËÄàâÙëÌ±•πïıÄ∞Å‡ËÅ5I%9}`∞Å‰∞ÅÕ•ÈîËÄƒ¿ÅÙ§Ï(ÄÄÄÄÄÅ‰Ä¨ÙÅ1%9}!%!PÏ(ÄÄÄÅÙ(ÄÄÄÅ‰Ä¨ÙÄ‘Ï(ÄÅÙ(ÄÅ‰Ä¨ÙÄƒ¿Ï(ÄÅ±•πïÃπ¡’Õ†°ÏÅ—ï·–ËÄâUQ!=I%MÅM%9Q=I%Là∞Å‡ËÅ5I%9}`∞Å‰∞ÅÕ•ÈîËÄ‹∏‘∞ÅâΩ±êËÅ—…’î∞ÅçΩ±Ω»ËÄà¿∏»–Ä¿∏ÃÿÄ¿∏Ã»àÅÙ§Ï(ÄÅ‰Ä¨ÙÄƒ‡Ï(ÄÅçΩπÕ–Å©Ω•π–ÄÙÅÕ•ùπÖ—’…ï	±Ωç≠Ãπ±ïπù—†Ä¯ÄƒÏ(ÄÅçΩπÕ–ÅÕ•ùπÖ—’…ïA±Öçïµïπ—ÃËÅM•ùπÖ—’…ïA±Öçïµïπ—mtÄÙÅmtÏ(ÄÅÕ•ùπÖ—’…ï	±Ωç≠ÃπôΩ…Öç††°Õ•ùπÖ—’…î∞Å•πëï‡§ÄÙ¯ÅÏ(ÄÄÄÅçΩπÕ–Å‡ÄÙÅ©Ω•π–Ä¸Å5I%9}`Ä¨Ä°•πëï‡ÄîÄ»§Ä®Ä»‘‹ÄËÅ5I%9}`Ï(ÄÄÄÅçΩπÕ–Åâ±Ωç≠dÄÙÅ‰Ä¨Å5Ö—†πô±ΩΩ»°•πëï‡ÄºÄ»§Ä®Ä‰»Ï(ÄÄÄÅçΩπÕ–Å°ÖÕA…Ω—ïç—ïëÕÕï–ÄÙÄÖÕ•ùπÖ—’…îπ—ïÕ—=π±‰ÄòòÅ	ΩΩ±ïÖ∏°Õ•ùπÖ—’…îπÖÕÕï—Iïò§Ï(ÄÄÄÅ•òÄ°°ÖÕA…Ω—ïç—ïëÕÕï–§ÅÏ(ÄÄÄÄÄÅçΩπÕ–Å¡Öùï%πëï‡ÄÙÅ5Ö—†πµÖ‡†¿∞Å5Ö—†πô±ΩΩ»†°â±Ωç≠dÄ¥ÅQ=@§ÄºÅ=9Q9Q}!%!P§§Ï(ÄÄÄÄÄÅÕ•ùπÖ—’…ïA±Öçïµïπ—Ãπ¡’Õ†°ÏÅ…Ω±îËÅÕ•ùπÖ—’…îπ…Ω±î∞ÅÖÕÕï—IïòËÅÕ•ùπÖ—’…îπÖÕÕï—IïòÑ∞Å¡Öùï%πëï‡∞Å‡∞Å‰ËÅQ=@Ä¨Ä†°â±Ωç≠dÄ¥ÅQ=@§ÄîÅ=9Q9Q}!%!P§∞Å›•ë—†ËÄƒ»‡∞Å°ï•ù°–ËÄÃ‡ÅÙ§Ï(ÄÄÄÅÙÅï±ÕîÅÏ(ÄÄÄÄÄÅ±•πïÃπ¡’Õ†°ÏÅ—ï·–ËÅÕ•ùπÖ—’…îπ—ïÕ—=π±‰Ä¸ÄâQMPÅM%9QUIÄ¥Å9=8µAI=UQ%=8àÄËÄâA…Ω—ïç—ïêÅÕ•ùπÖ—’…îÅ’πÖŸÖ•±Öâ±îà∞Å‡∞Å‰ËÅâ±Ωç≠d∞ÅÕ•ÈîËÄƒ¿∞ÅâΩ±êËÅ—…’î∞ÅçΩ±Ω»ËÄà¿∏ÿ‘Ä¿∏ƒ‘Ä¿∏ƒ‘àÅÙ§Ï(ÄÄÄÅÙ(ÄÄÄÅçΩπÕ–Åëï—Ö•±dÄÙÅ°ÖÕA…Ω—ïç—ïëÕÕï–Ä¸Åâ±Ωç≠dÄ¨Ä–ÿÄËÅâ±Ωç≠dÄ¨Ä»¿Ï(ÄÄÄÅçΩπÕ–ÅπÖµï1•πïÃÄÙÅ›…Ö¡Qï·–°Õ•ùπÖ—’…îππÖµî∞Å©Ω•π–Ä¸ÄÃ–ÄËÄ‹¿§πÕ±•çî†¿∞Ä»§Ï(ÄÄÄÅπÖµï1•πïÃπôΩ…Öç††°πÖµï1•πî∞ÅπÖµï%πëï‡§ÄÙ¯Å±•πïÃπ¡’Õ†°ÏÅ—ï·–ËÅπÖµï1•πî∞Å‡∞Å‰ËÅëï—Ö•±dÄ¨ÅπÖµï%πëï‡Ä®Äƒ»∞ÅÕ•ÈîËÄ‰∏»‘∞ÅâΩ±êËÅ—…’îÅÙ§§Ï(ÄÄÄÅçΩπÕ–ÅΩ…ùÖπ•ÕÖ—•ΩπdÄÙÅëï—Ö•±dÄ¨ÅπÖµï1•πïÃπ±ïπù—†Ä®Äƒ»Ä¨ÄÃÏ(ÄÄÄÅ•òÄ°Õ•ùπÖ—’…îπΩ…ùÖπ•ÕÖ—•Ω∏§Å±•πïÃπ¡’Õ†°ÏÅ—ï·–ËÅÕ•ùπÖ—’…îπΩ…ùÖπ•ÕÖ—•Ω∏∞Å‡∞Å‰ËÅΩ…ùÖπ•ÕÖ—•Ωπd∞ÅÕ•ÈîËÄ‡∏‘ÅÙ§Ï(ÄÄÄÅçΩπÕ–Å—•µïÕ—Öµ¡dÄÙÅÕ•ùπÖ—’…îπΩ…ùÖπ•ÕÖ—•Ω∏Ä¸ÅΩ…ùÖπ•ÕÖ—•ΩπdÄ¨Äƒ–ÄËÅΩ…ùÖπ•ÕÖ—•ΩπdÏ(ÄÄÄÅ±•πïÃπ¡’Õ†°ÏÅ—ï·–ËÅÕ•ùπÖ—’…îπÕ•ùπïë–Ä¸Åπï‹ÅÖ—î°Õ•ùπÖ—’…îπÕ•ùπïë–§π—Ω1ΩçÖ±ïM—…•πú†âï∏µ9à§ÄËÄâAïπë•πúÅ—•µïÕ—Öµ¿à∞Å‡∞Å‰ËÅ—•µïÕ—Öµ¡d∞ÅÕ•ÈîËÄ‹∏‘∞ÅçΩ±Ω»ËÄà¿∏Ã‘Ä¿∏Ã‘Ä¿∏Ã‘àÅÙ§Ï(ÄÅÙ§Ï(ÄÅ‰Ä¨ÙÅ©Ω•π–Ä¸Äƒ¿¿ÄËÄ‡–Ï(ÄÅ•òÄ°Ω¡—•ΩπÃπë•Õ¡Ö—ç°Iïôï…ïπçîÄòòÅΩ¡—•ΩπÃπë•Õ¡Ö—ç°Iïôï…ïπçîÄÑÙÙÅ…ïçΩ…êπ…ïôï…ïπçî§ÅÏ(ÄÄÄÅ‰Ä¨ÙÄƒÃÏ(ÄÄÄÅ±•πïÃπ¡’Õ†°ÏÅ—ï·–ËÅÅ•Õ¡Ö—ç†Å…ïôï…ïπçîËÄëÌΩ¡—•ΩπÃπë•Õ¡Ö—ç°Iïôï…ïπçïıÄ∞Å‡ËÅ5I%9}`∞Å‰∞ÅÕ•ÈîËÄ‡∞ÅâΩ±êËÅ—…’îÅÙ§Ï(ÄÅÙ((ÄÅçΩπÕ–Å¡ÖùïÃËÅAëôQï·—I’πmumtÄÙÅmmutÏ(ÄÅôΩ»Ä°çΩπÕ–Å…’∏ÅΩòÅ±•πïÃ§ÅÏ(ÄÄÄÅçΩπÕ–Å¡Öùï%πëï‡ÄÙÅ5Ö—†πµÖ‡†¿∞Å5Ö—†πô±ΩΩ»†°…’∏π‰Ä¥ÅQ=@§ÄºÅ=9Q9Q}!%!P§§Ï(ÄÄÄÅ›°•±îÄ°¡ÖùïÃπ±ïπù—†ÄÙÅ¡Öùï%πëï‡§Å¡ÖùïÃπ¡’Õ†°mt§Ï(ÄÄÄÅ¡ÖùïÕm¡Öùï%πëï·tπ¡’Õ†°ÏÄ∏∏π…’∏∞Å‰ËÅ…’∏π‰Ä¥Å¡Öùï%πëï‡Ä®Å=9Q9Q}!%!PÅÙ§Ï(ÄÅÙ(ÄÅ…ï—’…∏ÅÏ(ÄÄÄÅ¡ÖùïÃ∞(ÄÄÄÅ›Ö—ï…µÖ…¨ËÅΩ¡—•ΩπÃπµΩëîÄÙÙÙÄâë…Öô–àÄ¸ÄâIPàÄËÅ’πëïô•πïê∞(ÄÄÄÅÕ•ùπÖ—’…ïA±Öçïµïπ—Ã∞(ÄÄÄÅµï—ÖëÖ—ÑËÅÏ(ÄÄÄÄÄÅ…ïôï…ïπçîËÅ…ïçΩ…êπ…ïôï…ïπçî∞(ÄÄÄÄÄÅëÖ—îËÅπï‹ÅÖ—î°ëΩç’µïπ—Ö—î§π—Ω1ΩçÖ±ïÖ—ïM—…•πú†âï∏µà∞ÅÏÅëÖ‰ËÄà»µë•ù•–à∞ÅµΩπ—†ËÄâ±Ωπúà∞ÅÂïÖ»ËÄâπ’µï…•åàÅÙ§∞(ÄÄÄÄÄÅŸï…Õ•Ω∏ËÅÅYï…Õ•Ω∏ÄëÌ±Ö—ïÕ—Yï…Õ•Ω∏¸πŸï…Õ•Ωπ}π’µâï»Ä¸¸Ä≈ıÄ∞(ÄÄÄÅÙ∞(ÄÅÙÏ)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Åç…ïÖ—ïΩ……ïÕ¡ΩπëïπçïAëò°…ïçΩ…êËÅ1çëâΩΩ……ïÕ¡ΩπëïπçïIïçΩ…ê∞ÅΩ¡—•ΩπÃËÅΩ……ïÕ¡ΩπëïπçïAëô=¡—•ΩπÃ§ÅÏ(ÄÅçΩπÕ–ÅµΩëï∞ÄÙÅâ’•±ëΩ……ïÕ¡ΩπëïπçïAëô5Ωëï∞°…ïçΩ…ê∞ÅΩ¡—•ΩπÃ§Ï(ÄÅçΩπÕ–Å¡ëòÄÙÅÖ›Ö•–ÅAΩç’µïπ–πç…ïÖ—î†§Ï(ÄÅ¡ëòπ…ïù•Õ—ï…Ωπ—≠•–°ôΩπ—≠•–§Ï(ÄÅçΩπÕ–Åm…ïù’±Ö…	Â—ïÃ∞ÅâΩ±ë	Â—ïÕtÄÙÅÖ›Ö•–ÅA…Ωµ•ÕîπÖ±∞°m…ïÖë•±î°%9QI}IU1I}AQ §∞Å…ïÖë•±î°%9QI}	=1}AQ •t§Ï(ÄÅçΩπÕ–Å…ïù’±Ö»ÄÙÅÖ›Ö•–Å¡ëòπïµâïëΩπ–°…ïù’±Ö…	Â—ïÃ∞ÅÏÅÕ’âÕï–ËÅ—…’îÅÙ§Ï(ÄÅçΩπÕ–ÅâΩ±êÄÙÅÖ›Ö•–Å¡ëòπïµâïëΩπ–°âΩ±ë	Â—ïÃ∞ÅÏÅÕ’âÕï–ËÅ—…’îÅÙ§Ï(ÄÅçΩπÕ–ÅâÖç≠ù…Ω’πêÄÙÅÖ›Ö•–Å¡ëòπïµâïë)¡ú°	’ôôï»πô…Ω¥°AAI=Y}1	=}1QQI!})A}	Mÿ–∞ÄââÖÕîÿ–à§§Ï(ÄÅçΩπÕ–Å•π¨ÄÙÅ…ùà†¿∏¿Ã∞Ä¿∏ƒÃ∞Ä¿∏ƒ§Ï(ÄÅçΩπÕ–Åù…ïï∏ÄÙÅ…ùà†¿∏¿»∞Ä¿∏Ã‘∞Ä¿∏»–§Ï(ÄÅçΩπÕ–Åµ’—ïêÄÙÅ…ùà†¿∏Ã‘∞Ä¿∏Ã‰∞Ä¿∏Ã‡§Ï((ÄÅµΩëï∞π¡ÖùïÃπôΩ…Öç††°…’πÃ∞Å•πëï‡§ÄÙ¯ÅÏ(ÄÄÄÅçΩπÕ–Å¡ÖùîÄÙÅ¡ëòπÖëëAÖùî†§Ï(ÄÄÄÅ¡ÖùîπÕï—M•Èî°A}]%Q ∞ÅA}!%!P§Ï(ÄÄÄÅ¡Öùîπë…Ö›%µÖùî°âÖç≠ù…Ω’πê∞ÅÏÅ‡ËÄ¿∞Å‰ËÄ¿∞Å›•ë—†ËÅA}]%Q ∞Å°ï•ù°–ËÅA}!%!PÅÙ§Ï(ÄÄÄÅ¡Öùîπë…Ö›Iïç—Öπù±î°ÏÅ‡ËÄƒƒ‘∞Å‰ËÄ‹–ƒ∞Å›•ë—†ËÄÃÿ‘∞Å°ï•ù°–ËÄ‰ƒ∞ÅçΩ±Ω»ËÅ…ùà†ƒ∞Äƒ∞Äƒ§ÅÙ§Ï(ÄÄÄÅ¡Öùîπë…Ö›Iïç—Öπù±î°ÏÅ‡ËÄ¿∞Å‰ËÄƒ¿ÿ∞Å›•ë—†ËÄ‘‰‘∞Å°ï•ù°–ËÄÿ»‘∞ÅçΩ±Ω»ËÅ…ùà†ƒ∞Äƒ∞Äƒ§ÅÙ§Ï(ÄÄÄÅ¡Öùîπë…Ö›Iïç—Öπù±î°ÏÅ‡ËÄÃ–∞Å‰ËÄÿ‡»∞Å›•ë—†ËÄ‘»‹∞Å°ï•ù°–ËÄ–‡∞ÅçΩ±Ω»ËÅ…ùà†¿∏‰ÿ‘∞Ä¿∏‰‡∞Ä¿∏‰‹»§ÅÙ§Ï(ÄÄÄÅ¡Öùîπë…Ö›1•πî°ÏÅÕ—Ö…–ËÅÏÅ‡ËÄÃ–∞Å‰ËÄÿ‡»ÅÙ∞ÅïπêËÅÏÅ‡ËÄ‘ÿƒ∞Å‰ËÄÿ‡»ÅÙ∞Å—°•ç≠πïÕÃËÄ¿∏‡∞ÅçΩ±Ω»ËÅù…ïï∏ÅÙ§Ï(ÄÄÄÅ¡Öùîπë…Ö›1•πî°ÏÅÕ—Ö…–ËÅÏÅ‡ËÄ»‡ÿ∞Å‰ËÄÿ‰¿ÅÙ∞ÅïπêËÅÏÅ‡ËÄ»‡ÿ∞Å‰ËÄ‹»–ÅÙ∞Å—°•ç≠πïÕÃËÄ¿∏‘∞ÅçΩ±Ω»ËÅ…ùà†¿∏‡»∞Ä¿∏‡‡∞Ä¿∏‡‘§ÅÙ§Ï(ÄÄÄÅ¡Öùîπë…Ö›1•πî°ÏÅÕ—Ö…–ËÅÏÅ‡ËÄ–‘‹∞Å‰ËÄÿ‰¿ÅÙ∞ÅïπêËÅÏÅ‡ËÄ–‘‹∞Å‰ËÄ‹»–ÅÙ∞Å—°•ç≠πïÕÃËÄ¿∏‘∞ÅçΩ±Ω»ËÅ…ùà†¿∏‡»∞Ä¿∏‡‡∞Ä¿∏‡‘§ÅÙ§Ï((ÄÄÄÅçΩπÕ–Åë…Ö‹ÄÙÄ°—ï·–ËÅÕ—…•πú∞Å‡ËÅπ’µâï»∞Å‰ËÅπ’µâï»∞ÅÕ•ÈîËÅπ’µâï»∞Å•Õ	Ω±êÄÙÅôÖ±Õî∞ÅçΩ±Ω»ÄÙÅ•π¨§ÄÙ¯(ÄÄÄÄÄÅ¡Öùîπë…Ö›Qï·–°—ï·–∞ÅÏÅ‡∞Å‰ËÅA}!%!PÄ¥Å‰∞ÅÕ•Èî∞ÅôΩπ–ËÅ•Õ	Ω±êÄ¸ÅâΩ±êÄËÅ…ïù’±Ö»∞ÅçΩ±Ω»ÅÙ§Ï(ÄÄÄÅë…Ö‹†â1=0Å=9Q9PÅY1=A59Pà∞Äƒ‡‹∞ÄÃ»∞Äƒ‘∞Å—…’î§Ï(ÄÄÄÅë…Ö‹†â	e=9Å=%0Ä°1	<§à∞Ä»ƒ‡∞Ä‘ƒ∞Äƒ‘∞Å—…’î§Ï(ÄÄÄÅë…Ö‹†âÅ9Ö—•ΩπÖ∞Å%πë’Õ—…•Ö∞ÅïŸï±Ω¡µïπ–Å%π•—•Ö—•Ÿîà∞Ä»¿ƒ∞Ä‹ÿ∞Ä‡∞Å—…’î∞Åù…ïï∏§Ï(ÄÄÄÅë…Ö‹†â=U59PÅII9à∞Ä–‰∞Äƒ»ÿ∞Äÿ∏‘∞Å—…’î∞Åµ’—ïê§Ï(ÄÄÄÅë…Ö‹°µΩëï∞πµï—ÖëÖ—Ñπ…ïôï…ïπçî∞Ä–‰∞Äƒ–Ã∞Ä‡∏‘∞Å—…’î∞Åù…ïï∏§Ï(ÄÄÄÅë…Ö‹†âQà∞ÄÃ¿Ã∞Äƒ»ÿ∞Äÿ∏‘∞Å—…’î∞Åµ’—ïê§Ï(ÄÄÄÅë…Ö‹°µΩëï∞πµï—ÖëÖ—ÑπëÖ—î∞ÄÃ¿Ã∞Äƒ–Ã∞Ä‡∏‘∞Å—…’î∞Åù…ïï∏§Ï(ÄÄÄÅë…Ö‹†âYIM%=8à∞Ä–‹–∞Äƒ»ÿ∞Äÿ∏‘∞Å—…’î∞Åµ’—ïê§Ï(ÄÄÄÅë…Ö‹°µΩëï∞πµï—ÖëÖ—ÑπŸï…Õ•Ω∏∞Ä–‹–∞Äƒ–Ã∞Ä‡∏‘∞Å—…’î∞Åù…ïï∏§Ï(ÄÄÄÅë…Ö‹°ÅAÖùîÄëÌ•πëï‡Ä¨Ä≈ÙÅΩòÄëÌµΩëï∞π¡ÖùïÃπ±ïπù—°ıÄ∞Ä–‰‡∞Ä‹»Ã∞Ä‹∞ÅôÖ±Õî∞Åµ’—ïê§Ï(ÄÄÄÅ•òÄ°µΩëï∞π›Ö—ï…µÖ…¨§Åë…Ö‹°µΩëï∞π›Ö—ï…µÖ…¨∞Äƒ‡¿∞Ä–‘¿∞Äÿ‡∞Å—…’î∞Å…ùà†¿∏‡‡∞Ä¿∏‡‡∞Ä¿∏‡‡§§Ï(ÄÄÄÅ…’πÃπôΩ…Öç††°…’∏§ÄÙ¯Åë…Ö‹°…’∏π—ï·–∞Å…’∏π‡∞Å…’∏π‰∞Å…’∏πÕ•ÈîÄ¸¸Äƒ¿∞Å…’∏πâΩ±ê∞Å…’∏πçΩ±Ω»Ä¸Å…ùà†∏∏π…’∏πçΩ±Ω»πÕ¡±•–†àÄà§πµÖ¿°9’µâï»§ÅÖÃÅmπ’µâï»∞Åπ’µâï»∞Åπ’µâï…t§ÄËÅ•π¨§§Ï(ÄÅÙ§Ï(ÄÅ…ï—’…∏Åπï‹ÅU•π–·……Ö‰°Ö›Ö•–Å¡ëòπÕÖŸî†§§Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Åç…ïÖ—ïΩ……ïÕ¡ΩπëïπçïAëô]•—°M•ùπÖ—’…ïÕÕï—Ã°…ïçΩ…êËÅ1çëâΩΩ……ïÕ¡ΩπëïπçïIïçΩ…ê∞ÅΩ¡—•ΩπÃËÅΩ……ïÕ¡ΩπëïπçïAëô=¡—•ΩπÃ∞ÅÖÕÕï—ÃËÅΩ……ïÕ¡ΩπëïπçïM•ùπÖ—’…ïÕÕï—mt§ÅÏ(ÄÅçΩπÕ–ÅâÖÕïAëòÄÙÅÖ›Ö•–Åç…ïÖ—ïΩ……ïÕ¡ΩπëïπçïAëò°…ïçΩ…ê∞ÅΩ¡—•ΩπÃ§Ï(ÄÅçΩπÕ–ÅµΩëï∞ÄÙÅâ’•±ëΩ……ïÕ¡ΩπëïπçïAëô5Ωëï∞°…ïçΩ…ê∞ÅΩ¡—•ΩπÃ§Ï(ÄÅ•òÄ†ÖµΩëï∞πÕ•ùπÖ—’…ïA±Öçïµïπ—Ãπ±ïπù—†§Å…ï—’…∏ÅâÖÕïAëòÏ(ÄÅçΩπÕ–Å¡ëòÄÙÅÖ›Ö•–ÅAΩç’µïπ–π±ΩÖê°âÖÕïAëò§Ï(ÄÅçΩπÕ–Å¡ÖùïÃÄÙÅ¡ëòπùï—AÖùïÃ†§Ï(ÄÅôΩ»Ä°çΩπÕ–Å¡±Öçïµïπ–ÅΩòÅµΩëï∞πÕ•ùπÖ—’…ïA±Öçïµïπ—Ã§ÅÏ(ÄÄÄÅçΩπÕ–ÅÖÕÕï–ÄÙÅÖÕÕï—Ãπô•πê†°çÖπë•ëÖ—î§ÄÙ¯ÅçÖπë•ëÖ—îπ…Ω±îÄÙÙÙÅ¡±Öçïµïπ–π…Ω±î§Ï(ÄÄÄÅ•òÄ†ÖÖÕÕï–§Å—°…Ω‹Åπï‹Å……Ω»°ÅA…Ω—ïç—ïêÅÕ•ùπÖ—’…îÅÖÕÕï–Å•ÃÅ’πÖŸÖ•±Öâ±îÅôΩ»ÄëÌ¡±Öçïµïπ–π…Ω±ïÙπÄ§Ï(ÄÄÄÅçΩπÕ–Å•µÖùîÄÙÅÖÕÕï–πçΩπ—ïπ—QÂ¡îÄÙÙÙÄâ•µÖùîΩ¡πúàÄ¸ÅÖ›Ö•–Å¡ëòπïµâïëAπú°ÖÕÕï–πâÂ—ïÃ§ÄËÅÖ›Ö•–Å¡ëòπïµâïë)¡ú°ÖÕÕï–πâÂ—ïÃ§Ï(ÄÄÄÅçΩπÕ–ÅÕçÖ±îÄÙÅ5Ö—†πµ•∏°¡±Öçïµïπ–π›•ë—†ÄºÅ•µÖùîπ›•ë—†∞Å¡±Öçïµïπ–π°ï•ù°–ÄºÅ•µÖùîπ°ï•ù°–§Ï(ÄÄÄÅçΩπÕ–Å›•ë—†ÄÙÅ•µÖùîπ›•ë—†Ä®ÅÕçÖ±îÏ(ÄÄÄÅçΩπÕ–Å°ï•ù°–ÄÙÅ•µÖùîπ°ï•ù°–Ä®ÅÕçÖ±îÏ(ÄÄÄÅçΩπÕ–Å¡ÖùîÄÙÅ¡ÖùïÕm¡±Öçïµïπ–π¡Öùï%πëï·tÏ(ÄÄÄÅ•òÄ†Ö¡Öùî§Å—°…Ω‹Åπï‹Å……Ω»†âM•ùπÖ—’…îÅ¡±Öçïµïπ–Å…ïôï…ïπçïÃÅÑÅµ•ÕÕ•πúÅAÅ¡Öùî∏à§Ï(ÄÄÄÅ¡Öùîπë…Ö›%µÖùî°•µÖùî∞ÅÏÅ‡ËÅ¡±Öçïµïπ–π‡∞Å‰ËÅA}!%!PÄ¥Å¡±Öçïµïπ–π‰Ä¥Å°ï•ù°–∞Å›•ë—†∞Å°ï•ù°–ÅÙ§Ï(ÄÅÙ(ÄÅ…ï—’…∏Åπï‹ÅU•π–·……Ö‰°Ö›Ö•–Å¡ëòπÕÖŸî†§§Ï)Ù()ï·¡Ω…–Åô’πç—•Ω∏ÅçΩ……ïÕ¡ΩπëïπçïAëô!ÖÕ†°âÂ—ïÃËÅU•π–·……Ö‰§ÅÏ(ÄÅ…ï—’…∏ÅÕ°Ñ»‘Ÿ!ï‡°	’ôôï»πô…Ω¥°âÂ—ïÃ§π—ΩM—…•πú†ââÖÕîÿ–à§§Ï)Ù(