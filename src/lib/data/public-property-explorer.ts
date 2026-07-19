import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { JsonRecord } from "@/types/platform";
import type { Property, PropertyCategory, PropertyDocument, PropertyIdentityCredential, PropertyType } from "@/types/property";

type Client = SupabaseClient<any>;

type PublicPropertyRow = Pick<
  Property,
  | "id"
  | "npin"
  | "application_reference"
  | "parcel_reference"
  | "property_category_id"
  | "property_type"
  | "title"
  | "description"
  | "state_id"
  | "lga_id"
  | "ward_id"
  | "community_id"
  | "status"
  | "registry_status"
  | "area_size"
  | "area_unit"
  | "metadata"
  | "updated_at"
>;

type PublicCredentialRow = Pick<
  PropertyIdentityCredential,
  "property_id" | "npin" | "credential_reference" | "status" | "issued_at" | "token_expires_at"
>;

type PublicDocumentRow = Pick<PropertyDocument, "title" | "document_type" | "issuer" | "issued_at" | "status" | "metadata">;

export type PublicPropertySummary = {
  npin: string;
  applicationReference: string | null;
  title: string;
  propertyType: string;
  category: string;
  categoryKey: string | null;
  state: string;
  lga: string;
  ward: string | null;
  community: string | null;
  area: string | null;
  registryStatus: string;
  verificationStatus: "verified" | "approved" | "pending" | "unavailable";
  credentialStatus: string | null;
  certificateStatus: string | null;
  description: string | null;
  issuedAt: string | null;
};

export type PublicPropertyProfile = PublicPropertySummary & {
  issuingAuthority: string;
  documents: Array<{
    title: string;
    documentType: string;
    issuedAt: string | null;
    issuer: string | null;
  }>;
  publicGeometry: {
    latitude: number;
    longitude: number;
    source: string;
    verificationStatus: string;
  } | null;
  hasPrivateGeometry: boolean;
  disclaimer: string;
};

export type PublicPropertySearchFilters = {
  q?: string;
  npin?: string;
  applicationReference?: string;
  state?: string;
  lga?: string;
  ward?: string;
  community?: string;
  category?: string;
  propertyType?: string;
  landUse?: string;
  registryStatus?: string;
  verificationStatus?: string;
  page?: number;
  limit?: number;
};

export type PublicPropertyVerificationResult = {
  status: "valid" | "revoked" | "superseded" | "suspended" | "expired" | "unknown";
  label: string;
  verifiedAt: string;
  issuingAuthority: string;
  registryDisclaimer: string;
  credential: {
    npin: string;
    credentialReference: string;
    status: string;
    issuedAt: string | null;
    expiresAt: string | null;
  } | null;
  property: PublicPropertySummary | null;
};

const PUBLIC_STATUSES = ["approved", "verified", "active"];
const ISSUING_AUTHORITY = "Digital Land & Property Infrastructure Registry";
const REGISTRY_DISCLAIMER = "This public record confirms registry status only. It does not disclose ownership, title transfer, private documents, or internal case history.";
const PUBLIC_PROPERTY_SELECT = [
  "id",
  "npin",
  "application_reference",
  "parcel_reference",
  "property_category_id",
  "property_type",
  "title",
  "description",
  "state_id",
  "lga_id",
  "ward_id",
  "community_id",
  "status",
  "registry_status",
  "area_size",
  "area_unit",
  "metadata",
  "updated_at",
].join(",");
const PUBLIC_CREDENTIAL_SELECT = "property_id,npin,credential_reference,status,issued_at,token_expires_at";
const PUBLIC_DOCUMENT_SELECT = "title,document_type,issuer,issued_at,status,metadata";

async function service(client?: Client) {
  return client ?? await createServiceRoleSupabaseClient();
}

function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Unavailable";
}

