import { NextResponse } from "next/server";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { formatDate } from "@/lib/data/invoicing";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type PdfLine = { text: string; x?: number; y?: number; size?: number; bold?: boolean };

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 44;
const RIGHT = 551;

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function money(value: number | string | null | undefined) {
  return `NGN ${Number(value ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeText(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/[()\\]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textCommand({ text, x = LEFT, y = 800, size = 10, bold = false }: PdfLine) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${safeText(text)}) Tj ET`;
}

function lineCommand(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

function wrapText(value: string | null | undefined, maxLength: number) {
  const words = safeText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function buildPdf(pages: string[]) {
  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontRegularId = 3;
  const fontBoldId = 4;
  let nextId = 5;

  for (const stream of pages) {
    const contentId = nextId;
    const pageId = nextId + 1;
    objects.push(`${contentId} 0 obj\n<< /Length ${bytes(stream).length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
    pageIds.push(pageId);
    nextId += 2;
  }

  const header = "%PDF-1.4\n";
  const root = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`;
  const fontRegular = `${fontRegularId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const fontBold = `${fontBoldId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;
  const all = [header, root, pagesObj, fontRegular, fontBold, ...objects];
  let pdf = "";
  const xref = [0];
  for (const part of all) {
    xref.push(bytes(pdf).length);
    pdf += part;
  }
  const start = bytes(pdf).length;
  pdf += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < xref.length; index += 1) pdf += `${String(xref[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return bytes(pdf);
}

function htmlError(message: string, status = 500) {
  const safeMessage = safeText(message);
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"/><title>Invoice PDF Error</title></head><body><h1>Unable to generate invoice PDF</h1><p>${safeMessage}</p></body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { invoiceId } = await params;
    const workspace = await getProviderWorkspaceContext();
    const supabase = await createServiceRoleSupabaseClient();

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id,invoice_number,customer_name,customer_email,customer_phone,status,due_date,issued_at,subtotal,vat_rate,vat_amount,total_amount")
      .eq("id", invoiceId)
      .eq("provider_profile_id", workspace.provider.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invoice) return htmlError("Invoice not found.", 404);

    const { data: items, error: itemError } = await supabase
      .from("invoice_items")
      .select("id,item_name,description,quantity,unit_price,line_total,vat_applicable")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    if (itemError) throw new Error(itemError.message);

    const publicUrl = `/invoice/${invoice.id}`;
    const publicAbsoluteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${publicUrl}` || publicUrl;
    const statusLabel = safeText(invoice.status).replaceAll("_", " ").toUpperCase();
    const invoiceNumber = safeText(invoice.invoice_number || invoice.id);
    const providerName = workspace.provider.display_name || workspace.msme.business_name || "Verified MSME";
    const rows = items ?? [];
    const pages: string[] = [];
    let commands: string[] = [
      "0.10 0.36 0.24 RG",
      lineCommand(LEFT, 792, RIGHT, 792),
      textCommand({ text: "DBIN", x: LEFT, y: 808, size: 18, bold: true }),
      textCommand({ text: "Digital Business Identity Network", x: 100, y: 811, size: 10 }),
      textCommand({ text: `Invoice ${invoiceNumber}`, x: LEFT, y: 760, size: 20, bold: true }),
      textCommand({ text: `Status: ${statusLabel}`, x: 390, y: 763, size: 11, bold: true }),
      textCommand({ text: `Provider: ${providerName}`, x: LEFT, y: 732, size: 10 }),
      textCommand({ text: `Invoice date: ${formatDate(invoice.issued_at ?? invoice.due_date)}`, x: LEFT, y: 710, size: 10 }),
      textCommand({ text: `Due date: ${formatDate(invoice.due_date)}`, x: 310, y: 710, size: 10 }),
      textCommand({ text: "Customer", x: LEFT, y: 678, size: 12, bold: true }),
      textCommand({ text: invoice.customer_name, x: LEFT, y: 660, size: 10 }),
      textCommand({ text: invoice.customer_email ?? "No customer email", x: LEFT, y: 646, size: 10 }),
      textCommand({ text: invoice.customer_phone ?? "No customer phone", x: LEFT, y: 632, size: 10 }),
      textCommand({ text: "Public invoice link", x: LEFT, y: 604, size: 12, bold: true }),
      ...wrapText(publicAbsoluteUrl, 88).slice(0, 2).map((line, index) => textCommand({ text: line, x: LEFT, y: 586 - index * 14, size: 9 })),
      lineCommand(LEFT, 548, RIGHT, 548),
      textCommand({ text: "Item", x: LEFT, y: 532, size: 9, bold: true }),
      textCommand({ text: "Qty", x: 274, y: 532, size: 9, bold: true }),
      textCommand({ text: "Unit", x: 330, y: 532, size: 9, bold: true }),
      textCommand({ text: "VAT", x: 414, y: 532, size: 9, bold: true }),
      textCommand({ text: "Line total", x: 462, y: 532, size: 9, bold: true }),
      lineCommand(LEFT, 524, RIGHT, 524),
    ];
    let y = 506;

    const flushPage = () => {
      commands.push(textCommand({ text: `Invoice ${invoiceNumber} | DBIN`, x: LEFT, y: 36, size: 8 }));
      pages.push(commands.join("\n"));
      commands = [
        textCommand({ text: `Invoice ${invoiceNumber}`, x: LEFT, y: 800, size: 14, bold: true }),
        lineCommand(LEFT, 782, RIGHT, 782),
        textCommand({ text: "Item", x: LEFT, y: 764, size: 9, bold: true }),
        textCommand({ text: "Qty", x: 274, y: 764, size: 9, bold: true }),
        textCommand({ text: "Unit", x: 330, y: 764, size: 9, bold: true }),
        textCommand({ text: "VAT", x: 414, y: 764, size: 9, bold: true }),
        textCommand({ text: "Line total", x: 462, y: 764, size: 9, bold: true }),
        lineCommand(LEFT, 756, RIGHT, 756),
      ];
      y = 738;
    };

    if (rows.length === 0) {
      commands.push(textCommand({ text: "No invoice line items available.", x: LEFT, y, size: 10 }));
      y -= 24;
    }

    for (const item of rows) {
      const itemLines = wrapText(`${item.item_name}${item.description ? ` - ${item.description}` : ""}`, 45).slice(0, 3);
      const rowHeight = Math.max(28, itemLines.length * 12 + 12);
      if (y - rowHeight < 118) flushPage();
      itemLines.forEach((line, index) => commands.push(textCommand({ text: line, x: LEFT, y: y - index * 12, size: 9 })));
      commands.push(textCommand({ text: item.quantity, x: 274, y, size: 9 }));
      commands.push(textCommand({ text: money(item.unit_price), x: 330, y, size: 9 }));
      commands.push(textCommand({ text: item.vat_applicable ? "Yes" : "No", x: 414, y, size: 9 }));
      commands.push(textCommand({ text: money(item.line_total), x: 462, y, size: 9, bold: true }));
      y -= rowHeight;
      commands.push(lineCommand(LEFT, y + 8, RIGHT, y + 8));
    }

    if (y < 178) flushPage();
    commands.push(textCommand({ text: "Subtotal", x: 350, y: 144, size: 10 }));
    commands.push(textCommand({ text: money(invoice.subtotal), x: 450, y: 144, size: 10, bold: true }));
    commands.push(textCommand({ text: `VAT (${Number(invoice.vat_rate ?? 0)}%)`, x: 350, y: 124, size: 10 }));
    commands.push(textCommand({ text: money(invoice.vat_amount), x: 450, y: 124, size: 10, bold: true }));
    commands.push(lineCommand(350, 110, RIGHT, 110));
    commands.push(textCommand({ text: "Total amount", x: 350, y: 92, size: 12, bold: true }));
    commands.push(textCommand({ text: money(invoice.total_amount), x: 450, y: 92, size: 12, bold: true }));
    commands.push(textCommand({ text: `Status: ${statusLabel}`, x: LEFT, y: 92, size: 10, bold: true }));
    commands.push(textCommand({ text: `Generated: ${new Date().toLocaleString("en-NG")}`, x: LEFT, y: 72, size: 8 }));
    commands.push(textCommand({ text: `Public link: ${publicAbsoluteUrl}`, x: LEFT, y: 58, size: 8 }));
    commands.push(textCommand({ text: `Invoice ${invoiceNumber} | DBIN`, x: LEFT, y: 36, size: 8 }));
    pages.push(commands.join("\n"));

    const pdfBytes = buildPdf(pages);
    const filename = `invoice-${invoiceNumber || invoice.id}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "Content-Length": String(pdfBytes.length),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[invoice-pdf][route_error]", error);
    const reason = error instanceof Error ? error.message : "Unknown server error";
    return htmlError(reason, 500);
  }
}
