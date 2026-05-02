import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoiceExportRow = {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  issued_at: string | null;
  created_at: string | null;
  due_date: string | null;
  status: string | null;
  subtotal: number | string | null;
  vat_amount: number | string | null;
  total_amount: number | string | null;
  currency: string | null;
};

const CSV_COLUMNS = [
  "Invoice Number",
  "Customer Name",
  "Customer Email",
  "Customer Phone",
  "Invoice Date",
  "Due Date",
  "Status",
  "Subtotal",
  "VAT Amount",
  "Total Amount",
  "Currency",
  "Public Invoice Link",
] as const;

function formatDateForCsv(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-NG", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatAmountForCsv(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toFixed(2);
}

function escapeCsvValue(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsv(rows: InvoiceExportRow[], requestUrl: string) {
  const csvRows = [
    CSV_COLUMNS.map(escapeCsvValue).join(","),
    ...rows.map((invoice) => {
      const publicInvoiceLink = new URL(`/invoice/${invoice.id}`, requestUrl).toString();
      return [
        invoice.invoice_number ?? invoice.id,
        invoice.customer_name,
        invoice.customer_email,
        invoice.customer_phone,
        formatDateForCsv(invoice.issued_at ?? invoice.created_at),
        formatDateForCsv(invoice.due_date),
        invoice.status,
        formatAmountForCsv(invoice.subtotal),
        formatAmountForCsv(invoice.vat_amount),
        formatAmountForCsv(invoice.total_amount),
        invoice.currency ?? "NGN",
        publicInvoiceLink,
      ].map(escapeCsvValue).join(",");
    }),
  ];

  return `${csvRows.join("\r\n")}\r\n`;
}

function exportFileName(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `invoices-export-${yyyy}-${mm}-${dd}.csv`;
}

export async function GET(request: Request) {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,customer_name,customer_email,customer_phone,issued_at,created_at,due_date,status,subtotal,vat_amount,total_amount,currency")
    .eq("provider_profile_id", workspace.provider.id)
    .order("created_at", { ascending: false });

  if (error) {
    return new Response("Unable to export invoices.", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = buildCsv((data ?? []) as InvoiceExportRow[], request.url);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName()}"`,
      "Cache-Control": "no-store",
    },
  });
}
