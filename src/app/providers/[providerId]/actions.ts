"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveProviderPublicContext } from "@/lib/data/provider-profile-resolver";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SubmitPublicComplaintInput = {
  provider_path_segment: string;
  provider_profile_id?: string;
  provider_msme_public_id?: string;
  provider_slug?: string;
  full_name: string;
  email: string;
  phone: string;
  preferred_contact_method: string;
  complaint_type: string;
  priority: string;
  short_summary: string;
  description: string;
  related_reference?: string;
  consent_confirmation: string;
  evidence_url?: string;
  evidence_storage_path?: string;
  evidence_bucket?: string;
  evidence_original_name?: string;
  evidence_size_bytes?: number;
  evidence_mime_type?: string;
};

export async function submitPublicComplaint(payload: SubmitPublicComplaintInput) {
  const providerPathSegment = String(payload.provider_path_segment ?? "").trim();

  if (!providerPathSegment) {
    return { ok: false as const, redirectPath: "/search?complaint=missing_provider" };
  }

  const complainant_name = String(payload.full_name ?? "").trim();
  const complaint_type = String(payload.complaint_type ?? "").trim();
  const priority = String(payload.priority ?? "").trim();
  const normalizedPriority = priority || "medium";
  const summary = String(payload.short_summary ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const consent_confirmation = String(payload.consent_confirmation ?? "").trim();
  const providerMsmePublicId = String(payload.provider_msme_public_id ?? "").trim();

  if (!complainant_name || !description || !summary || !consent_confirmation || !complaint_type) {
    return { ok: false as const, redirectPath: `/providers/${providerPathSegment}?reported_error=missing_fields` };
  }

  const supabase = await createServiceRoleSupabaseClient();

  try {
    const providerContext = await resolveProviderPublicContext({
      providerRouteParam: providerPathSegment,
    });

    if (!providerContext.provider_profile_id) {
      return { ok: false as const, redirectPath: `/providers/${providerPathSegment}?reported_error=provider_not_found` };
    }

    const resolvedProviderId = providerContext.provider_profile_id;
    const canonicalSlug = providerContext.provider?.public_slug ?? providerPathSegment;
    const providerPublicMsmeId = providerMsmePublicId || providerContext.provider?.msme_id || null;

    let resolvedInternalMsmeUuid = providerContext.provider_profile_msme_id;

    if (!resolvedInternalMsmeUuid && providerPublicMsmeId) {
      if (UUID_PATTERN.test(providerPublicMsmeId)) {
        resolvedInternalMsmeUuid = providerPublicMsmeId;
      } else {
        const { data: resolvedMsme, error: msmeResolveError } = await supabase
          .from("msmes")
          .select("id")
          .eq("msme_id", providerPublicMsmeId.toUpperCase())
          .maybeSingle();

        if (msmeResolveError) {
          console.error("[complaint-submit][msme_resolution_error]", {
            providerPathSegment,
            providerPublicMsmeId,
            message: msmeResolveError.message,
            details: msmeResolveError.details,
            hint: msmeResolveError.hint,
          });
        }
        resolvedInternalMsmeUuid = resolvedMsme?.id ?? null;
      }
    }

    if (!resolvedInternalMsmeUuid || !UUID_PATTERN.test(resolvedInternalMsmeUuid)) {
      throw new Error(
        `[complaint-submit] internal_msme_uuid_resolution_failed provider=${providerPathSegment} publicMsmeId=${providerPublicMsmeId ?? "n/a"}`
      );
    }

    const mappedComplaintPayload = {
      msme_id: resolvedInternalMsmeUuid,
      provider_id: resolvedProviderId,
      provider_profile_id: resolvedProviderId,
      provider_msme_id: resolvedInternalMsmeUuid,
      complaint_type,
      category: complaint_type,
      description,
      status: "submitted",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      summary,
      title: summary,
      complaint_reference: `CMP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
      severity: normalizedPriority,
      priority: normalizedPriority,
      complainant_name,
      complainant_email: String(payload.email ?? "").trim() || null,
      complainant_phone: String(payload.phone ?? "").trim() || null,
      preferred_contact_method: String(payload.preferred_contact_method ?? "").trim() || "email",
      assigned_officer_user_id: null,
      state: null,
      sector: null,
      source_channel: "marketplace_public_profile",
      investigation_notes: payload.evidence_url
        ? `Evidence: ${payload.evidence_url}${payload.evidence_storage_path ? ` (path: ${payload.evidence_storage_path})` : ""}`
        : null,
      closed_at: null,
    };

    const evidenceUploadResult = payload.evidence_url
      ? {
          public_url: payload.evidence_url,
          storage_path: payload.evidence_storage_path ?? null,
          bucket: payload.evidence_bucket ?? null,
          original_name: payload.evidence_original_name ?? null,
          size_bytes: payload.evidence_size_bytes ?? null,
          mime_type: payload.evidence_mime_type ?? null,
        }
      : null;

    console.info("[complaint-submit][pre_insert]", {
      resolved_provider_id: resolvedProviderId,
      resolved_provider_public_msme_id: providerPublicMsmeId,
      mapped_complaint_payload: mappedComplaintPayload,
      evidence_upload_result: evidenceUploadResult,
      complaint_insert_payload: mappedComplaintPayload,
    });

    const complaintInsertPayload = {
      ...mappedComplaintPayload,
      msme_id: UUID_PATTERN.test(mappedComplaintPayload.msme_id) ? mappedComplaintPayload.msme_id : null,
    };

    const { data: complaintRow, error: complaintInsertError } = await supabase
      .from("complaints")
      .insert(complaintInsertPayload)
      .select("id")
      .single();

    if (complaintInsertError || !complaintRow) {
      console.error("[complaint-submit][insert_failed]", {
        providerPathSegment,
        canonicalSlug,
        resolved_provider_id: resolvedProviderId,
        complaint_insert_payload: complaintInsertPayload,
        insert_error: complaintInsertError
          ? {
              message: complaintInsertError.message,
              details: complaintInsertError.details,
              hint: complaintInsertError.hint,
              code: complaintInsertError.code ?? null,
            }
          : null,
        insert_row: complaintRow ?? null,
      });
      return { ok: false as const, redirectPath: `/providers/${providerPathSegment}?reported_error=submit_failed` };
    }

    revalidatePath(`/providers/${providerPathSegment}`);
    if (canonicalSlug !== providerPathSegment) {
      revalidatePath(`/providers/${canonicalSlug}`);
    }

    return { ok: true as const, redirectPath: `/providers/${canonicalSlug}?notice=complaint_submitted` };
  } catch (error) {
    console.error("[complaint-submit][submit_pipeline_error]", {
      providerPathSegment,
      error,
    });
    return { ok: false as const, redirectPath: `/providers/${providerPathSegment}?reported_error=submit_failed` };
  }
}
