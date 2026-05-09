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

const normalizeId = (value: string) => value.trim().toUpperCase();
const isDev = process.env.NODE_ENV !== "production";
const msmeSelectFields =
  "id,msme_id,business_name,owner_name,state,sector,verification_status,review_status,association_id,passport_photo_url,flagged,suspended,issued_at";
const digitalIdSelectFields = "id,msme_id,ndmii_id,status,issued_at,qr_code_ref,validation_snapshot";
const digitalIdWithMsmeSelectFields = `${digitalIdSelectFields},msmes(${msmeSelectFields})`;

function logVerificationDebug(stage: string, payload: Record<string, unknown>) {
  if (!isDev) return;
  console.info(`[public-verification] ${stage}`, {
    client: "service_role_server_client",
    ...payload,
  });
}

function toPublicRecord(msme: any, digitalId?: any | null): PublicVerificationRecord {
  const msmeId = normalizeId(msme.msme_id);
  const ndmiiId = digitalId?.ndmii_id ? normalizeId(digitalId.ndmii_id) : null;

  return {
    ...msme,
    msme_id: msmeId,
    ndmii_id: ndmiiId,
    route_id: ndmiiId ?? msmeId,
    digital_id_id: digitalId?.id,
    qr_code_ref: digitalId?.qr_code_ref ?? null,
    digital_status: digitalId?.status ?? digitalId?.digital_status ?? null,
    issued_at: digitalId?.issued_at ?? msme.issued_at ?? null,
  };
}

function toPublicRecordFromDigitalRow(row: any): PublicVerificationRecord | null {
  const msme = Array.isArray(row.msmes) ? row.msmes[0] : row.msmes;
  if (!msme) return null;

  return toPublicRecord(msme, row);
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
    .or(`msme_id.ilike.%${trimmed}%,business_name.ilike.%${trimmed}%`)
    .order("issued_at", { ascending: false })
    .limit(20);

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
        .from("digital_ids")
        .select(digitalIdSelectFields)
        .in("msme_id", msmeRowIds)
        .order("issued_at", { ascending: false })
    : { data: [] };
  const digitalByMsmeId = new Map<string, any>();
  for (const row of (msmeDigitalRows ?? []) as any[]) {
    if (!digitalByMsmeId.has(row.msme_id)) {
      digitalByMsmeId.set(row.msme_id, row);
    }
  }
  const msmeMatches = ((msmeRows ?? []) as any[]).map((row) => toPublicRecord(row, digitalByMsmeId.get(row.id)));

  logVerificationDebug("search.msmes", {
    source: "public.msmes",
    lookup: trimmed,
    rowFound: msmeMatches.length > 0,
    matchedIdentifier: msmeMatches.length > 0 ? ["msme_id", "business_name"] : null,
    results: msmeMatches.length,
  });

  const { data: digitalRows, error: digitalError } = await supabase
    .from("digital_ids")
    .select(digitalIdWithMsmeSelectFields)
    .ilike("ndmii_id", `%${trimmed}%`)
    .order("issued_at", { ascending: false })
    .limit(20);

  if (digitalError) {
    logVerificationDebug("search.digital_ids_error", {
      source: "public.digital_ids",
      lookup: trimmed,
      error: digitalError.message,
    });
    return msmeMatches;
  }

  const seenMsmeIds = new Set(msmeMatches.map((row) => row.id));
  const digitalMatches = ((digitalRows ?? []) as any[])
    .map((row) => toPublicRecordFromDigitalRow(row))
    .filter((row): row is PublicVerificationRecord => Boolean(row))
    .filter((row) => {
      if (seenMsmeIds.has(row.id)) return false;
      seenMsmeIds.add(row.id);
      return true;
    });

  logVerificationDebug("search.digital_ids_fallback", {
    source: "public.digital_ids",
    lookup: trimmed,
    rowFound: digitalMatches.length > 0,
    matchedIdentifier: digitalMatches.length > 0 ? ["ndmii_id", "msme_id", "business_name"] : null,
    results: digitalMatches.length,
  });

  return [...msmeMatches, ...digitalMatches].slice(0, 20);
}

export async function getPublicVerificationDetail(msmeLookup: string): Promise<VerificationDetail | null> {
  const rawLookup = decodeURIComponent(msmeLookup).trim();
  const normalizedId = normalizeId(rawLookup);
  const supabase = await createServiceRoleSupabaseClient();

  const { data: digitalRow, error: digitalError } = await supabase
    .from("digital_ids")
    .select(digitalIdWithMsmeSelectFields)
    .eq("ndmii_id", normalizedId)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (digitalError) {
    logVerificationDebug("detail.digital_ids_error", {
      source: "public.digital_ids",
      lookup: rawLookup,
      error: digitalError.message,
    });
  }

  if (digitalRow) {
    const msme = toPublicRecordFromDigitalRow(digitalRow);
    if (msme) {
      logVerificationDebug("detail.digital_ids_hit", {
        source: "public.digital_ids",
        lookup: rawLookup,
        rowFound: true,
        matchedIdentifier: "ndmii_id",
        resolvedId: msme.route_id,
      });

      return {
        msme,
        digitalId: digitalRow,
        resolvedId: msme.route_id,
      };
    }
  }

  const { data: msmeRow, error: msmeError } = await supabase
    .from("msmes")
    .select(msmeSelectFields)
    .eq("msme_id", normalizedId)
    .maybeSingle();

  if (msmeError) {
    logVerificationDebug("detail.msmes_error", {
      source: "public.msmes",
      lookup: rawLookup,
      error: msmeError.message,
    });
  }

  if (msmeRow) {
    const { data: digitalRecord } = await supabase
      .from("digital_ids")
      .select(digitalIdSelectFields)
      .eq("msme_id", msmeRow.id)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const msme = toPublicRecord(msmeRow, digitalRecord);

    logVerificationDebug("detail.msmes_hit", {
      source: "public.msmes",
      lookup: rawLookup,
      rowFound: true,
      matchedIdentifier: "msme_id",
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

  logVerificationDebug("detail.not_found", {
    source: "public.msmes -> public.digital_ids",
    lookup: rawLookup,
    rowFound: false,
    matchedIdentifier: normalizedId,
  });

  return null;
}
