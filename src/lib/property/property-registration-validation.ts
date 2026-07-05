import type { SupabaseClient } from "@supabase/supabase-js";
import type { PropertyDocumentType, PropertyOwnerType, PropertyType } from "@/types/property";

type Client = SupabaseClient<any>;

export const PROPERTY_TYPES = new Set<PropertyType>(["residential", "commercial", "industrial", "agricultural", "mining", "institutional", "mixed_use", "government", "infrastructure", "protected"]);
export const OWNER_TYPES = new Set<PropertyOwnerType>(["individual", "joint", "corporate", "government", "institution", "community", "cooperative", "trust", "family_estate"]);
export const REGISTRATION_DOCUMENT_TYPES = new Set<PropertyDocumentType>(["survey_plan", "certificate_of_occupancy", "deed_of_assignment", "allocation_letter", "photographs", "supporting_evidence", "building_approval"]);
export const REGISTRATION_DOCUMENT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type RegistrationIntent = "draft" | "submit";

export type OwnerInput = {
  id: string | null;
  owner_type: PropertyOwnerType;
  owner_name: string;
  ownership_percentage: number | null;
  is_primary: boolean;
  notes: string | null;
};

export type DocumentInput = {
  index: number;
  document_type: PropertyDocumentType;
  title: string | null;
  description: string | null;
  file: File;
};

export type ParsedPropertyRegistration = {
  intent: RegistrationIntent;
  propertyId: string | null;
  currentStep: number;
  nextStep: number | null;
  propertyType: PropertyType;
  propertyCategoryId: string | null;
  countryId: string | null;
  stateId: string | null;
  lgaId: string | null;
  wardId: string | null;
  communityId: string | null;
  villageId: string | null;
  surveyBlockId: string | null;
  latitude: number | null;
  longitude: number | null;
  areaSize: number | null;
  owners: OwnerInput[];
  documents: DocumentInput[];
};

export function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function nullable(value: string | null | undefined) {
  return value?.trim() || null;
}

