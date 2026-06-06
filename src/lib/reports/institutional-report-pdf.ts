type InstitutionalReportPdfInput = {
  title: string;
  reportType: string;
  versionNumber: number;
  generatedAt: string;
  sourceCutoffAt: string;
  status: string;
  scope: Record<string, unknown>;
  sourceSummary: Record<string, unknown>;
  warnings: string[];
  assessments: Array<Record<string, unknown>>;
  fieldVisits: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  indicators: Array<Record<string, unknown>>;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 42;
const TOP = 790;
const BOTTOM = 48;

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/[()\\]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(value: unknown, maxChars = 88) {
  const words = safeText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ["None"];
}

function text(value: unknown, y: number, size = 9, bold = false, x = LEFT) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${safeText(value)}) Tj ET`;
}

function buildPdf(pages: string[]) {
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 5;
  for (const stream of pages) {
    const contentId = nextId;
    const pageId = nextId + 1;
    objects.push(`${contentId} 0 obj\n<< /Length ${bytes(stream).length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    pageIds.push(pageId);
    nextId += 2;
  }
  const parts = [
    "%PDF-1.4\n",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`,
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    ...objects,
  ];
  let pdf = "";
  const offsets = [0];
  for (const part of parts) {
    offsets.push(bytes(pdf).length);
    pdf += part;
  }
  const start = bytes(pdf).length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return bytes(pdf);
}

export function createInstitutionalReportPdf(input: InstitutionalReportPdfInput) {
  const pages: string[] = [];
  let commands: string[] = [];
  let y = TOP;
  let pageNumber = 0;

  const startPage = () => {
    if (commands.length > 0) pages.push(commands.join("\n"));
    commands = [];
    pageNumber += 1;
    y = TOP;
    commands.push(text("DBIN Impact Intelligence Institutional Report", 814, 9, true));
    commands.push(text(`Version ${input.versionNumber} | Page ${pageNumber}`, 814, 8, false, 460));
  };

  const ensure = (height = 18) => {
    if (y - height < BOTTOM) startPage();
  };

  const heading = (value: string) => {
    ensure(30);
    commands.push(text(value, y, 13, true));
    y -= 22;
  };

  const line = (label: string, value: unknown) => {
    for (const wrapped of wrap(`${label}: ${safeText(value)}`)) {
      ensure(14);
      commands.push(text(wrapped, y));
      y -= 13;
    }
  };

  const list = (items: Array<Record<string, unknown>>, formatter: (item: Record<string, unknown>) => string) => {
    if (items.length === 0) {
      line("Status", "No qualified records");
      return;
    }
    for (const item of items) line("-", formatter(item));
  };

  startPage();
  commands.push(text(input.title, y, 21, true));
  y -= 30;
  line("Report type", input.reportType.replaceAll("_", " "));
  line("Lifecycle status", input.status);
  line("Generated", new Date(input.generatedAt).toLocaleString("en-NG"));
  line("Source cutoff", new Date(input.sourceCutoffAt).toLocaleString("en-NG"));

  heading("Report Scope");
  for (const [key, value] of Object.entries(input.scope)) {
    if (value !== null && value !== "") line(key.replaceAll("_", " "), value);
  }

  heading("Qualified Source Summary");
  for (const [key, value] of Object.entries(input.sourceSummary)) line(key.replaceAll("_", " "), value);

  heading("Completeness Warnings");
  if (input.warnings.length === 0) line("Status", "No completeness warnings");
  else for (const warning of input.warnings) line("-", warning);

  heading("Approved Assessments");
  list(input.assessments, (item) => `${item.title ?? "Assessment"} | ${item.assessment_type ?? "type unavailable"} | score ${item.weighted_score ?? "unavailable"} | ${item.readiness_category ?? "unclassified"}`);

  heading("Reviewed Monitoring Visits");
  list(input.fieldVisits, (item) => `${item.title ?? "Field visit"} | ${item.visit_date ?? "date unavailable"} | reviewed`);

  heading("Verified Evidence");
  list(input.evidence, (item) => `${item.original_filename ?? "Evidence"} | ${item.mime_type ?? "type unavailable"} | SHA-256 ${item.checksum_sha256 ?? "unavailable"}`);

  heading("Verified Indicators");
  list(input.indicators, (item) => `${item.indicator_name ?? "Indicator"} | baseline ${item.baseline_value ?? "n/a"} | target ${item.target_value ?? "n/a"} | current ${item.measured_value ?? "n/a"} | ${item.outcome_status ?? "unclassified"}`);

  pages.push(commands.join("\n"));
  return buildPdf(pages);
}

