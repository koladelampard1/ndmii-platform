import { NextResponse } from "next/server";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { formatDate } from "@/lib/data/invoicing";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type PdfLine = { text: string | number | null | undefined; x?: number; y?: number; size?: number; bold?: boolean };

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const LEFT = MARGIN;
const RIGHT = PAGE_WIDTH - MARGIN;
const NAVY = "0.03 0.10 0.23";
const GREEN = "0.02 0.47 0.31";
const SLATE = "0.10 0.16 0.27";
const MUTED = "0.39 0.45 0.55";
const BORDER = "0.82 0.86 0.90";
const SOFT = "0.95 0.98 0.97";
const WHITE = "1 1 1";

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

function colorCommand(color: string, target: "fill" | "stroke" = "fill") {
  return `${color} ${target === "fill" ? "rg" : "RG"}`;
}

function lineCommand(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

function rectCommand(x: number, y: number, width: number, height: number, mode: "fill" | "stroke" | "both" = "stroke") {
  const operator = mode === "fill" ? "f" : mode === "both" ? "B" : "S";
  return `${x} ${y} ${width} ${height} re ${operator}`;
}

function rightText(text: string | number | null | undefined, right: number, y: number, size = 10, bold = false) {
  const safe = safeText(text);
  const estimatedWidth = safe.length * size * 0.52;
  return textCommand({ text: safe, x: Math.max(LEFT, right - estimatedWidth), y, size, bold });
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

function displayValue(value: string | number | null | undefined, fallback = "Not provided") {
  const safe = safeText(value);
  return safe || fallback;
}

function filenamePart(value: string | number | null | undefined, fallback = "invoice") {
  return safeText(value).toLowerCase().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function initialsFor(value: string) {
  const parts = safeText(value).split(" ").filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0] ?? "B").slice(0, 2);
  return letters.toUpperCase();
}

function labelValue(label: string, value: string | number | null | undefined, x: number, y: number, valueX = x + 82) {
  return [
    colorCommand(MUTED),
    textCommand({ text: label, x, y, size: 8, bold: true }),
    colorCommand(SLATE),
    textCommand({ text: value, x: valueX, y, size: 9, bold: true }),
  ];
}

function addWrappedText(commands: string[], value: string | null | undefined, x: number, y: number, maxLength: number, size = 9, maxLines = 3, leading = 12) {
  wrapText(value, maxLength)
    .slice(0, maxLines)
    .forEach((line, index) => commands.push(textCommand({ text: line, x, y: y - index * leading, size })));
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
      .select("id,invoice_number,customer_name,customer_email,customer_phone,due_date,issued_at,subtotal,vat_rate,vat_amount,total_amount")
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

    const invoiceNumber = safeText(invoice.invoice_number || invoice.id);
    const providerName = workspace.provider.display_name || workspace.msme.business_name || "Business Invoice";
    const { data: msmeProfile } = await supabase
      .from("msmes")
      .select("business_name,contact_email,contact_phone,address,state,lga")
      .eq("id", workspace.msme.id)
      .maybeSingle();
    const businessName = displayValue(workspace.msme.business_name ?? msmeProfile?.business_name ?? providerName, "Business Invoice");
    const businessEmail = displayValue(workspace.provider.contact_email ?? msmeProfile?.contact_email ?? workspace.msme.contact_email);
    const businessPhone = displayValue(workspace.provider.contact_phone ?? msmeProfile?.contact_phone);
    const businessAddress = displayValue(
      msmeProfile?.address ?? [workspace.msme.lga, workspace.msme.state].filter(Boolean).join(", "),
      "Address not provided"
    );
    const invoiceDate = formatDate(invoice.issued_at ?? invoice.due_date);
    const dueDate = formatDate(invoice.due_date);
    const vatRate = Number(invoice.vat_rate ?? 0);
    const rows = items ?? [];
    const pages: string[] = [];
    let commands: string[] = [];

    const addFooter = () => {
      commands.push(colorCommand(MUTED));
      commands.push(textCommand({ text: "Powered by DBIN", x: LEFT, y: 12, size: 7 }));
      commands.push(rightText("All amounts are in Nigerian Naira (NGN)", RIGHT, 12, 7));
    };

    const addTableHeader = (y: number) => {
      commands.push(colorCommand(NAVY));
      commands.push(rectCommand(LEFT, y - 18, RIGHT - LEFT, 24, "fill"));
      commands.push(colorCommand(WHITE));
      commands.push(textCommand({ text: "#", x: LEFT + 12, y: y - 10, size: 8, bold: true }));
      commands.push(textCommand({ text: "Description", x: LEFT + 42, y: y - 10, size: 8, bold: true }));
      commands.push(textCommand({ text: "Qty", x: 296, y: y - 10, size: 8, bold: true }));
      commands.push(textCommand({ text: "Unit price", x: 342, y: y - 10, size: 8, bold: true }));
      commands.push(textCommand({ text: "VAT", x: 428, y: y - 10, size: 8, bold: true }));
      commands.push(textCommand({ text: "Line total", x: 484, y: y - 10, size: 8, bold: true }));
    };

    const startContinuationPage = () => {
      addFooter();
      pages.push(commands.join("\n"));
      commands = [
        colorCommand(WHITE),
        rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "fill"),
        colorCommand(SLATE),
        textCommand({ text: businessName, x: LEFT, y: 802, size: 14, bold: true }),
        rightText(`Invoice ${invoiceNumber}`, RIGHT, 802, 10, true),
        colorCommand(BORDER, "stroke"),
        lineCommand(LEFT, 782, RIGHT, 782),
      ];
      addTableHeader(752);
      return 716;
    };

    commands = [
      colorCommand(WHITE),
      rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "fill"),
      colorCommand(GREEN),
      rectCommand(0, PAGE_HEIGHT - 6, PAGE_WIDTH, 6, "fill"),
      colorCommand(GREEN),
      rectCommand(LEFT, 742, 48, 48, "fill"),
      colorCommand(WHITE),
      textCommand({ text: initialsFor(businessName), x: LEFT + 12, y: 760, size: 16, bold: true }),
      colorCommand(NAVY),
      textCommand({ text: businessName, x: 96, y: 773, size: 21, bold: true }),
      colorCommand(GREEN),
      textCommand({ text: "Invoice from your service provider", x: 98, y: 754, size: 8, bold: true }),
      colorCommand(MUTED),
    ];
    addWrappedText(commands, businessAddress, 98, 735, 52, 8, 2, 11);
    commands.push(textCommand({ text: businessPhone, x: 98, y: 711, size: 8 }));
    commands.push(textCommand({ text: businessEmail, x: 98, y: 700, size: 8 }));

    commands.push(colorCommand(NAVY));
    commands.push(textCommand({ text: "INVOICE", x: 398, y: 770, size: 24, bold: true }));
    commands.push(...labelValue("Invoice No.", invoiceNumber, 360, 740, 428));
    commands.push(...labelValue("Invoice Date", invoiceDate, 360, 720, 428));
    commands.push(...labelValue("Due Date", dueDate, 360, 700, 428));
    commands.push(colorCommand(BORDER, "stroke"));
    commands.push(lineCommand(LEFT, 626, RIGHT, 626));

    commands.push(colorCommand(GREEN));
    commands.push(textCommand({ text: "BILL TO", x: LEFT, y: 596, size: 10, bold: true }));
    commands.push(colorCommand(SLATE));
    commands.push(textCommand({ text: invoice.customer_name, x: LEFT, y: 574, size: 11, bold: true }));
    commands.push(textCommand({ text: displayValue(invoice.customer_email, "No customer email"), x: LEFT, y: 558, size: 9 }));
    commands.push(textCommand({ text: displayValue(invoice.customer_phone, "No customer phone"), x: LEFT, y: 543, size: 9 }));

    addTableHeader(490);
    let y = 458;

    const flushPage = () => {
      y = startContinuationPage();
    };

    if (rows.length === 0) {
      commands.push(colorCommand(SLATE));
      commands.push(textCommand({ text: "No invoice line items available.", x: LEFT, y, size: 10 }));
      y -= 24;
    }

    rows.forEach((item, index) => {
      const itemLines = wrapText(`${item.item_name}${item.description ? ` - ${item.description}` : ""}`, 40).slice(0, 3);
      const rowHeight = Math.max(34, itemLines.length * 12 + 16);
      if (y - rowHeight < 220) flushPage();
      commands.push(colorCommand(BORDER, "stroke"));
      commands.push(lineCommand(LEFT, y + 12, RIGHT, y + 12));
      commands.push(colorCommand(SLATE));
      commands.push(textCommand({ text: index + 1, x: LEFT + 14, y, size: 8 }));
      itemLines.forEach((line, lineIndex) => commands.push(textCommand({ text: line, x: LEFT + 42, y: y - lineIndex * 12, size: 8 })));
      commands.push(textCommand({ text: item.quantity, x: 298, y, size: 8 }));
      commands.push(rightText(money(item.unit_price), 408, y, 8));
      commands.push(textCommand({ text: item.vat_applicable ? `Yes (${vatRate}%)` : "No", x: 426, y, size: 8 }));
      commands.push(rightText(money(item.line_total), RIGHT - 12, y, 8, true));
      y -= rowHeight;
    });

    if (y < 356) flushPage();
    commands.push(colorCommand(BORDER, "stroke"));
    commands.push(lineCommand(LEFT, y + 12, RIGHT, y + 12));

    const totalsY = y - 18;
    const totalsBoxX = 304;
    const totalsBoxWidth = 220;
    const totalsLabelX = totalsBoxX + 14;
    const totalsAmountRight = totalsBoxX + totalsBoxWidth - 14;
    commands.push(colorCommand(WHITE));
    commands.push(rectCommand(totalsBoxX, totalsY - 80, totalsBoxWidth, 94, "fill"));
    commands.push(colorCommand(BORDER, "stroke"));
    commands.push(rectCommand(totalsBoxX, totalsY - 80, totalsBoxWidth, 94, "stroke"));
    commands.push(colorCommand(SLATE));
    commands.push(textCommand({ text: "Subtotal", x: totalsLabelX, y: totalsY - 4, size: 9 }));
    commands.push(rightText(money(invoice.subtotal), totalsAmountRight, totalsY - 4, 9));
    commands.push(textCommand({ text: `VAT (${vatRate}%)`, x: totalsLabelX, y: totalsY - 26, size: 9 }));
    commands.push(rightText(money(invoice.vat_amount), totalsAmountRight, totalsY - 26, 9));
    commands.push(colorCommand(BORDER, "stroke"));
    commands.push(lineCommand(totalsLabelX, totalsY - 44, totalsAmountRight, totalsY - 44));
    commands.push(colorCommand(NAVY));
    commands.push(textCommand({ text: "TOTAL AMOUNT", x: totalsLabelX, y: totalsY - 64, size: 8, bold: true }));
    commands.push(colorCommand(GREEN));
    commands.push(rightText(money(invoice.total_amount), totalsAmountRight, totalsY - 64, 10, true));

    commands.push(colorCommand(GREEN));
    commands.push(textCommand({ text: "PAYMENT INSTRUCTIONS", x: LEFT, y: totalsY - 2, size: 9, bold: true }));
    commands.push(colorCommand(SOFT));
    commands.push(rectCommand(LEFT, totalsY - 108, 254, 86, "fill"));
    commands.push(colorCommand(SLATE));
    commands.push(textCommand({ text: "Please use the invoice number as payment reference.", x: LEFT + 12, y: totalsY - 38, size: 8, bold: true }));
    commands.push(textCommand({ text: "Bank name: Not provided", x: LEFT + 12, y: totalsY - 56, size: 8 }));
    commands.push(textCommand({ text: `Account name: ${businessName}`, x: LEFT + 12, y: totalsY - 70, size: 8 }));
    commands.push(textCommand({ text: "Account number: Not provided", x: LEFT + 12, y: totalsY - 84, size: 8 }));
    commands.push(textCommand({ text: "Sort code / SWIFT: Not provided", x: LEFT + 12, y: totalsY - 98, size: 8 }));
    commands.push(colorCommand(NAVY));
    commands.push(textCommand({ text: `Payment reference: ${invoiceNumber}`, x: LEFT + 12, y: totalsY - 118, size: 8, bold: true }));

    commands.push(colorCommand(GREEN));
    commands.push(textCommand({ text: "NOTES / TERMS", x: 334, y: totalsY - 116, size: 9, bold: true }));
    commands.push(colorCommand(SLATE));
    commands.push(textCommand({ text: "Thank you for your business.", x: 334, y: totalsY - 136, size: 8 }));
    commands.push(textCommand({ text: `Payment is due on or before ${dueDate}.`, x: 334, y: totalsY - 151, size: 8 }));
    commands.push(textCommand({ text: "Late payment may affect fulfilment.", x: 334, y: totalsY - 166, size: 8 }));
    commands.push(textCommand({ text: `Invoice validity: valid until ${dueDate}.`, x: 334, y: totalsY - 181, size: 8 }));

    addFooter();
    pages.push(commands.join("\n"));

    const pdfBytes = buildPdf(pages);
    const filename = `${filenamePart(businessName, "business")}-invoice-${filenamePart(invoiceNumber || invoice.id)}.pdf`;

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