export function numeric(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function step(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : null;
}

function collectOwners(formData: FormData): OwnerInput[] {
  const owners: OwnerInput[] = [];
  for (let index = 0; index < 4; index += 1) {
    const id = nullable(formValue(formData, `owner_${index}_id`));
    const ownerName = formValue(formData, `owner_${index}_name`);
    const ownerType = formValue(formData, `owner_${index}_type`) as PropertyOwnerType;
    const percentage = numeric(formValue(formData, `owner_${index}_percentage`));
    const notes = nullable(formValue(formData, `owner_${index}_notes`));
    const isPrimary = formData.get(`owner_${index}_primary`) === "on";
    const hasMeaningfulOwnerInput = Boolean(id || ownerName || percentage !== null || notes);
    if (!hasMeaningfulOwnerInput) continue;
    if (!ownerName) throw new Error("Owner name is required when adding an owner.");
    if (!OWNER_TYPES.has(ownerType)) throw new Error("Invalid owner type.");
    if (percentage !== null && (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100)) {
      throw new Error("Ownership percentage must be between 0 and 100.");
    }
    owners.push({ id, owner_type: ownerType, owner_name: ownerName, ownership_percentage: percentage, is_primary: isPrimary, notes });
  }
  return owners;
}

function collectDocuments(formData: FormData): DocumentInput[] {
  const documents: DocumentInput[] = [];
  for (let index = 0; index < 5; index += 1) {
    const documentType = formValue(formData, `document_${index}_type`) as PropertyDocumentType;
    const file = formData.get(`document_${index}_file`);
    const title = nullable(formValue(formData, `document_${index}_title`));
    const description = nullable(formValue(formData, `document_${index}_description`));
    if (!documentType && !(file instanceof File && file.size > 0)) continue;
    if (!REGISTRATION_DOCUMENT_TYPES.has(documentType)) throw new Error("Unsupported property document type.");
    if (!(file instanceof File) || file.size <= 0) continue;
    if (file.type && !REGISTRATION_DOCUMENT_MIME_TYPES.has(file.type)) {
      throw new Error("Property documents must be PDF, JPEG, PNG or WEBP files.");
    }
    documents.push({ index, document_type: documentType, title, description, file });
  }
  return documents;
}

export function parsePropertyRegistrationForm(formData: FormData): ParsedPropertyRegistration {
  const intent = formValue(formData, "intent") === "submit" ? "submit" : "draft";
  const propertyType = formValue(formData, "property_type") as PropertyType;
  const owners = collectOwners(formData);
  const parsed: ParsedPropertyRegistration = {
    intent,
    propertyId: nullable(formValue(formData, "property_id")),
    currentStep: step(formValue(formData, "current_step")) ?? 1,
    nextStep: step(formValue(formData, "next_step")),
    propertyType,
    propertyCategoryId: nullable(formValue(formData, "property_category_id")),
    countryId: nullable(formValue(formData, "country_id")),
    stateId: nullable(formValue(formData, "state_id")),
    lgaId: nullable(formValue(formData, "lga_id")),
    wardId: nullable(formValue(formData, "ward_id")),
    communityId: nullable(formValue(formData, "community_id")),
    villageId: nullable(formValue(formData, "village_id")),
    surveyBlockId: nullable(formValue(formData, "survey_block_id")),
    latitude: numeric(formValue(formData, "centroid_latitude")),
    longitude: numeric(formValue(formData, "centroid_longitude")),
    areaSize: numeric(formValue(formData, "area_size")),
    owners,
    documents: collectDocuments(formData),
  };
  validateRegistrationBasics(parsed);
  return parsed;
}

export function validateRegistrationBasics(parsed: ParsedPropertyRegistration) {
  if (!PROPERTY_TYPES.has(parsed.propertyType)) throw new Error("Select a valid property type.");
  if (parsed.intent === "submit") {
    if (!parsed.propertyCategoryId) throw new Error("Select a property category.");
    if (!parsed.countryId || !parsed.stateId || !parsed.lgaId) throw new Error("Country, state and LGA are required before submission.");
    if (!parsed.owners.length) throw new Error("At least one owner is required before submission.");
  }
  if (parsed.latitude !== null && (!Number.isFinite(parsed.latitude) || parsed.latitude < -90 || parsed.latitude > 90)) throw new Error("Latitude must be between -90 and 90.");
  if (parsed.longitude !== null && (!Number.isFinite(parsed.longitude) || parsed.longitude < -180 || parsed.longitude > 180)) throw new Error("Longitude must be between -180 and 180.");
  if (parsed.areaSize !== null && (!Number.isFinite(parsed.areaSize) || parsed.areaSize < 0)) throw new Error("Approximate size must be a positive number.");
  if (parsed.owners.filter((owner) => owner.is_primary).length > 1) throw new Error("Only one owner can be marked as primary.");
  const totalOwnership = parsed.owners.reduce((sum, owner) => sum + (owner.ownership_percentage ?? 0), 0);
  if (totalOwnership > 100) throw new Error("Total ownership percentage cannot exceed 100.");
}

export async function validatePropertyReferences(parsed: ParsedPropertyRegistration, supabase: Client) {
  if (parsed.propertyCategoryId) {
    const { data: category, error } = await supabase.from("property_categories").select("id").eq("id", parsed.propertyCategoryId).eq("status", "active").maybeSingle();
    if (error) throw error;
    if (!category) throw new Error("Selected property category is not available.");
  }

  const [country, state, lga, ward, community, village, surveyBlock] = await Promise.all([
    parsed.countryId ? supabase.from("countries").select("id").eq("id", parsed.countryId).eq("status", "active").maybeSingle() : Promise.resolve({ data: null, error: null }),
    parsed.stateId ? supabase.from("states").select("id,country_id").eq("id", parsed.stateId).eq("status", "active").maybeSingle() : Promise.resolve({ data: null, error: null }),
    parsed.lgaId ? supabase.from("lgas").select("id,state_id").eq("id", parsed.lgaId).eq("status", "active").maybeSingle() : Promise.resolve({ data: null, error: null }),
    parsed.wardId ? supabase.from("property_wards").select("id,lga_id").eq("id", parsed.wardId).eq("status", "active").maybeSingle() : Promise.resolve({ data: null, error: null }),
    parsed.communityId ? supabase.from("property_communities").select("id,lga_id,ward_id").eq("id", parsed.communityId).eq("status", "active").maybeSingle() : Promise.resolve({ data: null, error: null }),
    parsed.villageId ? supabase.from("property_villages").select("id,lga_id,ward_id,community_id").eq("id", parsed.villageId).eq("status", "active").maybeSingle() : Promise.resolve({ data: null, error: null }),
    parsed.surveyBlockId ? supabase.from("survey_blocks").select("id,country_id,state_id,lga_id,ward_id,community_id").eq("id", parsed.surveyBlockId).eq("status", "active").maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const result of [country, state, lga, ward, community, village, surveyBlock]) {
    if (result.error) throw result.error;
  }

  if (parsed.intent === "submit" && (!country.data || !state.data || !lga.data)) {
    throw new Error("Selected country, state or LGA is not available.");
  }
  if (parsed.countryId && !country.data) throw new Error("Selected country is not available.");
  if (parsed.stateId && !state.data) throw new Error("Selected state is not available.");
  if (parsed.lgaId && !lga.data) throw new Error("Selected LGA is not available.");
  if (parsed.wardId && !ward.data) throw new Error("Selected ward is not available.");
  if (parsed.communityId && !community.data) throw new Error("Selected community is not available.");
  if (parsed.villageId && !village.data) throw new Error("Selected village is not available.");
  if (parsed.surveyBlockId && !surveyBlock.data) throw new Error("Selected survey block is not available.");

  if (state.data && parsed.countryId && state.data.country_id !== parsed.countryId) throw new Error("Selected state does not belong to the selected country.");
  if (lga.data && parsed.stateId && lga.data.state_id !== parsed.stateId) throw new Error("Selected LGA does not belong to the selected state.");
  if (ward.data && parsed.lgaId && ward.data.lga_id !== parsed.lgaId) throw new Error("Selected ward does not belong to the selected LGA.");
  if (community.data) {
    if (parsed.lgaId && community.data.lga_id !== parsed.lgaId) throw new Error("Selected community does not belong to the selected LGA.");
    if (parsed.wardId && community.data.ward_id && community.data.ward_id !== parsed.wardId) throw new Error("Selected community does not belong to the selected ward.");
  }
  if (village.data) {
    if (parsed.lgaId && village.data.lga_id !== parsed.lgaId) throw new Error("Selected village does not belong to the selected LGA.");
    if (parsed.wardId && village.data.ward_id && village.data.ward_id !== parsed.wardId) throw new Error("Selected village does not belong to the selected ward.");
    if (parsed.communityId && village.data.community_id && village.data.community_id !== parsed.communityId) throw new Error("Selected village does not belong to the selected community.");
  }
  if (surveyBlock.data) {
    if (parsed.countryId && surveyBlock.data.country_id && surveyBlock.data.country_id !== parsed.countryId) throw new Error("Selected survey block does not belong to the selected country.");
    if (parsed.stateId && surveyBlock.data.state_id && surveyBlock.data.state_id !== parsed.stateId) throw new Error("Selected survey block does not belong to the selected state.");
    if (parsed.lgaId && surveyBlock.data.lga_id && surveyBlock.data.lga_id !== parsed.lgaId) throw new Error("Selected survey block does not belong to the selected LGA.");
    if (parsed.wardId && surveyBlock.data.ward_id && surveyBlock.data.ward_id !== parsed.wardId) throw new Error("Selected survey block does not belong to the selected ward.");
    if (parsed.communityId && surveyBlock.data.community_id && surveyBlock.data.community_id !== parsed.communityId) throw new Error("Selected survey block does not belong to the selected community.");
  }
}
