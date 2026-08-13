import {
  LCDBO_CORRESPONDENCE_CANONICAL_ORIGIN,
  type CorrespondenceIssuer,
  type LcdboCorrespondenceRecord,
} from "@/lib/lcdbo-correspondence/types";
import { sha256Hex } from "@/lib/lcdbo-correspondence/security";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 54;
const TOP = 62;
const LINE_HEIGHT = 15;
const BODY_LINE_WIDTH = 88;

type PdfTextRun = { text: string; x: number; y: number; size?: number; bold?: boolean; color?: string };

export type CorrespondencePdfOptions = {
  mode: "draft" | "final";
  verificationToken?: string | null;
  signatureBlocks?: CorrespondenceSignatureBlock[];
  dispatchReference?: string | null;
};

export type CorrespondenceSignatureBlock = {
  role: "rmrdc_signatory" | "roseate_signatory" | "joint_signatory" | "signatory_delegate" | string;
  name: string;
  organisation: string;
  signedAt?: string | null;
  testOnly?: boolean;
};

function pdfEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapText(value: string, width = BODY_LINE_WIDTH) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function issuerName(issuer: CorrespondenceIssuer) {
  if (issuer === "RMRDC") return "Raw Materials Research and Development Council";
  if (issuer === "RFNL") return "Roseate Forte Nigeria Limited";
  return "LCDBO Joint Secretariat";
}

function textLine(run: PdfTextRun) {
  const color = run.color ?? "0 0 0";
  return `${color} rg BT /${run.bold ? "F2" : "F1"} ${run.size ?? 10} Tf ${run.x} ${PAGE_HEIGHT - run.y} Td (${pdfEscape(run.text)}) Tj ET`;
}

function pageStream(runs: PdfTextRun[], pageNumber: number, totalPages: number, watermark?: string) {
  const furniture: PdfTextRun[] = [
    { text: "LCDBO Correspondence Management", x: MARGIN_X, y: 28, size: 9, bold: true, color: "0 0.45 0.25" },
    { text: `Page ${pageNumber} of ${totalPages}`, x: 500, y: 28, size: 8, color: "0.35 0.35 0.35" },
    { text: "Official correspondence is verified through correspondence.dbin.ng.", x: MARGIN_X, y: 812, size: 8, color: "0.35 0.35 0.35" },
  ];
  const watermarkRuns = watermark
    ? [
        "0.82 0.82 0.82 rg BT /F2 68 Tf 165 435 Td",
        `(${pdfEscape(watermark)}) Tj ET`,
      ]
    : [];
  return [
    ...watermarkRuns,
    ...furniture.map(textLine),
    ...runs.map(textLine),
  ].join("\n");
}

