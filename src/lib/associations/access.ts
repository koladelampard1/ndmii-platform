import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/data/admin-association-members";
import { generateMsmeId } from "@/lib/data/ndmii";

const SETUP_TOKEN_TTL_MS = 15 * 60 * 1000;
const PIN_KEY_LENGTH = 32;

type AccessCredential = {
  id: string;
  association_member_id: string;
  association_id: string;
  login_phone_normalized: string | null;
  login_email: string | null;
  temporary_pin_hash: string;
  temporary_pin_expires_at: string;
  must_change_password: boolean;
  first_login_completed_at: string | null;
  status: string;
  auth_user_id: string | null;
  metadata: Record<string, unknown> | null;
};

type AccessMember = {
  id: string;
  association_id: string;
  full_name: string | null;
  business_name: string | null;
  trade_type: string | null;
  lga: string | null;
  phone_number: string | null;
  email: string | null;
  msme_id: string | null;
  source_import_id: string | null;
  source_import_row_id: string | null;
  source_row_number: number | null;
  associations: { name?: string | null; state?: string | null } | null;
};

type MsmeRow = {
  id: string;
  created_by: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: string | null;
  source_association_member_id: string | null;
  verification_status: string | null;
  review_status: string | null;
};

function secret() {
  const value = process.env.NDMII_ASSOCIATION_ACCESS_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Association access setup is unavailable.");
  return value;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizedIdentifier(identifier: string) {
  const clean = identifier.trim().toLowerCase();
  return clean.includes("@") ? { email: clean, phone: null } : { email: null, phone: normalizePhone(clean) };
}

export function generateTemporaryPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashTemporaryPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, PIN_KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyTemporaryPin(pin: string, encodedHash: string) {
  const [algorithm, salt, expected] = encodedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  return safeEqual(crypto.scryptSync(pin, salt, PIN_KEY_LENGTH).toString("hex"), expected);
}

function setupToken(credential: AccessCredential) {
  const payload = encode(JSON.stringify({
    credentialId: credential.id,
    expiresAt: Date.now() + SETUP_TOKEN_TTL_MS,
    pinFingerprint: sign(credential.temporary_pin_hash),
  }));
  return `${payload}.${sign(payload)}`;
}

function readSetupToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { credentialId?: string; expiresAt?: number; pinFingerprint?: string };
    if (!parsed.credentialId || !parsed.expiresAt || !parsed.pinFingerprint || parsed.expiresAt <= Date.now()) return null;
    return parsed as { credentialId: string; expiresAt: number; pinFingerprint: string };
  } catch {
    return null;
  }
}

async function writePublicAudit(supabase: SupabaseClient<any>, credential: AccessCredential, eventType: string, params?: { actorUserId?: string | null; msmeId?: string | null }) {
  const timestamp = new Date().toISOString();
  const metadata = { association_id: credential.association_id, member_id: credential.association_member_id, access_credential_id: credential.id, msme_id: params?.msmeId ?? null, raw_pin_stored: false };
  await supabase.from("association_member_events").insert({ association_id: credential.association_id, association_member_id: credential.association_member_id, member_id: credential.association_member_id, actor_id: params?.actorUserId ?? null, actor_user_id: params?.actorUserId ?? null, actor_role: params?.actorUserId ? "msme" : "public", event_type: eventType, metadata, created_at: timestamp });
  await supabase.from("activity_logs").insert({ actor_user_id: params?.actorUserId ?? null, action: `association_member_${eventType}`, entity_type: "association_member", entity_id: credential.association_member_id, metadata, created_at: timestamp });
}

