import rmrdcSource from "../../../data/lcdbo/rmrdc-lga-resource-source.json";
import { LCDBO_PROGRAMME_SLUG, type LcdboClusterCard } from "@/lib/lcdbo/content";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const RMRDC_SOURCE_DISCLOSURE =
  "The RMRDC source identifies raw materials and resource-based investment opportunities across Nigeria’s Local Government Areas. LCDBO uses a governed assessment and institutional approval process to select one anchor product for each LGA and develop an appropriate industrial-cluster pathway.";

export const LCDBO_CLUSTER_DATA_CLASSES = [
  "RMRDC Reference Source — 2017",
  "Source-listed Raw Material",
  "Candidate Anchor Product",
  "Pending Validation",
  "Recommended",
  "Institutionally Approved",
  "Proposed Cluster",
  "Approved Programme Cluster",
  "Planned",
  "Active Operational Record",
  "Configured Target",
  "Long-term Programme Ambition",
  "Last Reviewed",
] as const;

export type RmrdcSourceRow = {
  source_row_id: string;
  source_document_key: string;
  source_page: number;
  source_serial: number;
  source_state_label: string;
  normalised_state: string;
  source_lga_label: string;
  source_lga_label_original: string;
  source_text: string;
  source_material_and_opportunity_text: string;
  extraction_status: string;
  extraction_confidence: string;
  source_classification: string;
};

export type LcdboStateOpportunitySummary = {
  state: string;
  stateSlug: string;
  sourceRows: number;
  sourcePages: number[];
  lgas: LcdboLgaResourceSummary[];
};

export type LcdboLgaResourceSummary = {
  publicReference: string;
  state: string;
  stateSlug: string;
  lga: string;
  sourcePage: number;
  sourceRowId: string;
  sourceClassification: string;
  extractionConfidence: string;
  materialPreview: string;
  anchorStatus: "pending_validation";
  approvedAnchorProduct: null;
};

export type LcdboApprovedPublicCluster = LcdboClusterCard & {
  publicReference: string;
  publicSlug: string;
  publicSummary: string;
  dataClassification: string;
  lastReviewedAt: string | null;
};

export const canonicalLgaSeed = [
  { state: "Lagos", lga: "Ikeja" },
  { state: "Lagos", lga: "Surulere" },
  { state: "Lagos", lga: "Mushin" },
  { state: "Ogun", lga: "Abeokuta South" },
  { state: "Oyo", lga: "Ibadan North" },
  { state: "Kano", lga: "Kano Municipal" },
  { state: "Kano", lga: "Nassarawa" },
  { state: "Federal Capital Territory", lga: "Abuja Municipal" },
  { state: "Abia", lga: "Aba North" },
  { state: "Abia", lga: "Aba South" },
  { state: "Rivers", lga: "Port Harcourt" },
] as const;

export function slugifyLcdboCatalogue(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function publicLgaReference(state: string, lga: string) {
  return `lga-${slugifyLcdboCatalogue(state)}-${slugifyLcdboCatalogue(lga)}`;
}

export function sourceRows(): RmrdcSourceRow[] {
  return (rmrdcSource.rows as RmrdcSourceRow[]).filter((row) => row.normalised_state && row.source_lga_label);
}

export function sourceMetadata() {
  return rmrdcSource.metadata;
}

export function lgaSummary(row: RmrdcSourceRow): LcdboLgaResourceSummary {
  return {
    publicReference: publicLgaReference(row.normalised_state, row.source_lga_label),
    state: row.normalised_state,
    stateSlug: slugifyLcdboCatalogue(row.normalised_state),
    lga: row.source_lga_label,
    sourcePage: row.source_page,
    sourceRowId: row.source_row_id,
    sourceClassification: row.source_classification,
    extractionConfidence: row.extraction_confidence,
    materialPreview: row.source_material_and_opportunity_text.slice(0, 280),
    anchorStatus: "pending_validation",
    approvedAnchorProduct: null,
  };
}

export function getStateOpportunitySummaries(): LcdboStateOpportunitySummary[] {
  const grouped = new Map<string, RmrdcSourceRow[]>();
  for (const row of sourceRows()) {
    grouped.set(row.normalised_state, [...(grouped.get(row.normalised_state) ?? []), row]);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, rows]) => ({
      state,
      stateSlug: slugifyLcdboCatalogue(state),
      sourceRows: rows.length,
      sourcePages: [...new Set(rows.map((row) => row.source_page))].sort((a, b) => a - b),
      lgas: rows.map(lgaSummary).sort((a, b) => a.lga.localeCompare(b.lga)),
    }));
}