function normalize(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeIdentifier(value: string | null | undefined) {
  return normalize(value).normalize("NFKC").replace(/\s+/g, "").toUpperCase().slice(0, 96);
}

function normalizeVerificationToken(value: string | null | undefined) {
  return normalize(value).normalize("NFKC").replace(/[\u0000-\u001F\u007F\s]/g, "").slice(0, 256);
}

function normalizeFreeTextSearch(value: string | null | undefined) {
  return normalize(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[,%(){}[\]"'`\\]/g, " ")
    .replace(/[^\p{L}\p{N}\s._:/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function ilikePattern(value: string | null | undefined) {
  const safe = normalizeFreeTextSearch(value).replace(/[%_*]/g, " ");
  return safe ? `%${safe}%` : "";
}

function sanitizePublicText(value: string | null | undefined) {
  const text = normalize(value);
  if (!text) return null;
  const redacted = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\b(?:NIN|BVN)\s*[:#-]?\s*\d{10,11}\b/gi, "[redacted identity number]")
    .replace(/\b\d{11}\b/g, "[redacted identity number]")
    .replace(/\b(?:\+?234|0)[\s-]?[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g, "[redacted phone]")
    .replace(/\b(?:owner|owner name|ownership|internal note|case note|review note)\s*[:=-]\s*[^.;\n]+/gi, "$1: [redacted]");
  return redacted.slice(0, 420);
}

function areaLabel(property: Pick<Property, "area_size" | "area_unit">) {
  if (!property.area_size) return null;
  return [property.area_size, property.area_unit].filter(Boolean).join(" ");
}

function verificationStatus(property: Pick<Property, "status" | "registry_status">): PublicPropertySummary["verificationStatus"] {
  if (property.status === "verified" || property.registry_status === "verified") return "verified";
  if (property.status === "approved" || property.registry_status === "approved") return "approved";
  if (property.status === "submitted" || property.status === "under_review") return "pending";
  return "unavailable";
}

function publicDocument(document: PublicDocumentRow) {
  const metadata = document.metadata as JsonRecord;
  return document.status === "accepted" && (metadata.public === true || metadata.public_access === true || metadata.public_visible === true);
}

async function lookupNames(client: Client, rows: PublicPropertyRow[]) {
  const stateIds = [...new Set(rows.map((row) => row.state_id).filter(Boolean))] as string[];
  const lgaIds = [...new Set(rows.map((row) => row.lga_id).filter(Boolean))] as string[];
  const wardIds = [...new Set(rows.map((row) => row.ward_id).filter(Boolean))] as string[];
  const communityIds = [...new Set(rows.map((row) => row.community_id).filter(Boolean))] as string[];
  const categoryIds = [...new Set(rows.map((row) => row.property_category_id).filter(Boolean))] as string[];

  const [states, lgas, wards, communities, categories] = await Promise.all([
    stateIds.length ? client.from("states").select("id,name").in("id", stateIds) : Promise.resolve({ data: [], error: null }),
    lgaIds.length ? client.from("lgas").select("id,name").in("id", lgaIds) : Promise.resolve({ data: [], error: null }),
    wardIds.length ? client.from("property_wards").select("id,name").in("id", wardIds) : Promise.resolve({ data: [], error: null }),
    communityIds.length ? client.from("property_communities").select("id,name").in("id", communityIds) : Promise.resolve({ data: [], error: null }),
    categoryIds.length ? client.from("property_categories").select("id,name,category_key").in("id", categoryIds) : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [states, lgas, wards, communities, categories]) {
    if (result.error) throw result.error;
  }

  return {
    states: new Map((states.data ?? []).map((item) => [item.id, item.name])),
    lgas: new Map((lgas.data ?? []).map((item) => [item.id, item.name])),
    wards: new Map((wards.data ?? []).map((item) => [item.id, item.name])),
    communities: new Map((communities.data ?? []).map((item) => [item.id, item.name])),
    categories: new Map((categories.data ?? []).map((item) => [item.id, item as PropertyCategory])),
  };
}

async function credentialMap(client: Client, propertyIds: string[]) {
  if (!propertyIds.length) return new Map<string, PublicCredentialRow>();
  const { data, error } = await client
    .from("property_identity_credentials")
    .select(PUBLIC_CREDENTIAL_SELECT)
    .in("property_id", propertyIds)
    .order("issued_at", { ascending: false });
  if (error) throw error;
  const map = new Map<string, PublicCredentialRow>();
  for (const credential of (data ?? []) as PublicCredentialRow[]) {
    if (!map.has(credential.property_id)) map.set(credential.property_id, credential);
  }
  return map;
}

async function certificateMap(client: Client, propertyIds: string[]) {
  if (!propertyIds.length) return new Map<string, string>();
  const { data, error } = await client
    .from("property_certificates")
    .select("property_id,status")
    .in("property_id", propertyIds)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  const map = new Map<string, string>();
  for (const certificate of data ?? []) {
    if (!map.has(certificate.property_id)) map.set(certificate.property_id, certificate.status);
  }
  return map;
}

function publicTitle(property: PublicPropertyRow) {
  return sanitizePublicText(property.title) || humanize(property.property_type);
}

function publicDescription(property: PublicPropertyRow) {
  const metadata = property.metadata as JsonRecord;
  const publicSummary = typeof metadata.public_summary === "string" ? metadata.public_summary : null;
  const publicDescription = typeof metadata.public_description === "string" ? metadata.public_description : null;
  return sanitizePublicText(publicSummary ?? publicDescription ?? property.description);
}

async function toPublicSummaries(client: Client, rows: PublicPropertyRow[]): Promise<PublicPropertySummary[]> {
  const lookups = await lookupNames(client, rows);
  const credentials = await credentialMap(client, rows.map((row) => row.id));
  const certificates = await certificateMap(client, rows.map((row) => row.id));

  return rows
    .filter((property) => property.npin && PUBLIC_STATUSES.includes(property.status))
    .map((property) => {
      const category = property.property_category_id ? lookups.categories.get(property.property_category_id) : null;
      const credential = credentials.get(property.id);
      return {
        npin: property.npin!,
        applicationReference: property.application_reference,
        title: publicTitle(property),
        propertyType: humanize(property.property_type),
        category: category?.name ?? humanize(property.property_type),
        categoryKey: category?.category_key ?? null,
        state: property.state_id ? lookups.states.get(property.state_id) ?? "State unavailable" : "State unavailable",
        lga: property.lga_id ? lookups.lgas.get(property.lga_id) ?? "LGA unavailable" : "LGA unavailable",
        ward: property.ward_id ? lookups.wards.get(property.ward_id) ?? null : null,
        community: property.community_id ? lookups.communities.get(property.community_id) ?? null : null,
        area: areaLabel(property),
        registryStatus: humanize(property.registry_status),
        verificationStatus: verificationStatus(property),
        credentialStatus: credential?.status ?? null,
        certificateStatus: certificates.get(property.id) ?? null,
        description: publicDescription(property),
        issuedAt: credential?.issued_at ?? null,
      };
    });
}

async function resolveFilterId(client: Client, table: string, value: string | undefined, extra?: (query: any) => any) {
  const term = normalizeFreeTextSearch(value);
  if (!term) return null;
  let query = client.from(table).select("id").ilike("name", term).limit(1).maybeSingle();
  if (extra) query = extra(query);
  const { data, error } = await query;
  if (error) throw error;
  return data?.id as string | null;
}

async function resolveCategoryId(client: Client, value: string | undefined) {
  const term = normalizeFreeTextSearch(value);
  if (!term) return null;
  const byKey = await client
    .from("property_categories")
    .select("id")
    .eq("category_key", term)
    .limit(1)
    .maybeSingle();
  if (byKey.error) throw byKey.error;
  if (byKey.data?.id) return byKey.data.id as string;

  const byName = await client
    .from("property_categories")
    .select("id")
    .ilike("name", term)
    .limit(1)
    .maybeSingle();
  if (byName.error) throw byName.error;
  return byName.data?.id as string | null;
}

async function resolveSearchFilters(client: Client, filters: PublicPropertySearchFilters) {
  const stateId = await resolveFilterId(client, "states", filters.state);
  if (filters.state && !stateId) return null;
  const lgaId = await resolveFilterId(client, "lgas", filters.lga, stateId ? (query) => query.eq("state_id", stateId) : undefined);
  if (filters.lga && !lgaId) return null;
  const wardId = await resolveFilterId(client, "property_wards", filters.ward, lgaId ? (query) => query.eq("lga_id", lgaId) : undefined);
  if (filters.ward && !wardId) return null;
  const communityId = await resolveFilterId(client, "property_communities", filters.community, lgaId ? (query) => query.eq("lga_id", lgaId) : undefined);
  if (filters.community && !communityId) return null;
  const categoryId = await resolveCategoryId(client, filters.category);
  if (filters.category && !categoryId) return null;
  return { stateId, lgaId, wardId, communityId, categoryId };
}

export async function searchPublicProperties(filters: PublicPropertySearchFilters = {}, client?: Client) {
  const supabase = await service(client);
  const limit = Math.min(Math.max(filters.limit ?? 12, 1), 48);
  const page = Math.max(filters.page ?? 1, 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const resolved = await resolveSearchFilters(supabase, filters);
  if (!resolved) return { results: [], count: 0, page, limit };

  let query = supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_SELECT, { count: "exact" })
    .in("status", PUBLIC_STATUSES)
    .not("npin", "is", null)
    .order("updated_at", { ascending: false });

  const q = ilikePattern(filters.q);
  if (q) {
    query = query.or(`npin.ilike.${q},application_reference.ilike.${q},title.ilike.${q},parcel_reference.ilike.${q}`);
  }
  const npin = ilikePattern(filters.npin);
  if (npin) query = query.ilike("npin", npin);
  const applicationReference = ilikePattern(filters.applicationReference);
  if (applicationReference) query = query.ilike("application_reference", applicationReference);
  if (filters.propertyType) query = query.eq("property_type", filters.propertyType);
  if (filters.registryStatus) query = query.eq("registry_status", filters.registryStatus);
  const landUse = ilikePattern(filters.landUse);
  if (landUse) query = query.ilike("metadata->>current_use", landUse);
  if (resolved.stateId) query = query.eq("state_id", resolved.stateId);
  if (resolved.lgaId) query = query.eq("lga_id", resolved.lgaId);
  if (resolved.wardId) query = query.eq("ward_id", resolved.wardId);
  if (resolved.communityId) query = query.eq("community_id", resolved.communityId);
  if (resolved.categoryId) query = query.eq("property_category_id", resolved.categoryId);
  if (filters.verificationStatus === "verified") query = query.or("status.eq.verified,registry_status.eq.verified");
  if (filters.verificationStatus === "approved") query = query.or("status.eq.approved,registry_status.eq.approved");

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  const rows = (data ?? []) as unknown as PublicPropertyRow[];
  return { results: await toPublicSummaries(supabase, rows), count: count ?? rows.length, page, limit };
}

export async function getPublicPropertyByNpin(npin: string, client?: Client): Promise<PublicPropertyProfile | null> {
  const supabase = await service(client);
  const normalizedNpin = normalizeIdentifier(npin);
  if (!normalizedNpin) return null;
  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_SELECT)
    .eq("npin", normalizedNpin)
    .in("status", PUBLIC_STATUSES)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const property = data as unknown as PublicPropertyRow;
  const summaries = await toPublicSummaries(supabase, [property]);
  const summary = summaries[0];
  if (!summary) return null;

  const { data: documents, error: documentError } = await supabase
    .from("property_documents")
    .select(PUBLIC_DOCUMENT_SELECT)
    .eq("property_id", property.id)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (documentError) throw documentError;
  const { data: geometry, error: geometryError } = await supabase
    .from("property_geometries")
    .select("centroid_latitude,centroid_longitude,source,verification_status,privacy_visibility")
    .eq("property_id", property.id)
    .is("superseded_at", null)
    .neq("verification_status", "superseded")
    .maybeSingle();
  const safeGeometry = geometryError ? null : geometry;
  const publicGeometry = safeGeometry?.privacy_visibility === "public_generalized"
    && safeGeometry.verification_status === "verified"
    && safeGeometry.centroid_latitude !== null
    && safeGeometry.centroid_longitude !== null
    ? {
        latitude: Number(Number(safeGeometry.centroid_latitude).toFixed(2)),
        longitude: Number(Number(safeGeometry.centroid_longitude).toFixed(2)),
        source: humanize(safeGeometry.source),
        verificationStatus: humanize(safeGeometry.verification_status),
      }
    : null;

  return {
    ...summary,
    issuingAuthority: ISSUING_AUTHORITY,
    documents: ((documents ?? []) as PublicDocumentRow[]).filter(publicDocument).map((document) => ({
      title: sanitizePublicText(document.title) ?? "Public document",
      documentType: humanize(document.document_type),
      issuedAt: document.issued_at,
      issuer: sanitizePublicText(document.issuer),
    })),
    publicGeometry,
    hasPrivateGeometry: Boolean(safeGeometry && !publicGeometry),
    disclaimer: REGISTRY_DISCLAIMER,
  };
}

export async function getPublicPropertyStats(client?: Client) {
  const supabase = await service(client);
  const [verified, industrial, agricultural, government, institutional, categories, states] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).not("npin", "is", null),
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).not("npin", "is", null).eq("property_type", "industrial"),
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).not("npin", "is", null).eq("property_type", "agricultural"),
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).not("npin", "is", null).eq("property_type", "government"),
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).not("npin", "is", null).eq("property_type", "institutional"),
    supabase.from("property_categories").select("id,name,category_key").eq("status", "active").order("name"),
    supabase.from("states").select("id,name").order("name"),
  ]);
  for (const result of [verified, industrial, agricultural, government, institutional, categories, states]) {
    if (result.error) throw result.error;
  }
  return {
    verified: verified.count ?? 0,
    industrial: industrial.count ?? 0,
    agricultural: agricultural.count ?? 0,
    government: government.count ?? 0,
    institutional: institutional.count ?? 0,
    categories: (categories.data ?? []) as PropertyCategory[],
    states: states.data ?? [],
  };
}

export async function getPublicStateExplorer(client?: Client) {
  const supabase = await service(client);
  const { data: states, error: statesError } = await supabase.from("states").select("id,name").order("name");
  if (statesError) throw statesError;
  return await Promise.all((states ?? []).map(async (state) => {
    const [total, verified, typeRows] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).not("npin", "is", null).eq("state_id", state.id),
      supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).not("npin", "is", null).eq("state_id", state.id).or("status.eq.verified,registry_status.eq.verified"),
      supabase.from("properties").select("property_type").in("status", PUBLIC_STATUSES).not("npin", "is", null).eq("state_id", state.id).limit(200),
    ]);
    for (const result of [total, verified, typeRows]) {
      if (result.error) throw result.error;
    }
    const propertyCount = total.count ?? 0;
    const verifiedCount = verified.count ?? 0;
    const categories = [...new Set((typeRows.data ?? []).map((property) => humanize(property.property_type)))].slice(0, 4);
    return {
      id: state.id,
      name: state.name,
      propertyCount,
      categories,
      registryCoverage: propertyCount ? Math.round((verifiedCount / propertyCount) * 100) : 0,
      verificationCoverage: propertyCount ? Math.round((verifiedCount / propertyCount) * 100) : 0,
      industrialReadiness: (typeRows.data ?? []).some((property) => property.property_type === "industrial") ? "Industrial registry signals available" : "Industrial registry signals emerging",
    };
  }));
}