export function buildCorrespondencePdfModel(record: LcdboCorrespondenceRecord, options: CorrespondencePdfOptions) {
  const latestVersion = record.versions?.[0];
  const body = latestVersion?.body || String(record.metadata?.body ?? record.summary ?? "");
  const recipientName = String(record.metadata?.recipient_name ?? "Recipient");
  const recipientOrganisation = String(record.metadata?.recipient_organisation ?? "");
  const verificationUrl = options.verificationToken ? `${LCDBO_CORRESPONDENCE_CANONICAL_ORIGIN}/verify/${options.verificationToken}` : `${LCDBO_CORRESPONDENCE_CANONICAL_ORIGIN}/verify`;
  const documentDate = record.issued_at ?? record.created_at;
  const signatureBlocks = options.signatureBlocks?.length
    ? options.signatureBlocks
    : [{ role: "signatory_delegate", name: "Authorised Signatory", organisation: issuerName(record.issuer), signedAt: null, testOnly: options.mode === "draft" }];

  const lines: PdfTextRun[] = [];
  let y = TOP;
  lines.push({ text: issuerName(record.issuer), x: MARGIN_X, y, size: 16, bold: true, color: "0 0.35 0.2" });
  y += 22;
  lines.push({ text: "Local Content Development Beyond Oil Programme", x: MARGIN_X, y, size: 10, color: "0.1 0.1 0.1" });
  y += 28;
  lines.push({ text: `Reference: ${record.reference}`, x: MARGIN_X, y, size: 10, bold: true });
  lines.push({ text: `Date: ${new Date(documentDate).toLocaleDateString("en-NG", { dateStyle: "long" })}`, x: 390, y, size: 10 });
  y += 26;
  for (const line of wrapText([recipientName, recipientOrganisation].filter(Boolean).join(", "), 70)) {
    lines.push({ text: line, x: MARGIN_X, y, size: 10 });
    y += LINE_HEIGHT;
  }
  y += 8;
  for (const line of wrapText(`Subject: ${record.subject}`, 78)) {
    lines.push({ text: line, x: MARGIN_X, y, size: 11, bold: true });
    y += LINE_HEIGHT;
  }
  y += 10;
  for (const paragraph of body.split(/\n{2,}/)) {
    for (const line of wrapText(paragraph, BODY_LINE_WIDTH)) {
      lines.push({ text: line, x: MARGIN_X, y, size: 10 });
      y += LINE_HEIGHT;
    }
    y += 8;
  }
  y += 12;
  lines.push({ text: "Authorised signature", x: MARGIN_X, y, size: 10, bold: true });
  y += 20;
  const joint = signatureBlocks.length > 1;
  signatureBlocks.forEach((signature, index) => {
    const x = joint ? MARGIN_X + (index % 2) * 255 : MARGIN_X;
    const blockY = y + Math.floor(index / 2) * 70;
    lines.push({ text: signature.testOnly ? "TEST SIGNATURE - NON-PRODUCTION" : "Protected signature applied", x, y: blockY, size: 10, bold: true, color: signature.testOnly ? "0.65 0.15 0.15" : "0 0.35 0.2" });
    lines.push({ text: signature.name, x, y: blockY + 18, size: 10, bold: true });
    lines.push({ text: signature.organisation, x, y: blockY + 33, size: 9 });
    lines.push({ text: signature.signedAt ? new Date(signature.signedAt).toLocaleString("en-NG") : "Pending timestamp", x, y: blockY + 48, size: 8, color: "0.35 0.35 0.35" });
  });
  y += joint ? 92 : 74;
  lines.push({ text: `Verification: ${verificationUrl}`, x: MARGIN_X, y, size: 8, color: "0 0.35 0.2" });
  y += 13;
  lines.push({ text: `Document fingerprint: ${latestVersion?.document_hash ?? sha256Hex(`${record.reference}:${record.subject}`)}`, x: MARGIN_X, y, size: 7, color: "0.35 0.35 0.35" });
  if (options.dispatchReference) {
    y += 13;
    lines.push({ text: `Dispatch reference: ${options.dispatchReference}`, x: MARGIN_X, y, size: 8, bold: true });
  }

  const pages: PdfTextRun[][] = [[]];
  for (const run of lines) {
    const pageIndex = Math.max(0, Math.floor((run.y - 40) / 720));
    while (pages.length <= pageIndex) pages.push([]);
    pages[pageIndex].push({ ...run, y: run.y - pageIndex * 720 });
  }
  return { pages, watermark: options.mode === "draft" ? "DRAFT" : undefined };
}

export function createCorrespondencePdf(record: LcdboCorrespondenceRecord, options: CorrespondencePdfOptions) {
  const model = buildCorrespondencePdfModel(record, options);
  const streams = model.pages.map((page, index) => pageStream(page, index + 1, model.pages.length, model.watermark));
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${streams.length} /Kids [${streams.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] >>`,
  ];
  streams.forEach((stream, index) => {
    const contentObject = 4 + index * 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${3 + streams.length * 2} 0 R /F2 ${4 + streams.length * 2} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function correspondencePdfHash(bytes: Uint8Array) {
  return sha256Hex(Buffer.from(bytes).toString("base64"));
}
