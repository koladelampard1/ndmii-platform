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
const selectFields = "id,msme_id,business_name,owner_name,state,sector,verification_status,association_id,passport_photo_url,flagged,suspended";

export async function searchPublicVerificationRecords(query: string): Promise<PublicVerificationRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data: digitalRows } = await supabase
    .from("digital_ids")
    .select(`id,msme_id,ndmii_id,status,issued_at,qr_code_ref,msmes(${selectFields})`)
    .order("issued_at", { ascending: false });

  const mappedDigital: PublicVerificationRecord[] = ((digitalRows ?? []) as any[]).flatMap((row: any) => {
    const msme = row.msmes;
    if (!msme) return [];

    const ndmiiId = row.ndmii_id ? normalizeId(row.ndmii_id) : null;
    const msmeId = normalizeId(msme.msme_id);
    return [{
      ...msme,
      msme_id: msmeId,
      ndmii_id: ndmiiId,
      route_id: ndmiiId ?? msmeId,
      digital_id_id: row.id,
      qr_code_ref: row.qr_code_ref,
      digital_status: row.status,
      issued_at: row.issued_at,
    }];
  });

  const trimmed = query.trim();
  if (!trimmed) return mappedDigital.slice(0, 15);

  const q = normalizeLookup(trimmed);
  return mappedDigital.filter(
    (row) =>
      row.route_id.toLowerCase().includes(q) ||
      row.msme_id.toLowerCase().includes(q) ||
      row.business_name.toLowerCase().includes(q)
  );
}

export async function getPublicVerificationDetail(msmeLookup: string): Promise<VerificationDetail | null> {
  const lookup = normalizeLookup(decodeURIComponent(msmeLookup));
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
    const normalizedDigitalId = normalizeId(digitalMatch.ndmii_id ?? digitalMatch.msme_id ?? digitalMatch.msmes.msme_id);
    const msme: PublicVerificationRecord = {
      ...digitalMatch.msmes,
      msme_id: normalizeId(digitalMatch.msmes.msme_id),
      ndmii_id: digitalMatch.ndmii_id ? normalizeId(digitalMatch.ndmii_id) : null,
      route_id: normalizedDigitalId,
      digital_id_id: digitalMatch.id,
      digital_status: digitalMatch.status,
      issued_at: digitalMatch.issued_at,
      qr_code_ref: digitalMatch.qr_code_ref,
    };

    return {
      msme,
      digitalId: {
        ...digitalMatch,
        ndmii_id: digitalMatch.ndmii_id ? normalizeId(digitalMatch.ndmii_id) : null,
      },
      resolvedId: normalizedDigitalId,
    };
  }

  const normalizedId = normalizeId(lookup);
  const { data: fallbackMsme } = await supabase
    .from("msmes")
    .select(selectFields)
    .ilike("msme_id", normalizedId)
    .maybeSingle();

  const fallback = fallbackMsme as any;
  if (!fallback) return null;

  const msme: PublicVerificationRecord = {
    ...fallback,
    msme_id: normalizeId(fallback.msme_id),
    route_id: normalizeId(fallback.msme_id),
  };

  return {
    msme,
    digitalId: null,
    resolvedId: msme.route_id,
  };
}