export async function verifyPublicProperty(input: { npin?: string; token?: string }, client?: Client): Promise<PublicPropertyVerificationResult> {
  const supabase = await service(client);
  const now = new Date();
  let credential: PublicCredentialRow | null = null;
  const token = normalizeVerificationToken(input.token);
  const npin = normalizeIdentifier(input.npin);
  if (token) {
    const lookupHash = createHash("sha256").update(token).digest("hex");
    const { data, error } = await supabase
      .from("property_identity_credentials")
      .select(PUBLIC_CREDENTIAL_SELECT)
      .eq("public_token_hash", lookupHash)
      .maybeSingle();
    if (error) throw error;
    credential = data as PublicCredentialRow | null;
  } else if (npin) {
    const { data, error } = await supabase
      .from("property_identity_credentials")
      .select(PUBLIC_CREDENTIAL_SELECT)
      .eq("npin", npin)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    credential = data as PublicCredentialRow | null;
  }

  if (!credential) {
    return {
      status: "unknown",
      label: "Unknown credential",
      verifiedAt: now.toISOString(),
      issuingAuthority: ISSUING_AUTHORITY,
      registryDisclaimer: REGISTRY_DISCLAIMER,
      credential: null,
      property: null,
    };
  }

  const expired = credential.token_expires_at ? new Date(credential.token_expires_at).getTime() < now.getTime() : false;
  const status = expired ? "expired" : credential.status === "issued" ? "valid" : credential.status;
  const property = await getPublicPropertyByNpin(credential.npin, supabase);
  return {
    status: status as PublicPropertyVerificationResult["status"],
    label: status === "valid" ? "Valid property credential" : `${humanize(status)} credential`,
    verifiedAt: now.toISOString(),
    issuingAuthority: ISSUING_AUTHORITY,
    registryDisclaimer: REGISTRY_DISCLAIMER,
    credential: {
      npin: credential.npin,
      credentialReference: credential.credential_reference,
      status: credential.status,
      issuedAt: credential.issued_at,
      expiresAt: credential.token_expires_at,
    },
    property,
  };
}

export const POPULAR_PROPERTY_SEARCHES = [
  "Industrial land in Lagos",
  "Agricultural properties in Ogun",
  "Government land",
  "Institutional land",
  "Verified commercial property",
  "NPIN lookup",
];

export const PROPERTY_TYPE_OPTIONS: PropertyType[] = ["industrial", "agricultural", "commercial", "residential", "government", "institutional", "mixed_use"];
