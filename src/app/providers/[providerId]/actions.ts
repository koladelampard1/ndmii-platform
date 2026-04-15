"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

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
  severity: string;
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
  const severity = String(payload.severity ?? "").trim();
  const normalizedSeverity = severity || "medium";
  const summary = String(payload.short_summary ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const consent_confirmation = String(payload.consent_confirmation ?? "").trim();
  if (!complainant_name || !description || !summary || !consent_confirmation || !complaint_type) {
    return { ok: false as const, redirectPath: `/providers/${providerPathSegment}?reported_error=missing_fields` };
  }

  const supabase = await createServiceRoleSupabaseClient();

  try {
    const { data: providerProfile, error: providerLookupError } = await supabase
      .from("provider_profiles")
      .select("id,msme_id,public_slug")
      .eq("public_slug", providerPathSegment)
      .maybeSingle();

    if (providerLookupError || !providerProfile?.id) {
      console.error("[complaint-submit][provider_lookup_failed]", {
        providerPathSegment,
        message: providerLookupError?.message ?? null,
        details: providerLookupError?.details ?? null,
        hint: providerLookupError?.hint ?? null,
        code: providerLookupError?.code ?? null,
      });
      return { ok: false as const, redirectPath: `/providers/${providerPathSegment}?reported_error=provider_not_found` };
    }

    const resolvedProviderId = providerProfile.id;
    const canonicalSlug = providerProfile.public_slug ?? providerPathSegment;
    const providerMsmeIdRaw = String(providerProfile.msme_id ?? "").trim();

    const resolvedInternalMsmeUuid: string | null =
      providerMsmeIdRaw && UUID_PATTERN.test(providerMsmeIdRaw) ? providerMsmeIdRaw : null;

    if (!resolvedInternalMsmeUuid || !UUID_PATTERN.test(resolvedInternalMsmeUuid)) {
      throw new Error(
        `[complaint-submit] internal_msme_uuid_resolution_failed provider=${providerPathSegment} providerMsmeId=${providerMsmeIdRaw || "n/a"}`
      );
    }

    const { data: providerMsmeContext } = await supabase
      .from("msmes")
      .select("state,sector")
      .eq("id", resolvedInternalMsmeUuid)
      .maybeSingle();

    const complaintInsertPayload: Record<string, string> = {
      msme_id: resolvedInternalMsmeUuid,
      complaint_type,
      summary,
      description,
      status: "open",
      severity: normalizedSeverity,
    };

    if (providerMsmeContext?.state && typeof providerMsmeContext.state === "string") {
      complaintInsertPayload.state = providerMsmeContext.state;
    }
    if (providerMsmeContext?.sector && typeof providerMsmeContext.sector === "string") {
      complaintInsertPayload.sector = providerMsmeContext.sector;
    }

    if (payload.evidence_url) {
      console.info("[complaint-submit][evidence_metadata_received_optional]", {
        providerPathSegment,
        resolved_provider_id: resolvedProviderId,
        resolved_provider_msme_id: resolvedInternalMsmeUuid,
        evidence_url: payload.evidence_url,
        evidence_storage_path: payload.evidence_storage_path ?? null,
        evidence_bucket: payload.evidence_bucket ?? null,
        evidence_original_name: payload.evidence_original_name ?? null,
        evidence_size_bytes: payload.evidence_size_bytes ?? null,
        evidence_mime_type: payload.evidence_mime_type ?? null,
      });
    }

    console.info("[complaint-submit][pre_insert]", {
      resolved_provider_id: resolvedProviderId,
      resolved_provider_msme_id: resolvedInternalMsmeUuid,
      complaint_insert_payload: complaintInsertPayload,
    });

    const { data: complaintRow, error: complaintInsertError } = await supabase
      .from("complaints")
      .insert(complaintInsertPayload)
      .select("id")
      .single();

    if (complaintInsertError || !complaintRow) {
      const trace = `complaints.insert failed table=complaints filter=n/a provider_id=${resolvedProviderId} code=${complaintInsertError?.code ?? "n/a"} message=${complaintInsertError?.message ?? "unknown"}`;
      console.error("[complaint-submit][insert_failed]", {
        trace,
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
      return { ok: false as const, redirectPath: `/providers/${providerPathSegment}?reported_error=submit_failed&reported_trace=${encodeURIComponent(trace)}` };
    }

    revalidatePath(`/providers/${providerPathSegment}`);
    if (canonicalSlug !== providerPathSegment) {
      revalidatePath(`/providers/${canonicalSlug}`);
    }

    return { ok: true as const, redirectPath: `/providers/${canonicalSlug}?notice=complaint_submitted` };
  } catch (error) {
    const trace = error instanceof Error ? error.message : "unknown_submit_pipeline_error";
    console.error("[complaint-submit][submit_pipeline_error]", {
      providerPathSegment,
      trace,
      error,
    });
    return { ok: false as const, redirectPath: `/providers/${providerPathSegment}?reported_error=submit_failed&reported_trace=${encodeURIComponent(trace)}` };
  }
}
