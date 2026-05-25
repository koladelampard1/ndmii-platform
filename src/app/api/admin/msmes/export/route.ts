import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  buildAdminMsmeRegistryCsv,
  loadAdminMsmeRegistry,
  registryFiltersForDiagnostics,
  type AdminMsmeRegistryFilters,
} from "@/lib/data/admin-msme-registry";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function filterFromUrl(url: URL): AdminMsmeRegistryFilters {
  return {
    q: url.searchParams.get("q") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    sector: url.searchParams.get("sector") ?? undefined,
    verificationStatus: url.searchParams.get("verificationStatus") ?? undefined,
    reviewStatus: url.searchParams.get("reviewStatus") ?? undefined,
    complianceStatus: url.searchParams.get("complianceStatus") ?? undefined,
    digitalIdStatus: url.searchParams.get("digitalIdStatus") ?? undefined,
    associationId: url.searchParams.get("associationId") ?? undefined,
    flagged: url.searchParams.get("flagged") ?? undefined,
    suspended: url.searchParams.get("suspended") ?? undefined,
    createdFrom: url.searchParams.get("createdFrom") ?? undefined,
    createdTo: url.searchParams.get("createdTo") ?? undefined,
    page: 1,
    pageSize: 100,
    exportAll: true,
  };
}

function exportFileName(date = new Date()) {
  return `msme-registry-${date.toISOString().slice(0, 10)}.csv`;
}

async function recordExportAudit(params: {
  actorUserId: string | null;
  filters: AdminMsmeRegistryFilters;
  rowCount: number;
}) {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const { error } = await supabase.from("activity_logs").insert({
      actor_user_id: params.actorUserId,
      action: "admin_msme_registry_exported",
      entity_type: "msme_registry",
      metadata: {
        filters: registryFiltersForDiagnostics(params.filters),
        row_count: params.rowCount,
      },
    });

    if (error) {
      console.info("[admin-msme-registry-export]", {
        operation: "audit_insert",
        filtersUsed: registryFiltersForDiagnostics(params.filters),
        rowCount: params.rowCount,
        supabaseErrorCode: error.code ?? null,
        supabaseErrorMessage: error.message ?? null,
      });
    }
  } catch (error) {
    console.info("[admin-msme-registry-export]", {
      operation: "audit_insert",
      filtersUsed: registryFiltersForDiagnostics(params.filters),
      rowCount: params.rowCount,
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Audit unavailable",
    });
  }
}

export async function GET(request: Request) {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = filterFromUrl(url);

  try {
    const supabase = await createServiceRoleSupabaseClient();
    const registry = await loadAdminMsmeRegistry(supabase, filters);
    await recordExportAudit({ actorUserId: ctx.appUserId, filters, rowCount: registry.rows.length });

    return new NextResponse(`${buildAdminMsmeRegistryCsv(registry.rows)}\r\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.info("[admin-msme-registry-export]", {
      operation: "export",
      filtersUsed: registryFiltersForDiagnostics(filters),
      rowCount: 0,
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Unable to export MSME registry",
    });

    return NextResponse.json({ ok: false, error: "Unable to export MSME registry." }, { status: 500 });
  }
}
