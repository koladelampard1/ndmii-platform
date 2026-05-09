import type { GeneratedBusinessPlan } from "@/lib/msme/business-plan-generator";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 42;
const RIGHT = PAGE_WIDTH - LEFT;
const TOP = 790;
const BOTTOM = 52;
const GREEN = "0.02 0.47 0.31";
const NAVY = "0.04 0.10 0.24";
const SLATE = "0.12 0.16 0.24";
const MUTED = "0.42 0.47 0.55";
const LIGHT = "0.94 0.98 0.96";
const WHITE = "1 1 1";

type TextOptions = {
  x?: number;
  y: number;
  size?: number;
  bold?: boolean;
  color?: string;
};

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function safeText(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/[()\\]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function color(value: string, target: "fill" | "stroke" = "fill") {
  return `${value} ${target === "fill" ? "rg" : "RG"}`;
}

function rect(x: number, y: number, width: number, height: number, mode: "fill" | "stroke" = "fill") {
  return `${x} ${y} ${width} ${height} re ${mode === "fill" ? "f" : "S"}`;
}

function text(value: string | number | null | undefined, options: TextOptions) {
  return [
    color(options.color ?? SLATE),
    `BT /${options.bold ? "F2" : "F1"} ${options.size ?? 10} Tf ${options.x ?? LEFT} ${options.y} Td (${safeText(value)}) Tj ET`,
  ].join("\n");
}

function wrap(value: string, maxChars: number) {
  const words = safeText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["Not provided by business owner."];
}

function buildPdf(pages: string[]) {
  const objects: string[] = [];
  const pageIds: number[] = [];
  const regularFontId = 3;
  const boldFontId = 4;
  let nextId = 5;

  for (const stream of pages) {
    const contentId = nextId;
    const pageId = nextId + 1;
    objects.push(`${contentId} 0 obj\n<< /Length ${bytes(stream).length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );
    pageIds.push(pageId);
    nextId += 2;
  }

  const header = "%PDF-1.4\n";
  const root = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const pageTree = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`;
  const regularFont = `${regularFontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const boldFont = `${boldFontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;
  const parts = [header, root, pageTree, regularFont, boldFont, ...objects];
  const xref = [0];
  let pdf = "";
  for (const part of parts) {
    xref.push(bytes(pdf).length);
    pdf += part;
  }
  const start = bytes(pdf).length;
  pdf += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < xref.length; index += 1) pdf += `${String(xref[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return bytes(pdf);
}

function addHeader(commands: string[], plan: GeneratedBusinessPlan, pageNumber: number) {
  commands.push(color(WHITE));
  commands.push(rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT));
  commands.push(color(GREEN));
  commands.push(rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8));
  commands.push(text("DBIN Business Plan Builder", { y: 812, size: 9, bold: true, color: GREEN }));
  commands.push(text(plan.businessName, { x: 248, y: 812, size: 9, bold: true, color: NAVY }));
  commands.push(text(`Page ${pageNumber}`, { x: 516, y: 812, size: 8, color: MUTED }));
}

function addFooter(commands: string[], plan: GeneratedBusinessPlan) {
  commands.push(color(MUTED, "stroke"));
  commands.push(`${LEFT} 36 m ${RIGHT} 36 l S`);
  commands.push(text(`DBIN/MSME ID: ${plan.msmeId || "Not provided"} | Generated ${new Date(plan.generatedAt).toLocaleString("en-NG")}`, { y: 20, size: 7, color: MUTED }));
}

export function createBusinessPlanPdf(plan: GeneratedBusinessPlan) {
  const pages: string[] = [];
  let commands: string[] = [];
  let pageNumber = 1;
  let y = TOP;

  const startPage = () => {
    if (commands.length) {
      addFooter(commands, plan);
      pages.push(commands.join("\n"));
    }
    commands = [];
    addHeader(commands, plan, pageNumber);
    pageNumber += 1;
    y = TOP;
  };

  startPage();
  commands.push(color(LIGHT));
  commands.push(rect(LEFT, 610, RIGHT - LEFT, 138));
  commands.push(text("DBIN", { y: 722, size: 12, bold: true, color: GREEN }));
  commands.push(text("BUSINESS PLAN", { y: 690, size: 26, bold: true, color: NAVY }));
  commands.push(text(plan.businessName, { y: 662, size: 16, bold: true, color: SLATE }));
  commands.push(text(`Prepared for: ${plan.purpose.replace(/_/g, " ")}`, { y: 638, size: 10, color: MUTED }));
  commands.push(text(`Generated: ${new Date(plan.generatedAt).toLocaleString("en-NG")}`, { y: 622, size: 9, color: MUTED }));
  y = 565;

  for (const section of plan.sections) {
    const bodyLines = section.body.flatMap((paragraph) => wrap(paragraph, 92));
    const needed = 28 + bodyLines.length * 13 + 12;
    if (y - needed < BOTTOM) startPage();

    commands.push(text(section.title, { y, size: 14, bold: true, color: GREEN }));
    y -= 22;
    for (const line of bodyLines) {
      if (y < BOTTOM) startPage();
      commands.push(text(line, { y, size: 9.5, color: SLATE }));
      y -= 13;
    }
    y -= 12;
  }

  addFooter(commands, plan);
  pages.push(commands.join("\n"));
  return buildPdf(pages);
}

export function businessPlanPdfFilename(businessName: string) {
  const slug = safeText(businessName).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "dbin-business"}-business-plan.pdf`;
}
