import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/authorization";
import { generatePropertyApplicationReference, recordPropertyEvent } from "@/lib/data/property-foundation";
import { ensureRegistryCaseForProperty } from "@/lib/property/property-operations-service";
import type { JsonRecord } from "@/types/platform";
import type { Property, PropertyDocumentType, PropertyOwner } from "@/types/property";
import {
  formValue,
  nullable,
  parsePropertyRegistrationForm,
  type OwnerInput,
  type ParsedPropertyRegistration,
  validatePropertyReferences,
} from "@/lib/property/property-registration-validation";

type Client = SupabaseClient<any>;

const PROPERTY_DOCUMENT_BUCKET = "property-documents";

type ExistingProperty = Pick<Property, "id" | "status" | "npin" | "application_reference" | "application_submitted_at" | "registered_by" | "state_id">;

function supabaseErrorInfo(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  return {
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    message: typeof candidate.message === "string" ? candidate.message : undefined,
    details: typeof candidate.details === "string" ? candidate.details : undefined,
    hint: typeof candidate.hint === "string" ? candidate.hint : undefined,
  };
}

function logSaveFailure(operation: string, tableOrFunction: string, error: unknown) {
  const info = supabaseErrorInfo(error);
  console.error("[property-registration:save-failed]", {
    operation,
    tableOrFunction,
    code: info?.code,
    message: info?.message ?? (error instanceof Error ? error.message : "Unknown Supabase failure."),
    details: info?.details,
    hint: info?.hint,
  });
}

function throwSaveFailure(operation: string, tableOrFunction: string, error: unknown, fallback = "Unable to save property registration.") {
  logSaveFailure(operation, tableOrFunction, error);
  const info = supabaseErrorInfo(error);
  throw new Error(`${operation} failed at ${tableOrFunction}: ${info?.message ?? (error instanceof Error ? error.message : fallback)}`);
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "property-document";
}

function ownerSnapshot(owner: OwnerInput | PropertyOwner) {
  return {
    owner_type: owner.owner_type,
    owner_name: owner.owner_name,
    ownership_percentage: owner.ownership_percentage,
    is_primary: owner.is_primary,
    verification_status: "verification_status" in owner ? owner.verification_status : "unverified",
    notes: "notes" in owner ? owner.notes : (owner.metadata?.notes ?? null),
  };
}

function sameOwner(previous: PropertyOwner, next: OwnerInput) {
  const previousNotes = typeof previous.metadata?.notes === "string" ? previous.metadata.notes : null;
  return (
    previous.owner_type === next.owner_type
    && (previous.owner_name ?? "") === (next.owner_name || "")
    && Number(previous.ownership_percentage ?? 0) === Number(next.ownership_percentage ?? 0)
    && previous.is_primary === next.is_primary
    && previousNotes === next.notes
  );
}

async function resolveExistingProperty(input: { propertyId: string | null; actorUserId: string; supabase: Client }) {
  if (!input.propertyId) return null;
  const { data, error } = await input.supabase
    .from("properties")
    .select("id,status,npin,application_reference,application_submitted_at,registered_by,state_id")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (error) throwSaveFailure("resolve existing property draft", "properties", error);
  if (!data) throw new Error("Property draft not found.");
  if (data.registered_by !== input.actorUserId) throw new Error("You can only update your own property registration.");
  if (!["draft", "submitted"].includes(data.status)) throw new Error("This property registration cannot be edited in the workspace.");
  return data as ExistingProperty;
}

async function recordStatusHistory(input: {
  propertyId: string;
  previousStatus: string | null;
  newStatus: string;
  actorUserId: string;
  reason: string;
  metadata?: JsonRecord;
  supabase: Client;
}) {
  if (input.previousStatus === input.newStatus && input.previousStatus !== null) return;
  const { error } = await input.supabase.from("property_status_history").insert({
    property_id: input.propertyId,
    previous_status: input.previousStatus,
    new_status: input.newStatus,
    changed_by: input.actorUserId,
    change_reason: input.reason,
    metadata: input.metadata ?? {},
  });
  if (error) throwSaveFailure("record property status history", "property_status_history", error);
}

