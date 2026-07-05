import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { JsonRecord } from "@/types/platform";
import type { Property, PropertyCategory, PropertyDocument, PropertyIdentityCredential, PropertyType } from "@/types/property";

type Client = SupabaseClient<any>;

export type PublicPropertySummary = {
  id: string;
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

async function service(client?: Client) {
  return client ?? await createServiceRoleSupabaseClient();
}

function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Unavailable";
}

function normalize(value: string | null | undefined) {
  return value?.trim() ?? "";
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

function publicDocument(document: PropertyDocument) {
  const metadata = document.metadata as JsonRecord;
  return document.status === "accepted" && (metadata.public === true || metadata.public_access === true || metadata.public_visible === true);
}

async function lookupNames(client: Client, rows: Property[]) {
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
  if (!propertyIds.length) return new Map<string, PropertyIdentityCredential>();
  const { data, error } = await client
    .from("property_identity_credentials")
    .select("*")
    .in("property_id", propertyIds)
    .order("issued_at", { ascending: false });
  if (error) throw error;
  const map = new Map<string, PropertyIdentityCredential>();
  for (const credential of (data ?? []) as PropertyIdentityCredential[]) {
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

async function toPublicSummaries(client: Client, rows: Property[]): Promise<PublicPropertySummary[]> {
  const lookups = await lookupNames(client, rows);
  const credentials = await credentialMap(client, rows.map((row) => row.id));
  const certificates = await certificateMap(client, rows.map((row) => row.id));

  return rows
    .filter((property) => property.npin && PUBLIC_STATUSES.includes(property.status))
    .map((property) => {
      const category = property.property_category_id ? lookups.categories.get(property.property_category_id) : null;
      const credential = credentials.get(property.id);
      return {
        id: property.id,
        npin: property.npin!,
        applicationReference: property.application_reference,
        title: property.title || humanize(property.property_type),
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
        description: property.description,
        issuedAt: credential?.issued_at ?? null,
      };
    });
}

export async function searchPublicProperties(filters: PublicPropertySearchFilters = {}, client?: Client) {
  const supabase = await service(client);
  const limit = Math.min(Math.max(filters.limit ?? 12, 1), 48);
  const page = Math.max(filters.page ?? 1, 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("properties")
    .select("*", { count: "exact" })
    .in("status", PUBLIC_STATUSES)
    .not("npin", "is", null)
    .order("updated_at", { ascending: false })
    .range(from, to);

  const q = normalize(filters.q);
  if (q) {
    query = query.or(`npin.ilike.%${q}%,application_reference.ilike.%${q}%,title.ilike.%${q}%,description.ilike.%${q}%,parcel_reference.ilike.%${q}%`);
  }
  if (filters.npin) query = query.ilike("npin", `%${filters.npin.trim()}%`);
  if (filters.applicationReference) query = query.ilike("application_reference", `%${filters.applicationReference.trim()}%`);
  if (filters.propertyType) query = query.eq("property_type", filters.propertyType);
  if (filters.registryStatus) query = query.eq("registry_status", filters.registryStatus);
  if (filters.landUse) query = query.ilike("metadata->>current_use", `%${filters.landUse.trim()}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Property[];

  if (filters.state || filters.lga || filters.ward || filters.community || filters.category || filters.verificationStatus) {
    const summaries = await toPublicSummaries(supabase, rows);
    const filtered = summaries.filter((item) => {
      if (filters.state && item.state.toLowerCase() !== filters.state.toLowerCase()) return false;
      if (filters.lga && item.lga.toLowerCase() !== filters.lga.toLowerCase()) return false;
      if (filters.ward && item.ward?.toLowerCase() !== filters.ward.toLowerCase()) return false;
      if (filters.community && item.community?.toLowerCase() !== filters.community.toLowerCase()) return false;
      if (filters.category && item.categoryKey !== filters.category && item.category.toLowerCase() !== filters.category.toLowerCase()) return false;
      if (filters.verificationStatus && item.verificationStatus !== filters.verificationStatus) return false;
      return true;
    });
    return { results: filtered, count: filtered.length, page, limit };
  }

  return { results: await toPublicSummaries(supabase, rows), count: count ?? rows.length, page, limit };
}

export async function getPublicPropertyByNpin(npin: string, client?: Client): Promise<PublicPropertyProfile | null> {
  const supabase = await service(client);
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("npin", npin.trim().toUpperCase())
    .in("status", PUBLIC_STATUSES)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const summaries = await toPublicSummaries(supabase, [data as Property]);
  const summary = summaries[0];
  if (!summary) return null;

  const { data: documents, error: documentError } = await supabase
    .from("property_documents")
    .select("*")
    .eq("property_id", data.id)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (documentError) throw documentError;

  return {
    ...summary,
    issuingAuthority: ISSUING_AUTHORITY,
    documents: ((documents ?? []) as PropertyDocument[]).filter(publicDocument).map((document) => ({
      title: document.title,
      documentType: humanize(document.document_type),
      issuedAt: document.issued_at,
      issuer: document.issuer,
    })),
    disclaimer: REGISTRY_DISCLAIMER,
  };
}

export async function getPublicPropertyStats(client?: Client) {
  const supabase = await service(client);
  const [verified, industrial, agricultural, government, institutional, categories, states] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).not("npin", "is", null),
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).eq("property_type", "industrial"),
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).eq("property_type", "agricultural"),
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).eq("property_type", "government"),
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", PUBLIC_STATUSES).eq("property_type", "institutional"),
    supabase.from("property_categories").select("*").eq("status", "active").order("name"),
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
  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id,state_id,property_type,status,registry_status")
    .in("status", PUBLIC_STATUSES)
    .not("npin", "is", null)
    .limit(5000);
  if (propertiesError) throw propertiesError;
  return (states ?? []).map((state) => {
    const rows = (properties ?? []).filter((property) => property.state_id === state.id);
    const verified = rows.filter((property) => property.status === "verified" || property.registry_status === "verified").length;
    const categories = [...new Set(rows.map((property) => humanize(property.property_type)))].slice(0, 4);
    return {
      id: state.id,
      name: state.name,
      propertyCount: rows.length,
      categories,
      registryCoverage: rows.length ? Math.round((verified / rows.length) * 100) : 0,
      verificationCoverage: rows.length ? Math.round((verified / rows.length) * 100) : 0,
      industrialReadiness: rows.some((property) => property.property_type === "industrial") ? "Industrial registry signals available" : "Industrial registry signals emerging",
    };
  });
}

export async function verifyPublicProperty(input: { npin?: string; token?: string }, client?: Client): Promise<PublicPropertyVerificationResult> {
  const supabase = await service(client);
  const now = new Date();
  let credential: PropertyIdentityCredential | null = null;
  if (input.token) {
    const lookupHash = createHash("sha256").update(input.token.trim()).digest("hex");
    const { data, error } = await supabase
      .from("property_identity_credentials")
      .select("*")
      .eq("public_token_hash", lookupHash)
      .maybeSingle();
    if (error) throw error;
    credential = data as PropertyIdentityCredential | null;
  } else if (input.npin) {
    const { data, error } = await supabase
      .from("property_identity_credentials")
      .select("*")
      .eq("npin", input.npin.trim().toUpperCase())
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    credential = data as PropertyIdentityCredential | null;
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