export async function verifyAssociationTemporaryAccess(supabase: SupabaseClient<any>, params: { identifier: string; pin: string }) {
  const identifier = normalizedIdentifier(params.identifier);
  if ((!identifier.email && !identifier.phone) || !/^\d{6}$/.test(params.pin)) return { ok: false as const, error: "Check your phone or email and your 6-digit PIN." };
  let query = supabase.from("association_member_access_credentials").select("*,association_members(id,association_id,full_name,business_name,trade_type,lga,associations(name,state))");
  query = identifier.email ? query.eq("login_email", identifier.email) : query.eq("login_phone_normalized", identifier.phone);
  const { data, error } = await query.eq("status", "active").maybeSingle();
  if (error || !data) return { ok: false as const, error: "Check your phone or email and your 6-digit PIN." };
  const credential = data as AccessCredential & { association_members: AccessMember };
  if (new Date(credential.temporary_pin_expires_at).getTime() <= Date.now()) {
    const now = new Date().toISOString();
    await supabase.from("association_member_access_credentials").update({ status: "expired", updated_at: now }).eq("id", credential.id);
    await supabase.from("association_members").update({ access_status: "expired", updated_at: now }).eq("id", credential.association_member_id);
    await writePublicAudit(supabase, credential, "access_expired");
    return { ok: false as const, error: "This PIN has expired. Ask your association officer for a new PIN." };
  }
  if (!credential.must_change_password || credential.first_login_completed_at) return { ok: false as const, error: "This PIN has already been used. Sign in with your password." };
  if (!verifyTemporaryPin(params.pin, credential.temporary_pin_hash)) return { ok: false as const, error: "Check your phone or email and your 6-digit PIN." };
  await supabase.from("association_member_access_credentials").update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", credential.id);
  const member = credential.association_members;
  return { ok: true as const, setupToken: setupToken(credential), member: { fullName: member.full_name, businessName: member.business_name, tradeType: member.trade_type, lga: member.lga, associationName: member.associations?.name ?? null } };
}

function internalProfileEmail(memberId: string) {
  return `association-member-${memberId}@association-fast-track.invalid`;
}

async function ensureMsmeUserProfile(supabase: SupabaseClient<any>, params: { authUserId: string; member: AccessMember; email: string | null; phone: string | null }) {
  const profileEmail = params.email ?? internalProfileEmail(params.member.id);
  const { data: byAuthId, error: authLookupError } = await supabase.from("users").select("id,email,auth_user_id").eq("auth_user_id", params.authUserId).maybeSingle();
  if (authLookupError) throw authLookupError;

  const { data: byEmail, error: emailLookupError } = !byAuthId && params.email
    ? await supabase.from("users").select("id,email,auth_user_id").eq("email", params.email).maybeSingle()
    : { data: null, error: null };
  if (emailLookupError) throw emailLookupError;

  const { data: byPhone, error: phoneLookupError } = !byAuthId && !byEmail && params.phone
    ? await supabase.from("users").select("id,email,auth_user_id").eq("phone", params.phone).maybeSingle()
    : { data: null, error: null };
  if (phoneLookupError) throw phoneLookupError;

  const existing = byAuthId ?? byEmail ?? byPhone;
  if (existing?.auth_user_id && existing.auth_user_id !== params.authUserId) {
    throw new Error("An existing user profile is linked to a different authenticated account.");
  }

  if (existing) {
    const { data, error } = await supabase
      .from("users")
      .update({
        auth_user_id: params.authUserId,
        email: params.email ?? existing.email ?? profileEmail,
        phone: params.phone,
        full_name: params.member.full_name?.trim() || params.member.business_name?.trim() || "Association MSME Member",
        role: "msme",
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !data?.id) throw error ?? new Error("Unable to update the MSME user profile.");
    return data.id as string;
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      auth_user_id: params.authUserId,
      email: profileEmail,
      phone: params.phone,
      full_name: params.member.full_name?.trim() || params.member.business_name?.trim() || "Association MSME Member",
      role: "msme",
    })
    .select("id")
    .single();
  if (error || !data?.id) throw error ?? new Error("Unable to create the MSME user profile.");
  return data.id as string;
}

async function uniqueMsmeMatch(query: PromiseLike<{ data: MsmeRow[] | null; error: { message: string } | null }>, label: string) {
  const { data, error } = await query;
  if (error) throw error;
  if ((data?.length ?? 0) > 1) throw new Error(`Multiple MSME records match this member by ${label}. Ask the support team to review the records.`);
  return data?.[0] ?? null;
}

