import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canReviewRegulator, canUseComplianceReviewQueue, recordComplianceReviewExport, type ComplianceReviewStatus } from "@/lib/data/compliance-reviews";

type RegulatorRow = {
  id: string;
  code: string | null;
  name: string | null;
};

type ExportRow = {
  id: string;
  status: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  msmes?: { msme_id?: string | null; business_name?: string | null; state?: string | null; sector?: string | null } | null;
  compliance_regulators?: RegulatorRow | RegulatorRow[] | null;
  compliance_requirement_definitions?: { code?: string | null; title?: string | null; category?: string | null } | Array<{ code?: string | null; title?: string | null; category?: string | null }> | null;
};

const reviewableStatuses = ["submitted", "resubmitted", "under_review", "changes_requested", "rejected", "approved"];

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const ctx = await getCurrentUserContext();
  if (!canUseComplianceReviewQueue(ctx)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const regulatorParam = url.searchParams.get("regulator");
  const statusParam = url.searchParams.get("status");
  const msmeParam = url.searchParams.get("msme");
  const dateParam = url.searchParams.get("date");

  const supabase = await createServiceRoleSupabaseClient();
  const { data: regulatorRows } = await supabase.from("compliance_regulators").select("id,code,name").eq("is_active", true);
  const regulators = ((regulatorRows ?? []) as RegulatorRow[]).filter((regulator) => canReviewRegulator(ctx, regulator.code));
  const selectedRegulator = regulatorParam ? regulators.find((regulator) => String(regulator.code ?? "").toUpperCase() === regulatorParam.toUpperCase()) : null;

  let query = supabase
    .from("msme_compliance_items")
    .select("id,status,submitted_at,updated_at,msmes(msme_id,business_name,state,sector),compliance_regulators(id,code,name),compliance_requirement_definitions(code,title,category)")
    .in("status", reviewableStatuses)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (selectedRegulator) query = query.eq("regulator_id", selectedRegulator.id);
  if (statusParam && reviewableStatuses.includes(statusParam)) query = query.eq("status", statusParam);
  if (dateParam) query = query.gte("updated_at", new Date(dateParam).toISOString());

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: "Unable to generate export." }, { status: 500 });
  }

  const rows = ((data ?? []) as ExportRow[]).filter((row) => {
    const regulator = relationOne(row.compliance_regulators);
    if (!canReviewRegulator(ctx, regulator?.code)) return false;
    if (!msmeParam) return true;
    const term = msmeParam.toLowerCase();
    return `${row.msmes?.business_name ?? ""} ${row.msmes?.msme_id ?? ""}`.toLowerCase().includes(term);
  });

  const reviewStatus = statusParam && ["pending_review", "under_review", "approved", "rejected", "changes_requested"].includes(statusParam)
    ? statusParam as ComplianceReviewStatus
    : null;

  await recordComplianceReviewExport(ctx, {
    regulatorId: selectedRegulator?.id ?? null,
    reviewStatus,
    filters: {
      regulator: regulatorParam,
      status: statusParam,
      msme: msmeParam,
      date: dateParam,
    },
    exportCount: rows.length,
  });

  const header = ["MSME ID", "Business name", "State", "Sector", "Regulator", "Requirement", "Category", "Status", "Submitted at", "Updated at"];
  const csv = [
    header.map(csvValue).join(","),
    ...rows.map((row) => {
      const regulator = relationOne(row.compliance_regulators);
      const requirement = relationOne(row.compliance_requirement_definitions);
      return [
        row.msmes?.msme_id,
        row.msmes?.business_name,
        row.msmes?.state,
        row.msmes?.sector,
        regulator?.code,
        requirement?.title ?? requirement?.code,
        requirement?.category,
        row.status,
        row.submitted_at,
        row.updated_at,
      ].map(csvValue).join(",");
    }),
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compliance-review-queue-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
