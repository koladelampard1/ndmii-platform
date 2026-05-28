import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  adminDigitalIdFiltersForDiagnostics,
  buildAdminDigitalIdQueueCsv,
  loadAdminDigitalIdQueue,
  type AdminDigitalIdFilters,
} from "@/lib/data/admin-digital-ids";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function filterFromUrl(url: URL): AdminDigitalIdFilters {
  return {
    q: url.searchParams.get("q") ?? undefined,
    credentialStatus: url.searchParams.get("credentialStatus") ?? undefined,
    lifecycleState: url.searchParams.get("lifecycleState") ?? undefined,
    msmeReviewStatus: url.searchParams.get("msmeReviewStatus") ?? undefined,
    verificationReviewStatus: url.searchParams.get("verificationReviewStatus") ?? undefined,
    tokenReadiness: url.searchParams.get("tokenReadiness") ?? undefined,
    signatureReadiness: url.searchParams.get("signatureReadiness") ?? undefined,
    qrReadiness: url.searchParams.get("qrReadiness") ?? undefined,
    expiryState: url.searchParams.get("expiryState") ?? undefined,
    attentionLevel: url.searchParams.get("attentionLevel") ?? undefined,
    operationalFilter: url.searchParams.get("operationalFilter") ?? undefined,
    assignmentFilter: url.searchParams.get("assignmentFilter") ?? undefined,
    slaState: url.searchParams.get("slaState") ?? undefined,
    publicVerificationPosture: url.searchParams.get("publicVerificationPosture") ?? undefined,
    trustPosture: url.searchParams.get("trustPosture") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    sector: url.searchParams.get("sector") ?? undefined,
    createdFrom: url.searchParams.get("createdFrom") ?? undefined,
    createdTo: url.searchParams.get("createdTo") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    page: 1,
    pageSize: 100,
    exportAll: true,
  };
}

function exportFileName(date = new Date()) {
  return `admin-digital-id-credential-queue-${date.toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  const ctx = await getCurrentUserContext();
  if (!["admin", "super_admin", "reviewer"].includes(ctx.role)) {
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
    const queue = await loadAdminDigitalIdQueue(supabase, filters, { currentUserId: ctx.appUserId ?? null });
    const rows = selectedIds.size ? queue.rows.filter((row) => selectedIds.has(row.id)) : queue.rows;

    console.info("[admin-digital-ids-export]", {
      operation: "export",
      rowCount: rows.length,
      filters: adminDigitalIdFiltersForDiagnostics(filters),
      sourceAvailability: Object.fromEntries(Object.entries(queue.sources).map(([name, source]) => [name, source.available])),
      supabaseErrorCode: null,
      supabaseErrorMessage: null,
    });

    return new NextResponse(`${buildAdminDigitalIdQueueCsv(rows)}\r\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.info("[admin-digital-ids-export]", {
      operation: "export",
      rowCount: 0,
      filters: adminDigitalIdFiltersForDiagnostics(filters),
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Unable to export digital ID queue",
    });

    return NextResponse.json({ ok: false, error: "Unable to export digital ID queue." }, { status: 500 });
  }
}
