import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type PublicVerificationRecord = {
  id: string;
  msme_id: string;
  ndmii_id?: string | null;
  route_id: string;
  business_name: string;
  owner_name: string;
  state: string;
  sector: string;
  verification_status: string;
  review_status?: string | null;
  association_id: string | null;
  passport_photo_url?: string | null;
  flagged?: boolean | null;
  suspended?: boolean | null;
  digital_id_id?: string;
  qr_code_ref?: string | null;
  digital_status?: string | null;
  issued_at?: string | null;
};

type VerificationDetail = {
  msme: PublicVerificationRecord;
  digitalId: any | null;
  resolvedId: string;
};

const normalizeLookup = (value: string) => value.trim().toLowerCase();
const normalizeId = (value: string) => value.trim().toUpperCase();
const isDev = process.env.NODE_ENV !== "production";
const msmeSelectFields =
  "id,msme_id,ndmii_id,business_name,owner_name,state,sector,verification_status,review_status,association_id,passport_photo_url,flagged,suspended";

function logVerificationDebug(stage: string, payload: Record<string, unknown>) {
  if (!isDev) return;
  console.info(`[public-verification] ${stage}`, {
    client: "service_role_server_client",
    ...payload,
  });
}

function toPublicRecordFromMsme(msme: any): PublicVerificationRecord {
  const msmeId = normalizeId(msme.msme_id);
  const ndmiiId = msme.ndmii_id ? normalizeId(msme.ndmii_id) : null;

  return {
    ...msme,
    msme_id: msmeId,
    ndmii_id: ndmiiId,
    route_id: ndmiiId ?? msmeId,
    digital_status: null,
    issued_at: msme.issued_at ?? null,
  };
}

function toPublicRecordFromDigitalView(row: any): PublicVerificationRecord {
  const msmeId = normalizeId(row.msme_id);
  const ndmiiId = row.ndmii_id ? normalizeId(row.ndmii_id) : null;

  return {
    id: row.msme_row_id ?? row.id,
    msme_id: msmeId,
    ndmii_id: ndmiiId,
    route_id: ndmiiId ?? msmeId,
    business_name: row.business_name,
    owner_name: row.owner_name,
    state: row.state,
    sector: row.sector,
    verification_status: row.verification_status,
    review_status: row.review_status,
    association_id: row.association_id,
    passport_photo_url: row.passport_photo_url,
    flagged: row.flagged,
    suspended: row.suspended,
    digital_id_id: row.digital_id_id ?? row.id,
    qr_code_ref: row.qr_code_ref,
    digital_status: row.digital_status ?? row.status ?? null,
    issued_at: row.issued_at ?? null,
  };
}

async function resolveDigitalFallbackById(lookup: string) {
  const supabase = await createServiceRoleSupabaseClient();
  const normalizedId = normalizeId(lookup);

  const { data, error } = await supabase
    .from("digital_ids")
    .select(
      "id,msme_id,ndmii_id,business_name,owner_name,state,sector,verification_status,review_status,association_id,passport_photo_url,flagged,suspended,status,digital_status,issued_at,qr_code_ref,validation_snapshot"
    )
    .or(`ndmii_id.eq.${normalizedId},msme_id.eq.${normalizedId}`)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logVerificationDebug("digital_fallback.error", {
      source: "public.digital_ids",
      lookup,
      error: error.message,
    });
    return null;
  }

  if (!data) {
    logVerificationDebug("digital_fallback.miss", {
      source: "public.digital_ids",
      lookup,
      matchedIdentifier: normalizedId,
      rowFound: false,
    });
    return null;
  }

  const msme = toPublicRecordFromDigitalView(data);

  logVerificationDebug("digital_fallback.hit", {
    source: "public.digital_ids",
    lookup,
    matchedIdentifier: data.ndmii_id ? "ndmii_id" : "msme_id",
    rowFound: true,
  });

  return {
    msme,
    digitalId: data,
    resolvedId: normalizeId(data.ndmii_id ?? data.msme_id),
  };
}