async function upsertPrimaryAddress(input: {
  propertyId: string;
  parsed: ParsedPropertyRegistration;
  formData: FormData;
  supabase: Client;
}) {
  const payload = {
    property_id: input.propertyId,
    country_id: input.parsed.countryId,
    state_id: input.parsed.stateId,
    lga_id: input.parsed.lgaId,
    ward_id: input.parsed.wardId,
    community_id: input.parsed.communityId,
    village_id: input.parsed.villageId,
    street: nullable(formValue(input.formData, "street")),
    building: nullable(formValue(input.formData, "building")),
    plot: nullable(formValue(input.formData, "plot")),
    block: nullable(formValue(input.formData, "block")),
    parcel_reference: nullable(formValue(input.formData, "parcel_reference")),
    centroid_latitude: input.parsed.latitude,
    centroid_longitude: input.parsed.longitude,
    traditional_description: nullable(formValue(input.formData, "traditional_description")),
    is_primary: true,
    metadata: { phase: "dlpi_property_registration_phase25" },
  };
  const { data: existing, error: lookupError } = await input.supabase
    .from("property_addresses")
    .select("id")
    .eq("property_id", input.propertyId)
    .eq("is_primary", true)
    .maybeSingle();
  if (lookupError) throwSaveFailure("lookup primary property address", "property_addresses", lookupError);
  const result = existing?.id
    ? await input.supabase.from("property_addresses").update(payload).eq("id", existing.id)
    : await input.supabase.from("property_addresses").insert(payload);
  if (result.error) throwSaveFailure(existing?.id ? "update primary property address" : "insert primary property address", "property_addresses", result.error);
}

async function recordOwnerHistory(input: {
  propertyId: string;
  propertyOwnerId?: string | null;
  changeType: "added" | "updated" | "removed" | "superseded";
  previousValues?: JsonRecord;
  newValues?: JsonRecord;
  actorUserId: string;
  note: string;
  supabase: Client;
}) {
  const { error } = await input.supabase.from("property_owner_history").insert({
    property_id: input.propertyId,
    property_owner_id: input.propertyOwnerId ?? null,
    change_type: input.changeType,
    previous_values: input.previousValues ?? {},
    new_values: input.newValues ?? {},
    changed_by: input.actorUserId,
    change_note: input.note,
    metadata: { phase: "dlpi_property_registration_phase25" },
  });
  if (error) throwSaveFailure("record property owner history", "property_owner_history", error);
}

async function persistOwners(input: {
  propertyId: string;
  owners: OwnerInput[];
  actorUserId: string;
  supabase: Client;
}) {
  const { data, error } = await input.supabase
    .from("property_owners")
    .select("*")
    .eq("property_id", input.propertyId)
    .in("verification_status", ["unverified", "pending_review"])
    .order("created_at", { ascending: true });
  if (error) throwSaveFailure("list editable property owners", "property_owners", error);

  const existing = (data ?? []) as PropertyOwner[];
  const existingById = new Map(existing.map((owner) => [owner.id, owner]));
  const retained = new Set<string>();

  if (existing.length) {
    const clearPrimary = await input.supabase
      .from("property_owners")
      .update({ is_primary: false })
      .eq("property_id", input.propertyId)
      .in("verification_status", ["unverified", "pending_review"]);
    if (clearPrimary.error) throwSaveFailure("clear primary owner flags", "property_owners", clearPrimary.error);
  }

  for (const owner of input.owners) {
    const previous = owner.id ? existingById.get(owner.id) : null;
    const payload = {
      property_id: input.propertyId,
      owner_type: owner.owner_type,
      owner_name: owner.owner_name || null,
      ownership_percentage: owner.ownership_percentage,
      is_primary: owner.is_primary,
      verification_status: "unverified",
      effective_from: new Date().toISOString().slice(0, 10),
      effective_to: null,
      metadata: { notes: owner.notes, phase: "dlpi_property_registration_phase25" },
    };

    if (previous) {
      retained.add(previous.id);
      const { error: updateError } = await input.supabase.from("property_owners").update(payload).eq("id", previous.id);
      if (updateError) throwSaveFailure("update property owner", "property_owners", updateError);
      if (!sameOwner(previous, owner)) {
        await recordOwnerHistory({
          propertyId: input.propertyId,
          propertyOwnerId: previous.id,
          changeType: "updated",
          previousValues: ownerSnapshot(previous),
          newValues: ownerSnapshot(owner),
          actorUserId: input.actorUserId,
          note: "Owner record updated from registration workspace.",
          supabase: input.supabase,
        });
      }
    } else {
      const { data: inserted, error: insertError } = await input.supabase.from("property_owners").insert(payload).select("*").single();
      if (insertError) throwSaveFailure("insert property owner", "property_owners", insertError);
      if (!inserted) throw new Error("Unable to save owner record.");
      retained.add(inserted.id);
      await recordOwnerHistory({
        propertyId: input.propertyId,
        propertyOwnerId: inserted.id,
        changeType: "added",
        newValues: ownerSnapshot(owner),
        actorUserId: input.actorUserId,
        note: "Owner record added from registration workspace.",
        supabase: input.supabase,
      });
    }
  }

  for (const owner of existing) {
    if (retained.has(owner.id)) continue;
    const { error: removeError } = await input.supabase
      .from("property_owners")
      .update({
        verification_status: "superseded",
        is_primary: false,
        effective_to: new Date().toISOString().slice(0, 10),
        metadata: { ...(owner.metadata ?? {}), superseded_reason: "removed_from_registration_workspace", phase: "dlpi_property_registration_phase25" },
      })
      .eq("id", owner.id);
    if (removeError) throwSaveFailure("supersede removed property owner", "property_owners", removeError);
    await recordOwnerHistory({
      propertyId: input.propertyId,
      propertyOwnerId: owner.id,
      changeType: "removed",
      previousValues: ownerSnapshot(owner),
      actorUserId: input.actorUserId,
      note: "Owner record removed from registration workspace.",
      supabase: input.supabase,
    });
  }
}

