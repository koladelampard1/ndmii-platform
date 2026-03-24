import { createServerSupabaseClient } from "@/lib/supabase/server";

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
const selectFields = "id,msme_id,ndmii_id,business_name,owner_name,state,sector,verification_status,association_id,passport_photo_url,flagged,suspended";

function logVerificationDebug(stage: string, payload: Record<string, unknown>) {
  if (!isDev) return;
  console.info(`[public-verification] ${stage}`, payload);
}

function toPublicRecordFromDigital(row: any): PublicVerificationRecord | null {
  const msme = row?.msmes;
  if (!msme) return null;

  const ndmiiId = row.ndmii_id ? normalizeId(row.ndmii_id) : msme.ndmii_id ? normalizeId(msme.ndmii_id) : null;
  const msmeId = normalizeId(msme.msme_id);

  return {
    ...msme,
    msme_id: msmeId,
    ndmii_id: ndmiiId,
    route_id: ndmiiId ?? msmeId,
    digital_id_id: row.id,
    qr_code_ref: row.qr_code_ref,
    digital_status: row.status,
    issued_at: row.issued_at,
  };
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
    issued_at: null,
  };
}

export async function searchPublicVerificationRecords(query: string): Promise<PublicVerificationRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data: digitalRows } = await supabase
    .from("digital_ids")
    .select(`id,msme_id,ndmii_id,status,issued_at,qr_code_ref,msmes(${selectFields})`)
    .order("issued_at", { ascending: false });

  const mappedDigital: PublicVerificationRecord[] = ((digitalRows ?? []) as any[])
    .map((row: any) => toPublicRecordFromDigital(row))
    .filter(Boolean) as PublicVerificationRecord[];

  const trimmed = query.trim();
  if (!trimmed) {
    logVerificationDebug("search.empty_query", { source: "digital_ids", results: mappedDigital.length });
    return mappedDigital.slice(0, 15);
  }

  const q = normalizeLookup(trimmed);
  const digitalMatches = mappedDigital.filter(
    (row) =>
      row.route_id.toLowerCase().includes(q) ||
      row.msme_id.toLowerCase().includes(q) ||
      (row.ndmii_id ? row.ndmii_id.toLowerCase().includes(q) : false) ||
      row.business_name.toLowerCase().includes(q)
  );

  if (digitalMatches.length > 0) {
    logVerificationDebug("search.digital_hit", { query: trimmed, results: digitalMatches.length, source: "digital_ids" });
    return digitalMatches;
  }

  const { data: fallbackRows } = await supabase
    .from("msmes")
    .select(selectFields)
    .or(`msme_id.ilike.%${trimmed}%,ndmii_id.ilike.%${trimmed}%,business_name.ilike.%${trimmed}%`)
    .limit(20);

  const fallbackMatches = ((fallbackRows ?? []) as any[]).map((row) => toPublicRecordFromMsme(row));
  logVerificationDebug("search.fallback_msmes", { query: trimmed, digitalResults: 0, fallbackResults: fallbackMatches.length, source: "msmes" });
  return fallbackMatches;
}

export async function getPublicVerificationDetail(msmeLookup: string): Promise<VerificationDetail | null> {
  const rawLookup = decodeURIComponent(msmeLookup).trim();
  const lookup = normalizeLookup(rawLookup);
  const normalizedId = normalizeId(rawLookup);
  const supabase = await createServerSupabaseClient();

  const { data: digitalRows } = await supabase
    .from("digital_ids")
    .select(`id,msme_id,ndmii_id,issued_at,status,qr_code_ref,validation_snapshot,msmes(${selectFields})`);

  const digitalMatch = ((digitalRows ?? []) as any[]).find((row: any) => {
    const ndmiiKey = row.ndmii_id ? normalizeLookup(row.ndmii_id) : "";
    const msmeKey = row.msmes?.msme_id ? normalizeLookup(row.msmes.msme_id) : "";
    return lookup === ndmiiKey || lookup === msmeKey;
  });

  if (digitalMatch?.msmes) {
    const msme = toPublicRecordFromDigital(digitalMatch);
    if (!msme) return null;
    const normalizedDigitalId = normalizeId(digitalMatch.ndmii_id ?? digitalMatch.msmes.ndmii_id ?? digitalMatch.msme_id ?? digitalMatch.msmes.msme_id);

    logVerificationDebug("detail.digital_hit", { lookup: rawLookup, source: "digital_ids", resolvedId: normalizedDigitalId });

    return {
      msme,
      digitalId: {
        ...digitalMatch,
        ndmii_id: digitalMatch.ndmii_id ? normalizeId(digitalMatch.ndmii_id) : null,
      },
      resolvedId: normalizedDigitalId,
    };
  }

  const { data: fallbackMsmeById } = await supabase
    .from("msmes")
    .select(selectFields)
    .or(`ndmii_id.eq.${normalizedId},msme_id.eq.${normalizedId}`)
    .maybeSingle();

  const fallbackById = fallbackMsmeById as any;
  if (fallbackById) {
    const msme = toPublicRecordFromMsme(fallbackById);
    logVerificationDebug("detail.fallback_msmes_id_hit", { lookup: rawLookup, source: "msmes", resolvedId: msme.route_id });
    return {
      msme,
      digitalId: null,
      resolvedId: msme.route_id,
    };
  }

  const { data: fallbackMsmesByName } = await supabase
    .from("msmes")
    .select(selectFields)
    .ilike("business_name", `%${rawLookup}%`)
    .limit(1);

  const fallbackByName = (fallbackMsmesByName?.[0] ?? null) as any;
  if (!fallbackByName) {
    logVerificationDebug("detail.not_found", { lookup: rawLookup, tried: ["digital_ids.ndmii_id/msme_id", "msmes.ndmii_id/msme_id", "msmes.business_name"] });
    return null;
  }

  const msme = toPublicRecordFromMsme(fallbackByName);
  logVerificationDebug("detail.fallback_msmes_name_hit", { lookup: rawLookup, source: "msmes", resolvedId: msme.route_id });

  return {
    msme,
    digitalId: null,
    resolvedId: msme.route_id,
  };
}