const MSME_WORKSPACE_SELECT = "id,created_by,contact_email,contact_phone,source,source_association_member_id,verification_status,review_status";

async function prepareExistingDraftMsmeWorkspace(supabase: SupabaseClient<any>, params: { msme: MsmeRow; member: AccessMember; appUserId: string; email: string | null; phone: string | null }) {
  const isVerified = ["verified", "approved", "active"].includes(params.msme.verification_status?.toLowerCase() ?? "")
    || ["verified", "approved", "active"].includes(params.msme.review_status?.toLowerCase() ?? "");
  if (isVerified) return params.msme.id;

  const { error } = await supabase
    .from("msmes")
    .update({
      created_by: params.msme.created_by ?? params.appUserId,
      contact_email: params.msme.contact_email ?? params.email,
      contact_phone: params.msme.contact_phone ?? params.member.phone_number?.trim() ?? params.phone,
      source: params.msme.source ?? "association_fast_track",
      source_association_member_id: params.msme.source_association_member_id ?? params.member.id,
    })
    .eq("id", params.msme.id);
  if (error) throw error;
  return params.msme.id;
}

async function ensureDraftMsmeWorkspace(supabase: SupabaseClient<any>, params: { member: AccessMember; appUserId: string; email: string | null; phone: string | null }) {
  if (params.member.msme_id) {
    const { data, error } = await supabase.from("msmes").select(MSME_WORKSPACE_SELECT).eq("id", params.member.msme_id).maybeSingle();
    if (error) throw error;
    if (data?.id) return prepareExistingDraftMsmeWorkspace(supabase, { msme: data as MsmeRow, ...params });
  }

  let msme = await uniqueMsmeMatch(
    supabase.from("msmes").select(MSME_WORKSPACE_SELECT).eq("source_association_member_id", params.member.id).limit(2),
    "association member source",
  );
  if (!msme && params.phone) {
    msme = await uniqueMsmeMatch(
      supabase.from("msmes").select(MSME_WORKSPACE_SELECT).eq("contact_phone_normalized", params.phone).limit(2),
      "phone number",
    );
  }
  if (!msme && params.email) {
    msme = await uniqueMsmeMatch(
      supabase.from("msmes").select(MSME_WORKSPACE_SELECT).ilike("contact_email", params.email).limit(2),
      "email address",
    );
  }
  if (!msme && params.member.business_name?.trim()) {
    msme = await uniqueMsmeMatch(
      supabase.from("msmes").select(MSME_WORKSPACE_SELECT).eq("association_id", params.member.association_id).ilike("business_name", params.member.business_name.trim()).limit(2),
      "business name and association",
    );
  }
  if (msme?.id) return prepareExistingDraftMsmeWorkspace(supabase, { msme, ...params });

  const state = params.member.associations?.state?.trim() || "Not specified";
  const { data, error } = await supabase
    .from("msmes")
    .insert({
      msme_id: generateMsmeId(state),
      business_name: params.member.business_name?.trim() || `${params.member.full_name?.trim() || "Association member"} business`,
      owner_name: params.member.full_name?.trim() || "Association MSME Member",
      state,
      lga: params.member.lga?.trim() || null,
      sector: params.member.trade_type?.trim() || "General Trade",
      contact_email: params.email,
      contact_phone: params.member.phone_number?.trim() || params.phone,
      contact_phone_normalized: params.phone,
      association_id: params.member.association_id,
      created_by: params.appUserId,
      source: "association_fast_track",
      source_association_member_id: params.member.id,
      verification_status: "draft",
      review_status: "draft",
    })
    .select("id")
    .single();
  if (error || !data?.id) throw error ?? new Error("Unable to create the draft MSME workspace.");
  return data.id as string;
}

