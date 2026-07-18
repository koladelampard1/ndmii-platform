import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { hashCredentialToken, recordCredentialEvent, tokenError, verifyCredentialSignature } from "@/lib/data/credential-trust";

export type PublicVerificationRecord = {
  msme_id: string;
  ndmii_id?: string | null;
  route_id: string;
  business_name: string;
  state: string;
  sector: string;
  verification_status: string;
  review_status?: string | null;
  flagged?: boolean | null;
  suspended?: boolean | null;
  qr_code_ref?: string | null;
  verify_path?: string | null;
  digital_status?: string | null;
  issued_at?: string | null;
  token_expires_at?: string | null;
  approved_at?: string | null;
};

type VerificationDetail = {
  msme: PublicVerificationRecord;
  digitalId: {
    status?: string | null;
    issued_at?: string | null;
    approved_at?: string | null;
    token_expires_at?: string | null;
  } | null;
  resolvedId: string;
  internalMsmeId: string;
  internalAssociationId: string | null;
};

export type CredentialVerificationResult =
  | { ok: true; detail: VerificationDetail }
  | { ok: false; error: { code: string; message: string } };

const normalizeId = (value: string) => value.trim().toUpperCase();
const isDev = process.env.NODE_ENV !== "production";
const msmeSelectFields =
  "id,msme_id,business_name,state,sector,verification_status,review_status,association_id,flagged,suspended,issued_at";
const digitalIdSelectFields =
  "id,msme_id,ndmii_id,status,issued_at,approved_at,revoked_at,suspended_at,token_expires_at,qr_code_ref,validation_snapshot,public_token_hash,public_signature,signature_version";
const digitalIdWithMsmeSelectFields = `${digitalIdSelectFields},msmes(${msmeSelectFields})`;

function logVerificationDebug(stage: string, payload: Record<string, unknown>) {
  if (!isDev) return;
  console.info(`[public-verification] ${stage}`, {
    client: "service_role_server_client",
    ...payload,
  });
}