async function uploadDocumentFile(input: {
  propertyId: string;
  actorUserId: string;
  file: File;
  documentType: PropertyDocumentType;
  supabase: Client;
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
  if (error) throwSaveFailure("upload property document file", `storage.${PROPERTY_DOCUMENT_BUCKET}`, error);
  return {
    storage_bucket: PROPERTY_DOCUMENT_BUCKET,
    storage_path: path,
    file_name: input.file.name,
    file_size_bytes: input.file.size,
    mime_type: input.file.type || null,
    checksum_sha256: checksum,
  };
}

async function recordDocumentEvent(input: {
  propertyId: string;
  documentId: string;
  eventType: string;
  actorUserId: string;
  summary: string;
  metadata?: JsonRecord;
  supabase: Client;
}) {
  const { error } = await input.supabase.from("property_document_events").insert({
    property_id: input.propertyId,
    document_id: input.documentId,
    event_type: input.eventType,
    actor_user_id: input.actorUserId,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });
  if (error) throwSaveFailure("record property document event", "property_document_events", error);
  await recordPropertyEvent({
    propertyId: input.propertyId,
    eventType: input.eventType,
    entityType: "property_document",
    entityId: input.documentId,
    actorUserId: input.actorUserId,
    summary: input.summary,
    metadata: input.metadata,
    client: input.supabase,
  });
}

async function persistDocuments(input: {
  propertyId: string;
  parsed: ParsedPropertyRegistration;
  actorUserId: string;
  supabase: Client;
}) {
  const uploadedDocuments: string[] = [];
  for (const documentInput of input.parsed.documents) {
    const upload = await uploadDocumentFile({
      propertyId: input.propertyId,
      actorUserId: input.actorUserId,
      file: documentInput.file,
      documentType: documentInput.document_type,
      supabase: input.supabase,
    });
    const { data: typeRow, error: typeError } = await input.supabase
      .from("property_document_types")
      .select("id")
      .eq("document_type_key", documentInput.document_type)
      .maybeSingle();
    if (typeError) throwSaveFailure("lookup property document type", "property_document_types", typeError);

    const { data: document, error: documentError } = await input.supabase
      .from("property_documents")
      .insert({
        property_id: input.propertyId,
        document_type_id: typeRow?.id ?? null,
        document_type: documentInput.document_type,
        title: documentInput.title ?? upload.file_name,
        description: documentInput.description,
        status: "pending_review",
        uploaded_by: input.actorUserId,
        metadata: { phase: "dlpi_property_registration_phase25", upload_slot: documentInput.index },
        ...upload,
      })
      .select("id")
      .single();
    if (documentError) throwSaveFailure("insert property document", "property_documents", documentError);
    if (!document) throw new Error("Unable to save property document.");

    const { data: superseded, error: supersedeLookupError } = await input.supabase
      .from("property_documents")
      .select("id,status,metadata")
      .eq("property_id", input.propertyId)
      .eq("document_type", documentInput.document_type)
      .in("status", ["pending_review", "rejected"])
      .neq("id", document.id);
    if (supersedeLookupError) throwSaveFailure("lookup superseded property documents", "property_documents", supersedeLookupError);

    for (const previous of superseded ?? []) {
      const { error: supersedeError } = await input.supabase
        .from("property_documents")
        .update({
          status: "superseded",
          superseded_by: document.id,
          superseded_at: new Date().toISOString(),
          superseded_by_user_id: input.actorUserId,
          metadata: { ...(previous.metadata ?? {}), superseded_reason: "replacement_upload", phase: "dlpi_property_registration_phase25" },
        })
        .eq("id", previous.id);
      if (supersedeError) throwSaveFailure("supersede property document", "property_documents", supersedeError);
      await recordDocumentEvent({
        propertyId: input.propertyId,
        documentId: previous.id,
        eventType: "property.document.superseded",
        actorUserId: input.actorUserId,
        summary: "Property document superseded by a replacement upload.",
        metadata: { replacement_document_id: document.id, document_type: documentInput.document_type },
        supabase: input.supabase,
      });
    }

    uploadedDocuments.push(document.id);
    await recordDocumentEvent({
      propertyId: input.propertyId,
      documentId: document.id,
      eventType: "property.document.uploaded",
      actorUserId: input.actorUserId,
      summary: "Property document uploaded.",
      metadata: { document_type: documentInput.document_type, superseded_document_count: superseded?.length ?? 0 },
      supabase: input.supabase,
    });
  }
  return uploadedDocuments;
}

export async function savePropertyRegistration(input: {
  formData: FormData;
  ctx: UserContext;
  supabase: Client;
}) {
  if (!input.ctx.appUserId) throw new Error("A signed-in user is required.");
  const parsed = parsePropertyRegistrationForm(input.formData);
  await validatePropertyReferences(parsed, input.supabase);
  const existing = await resolveExistingProperty({ propertyId: parsed.propertyId, actorUserId: input.ctx.appUserId, supabase: input.supabase });

  const now = new Date().toISOString();
  const shouldSubmit = parsed.intent === "submit";
  const newStatus = shouldSubmit ? "submitted" : "draft";
  let applicationReference = existing?.application_reference ?? null;
  if (shouldSubmit && !applicationReference) {
    try {
      applicationReference = await generatePropertyApplicationReference(input.supabase);
    } catch (error) {
      throwSaveFailure("generate property application reference", "rpc.generate_property_application_reference", error);
    }
  }

  const propertyPayload = {
    npin: existing?.npin ?? null,
    application_reference: applicationReference,
    application_submitted_at: shouldSubmit ? existing?.application_submitted_at ?? now : existing?.application_submitted_at ?? null,
    parcel_reference: nullable(formValue(input.formData, "parcel_reference")),
    property_category_id: parsed.propertyCategoryId,
    property_type: parsed.propertyType,
    title: nullable(formValue(input.formData, "title")),
    description: nullable(formValue(input.formData, "description")),
    country_id: parsed.countryId,
    state_id: parsed.stateId,
    lga_id: parsed.lgaId,
    ward_id: parsed.wardId,
    community_id: parsed.communityId,
    village_id: parsed.villageId,
    survey_block_id: parsed.surveyBlockId,
    status: newStatus,
    registry_status: newStatus,
    area_size: parsed.areaSize,
    area_unit: nullable(formValue(input.formData, "area_unit")),
    registered_by: input.ctx.appUserId,
    metadata: {
      current_use: nullable(formValue(input.formData, "current_use")),
      planned_use: nullable(formValue(input.formData, "planned_use")),
      development_stage: nullable(formValue(input.formData, "development_stage")),
      phase: "dlpi_property_registration_phase25",
    },
  };

  const propertyResult = existing
    ? await input.supabase.from("properties").update(propertyPayload).eq("id", existing.id).select("*").single()
    : await input.supabase.from("properties").insert(propertyPayload).select("*").single();
  if (propertyResult.error) throwSaveFailure(existing ? "update property registration" : "insert property registration", "properties", propertyResult.error);
  if (!propertyResult.data) throw new Error("Unable to save property registration.");
  const property = propertyResult.data as Property;

  await upsertPrimaryAddress({ propertyId: property.id, parsed, formData: input.formData, supabase: input.supabase });
  await persistOwners({ propertyId: property.id, owners: parsed.owners, actorUserId: input.ctx.appUserId, supabase: input.supabase });

  if (shouldSubmit) {
    await recordStatusHistory({
      propertyId: property.id,
      previousStatus: existing?.status ?? null,
      newStatus,
      actorUserId: input.ctx.appUserId,
      reason: "Property registration submitted from applicant workspace.",
      metadata: { application_reference: applicationReference },
      supabase: input.supabase,
    });
  } else if (!existing) {
    await recordStatusHistory({
      propertyId: property.id,
      previousStatus: null,
      newStatus,
      actorUserId: input.ctx.appUserId,
      reason: "Property registration draft created.",
      supabase: input.supabase,
    });
  }

  const claimReference = `PCL-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const primaryOwner = parsed.owners.find((owner) => owner.is_primary) ?? parsed.owners[0] ?? null;
  if (shouldSubmit) {
    const { data: existingClaim, error: claimLookupError } = await input.supabase
      .from("property_claims")
      .select("id,status")
      .eq("property_id", property.id)
      .eq("claim_type", "registration")
      .maybeSingle();
    if (claimLookupError) throwSaveFailure("lookup property registration claim", "property_claims", claimLookupError);
    if (!existingClaim) {
      const { error: claimError } = await input.supabase.from("property_claims").insert({
        property_id: property.id,
        claim_reference: claimReference,
        claimant_type: primaryOwner?.owner_type ?? "individual",
        claimant_user_id: input.ctx.appUserId,
        claimant_name: primaryOwner?.owner_name ?? input.ctx.fullName ?? input.ctx.email ?? "Property applicant",
        claim_type: "registration",
        status: "submitted",
        submitted_by: input.ctx.appUserId,
        submitted_at: now,
        metadata: { phase: "dlpi_property_registration_phase25", application_reference: applicationReference },
      });
      if (claimError) throwSaveFailure("insert property registration claim", "property_claims", claimError);
    }
  }

  const uploadedDocuments = await persistDocuments({
    propertyId: property.id,
    parsed,
    actorUserId: input.ctx.appUserId,
    supabase: input.supabase,
  });

  await recordPropertyEvent({
    propertyId: property.id,
    eventType: existing ? "property.registration.updated" : "property.registration.started",
    actorUserId: input.ctx.appUserId,
    summary: existing ? "Property registration updated." : "Property registration started.",
    metadata: { intent: parsed.intent, uploaded_documents: uploadedDocuments.length, application_reference: applicationReference },
    client: input.supabase,
  });
  await recordPropertyEvent({
    propertyId: property.id,
    eventType: "property.location.updated",
    actorUserId: input.ctx.appUserId,
    metadata: { state_id: property.state_id, lga_id: property.lga_id, has_coordinates: parsed.latitude !== null && parsed.longitude !== null },
    client: input.supabase,
  });
  await recordPropertyEvent({
    propertyId: property.id,
    eventType: shouldSubmit ? "property.registration.submitted" : "property.registration.saved",
    actorUserId: input.ctx.appUserId,
    summary: shouldSubmit ? "Property registration submitted for review." : "Property registration saved as draft.",
    metadata: { application_reference: applicationReference, npin: property.npin ?? null },
    client: input.supabase,
  });

  if (shouldSubmit) {
    try {
      await ensureRegistryCaseForProperty({
        propertyId: property.id,
        actorUserId: input.ctx.appUserId,
        client: input.supabase,
      });
    } catch (error) {
      throwSaveFailure("ensure submitted property registry case", "property_registry_cases", error);
    }
  }

  return {
    propertyId: property.id,
    intent: parsed.intent,
    nextStep: parsed.nextStep,
  };
}

export async function deletePropertyDraft(input: {
  propertyId: string;
  actorUserId: string;
  supabase: Client;
}) {
  const existing = await resolveExistingProperty({ propertyId: input.propertyId, actorUserId: input.actorUserId, supabase: input.supabase });
  if (!existing || existing.status !== "draft") throw new Error("Only draft property registrations can be deleted.");
  await recordPropertyEvent({
    propertyId: null,
    eventType: "property.registration.deleted",
    entityType: "property",
    entityId: input.propertyId,
    actorUserId: input.actorUserId,
    summary: "Draft property registration deleted.",
    metadata: {
      deleted_property_id: input.propertyId,
      previous_status: existing.status,
      application_reference: existing.application_reference,
      phase: "dlpi_property_registration_phase25",
    },
    scopeType: "property",
    scopeId: input.propertyId,
    client: input.supabase,
  });
  const { error } = await input.supabase
    .from("properties")
    .delete()
    .eq("id", input.propertyId)
    .eq("registered_by", input.actorUserId)
    .eq("status", "draft");
  if (error) throwSaveFailure("delete property draft", "properties", error);
}