export async function completeAssociationTemporaryAccess(supabase: SupabaseClient<any>, params: { setupToken: string; password: string }) {
  if (params.password.length < 8) return { ok: false as const, error: "Use a password with at least 8 characters." };
  const token = readSetupToken(params.setupToken);
  if (!token) return { ok: false as const, error: "Your setup session has expired. Start again with your PIN." };
  const { data, error } = await supabase.from("association_member_access_credentials").select("*,association_members(id,association_id,full_name,business_name,trade_type,lga,phone_number,email,msme_id,source_import_id,source_import_row_id,source_row_number,associations(name,state))").eq("id", token.credentialId).maybeSingle();
  if (error || !data) return { ok: false as const, error: "Your access record is unavailable. Ask your association officer for help." };
  const credential = data as AccessCredential & { association_members: AccessMember };
  const isActiveSetup = credential.status === "active" && credential.must_change_password && new Date(credential.temporary_pin_expires_at).getTime() > Date.now();
  const isCompletedRetry = credential.status === "completed" && !credential.must_change_password && Boolean(credential.auth_user_id);
  if (!safeEqual(sign(credential.temporary_pin_hash), token.pinFingerprint) || (!isActiveSetup && !isCompletedRetry)) {
    return { ok: false as const, error: "This PIN can no longer be used. Ask your association officer for a new PIN." };
  }
  try {
    let authUserId = credential.auth_user_id;
    const authMetadata = { role: "msme", onboarding_source: "association_fast_track", association_member_id: credential.association_member_id };
    if (authUserId) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(authUserId, { password: params.password, email_confirm: Boolean(credential.login_email), phone_confirm: Boolean(credential.login_phone_normalized), user_metadata: authMetadata });
      if (authUpdateError) throw authUpdateError;
    } else {
      const createPayload = credential.login_email
        ? { email: credential.login_email, password: params.password, email_confirm: true }
        : { phone: credential.login_phone_normalized ?? undefined, password: params.password, phone_confirm: true };
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({ ...createPayload, user_metadata: authMetadata });
      if (authError || !authData.user?.id) throw authError ?? new Error("Unable to create the authenticated account.");
      authUserId = authData.user.id;
      const { error: authLinkError } = await supabase.from("association_member_access_credentials").update({ auth_user_id: authUserId, updated_at: new Date().toISOString() }).eq("id", credential.id);
      if (authLinkError) throw authLinkError;
    }

    const member = credential.association_members;
    const phone = normalizePhone(member.phone_number) ?? credential.login_phone_normalized;
    const email = member.email?.trim().toLowerCase() || credential.login_email;
    const appUserId = await ensureMsmeUserProfile(supabase, { authUserId, member, email, phone });
    const msmeId = await ensureDraftMsmeWorkspace(supabase, { member, appUserId, email, phone });
    const now = new Date().toISOString();
    const isFirstCompletion = !credential.first_login_completed_at;
    const { error: credentialUpdateError } = await supabase.from("association_member_access_credentials").update({ auth_user_id: authUserId, must_change_password: false, first_login_completed_at: now, status: "completed", last_used_at: now, updated_at: now }).eq("id", credential.id);
    if (credentialUpdateError) throw credentialUpdateError;
    const { error: memberUpdateError } = await supabase.from("association_members").update({ msme_id: msmeId, activation_state: "account_created", access_status: "first_login_completed", access_first_login_completed_at: now, updated_at: now }).eq("id", credential.association_member_id);
    if (memberUpdateError) throw memberUpdateError;
    if (isFirstCompletion) {
      await writePublicAudit(supabase, credential, "first_login_completed", { actorUserId: appUserId, msmeId });
      await writePublicAudit(supabase, credential, "password_changed", { actorUserId: appUserId, msmeId });
      await writePublicAudit(supabase, credential, "msme_workspace_provisioned", { actorUserId: appUserId, msmeId });
    }
    return { ok: true as const, loginEmailAvailable: Boolean(email), redirectTo: "/dashboard/msme/onboarding" };
  } catch (setupError) {
    console.warn("[association-fast-track-setup]", {
      credentialId: credential.id,
      associationMemberId: credential.association_member_id,
      error: setupError instanceof Error ? setupError.message : String(setupError),
    });
    return { ok: false as const, error: "Your account workspace could not be prepared. Ask the support team to review your member record." };
  }
}