function normalizePublicSearchTerm(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[,%*_(){}[\]<>`"\\]/g, " ")
    .replace(/[^\p{L}\p{N}\s.'’&/-]/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
}

function toIlikePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function toPublicRecord(msme: any, digitalId?: any | null): PublicVerificationRecord {
  const msmeId = normalizeId(msme.msme_id);
  const ndmiiId = digitalId?.ndmii_id ? normalizeId(digitalId.ndmii_id) : null;

  return {
    msme_id: msmeId,
    ndmii_id: ndmiiId,
    route_id: ndmiiId ?? msmeId,
    business_name: msme.business_name,
    state: msme.state,
    sector: msme.sector,
    verification_status: msme.verification_status,
    review_status: msme.review_status ?? null,
    flagged: msme.flagged ?? null,
    suspended: msme.suspended ?? null,
    qr_code_ref: digitalId?.qr_code_ref ?? null,
    verify_path: digitalId?.qr_code_ref ?? null,
    digital_status: digitalId?.status ?? digitalId?.digital_status ?? null,
    issued_at: digitalId?.issued_at ?? msme.issued_at ?? null,
    token_expires_at: digitalId?.token_expires_at ?? null,
    approved_at: digitalId?.approved_at ?? null,
  };
}

function toPublicRecordFromDigitalRow(row: any): PublicVerificationRecord | null {
  const msme = Array.isArray(row.msmes) ? row.msmes[0] : row.msmes;
  if (!msme) return null;

  return toPublicRecord(msme, row);
}

export async function searchPublicVerificationRecords(query: string): Promise<PublicVerificationRecord[]> {
  const trimmed = normalizePublicSearchTerm(query);
  if (!trimmed) {
    logVerificationDebug("search.empty_query", {
      source: "public.msmes",
      rowFound: false,
      matchedIdentifier: null,
    });
    return [];
  }

  const supabase = await createServiceRoleSupabaseClient();
  const searchPattern = toIlikePattern(trimmed);

  const [publicIdLookup, businessNameLookup] = await Promise.all([
    supabase
      .from("msmes")
      .select(msmeSelectFields)
      .ilike("msme_id", searchPattern)
      .eq("review_status", "approved")
      .order("issued_at", { ascending: false })
      .limit(20),
    supabase
      .from("msmes")
      .select(msmeSelectFields)
      .ilike("business_name", searchPattern)
      .eq("review_status", "approved")
      .order("issued_at", { ascending: false })
      .limit(20),
  ]);

  const msmeRows = [...(publicIdLookup.data ?? []), ...(businessNameLookup.data ?? [])].filter(
    (row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index,
  );
  const msmeError = publicIdLookup.error ?? businessNameLookup.error;

  if (msmeError) {
    logVerificationDebug("search.msmes_error", {
      source: "public.msmes",
      lookup: trimmed,
      error: msmeError.message,
    });
  }

  const msmeRowIds = ((msmeRows ?? []) as any[]).map((row) => row.id).filter(Boolean);
  const { data: msmeDigitalRows } = msmeRowIds.length > 0
    ? await supabase
        .from("digital_identity_credentials")
        .select(digitalIdSelectFields)
        .in("msme_id", msmeRowIds)
        .eq("status", "active")
        .is("revoked_at", null)
        .is("suspended_at", null)
        .gt("token_expires_at", new Date().toISOString())
        .order("issued_at", { ascending: false })
    : { data: [] };
  const digitalByMsmeId = new Map<string, any>();
  for (const row of (msmeDigitalRows ?? []) as any[]) {
    if (!digitalByMsmeId.has(row.msme_id)) {
      digitalByMsmeId.set(row.msme_id, row);
    }
  }
  const msmeMatches = ((msmeRows ?? []) as any[])
    .filter((row) => digitalByMsmeId.has(row.id))
    .map((row) => toPublicRecord(row, digitalByMsmeId.get(row.id)));

  logVerificationDebug("search.msmes", {
    source: "public.msmes",
    lookup: trimmed,
    rowFound: msmeMatches.length > 0,
    matchedIdentifier: msmeMatches.length > 0 ? ["msme_id", "business_name"] : null,
    results: msmeMatches.length,
  });

  const { data: digitalRows, error: digitalError } = await supabase
    .from("digital_identity_credentials")
    .select(digitalIdWithMsmeSelectFields)
    .ilike("ndmii_id", `%${trimmed}%`)
    .eq("status", "active")
    .is("revoked_at", null)
    .is("suspended_at", null)
    .gt("token_expires_at", new Date().toISOString())
    .order("issued_at", { ascending: false })
    .limit(20);

  if (digitalError) {
    logVerificationDebug("search.credentials_error", {
      source: "public.digital_identity_credentials",
      lookup: trimmed,
      error: digitalError.message,
    });
    return msmeMatches;
  }

  const seenPublicRoutes = new Set(msmeMatches.map((row) => row.route_id));
  const digitalMatches = ((digitalRows ?? []) as any[])
    .map((row) => toPublicRecordFromDigitalRow(row))
    .filter((row): row is PublicVerificationRecord => Boolean(row))
    .filter((row) => {
      if (seenPublicRoutes.has(row.route_id)) return false;
      seenPublicRoutes.add(row.route_id);
      return true;
    });

  logVerificationDebug("search.credentials_fallback", {
    source: "public.digital_identity_credentials",
    lookup: trimmed,
    rowFound: digitalMatches.length > 0,
    matchedIdentifier: digitalMatches.length > 0 ? ["ndmii_id", "msme_id", "business_name"] : null,
    results: digitalMatches.length,
  });

  return [...msmeMatches, ...digitalMatches].slice(0, 20);
}

export async function getPublicVerificationDetail(msmeLookup: string): Promise<VerificationDetail | null> {
  logVerificationDebug("detail.raw_lookup_blocked", {
    source: "public.raw_identifier",
    lookupLength: decodeURIComponent(msmeLookup).trim().length,
    rowFound: false,
    matchedIdentifier: null,
  });
  return null;
}

function invalidCredential(code: string, message: string): CredentialVerificationResult {
  return { ok: false, error: tokenError(code, message) };
}

function isExpired(value?: string | null) {
  if (!value) return true;
  return new Date(value).getTime() <= Date.now();
}

export async function getPublicCredentialVerificationByToken(token: string): Promise<CredentialVerificationResult> {
  const normalizedToken = token.trim();
  if (!normalizedToken || normalizedToken.length < 32) {
    return invalidCredential("invalid_token", "This verification link is invalid.");
  }

  const supabase = await createServiceRoleSupabaseClient();
  const lookupHash = hashCredentialToken(normalizedToken);

  const { data: digitalRow, error: digitalError } = await supabase
    .from("digital_identity_credentials")
    .select(digitalIdWithMsmeSelectFields)
    .eq("public_token_hash", lookupHash)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (digitalError) {
    logVerificationDebug("detail.credentials_error", {
      source: "public.digital_identity_credentials",
      lookupHash,
      error: digitalError.message,
    });
  }

  if (!digitalRow) {
    return invalidCredential("credential_not_found", "This credential could not be verified.");
  }

  const msme = toPublicRecordFromDigitalRow(digitalRow);
  if (!msme) {
    return invalidCredential("credential_owner_missing", "This credential is not linked to an approved business.");
  }

  const failure =
    !verifyCredentialSignature({
      tokenHash: lookupHash,
      ndmiiId: digitalRow.ndmii_id,
      signatureVersion: digitalRow.signature_version,
      signature: digitalRow.public_signature,
    })
      ? "credential_signature_invalid"
      : digitalRow.status !== "active"
      ? "credential_not_active"
      : digitalRow.revoked_at
        ? "credential_revoked"
        : digitalRow.suspended_at
          ? "credential_suspended"
          : isExpired(digitalRow.token_expires_at)
            ? "credential_expired"
            : msme.review_status !== "approved"
              ? "business_not_approved"
              : msme.suspended
                ? "business_suspended"
                : null;

  if (failure) {
    logVerificationDebug("detail.token_rejected", {
      source: "public.digital_identity_credentials",
      credentialId: digitalRow.id,
      msmeId: digitalRow.msme_id,
      operation: "token_verification",
      status: digitalRow.status,
      tokenValid: false,
      errorCode: failure,
    });
    return invalidCredential(failure, "This credential is not currently valid for public verification.");
  }

  await recordCredentialEvent(supabase, {
    credentialId: digitalRow.id,
    action: "verified",
    actor: null,
    metadata: {
      operation: "public_token_verification",
      credentialId: digitalRow.id,
      msmeId: digitalRow.msme_id,
      status: digitalRow.status,
      tokenValid: true,
    },
  });

  logVerificationDebug("detail.token_hit", {
    source: "public.digital_identity_credentials",
    credentialId: digitalRow.id,
    msmeId: digitalRow.msme_id,
    operation: "token_verification",
    status: digitalRow.status,
    tokenValid: true,
  });

  return {
    ok: true,
    detail: {
      msme,
      digitalId: {
        status: digitalRow.status ?? null,
        issued_at: digitalRow.issued_at ?? null,
        approved_at: digitalRow.approved_at ?? null,
        token_expires_at: digitalRow.token_expires_at ?? null,
      },
      resolvedId: msme.route_id,
      internalMsmeId: digitalRow.msme_id,
      internalAssociationId: (Array.isArray(digitalRow.msmes) ? digitalRow.msmes[0] : digitalRow.msmes)?.association_id ?? null,
    },
  };
}
