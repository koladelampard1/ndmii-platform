import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { loadBookkeepingDashboard, parsePeriodParam, periodParamFromDate } from "@/lib/data/bookkeeping";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "Date",
  "Type",
  "Category",
  "Description",
  "Source Type",
  "Source ID",
  "Amount",
  "Currency",
  "VAT Applicable",
  "VAT Amount",
  "Status",
  "Evidence Count",
] as const;

function escapeCsv(value: string | number | boolean | null | undefined) {
  return `"${String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/"/g, '""')}"`;
}

function csvFileName(periodMonth: string, report: string | null) {
  const prefix = report === "monthly" ? "bookkeeping-monthly-report" : "bookkeeping-export";
  return `${prefix}-${periodParamFromDate(periodMonth)}.csv`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const periodMonth = parsePeriodParam(requestUrl.searchParams.get("period"));
  const { period, entries, summary } = await loadBookkeepingDashboard({ supabase, workspace, periodMonth });

  const rows = [
    COLUMNS.map(escapeCsv).join(","),
    ...entries.map((entry) => [
      entry.transaction_date,
      entry.entry_type,
      entry.category,
      entry.description,
      entry.source_type,
      entry.source_id,
      Number(entry.amount ?? 0).toFixed(2),
      entry.currency,
      entry.vat_applicable,
      Number(entry.vat_amount ?? 0).toFixed(2),
      entry.status,
      entry.bookkeeping_attachments?.length ?? 0,
    ].map(escapeCsv).join(",")),
    "",
    ["Summary", "", "", "", "", "", "", "", "", "", "", ""].map(escapeCsv).join(","),
    ["Revenue", "", "", "", "", "", summary.revenue.toFixed(2), "NGN", "", "", "", ""].map(escapeCsv).join(","),
    ["Expenses", "", "", "", "", "", summary.expenses.toFixed(2), "NGN", "", "", "", ""].map(escapeCsv).join(","),
    ["Net", "", "", "", "", "", summary.net.toFixed(2), "NGN", "", "", "", ""].map(escapeCsv).join(","),
    ["VAT", "", "", "", "", "", summary.vatTotal.toFixed(2), "NGN", "", "", "", ""].map(escapeCsv).join(","),
  ];

  return new Response(`${rows.join("\r\n")}\r\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(period.period_month, requestUrl.searchParams.get("report"))}"`,
      "Cache-Control": "no-store",
    },
  });
}
