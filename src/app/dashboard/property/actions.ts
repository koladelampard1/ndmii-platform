"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { generatePropertyNpin, recordPropertyEvent } from "@/lib/data/property-foundation";
import type { PropertyDocumentType, PropertyOwnerType, PropertyType } from "@/types/property";

const PROPERTY_TYPES = new Set<PropertyType>(["residential", "commercial", "industrial", "agricultural", "mining", "institutional", "mixed_use", "government", "infrastructure", "protected"]);
const OWNER_TYPES = new Set<PropertyOwnerType>(["individual", "joint", "corporate", "government", "institution", "community", "cooperative", "trust", "family_estate"]);
const DOCUMENT_TYPES = new Set<PropertyDocumentType>(["survey_plan", "certificate_of_occupancy", "deed_of_assignment", "allocation_letter", "photographs", "supporting_evidence", "building_approval"]);
const PROPERTY_DOCUMENT_BUCKET = "property-documents";

type OwnerInput = {
  owner_type: PropertyOwnerType;
  owner_name: string;
  ownership_percentage: number | null;
  is_primary: boolean;
  notes: string | null;
};

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullable(value: string) {
  return value.trim() || null;
}

function numeric(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "property-document";
}

function collectOwners(formData: FormData): OwnerInput[] {
  const owners: OwnerInput[] = [];
  for (let index = 0; index < 4; index += 1) {
    const ownerName = value(formData, `owner_${index}_name`);
    const ownerType = value(formData, `owner_${index}_type`) as PropertyOwnerType;
    const percentage = numeric(value(formData, `owner_${index}_percentage`));
    const notes = nullable(value(formData, `owner_${index}_notes`));
    const isPrimary = formData.get(`owner_${index}_primary`) === "on";
    if (!ownerName && !ownerType && percentage === null && !notes && !isPrimary) continue;
    if (!OWNER_TYPES.has(ownerType)) throw new Error("Invalid owner type.");
    if (percentage !== null && (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100)) {
      throw new Error("Ownership percentage must be between 0 and 100.");
    }
    owners.push({ owner_type: ownerType, owner_name: ownerName, ownership_percentage: percentage, is_primary: isPrimary, notes });
  }
  return owners;
}

function validateRegistration(formData: FormData, intent: "draft" | "submit", owners: OwnerInput[]) {
  const propertyType = value(formData, "property_type") as PropertyType;
  const propertyCategoryId = value(formData, "property_category_id");
  const countryId = value(formData, "country_id");
  const stateId = value(formData, "state_id");
  const lgaId = value(formData, "lga_id");
  const latitude = numeric(value(formData, "centroid_latitude"));
  const longitude = numeric(value(formData, "centroid_longitude"));
  const areaSize = numeric(value(formData, "area_size"));

  if (!PROPERTY_TYPES.has(propertyType)) throw new Error("Select a valid property type.");
  if (intent === "submit") {
    if (!propertyCategoryId) throw new Error("Select a property category.");
    if (!countryId || !stateId || !lgaId) throw new Error("Country, state and LGA are required before submission.");
    if (!owners.length) throw new Error("At least one owner is required before submission.");
  }
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) throw new Error("Latitude must be between -90 and 90.");
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw new Error("Longitude must be between -180 and 180.");
  if (areaSize !== null && (!Number.isFinite(areaSize) || areaSize < 0)) throw new Error("Approximate size must be a positive number.");
  if (owners.filter((owner) => owner.is_primary).length > 1) throw new Error("Only one owner can be marked as primary.");
  const totalOwnership = owners.reduce((sum, owner) => sum + (owner.ownership_percentage ?? 0), 0);
  if (totalOwnership > 100) throw new Error("Total ownership percentage cannot exceed 100.");

  return { propertyType, propertyCategoryId, countryId, stateId, lgaId, latitude, longitude, areaSize };
}

async function requirePropertyRegistrationUser() {
  const ctx = await getCurrentUserContext();
  if (ctx.role === "public" || !ctx.appUserId) redirect("/access-denied");
  const supabase = await createServiceRoleSupabaseClient();
  const { data: module } = await supabase.from("platform_modules").select("id,status").eq("module_key", "property_registry").maybeSingle();
  if (!module || !["active", "preview"].includes(module.status)) redirect("/access-denied");
  return { ctx, supabase };
}

async function resolveExistingProperty(input: { propertyId: string | null; actorUserId: string; supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>> }) {
  if (!input.propertyId) return null;
  const { data, error } = await input.supabase
    .from("properties")
    .select("id,status,npin,registered_by,state_id")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Property draft not found.");
  if (data.registered_by !== input.actorUserId) throw new Error("You can only update your own property registration.");
  if (!["draft", "submitted"].includes(data.status)) throw new Error("This property registration cannot be edited in the workspace.");
  return data as { id: string; status: string; npin: string | null; registered_by: string | null; state_id: string | null };
}

