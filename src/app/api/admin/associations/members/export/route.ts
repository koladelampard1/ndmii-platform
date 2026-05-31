import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  associationMemberFiltersForDiagnostics,
  buildAssociationMembersCsv,
  getAssociationMemberExportRows,
  type AdminAssociationMemberFilters,
} from "@/lib/data/admin-association-members";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function filtersFromUrl(url: URL): AdminAssociationMemberFilters {
  return {
    association: url.searchParams.get("association") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    activation: url.searchParams.get("activation") ?? undefined,
    invite: url.searchParams.get("invite") ?? undefined,
    duplicate: url.searchParams.get("duplicate") ?? undefined,
    lga: url.searchParams.get("lga") ?? undefined,
    tradeType: url.searchParams.get("tradeType") ?? undefined,
    reviewer: url.searchParams.get("reviewer") ?? undefined,
    importedFrom: url.searchParams.get("importedFrom") ?? undefined,
    importedTo: url.searchParams.get("importedTo") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    ids: url.searchParams.get("ids") ?? undefined,
    page: 1,
    pageSize: 1000,
  };
}

function exportFileName(date = new Date()) {
  return `association-members-${date.toISOString().slice(0, 10)}.csv`;
}

async function recordExportAudit(params: {
  actorUserId: string | null;
  filters: AdminAssociationMemberFilters;
  rowCount: number;
}) {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const { error } = await supabase.from("activity_logs").insert({
      actor_user_id: params.actorUserId,
      action: "admin_association_members_exported",
      entity_type: "association_members",
      metadata: {
        filters: associationMemberFiltersForDiagnostics(params.filters),
        row_count: params.rowCount,
        masked_export: true,
        excluded_fields: ["nin", "bvn"],
      },
    });

    if (error) {
      console.info("[admin-association-members-export]", {
        operation: "audit_insert",
        associationId: params.filters.association ?? null,
        rowCount: params.rowCount,
        code: error.code ?? null,
        message: error.message,
      });
    }
  } catch (error) {
    console.info("[admin-association-members-export]", {
      operation: "audit_insert",
      associationId: params.filters.association ?? null,
      rowCount: params.rowCount,
      code: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "Audit unavailable",
    });
  }
}

export async function GET(request: Request) {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = filtersFromUrl(url);

  try {
    const rows = await getAssociationMemberExportRows(filters);
    await recordExportAudit({ actorUserId: ctx.appUserId, filters, rowCount: rows.length });

    return new NextResponse(`${buildAssociationMembersCsv(rows)}\r\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.info("[admin-association-members-export]", {
      operation: "export",
      associationId: filters.association ?? null,
      rowCount: 0,
      code: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "Unable to export association members.",
    });

    return NextResponse.json({ ok: false, error: "Unable to export association members." }, { status: 500 });
  }
}
