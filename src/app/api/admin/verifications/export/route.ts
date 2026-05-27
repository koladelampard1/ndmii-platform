import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  adminVerificationFiltersForDiagnostics,
  buildAdminVerificationQueueCsv,
  loadAdminVerificationQueue,
  type AdminVerificationFilters,
} from "@/lib/data/admin-verifications";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function filterFromUrl(url: URL): AdminVerificationFilters {
  return {
    q: url.searchParams.get("q") ?? undefined,
    verificationStatus: url.searchParams.get("verificationStatus") ?? undefined,
    reviewStatus: url.searchParams.get("reviewStatus") ?? undefined,
    kycStatus: url.searchParams.get("kycStatus") ?? undefined,
    digitalIdStatus: url.searchParams.get("digitalIdStatus") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    sector: url.searchParams.get("sector") ?? undefined,
    attentionLevel: url.searchParams.get("attentionLevel") ?? undefined,
    confidenceCategory: url.searchParams.get("confidenceCategory") ?? undefined,
    priority: url.searchParams.get("priority") ?? undefined,
    complaintLinked: url.searchParams.get("complaintLinked") ?? undefined,
    duplicateSignal: url.searchParams.get("duplicateSignal") ?? undefined,
    missingCredential: url.searchParams.get("missingCredential") ?? undefined,
    staleReview: url.searchParams.get("staleReview") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    flagged: url.searchParams.get("flagged") ?? undefined,
    suspended: url.searchParams.get("suspended") ?? undefined,
    updatedFrom: url.searchParams.get("updatedFrom") ?? undefined,
    updatedTo: url.searchParams.get("updatedTo") ?? undefined,
    page: 1,
    pageSize: 100,
    exportAll: true,
  };
}

function exportFileName(date = new Date()) {
  return `admin-verification-queue-${date.toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin" && ctx.role !== "reviewer") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = filterFromUrl(url);
  const selectedIds = new Set(
    (url.searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

  try {
    const supabase = await createServiceRoleSupabaseClient();
    const queue = await loadAdminVerificationQueue(supabase, filters);
    const rows = selectedIds.size ? queue.rows.filter((row) => selectedIds.has(row.id)) : queue.rows;
    console.info("[admin-verifications-export]", {
      operation: "export",
      rowCount: rows.length,
      filters: adminVerificationFiltersForDiagnostics(filters),
      supabaseErrorCode: null,
      supabaseErrorMessage: null,
    });

    return new NextResponse(`${buildAdminVerificationQueueCsv(rows)}\r\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.info("[admin-verifications-export]", {
      operation: "export",
      rowCount: 0,
      filters: adminVerificationFiltersForDiagnostics(filters),
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Unable to export verification queue",
    });

    return NextResponse.json({ ok: false, error: "Unable to export verification queue." }, { status: 500 });
  }
}
