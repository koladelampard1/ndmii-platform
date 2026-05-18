import { createHash, createHmac, randomBytes } from "crypto";
import type { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/auth/authorization";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export const CREDENTIAL_TOKEN_TTL_DAYS = 365;
export const CREDENTIAL_SIGNATURE_VERSION = 1;

export type CredentialAction = "issued" | "approved" | "suspended" | "revoked" | "reissued" | "verified";

export type CredentialEventActor = Pick<UserContext, "role" | "appUserId"> | null;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function signatureSecret() {
  return process.env.DBIN_CREDENTIAL_SIGNATURE_SECRET || process.env.SUPABASE_JWT_SECRET || "dbin-development-signature-secret";
}

export function signCredentialTokenHash(params: { tokenHash: string; ndmiiId: string; signatureVersion?: number }) {
  const version = params.signatureVersion ?? CREDENTIAL_SIGNATURE_VERSION;
  return createHmac("sha256", signatureSecret())
    .update(`${params.tokenHash}:${params.ndmiiId}:${version}`)
    .digest("hex");
}

export function verifyCredentialSignature(params: { tokenHash: string; ndmiiId: string; signatureVersion?: number | null; signature?: string | null }) {
  if (!params.signature) return false;
  const expected = signCredentialTokenHash({
    tokenHash: params.tokenHash,
    ndmiiId: params.ndmiiId,
    signatureVersion: params.signatureVersion ?? CREDENTIAL_SIGNATURE_VERSION,
  });
  return expected === params.signature;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function publicBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://bin.gov.ng").replace(/\/$/, "");
}

export function generateCredentialToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCredentialToken(token: string) {
  return tokenHash(token.trim());
}

export function credentialVerifyPath(token: string) {
  return `/verify/c/${encodeURIComponent(token)}`;
}

export function credentialVerifyUrl(token: string) {
  return `${publicBaseUrl()}${credentialVerifyPath(token)}`;
}

export function nextCredentialExpiry(now = new Date()) {
  return addDays(now, CREDENTIAL_TOKEN_TTL_DAYS).toISOString();
}

export async function recordCredentialEvent(
  supabase: SupabaseClient,
  params: {
    credentialId: string;
    action: CredentialAction;
    actor?: CredentialEventActor;
    metadata?: Record<string, unknown>;
  },
) {
  const safeMetadata = params.metadata ?? {};
  await supabase.from("credential_events").insert({
    credential_id: params.credentialId,
    action: params.action,
    actor_role: params.actor?.role ?? null,
    actor_id: params.actor?.appUserId ?? null,
    metadata: safeMetadata,
  });
}

export async function ensurePendingCredential(
  supabase: SupabaseClient,
  params: {
    msmeId: string;
    ndmiiId: string;
    validationSnapshot?: Record<string, unknown>;
    actor?: CredentialEventActor;
  },
) {
  const nowIso = new Date().toISOString();
  const token = generateCredentialToken();
  const publicTokenHash = hashCredentialToken(token);
  const tokenExpiresAt = nextCredentialExpiry(new Date(nowIso));
  const payload = {
    msme_id: params.msmeId,
    ndmii_id: params.ndmiiId,
    issued_at: nowIso,
    qr_code_ref: credentialVerifyPath(token),
    status: "pending",
    public_token: token,
    public_token_hash: publicTokenHash,
    public_signature: signCredentialTokenHash({ tokenHash: publicTokenHash, ndmiiId: params.ndmiiId }),
    token_expires_at: tokenExpiresAt,
    signature_version: CREDENTIAL_SIGNATURE_VERSION,
    approved_at: null,
    approved_by: null,
    revoked_at: null,
    revoked_by: null,
    revocation_reason: null,
    suspended_at: null,
    suspended_by: null,
    validation_snapshot: params.validationSnapshot ?? null,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from("digital_identity_credentials")
    .upsert(payload, { onConflict: "msme_id" })
    .select("id,status")
    .single();

  if (error) throw error;
  if (data?.id) {
    await recordCredentialEvent(supabase, {
      credentialId: data.id,
      action: "issued",
      actor: params.actor,
      metadata: { operation: "pending_credential_issued", msmeId: params.msmeId, status: "pending" },
    });
  }

  return data;
}

export async function approveCredential(
  supabase: SupabaseClient,
  params: {
    msmeId: string;
    ndmiiId: string;
    validationSnapshot?: Record<string, unknown>;
    actor: CredentialEventActor;
  },
) {
  const nowIso = new Date().toISOString();
  const token = generateCredentialToken();
  const publicTokenHash = hashCredentialToken(token);
  const tokenExpiresAt = nextCredentialExpiry(new Date(nowIso));
  const payload = {
    msme_id: params.msmeId,
    ndmii_id: params.ndmiiId,
    issued_at: nowIso,
    approved_at: nowIso,
    approved_by: params.actor?.appUserId ?? null,
    qr_code_ref: credentialVerifyPath(token),
    status: "active",
    public_token: token,
    public_token_hash: publicTokenHash,
    public_signature: signCredentialTokenHash({ tokenHash: publicTokenHash, ndmiiId: params.ndmiiId }),
    token_expires_at: tokenExpiresAt,
    signature_version: CREDENTIAL_SIGNATURE_VERSION,
    revoked_at: null,
    revoked_by: null,
    revocation_reason: null,
    suspended_at: null,
    suspended_by: null,
    validation_snapshot: params.validationSnapshot ?? null,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from("digital_identity_credentials")
    .upsert(payload, { onConflict: "msme_id" })
    .select("id,status")
    .single();

  if (error) throw error;
  if (data?.id) {
    await recordCredentialEvent(supabase, {
      credentialId: data.id,
      action: "approved",
      actor: params.actor,
      metadata: { operation: "credential_approved", msmeId: params.msmeId, status: "active" },
    });
  }

  return data;
}

export async function suspendCredential(
  supabase: SupabaseClient,
  params: { credentialId: string; actor: CredentialEventActor; reason?: string | null },
) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("digital_identity_credentials")
    .update({
      status: "suspended",
      suspended_at: nowIso,
      suspended_by: params.actor?.appUserId ?? null,
      revocation_reason: params.reason ?? null,
      updated_at: nowIso,
    })
    .eq("id", params.credentialId)
    .select("id,msme_id,status")
    .single();

  if (error) throw error;
  await recordCredentialEvent(supabase, {
    credentialId: params.credentialId,
    action: "suspended",
    actor: params.actor,
    metadata: { operation: "credential_suspended", msmeId: data?.msme_id ?? null, status: "suspended", reason: params.reason ?? null },
  });
  return data;
}

export async function revokeCredential(
  supabase: SupabaseClient,
  params: { credentialId: string; actor: CredentialEventActor; reason?: string | null },
) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("digital_identity_credentials")
    .update({
      status: "revoked",
      revoked_at: nowIso,
      revoked_by: params.actor?.appUserId ?? null,
      revocation_reason: params.reason ?? null,
      updated_at: nowIso,
    })
    .eq("id", params.credentialId)
    .select("id,msme_id,status")
    .single();

  if (error) throw error;
  await recordCredentialEvent(supabase, {
    credentialId: params.credentialId,
    action: "revoked",
    actor: params.actor,
    metadata: { operation: "credential_revoked", msmeId: data?.msme_id ?? null, status: "revoked", reason: params.reason ?? null },
  });
  return data;
}

export async function reissueCredentialToken(
  supabase: SupabaseClient,
  params: { credentialId: string; actor: CredentialEventActor },
) {
  const nowIso = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("digital_identity_credentials")
    .select("id,ndmii_id")
    .eq("id", params.credentialId)
    .single();
  if (existingError) throw existingError;

  const token = generateCredentialToken();
  const publicTokenHash = hashCredentialToken(token);
  const { data, error } = await supabase
    .from("digital_identity_credentials")
    .update({
      public_token: token,
      public_token_hash: publicTokenHash,
      public_signature: signCredentialTokenHash({ tokenHash: publicTokenHash, ndmiiId: existing.ndmii_id }),
      token_expires_at: nextCredentialExpiry(new Date(nowIso)),
      qr_code_ref: credentialVerifyPath(token),
      signature_version: CREDENTIAL_SIGNATURE_VERSION,
      updated_at: nowIso,
    })
    .eq("id", params.credentialId)
    .select("id,msme_id,status")
    .single();

  if (error) throw error;
  await recordCredentialEvent(supabase, {
    credentialId: params.credentialId,
    action: "reissued",
    actor: params.actor,
    metadata: { operation: "credential_token_reissued", msmeId: data?.msme_id ?? null, status: data?.status ?? null },
  });
  return data;
}

export function tokenError(code: string, message: string) {
  return { code, message };
}