export function getStateOpportunitySummary(stateSlug: string) {
  return getStateOpportunitySummaries().find((state) => state.stateSlug === stateSlug) ?? null;
}

export function getLgaResourceProfile(reference: string) {
  const row = sourceRows().find((item) => publicLgaReference(item.normalised_state, item.source_lga_label) === reference);
  return row ? { row, summary: lgaSummary(row) } : null;
}

export function getLcdboSourceCoverage() {
  const rows = sourceRows();
  const stateCount = new Set(rows.map((row) => row.normalised_state)).size;
  const canonicalKeys = new Set(canonicalLgaSeed.map((item) => `${item.state.toLowerCase()}|${item.lga.toLowerCase()}`));
  const matched = rows.filter((row) => canonicalKeys.has(`${row.normalised_state.toLowerCase()}|${row.source_lga_label.toLowerCase()}`));
  return {
    sourceRows: rows.length,
    stateFctCoverage: stateCount,
    currentCanonicalLgaSeedCount: canonicalLgaSeed.length,
    exactCanonicalMatches: matched.length,
    aliasMatches: 0,
    ambiguous: rows.length - matched.length,
    approvedAnchorProducts: 0,
    candidateAnchorProducts: 0,
    publishedPublicClusters: 0,
    all774AccountedFor: false,
  };
}

export async function listApprovedPublicClusters(): Promise<LcdboApprovedPublicCluster[]> {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const { data: programme, error: programmeError } = await supabase
      .from("programmes")
      .select("id")
      .eq("slug", LCDBO_PROGRAMME_SLUG)
      .maybeSingle();
    if (programmeError || !programme?.id) return [];

    const { data, error } = await supabase
      .from("industrial_clusters")
      .select("public_reference,public_slug,name,slug,cluster_type,sector,status,public_summary,investment_required,jobs_target,msme_target,data_classification,last_public_reviewed_at")
      .eq("programme_id", programme.id)
      .eq("public_visibility", "public_catalogue")
      .eq("publication_status", "published")
      .in("data_classification", ["approved_programme_record", "live_operational_data"])
      .not("public_reference", "is", null)
      .not("public_slug", "is", null)
      .order("name", { ascending: true });
    if (error) return [];

    return (data ?? []).map((row: any) => ({
      id: row.public_reference,
      publicReference: row.public_reference,
      publicSlug: row.public_slug,
      name: row.name,
      slug: row.slug,
      clusterType: String(row.cluster_type ?? "").replaceAll("_", " "),
      sector: row.sector,
      state: "Published catalogue",
      lga: "Published catalogue",
      locationDescription: "Published public catalogue record",
      status: row.status,
      publicSummary: row.public_summary ?? "Approved public cluster profile.",
      description: row.public_summary ?? "Approved public cluster profile.",
      investmentRequired: row.investment_required,
      jobsTarget: row.jobs_target,
      msmeTarget: row.msme_target,
      dataClassification: row.data_classification,
      lastReviewedAt: row.last_public_reviewed_at,
    }));
  } catch {
    return [];
  }
}

export async function getApprovedPublicCluster(referenceOrSlug: string) {
  const clusters = await listApprovedPublicClusters();
  return clusters.find((cluster) => cluster.publicReference === referenceOrSlug || cluster.publicSlug === referenceOrSlug) ?? null;
}