export async function searchPublicVerificationRecords(query: string): Promise<PublicVerificationRecord[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    logVerificationDebug("search.empty_query", {
      source: "public.msmes",
      rowFound: false,
      matchedIdentifier: null,
    });
    return [];
  }

  const supabase = await createServiceRoleSupabaseClient();

  const { data: msmeRows, error: msmeError } = await supabase
    .from("msmes")
    .select(msmeSelectFields)
    .or(`msme_id.ilike.%${trimmed}%,ndmii_id.ilike.%${trimmed}%,business_name.ilike.%${trimmed}%`)
    .order("issued_at", { ascending: false })
    .limit(20);

  if (msmeError) {
    logVerificationDebug("search.msmes_error", {
      source: "public.msmes",
      lookup: trimmed,
      error: msmeError.message,
    });
  }

  const msmeMatches = ((msmeRows ?? []) as any[]).map((row) => toPublicRecordFromMsme(row));

  logVerificationDebug("search.msmes", {
    source: "public.msmes",
    lookup: trimmed,
    rowFound: msmeMatches.length > 0,
    matchedIdentifier: msmeMatches.length > 0 ? ["ndmii_id", "msme_id", "business_name"] : null,
    results: msmeMatches.length,
  });

  if (msmeMatches.length > 0) {
    return msmeMatches;
  }

  const { data: digitalViewRows, error: digitalViewError } = await supabase
    .from("digital_ids")
    .select(
      "id,msme_id,ndmii_id,business_name,owner_name,state,sector,verification_status,review_status,association_id,passport_photo_url,flagged,suspended,status,digital_status,issued_at,qr_code_ref"
    )
    .or(`msme_id.ilike.%${trimmed}%,ndmii_id.ilike.%${trimmed}%,business_name.ilike.%${trimmed}%`)
    .order("issued_at", { ascending: false })
    .limit(20);

  if (digitalViewError) {
    logVerificationDebug("search.digital_ids_error", {
      source: "public.digital_ids",
      lookup: trimmed,
      error: digitalViewError.message,
    });
    return [];
  }

  const digitalMatches = ((digitalViewRows ?? []) as any[]).map((row) => toPublicRecordFromDigitalView(row));

  logVerificationDebug("search.digital_ids_fallback", {
    source: "public.digital_ids",
    lookup: trimmed,
    rowFound: digitalMatches.length > 0,
    matchedIdentifier: digitalMatches.length > 0 ? ["ndmii_id", "msme_id", "business_name"] : null,
    results: digitalMatches.length,
  });

  return digitalMatches;
}

export async function getPublicVerificationDetail(msmeLookup: string): Promise<VerificationDetail | null> {
  const rawLookup = decodeURIComponent(msmeLookup).trim();
  const normalizedId = normalizeId(rawLookup);
  const supabase = await createServiceRoleSupabaseClient();

  const { data: msmeRow, error: msmeError } = await supabase
    .from("msmes")
    .select(msmeSelectFields)
    .or(`ndmii_id.eq.${normalizedId},msme_id.eq.${normalizedId}`)
    .maybeSingle();

  if (msmeError) {
    logVerificationDebug("detail.msmes_error", {
      source: "public.msmes",
      lookup: rawLookup,
      error: msmeError.message,
    });
  }

  if (msmeRow) {
    const msme = toPublicRecordFromMsme(msmeRow);

    const { data: digitalRecord } = await supabase
      .from("digital_ids")
      .select("id,msme_id,ndmii_id,status,issued_at,qr_code_ref,validation_snapshot")
      .or(`ndmii_id.eq.${normalizedId},msme_id.eq.${normalizedId}`)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    logVerificationDebug("detail.msmes_hit", {
      source: "public.msmes",
      lookup: rawLookup,
      rowFound: true,
      matchedIdentifier: normalizedId === (msme.ndmii_id ?? "") ? "ndmii_id" : "msme_id",
      resolvedId: msme.route_id,
    });

    return {
      msme,
      digitalId: digitalRecord ?? null,
      resolvedId: msme.route_id,
    };
  }

  logVerificationDebug("detail.msmes_miss", {
    source: "public.msmes",
    lookup: rawLookup,
    rowFound: false,
    matchedIdentifier: normalizedId,
  });

  const fallbackById = await resolveDigitalFallbackById(rawLookup);
  if (fallbackById) {
    return fallbackById;
  }

  logVerificationDebug("detail.not_found", {
    source: "public.msmes -> public.digital_ids",
    lookup: rawLookup,
    rowFound: false,
    matchedIdentifier: normalizedId,
  });

  return null;
}