async function uploadDocumentFile(input: {
  propertyId: string;
  actorUserId: string;
  file: File;
  documentType: PropertyDocumentType;
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>;
}) {
  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const path = `${input.actorUserId}/${input.propertyId}/${randomUUID()}-${safeFilename(input.file.name)}`;
  const { error } = await input.supabase.storage
    .from(PROPERTY_DOCUMENT_BUCKET)
    .upload(path, buffer, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  return {
    storage_bucket: PROPERTY_DOCUMENT_BUCKET,
    storage_path: path,
    file_name: input.file.name,
    file_size_bytes: input.file.size,
    mime_type: input.file.type || null,
    checksum_sha256: checksum,
  };
}

export async function savePropertyRegistrationAction(formData: FormData) {
  const intent = value(formData, "intent") === "submit" ? "submit" : "draft";
  try {
    const { ctx, supabase } = await requirePropertyRegistrationUser();
    const existing = await resolveExistingProperty({ propertyId: nullable(value(formData, "property_id")), actorUserId: ctx.appUserId!, supabase });
    const owners = collectOwners(formData);
    const validated = validateRegistration(formData, intent, owners);
    if (validated.propertyCategoryId) {
      const { data: category } = await supabase.from("property_categories").select("id").eq("id", validated.propertyCategoryId).eq("status", "active").maybeSingle();
      if (!category) throw new Error("Selected property category is not available.");
    }
    if (intent === "submit") {
      const [{ data: country }, { data: state }, { data: lga }] = await Promise.all([
        supabase.from("countries").select("id").eq("id", validated.countryId).eq("status", "active").maybeSingle(),
        supabase.from("states").select("id").eq("id", validated.stateId).eq("status", "active").maybeSingle(),
        supabase.from("lgas").select("id").eq("id", validated.lgaId).eq("status", "active").maybeSingle(),
      ]);
      if (!country || !state || !lga) throw new Error("Selected country, state or LGA is not available.");
    }
    const now = new Date().toISOString();
    let npin = existing?.npin ?? null;

    if (intent === "submit" && !npin) {
      npin = await generatePropertyNpin(validated.stateId, supabase);
    }

    const propertyPayload = {
      npin,
      parcel_reference: nullable(value(formData, "parcel_reference")),
      property_category_id: nullable(validated.propertyCategoryId),
      property_type: validated.propertyType,
      title: nullable(value(formData, "title")),
      description: nullable(value(formData, "description")),
      country_id: nullable(validated.countryId),
      state_id: nullable(validated.stateId),
      lga_id: nullable(validated.lgaId),
      ward_id: nullable(value(formData, "ward_id")),
      community_id: nullable(value(formData, "community_id")),
      village_id: nullable(value(formData, "village_id")),
      status: intent === "submit" ? "submitted" : "draft",
      registry_status: intent === "submit" ? "submitted" : "draft",
      area_size: validated.areaSize,
      area_unit: nullable(value(formData, "area_unit")),
      registered_by: ctx.appUserId,
      metadata: {
        current_use: nullable(value(formData, "current_use")),
        planned_use: nullable(value(formData, "planned_use")),
        development_stage: nullable(value(formData, "development_stage")),
        phase: "dlpi_property_registration_phase2",
      },
    };

    const propertyResult = existing
      ? await supabase.from("properties").update(propertyPayload).eq("id", existing.id).select("*").single()
      : await supabase.from("properties").insert(propertyPayload).select("*").single();
    if (propertyResult.error || !propertyResult.data) throw propertyResult.error ?? new Error("Unable to save property registration.");
    const property = propertyResult.data as { id: string; state_id: string | null; lga_id: string | null };

    await supabase.from("property_addresses").delete().eq("property_id", property.id);
    await supabase.from("property_addresses").insert({
      property_id: property.id,
      country_id: nullable(validated.countryId),
      state_id: nullable(validated.stateId),
      lga_id: nullable(validated.lgaId),
      ward_id: nullable(value(formData, "ward_id")),
      community_id: nullable(value(formData, "community_id")),
      village_id: nullable(value(formData, "village_id")),
      street: nullable(value(formData, "street")),
      building: nullable(value(formData, "building")),
      plot: nullable(value(formData, "plot")),
      block: nullable(value(formData, "block")),
      parcel_reference: nullable(value(formData, "parcel_reference")),
      centroid_latitude: validated.latitude,
      centroid_longitude: validated.longitude,
      traditional_description: nullable(value(formData, "traditional_description")),
      is_primary: true,
      metadata: { phase: "dlpi_property_registration_phase2" },
    });

    await supabase.from("property_owners").delete().eq("property_id", property.id).eq("verification_status", "unverified");
    if (owners.length) {
      const ownerRows = owners.map((owner) => ({
        property_id: property.id,
        owner_type: owner.owner_type,
        owner_name: owner.owner_name || null,
        ownership_percentage: owner.ownership_percentage,
        is_primary: owner.is_primary,
        verification_status: "unverified",
        effective_from: new Date().toISOString().slice(0, 10),
        metadata: { notes: owner.notes, phase: "dlpi_property_registration_phase2" },
      }));
      const { error: ownerError } = await supabase.from("property_owners").insert(ownerRows);
      if (ownerError) throw ownerError;
      await recordPropertyEvent({
        propertyId: property.id,
        eventType: "property.owner.added",
        actorUserId: ctx.appUserId,
        summary: `${owners.length} owner record(s) saved.`,
        metadata: { owner_count: owners.length },
        client: supabase,
      });
    }

    const claimReference = `PCL-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const primaryOwner = owners.find((owner) => owner.is_primary) ?? owners[0] ?? null;
    if (intent === "submit") {
      const { data: existingClaim } = await supabase.from("property_claims").select("id").eq("property_id", property.id).eq("claim_type", "registration").maybeSingle();
      if (!existingClaim) {
        await supabase.from("property_claims").insert({
          property_id: property.id,
          claim_reference: claimReference,
          claimant_type: primaryOwner?.owner_type ?? "individual",
          claimant_user_id: ctx.appUserId,
          claimant_name: primaryOwner?.owner_name ?? ctx.fullName ?? ctx.email ?? "Property applicant",
          claim_type: "registration",
          status: "submitted",
          submitted_by: ctx.appUserId,
          submitted_at: now,
          metadata: { phase: "dlpi_property_registration_phase2" },
        });
      }
    }

    const uploadedDocuments: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const documentType = value(formData, `document_${index}_type`) as PropertyDocumentType;
      const file = formData.get(`document_${index}_file`);
      const title = nullable(value(formData, `document_${index}_title`));
      const description = nullable(value(formData, `document_${index}_description`));
      if (!documentType && !(file instanceof File && file.size > 0)) continue;
      if (!DOCUMENT_TYPES.has(documentType)) throw new Error("Unsupported property document type.");
      if (!(file instanceof File) || file.size <= 0) continue;
      const upload = await uploadDocumentFile({ propertyId: property.id, actorUserId: ctx.appUserId!, file, documentType, supabase });
      const { data: typeRow } = await supabase.from("property_document_types").select("id").eq("document_type_key", documentType).maybeSingle();
      const { data: document, error: documentError } = await supabase
        .from("property_documents")
        .insert({
          property_id: property.id,
          document_type_id: typeRow?.id ?? null,
          document_type: documentType,
          title: title ?? upload.file_name,
          description,
          status: "pending_review",
          uploaded_by: ctx.appUserId,
          metadata: { phase: "dlpi_property_registration_phase2" },
          ...upload,
        })
        .select("id")
        .single();
      if (documentError) throw documentError;
      uploadedDocuments.push(document.id);
      await recordPropertyEvent({
        propertyId: property.id,
        eventType: "property.document.uploaded",
        entityType: "property_document",
        entityId: document.id,
        actorUserId: ctx.appUserId,
        metadata: { document_type: documentType },
        client: supabase,
      });
    }

    await recordPropertyEvent({
      propertyId: property.id,
      eventType: existing ? "property.registration.updated" : "property.registration.started",
      actorUserId: ctx.appUserId,
      summary: existing ? "Property registration updated." : "Property registration started.",
      metadata: { intent, uploaded_documents: uploadedDocuments.length },
      client: supabase,
    });
    await recordPropertyEvent({
      propertyId: property.id,
      eventType: "property.location.updated",
      actorUserId: ctx.appUserId,
      metadata: { state_id: property.state_id, lga_id: property.lga_id, has_coordinates: validated.latitude !== null && validated.longitude !== null },
      client: supabase,
    });
    await recordPropertyEvent({
      propertyId: property.id,
      eventType: intent === "submit" ? "property.registration.submitted" : "property.registration.saved",
      actorUserId: ctx.appUserId,
      summary: intent === "submit" ? "Property registration submitted for review." : "Property registration saved as draft.",
      metadata: { npin: npin ?? null },
      client: supabase,
    });

    revalidatePath("/dashboard/property");
    revalidatePath("/dashboard/property/register");
    revalidatePath("/dashboard/property/my-properties");
    revalidatePath("/dashboard/property/drafts");
    redirect(intent === "submit" ? "/dashboard/property/my-properties?success=submitted" : `/dashboard/property/register?property=${property.id}&success=draft_saved`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save property registration.";
    redirect(`/dashboard/property/register?error=${encodeURIComponent(message)}`);
  }
}

export async function deletePropertyDraftAction(formData: FormData) {
  const { ctx, supabase } = await requirePropertyRegistrationUser();
  const propertyId = value(formData, "property_id");
  const existing = await resolveExistingProperty({ propertyId, actorUserId: ctx.appUserId!, supabase });
  if (!existing || existing.status !== "draft") redirect("/access-denied");
  await recordPropertyEvent({
    propertyId,
    eventType: "property.registration.updated",
    actorUserId: ctx.appUserId,
    summary: "Draft property registration deleted.",
    metadata: { deleted: true },
    client: supabase,
  });
  const { error } = await supabase.from("properties").delete().eq("id", propertyId).eq("registered_by", ctx.appUserId).eq("status", "draft");
  if (error) throw error;
  revalidatePath("/dashboard/property");
  revalidatePath("/dashboard/property/drafts");
  redirect("/dashboard/property/drafts?success=draft_deleted");
}
