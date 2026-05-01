import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

type SubmissionBody = {
  assessment_data?: Record<string, unknown>;
  answers?: Record<string, unknown>;
  score?: number;
  readiness_score?: number;
  status?: string;
  notes?: string;
  preview?: boolean;
  [key: string]: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isPreviewRequest(request: Request, body: SubmissionBody) {
  const url = new URL(request.url);
  const queryPreview = url.searchParams.get("preview");
  const headerPreview = request.headers.get("x-preview");
  return (
    body.preview === true ||
    queryPreview === "1" ||
    queryPreview === "true" ||
    headerPreview === "1" ||
    headerPreview === "true"
  );
}

function sanitizeColumnLog(columns: string[]) {
  return columns.filter((column) => !column.toLowerCase().includes("secret") && !column.toLowerCase().includes("token"));
}

export async function POST(request: Request) {
  let body: SubmissionBody = {};
  try {
    body = (await request.json()) as SubmissionBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_json", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const preview = isPreviewRequest(request, body);
  const context = await getCurrentUserContext();
  const authenticatedEmail = normalizeEmail(context.email);

  if (preview) {
    console.info("[finance-readiness-submit][auth-context]", {
      authenticatedUserId: context.appUserId,
      authenticatedAuthUserId: context.authUserId,
      authenticatedUserEmail: authenticatedEmail || null,
    });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        ok: false,
        code: "missing_service_role",
        message: preview
          ? "SUPABASE_SERVICE_ROLE_KEY missing. Configure server env before submitting finance readiness assessments."
          : "Server configuration missing.",
      },
      { status: 500 },
    );
  }

  if (!authenticatedEmail) {
    return NextResponse.json(
      { ok: false, code: "unauthorized", message: "Unable to resolve authenticated user email for submission." },
      { status: 401 },
    );
  }

  const supabase = await createServiceRoleSupabaseClient();

  const { data: msmeRow, error: msmeLookupError } = await supabase
    .from("msmes")
    .select("id, business_name, contact_email, created_by")
    .filter("contact_email", "ilike", authenticatedEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (preview) {
    console.info("[finance-readiness-submit][msme-lookup-result]", {
      lookupEmail: authenticatedEmail,
      msmeFound: Boolean(msmeRow?.id),
      msmeId: msmeRow?.id ?? null,
      businessName: msmeRow?.business_name ?? null,
      contactEmail: msmeRow?.contact_email ?? null,
      createdBy: msmeRow?.created_by ?? null,
      error: msmeLookupError
        ? {
            message: msmeLookupError.message,
            details: msmeLookupError.details,
            hint: msmeLookupError.hint,
          }
        : null,
    });
  }

  if (msmeLookupError) {
    return NextResponse.json(
      {
        ok: false,
        code: "msme_lookup_failed",
        message: "Unable to resolve MSME profile for the authenticated user.",
      },
      { status: 500 },
    );
  }

  if (!msmeRow?.id) {
    return NextResponse.json(
      {
        ok: false,
        code: "msme_not_found",
        message: `No MSME profile found for authenticated email ${authenticatedEmail}.`,
      },
      { status: 404 },
    );
  }

  const { data: tableColumnsRows, error: columnsError } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "finance_readiness_assessments")
    .order("ordinal_position", { ascending: true });

  if (columnsError) {
    return NextResponse.json(
      {
        ok: false,
        code: "column_introspection_failed",
        message: "Unable to inspect finance_readiness_assessments table columns.",
      },
      { status: 500 },
    );
  }

  const tableColumns = new Set((tableColumnsRows ?? []).map((row) => String(row.column_name)));

  if (tableColumns.size === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "assessment_table_missing",
        message: "finance_readiness_assessments table is missing or inaccessible.",
      },
      { status: 500 },
    );
  }

  const assessmentPayload = isObject(body.assessment_data)
    ? body.assessment_data
    : isObject(body.answers)
      ? body.answers
      : Object.fromEntries(
          Object.entries(body).filter(([key]) => !["preview", "score", "readiness_score", "status", "notes"].includes(key)),
        );

  const candidatePayload: Record<string, unknown> = {
    msme_id: msmeRow.id,
    readiness_score: typeof body.readiness_score === "number" ? body.readiness_score : body.score,
    status: typeof body.status === "string" ? body.status : "submitted",
    notes: typeof body.notes === "string" ? body.notes : null,
    assessment_data: assessmentPayload,
    assessment_payload: assessmentPayload,
    submitted_by: context.appUserId,
    created_by: context.appUserId,
  };

  const finalInsertPayload = Object.fromEntries(
    Object.entries(candidatePayload).filter(([key, value]) => tableColumns.has(key) && value !== undefined),
  );

  const candidateKeys = Object.keys(candidatePayload);
  const finalKeys = Object.keys(finalInsertPayload);
  const droppedKeys = candidateKeys.filter((key) => !finalKeys.includes(key));

  if (preview) {
    console.info("[finance-readiness-submit][payload-before-insert]", {
      tableColumns: sanitizeColumnLog(Array.from(tableColumns)),
      candidatePayloadKeys: candidateKeys,
      finalInsertPayloadKeys: finalKeys,
      droppedPayloadKeys: droppedKeys,
    });
  }

  const { data: insertedRow, error: insertError } = await supabase
    .from("finance_readiness_assessments")
    .insert(finalInsertPayload)
    .select("id")
    .maybeSingle();

  if (insertError) {
    return NextResponse.json(
      {
        ok: false,
        code: "persist_failed",
        message: "Could not persist assessment record.",
        ...(preview
          ? {
              preview: {
                insertMessage: insertError.message,
                insertDetails: insertError.details,
                insertHint: insertError.hint,
                finalInsertPayloadKeys: finalKeys,
              },
            }
          : {}),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    assessmentId: insertedRow?.id ?? null,
    msmeId: msmeRow.id,
  });
}
