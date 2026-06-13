type ReportVersionSummary = {
  id: string;
  versionNumber: number;
  generatedAt: string;
  generatedByUserId: string | null;
  sourceCutoffAt: string;
  assessmentCount: number;
  fieldVisitCount: number;
  evidenceCount: number;
  indicatorCount: number;
  warningCount: number;
};

type ReportExportSummary = {
  id: string;
  format: string;
  status: string;
  generatedAt: string | null;
  generatedByUserId: string | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
};

type InstitutionalReportPdfInput = {
  reportId: string;
  title: string;
  summary: string | null;
  reportType: string;
  versionNumber: number;
  versionId: string;
  generatedAt: string;
  generatedByUserId: string | null;
  sourceCutoffAt: string;
  status: string;
  metadata: Record<string, unknown>;
  scope: Record<string, unknown>;
  sourceSummary: Record<string, unknown>;
  warnings: string[];
  assessments: Array<Record<string, unknown>>;
  scoreRunIds: string[];
  fieldVisits: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  indicators: Array<Record<string, unknown>>;
  governance: {
    createdAt: string;
    createdByUserId: string | null;
    submittedAt: string | null;
    submittedByUserId: string | null;
    reviewedAt: string | null;
    reviewedByUserId: string | null;
    approvedAt: string | null;
    approvedByUserId: string | null;
    returnedReason: string | null;
  };
  versions: ReportVersionSummary[];
  exports: ReportExportSummary[];
};

type Tone = "navy" | "green" | "amber" | "red" | "blue" | "slate";
type RGB = [number, number, number];

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 38;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const UNAVAILABLE = "Unavailable";

const COLORS = {
  navy: [0.027, 0.102, 0.227] as RGB,
  navyDeep: [0.016, 0.055, 0.137] as RGB,
  navyLight: [0.063, 0.176, 0.337] as RGB,
  blue: [0.075, 0.302, 0.62] as RGB,
  cyan: [0.055, 0.647, 0.737] as RGB,
  green: [0.024, 0.478, 0.302] as RGB,
  greenBright: [0.063, 0.655, 0.416] as RGB,
  greenLight: [0.91, 0.973, 0.945] as RGB,
  amber: [0.82, 0.467, 0.039] as RGB,
  amberLight: [1, 0.969, 0.875] as RGB,
  red: [0.745, 0.114, 0.169] as RGB,
  redLight: [0.996, 0.925, 0.925] as RGB,
  ink: [0.055, 0.09, 0.165] as RGB,
  body: [0.22, 0.278, 0.365] as RGB,
  muted: [0.42, 0.475, 0.56] as RGB,
  line: [0.855, 0.882, 0.918] as RGB,
  panel: [0.965, 0.973, 0.984] as RGB,
  white: [1, 1, 1] as RGB,
};

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function clean(value: unknown, fallback = UNAVAILABLE) {
  const text = String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/•/g, "-")
    .replace(/·/g, "|")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function pdfText(value: unknown) {
  return clean(value).replace(/([()\\])/g, "\\$1");
}

function humanize(value: unknown) {
  const text = clean(value);
  if (text === UNAVAILABLE) return text;
  return text.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function displayNumber(value: unknown, suffix = "") {
  const numeric = numberValue(value);
  return numeric === null ? UNAVAILABLE : `${numeric.toLocaleString("en-NG", { maximumFractionDigits: 2 })}${suffix}`;
}

function displayDate(value: unknown, includeTime = false) {
  if (typeof value !== "string" || !value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return includeTime
    ? date.toLocaleString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      })
    : date.toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Lagos",
      });
}

function displayBytes(value: unknown) {
  const numeric = numberValue(value);
  if (numeric === null || numeric < 0) return UNAVAILABLE;
  if (numeric < 1024) return `${numeric.toLocaleString("en-NG")} bytes`;
  if (numeric < 1024 * 1024) return `${(numeric / 1024).toFixed(1)} KB`;
  return `${(numeric / (1024 * 1024)).toFixed(1)} MB`;
}

function truncate(value: unknown, length: number) {
  const text = clean(value);
  return text.length <= length ? text : `${text.slice(0, Math.max(1, length - 3))}...`;
}

function wrapText(value: unknown, width: number, size: number, maxLines = Number.POSITIVE_INFINITY) {
  const text = clean(value);
  const maxChars = Math.max(8, Math.floor(width / (size * 0.52)));
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const chunks = word.length > maxChars
      ? word.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [word]
      : [word];
    for (const chunk of chunks) {
      const candidate = line ? `${line} ${chunk}` : chunk;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = chunk;
      } else {
        line = candidate;
      }
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = truncate(lines[maxLines - 1], Math.max(4, maxChars));
  }
  return lines.length > 0 ? lines : [UNAVAILABLE];
}

function color(rgb: RGB, stroke = false) {
  return `${rgb.join(" ")} ${stroke ? "RG" : "rg"}`;
}

function topY(top: number) {
  return PAGE_HEIGHT - top;
}

function rectPath(x: number, top: number, width: number, height: number) {
  return `${x} ${PAGE_HEIGHT - top - height} ${width} ${height} re`;
}

function roundedRectPath(x: number, top: number, width: number, height: number, radius = 8) {
  const y = PAGE_HEIGHT - top - height;
  const r = Math.min(radius, width / 2, height / 2);
  const k = r * 0.5522847498;
  return [
    `${x + r} ${y} m`,
    `${x + width - r} ${y} l`,
    `${x + width - r + k} ${y} ${x + width} ${y + r - k} ${x + width} ${y + r} c`,
    `${x + width} ${y + height - r} l`,
    `${x + width} ${y + height - r + k} ${x + width - r + k} ${y + height} ${x + width - r} ${y + height} c`,
    `${x + r} ${y + height} l`,
    `${x + r - k} ${y + height} ${x} ${y + height - r + k} ${x} ${y + height - r} c`,
    `${x} ${y + r} l`,
    `${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c`,
    "h",
  ].join("\n");
}

class PdfPage {
  commands: string[] = [];

  fillRect(x: number, top: number, width: number, height: number, fill: RGB, radius = 0) {
    const path = radius > 0 ? roundedRectPath(x, top, width, height, radius) : rectPath(x, top, width, height);
    this.commands.push("q", color(fill), path, "f", "Q");
  }

  strokeRect(x: number, top: number, width: number, height: number, stroke: RGB, radius = 0, lineWidth = 0.8) {
    const path = radius > 0 ? roundedRectPath(x, top, width, height, radius) : rectPath(x, top, width, height);
    this.commands.push("q", color(stroke, true), `${lineWidth} w`, path, "S", "Q");
  }

  line(x1: number, top1: number, x2: number, top2: number, stroke: RGB, lineWidth = 0.8) {
    this.commands.push(
      "q",
      color(stroke, true),
      `${lineWidth} w`,
      `${x1} ${topY(top1)} m ${x2} ${topY(top2)} l S`,
      "Q",
    );
  }

  circle(x: number, top: number, radius: number, fill: RGB, stroke?: RGB, lineWidth = 0.8) {
    const y = PAGE_HEIGHT - top;
    const k = radius * 0.5522847498;
    const path = [
      `${x + radius} ${y} m`,
      `${x + radius} ${y + k} ${x + k} ${y + radius} ${x} ${y + radius} c`,
      `${x - k} ${y + radius} ${x - radius} ${y + k} ${x - radius} ${y} c`,
      `${x - radius} ${y - k} ${x - k} ${y - radius} ${x} ${y - radius} c`,
      `${x + k} ${y - radius} ${x + radius} ${y - k} ${x + radius} ${y} c`,
      "h",
    ].join("\n");
    this.commands.push("q", color(fill), ...(stroke ? [color(stroke, true), `${lineWidth} w`] : []), path, stroke ? "B" : "f", "Q");
  }

  polygon(points: Array<[number, number]>, fill: RGB, stroke?: RGB, lineWidth = 0.8) {
    if (points.length < 3) return;
    const [first, ...rest] = points;
    const path = [
      `${first[0]} ${topY(first[1])} m`,
      ...rest.map(([x, top]) => `${x} ${topY(top)} l`),
      "h",
    ].join("\n");
    this.commands.push("q", color(fill), ...(stroke ? [color(stroke, true), `${lineWidth} w`] : []), path, stroke ? "B" : "f", "Q");
  }

  text(value: unknown, x: number, top: number, size = 9, options: {
    bold?: boolean;
    fill?: RGB;
    align?: "left" | "center" | "right";
    width?: number;
  } = {}) {
    const text = clean(value);
    const estimatedWidth = text.length * size * 0.5;
    const width = options.width ?? 0;
    const adjustedX = options.align === "right"
      ? x + width - estimatedWidth
      : options.align === "center"
        ? x + (width - estimatedWidth) / 2
        : x;
    this.commands.push(
      "q",
      color(options.fill ?? COLORS.body),
      `BT /${options.bold ? "F2" : "F1"} ${size} Tf ${Math.max(x, adjustedX)} ${PAGE_HEIGHT - top - size} Td (${pdfText(text)}) Tj ET`,
      "Q",
    );
  }

  wrappedText(value: unknown, x: number, top: number, width: number, size = 9, options: {
    bold?: boolean;
    fill?: RGB;
    lineHeight?: number;
    maxLines?: number;
  } = {}) {
    const lineHeight = options.lineHeight ?? size * 1.35;
    const lines = wrapText(value, width, size, options.maxLines);
    lines.forEach((line, index) => this.text(line, x, top + index * lineHeight, size, options));
    return lines.length * lineHeight;
  }
}

type PageRecord = { page: PdfPage; section: string; cover?: boolean };

class ReportDocument {
  pages: PageRecord[] = [];
  private current!: PdfPage;
  private section = "";
  cursor = 0;

  addPage(section: string, options: { cover?: boolean; continuation?: boolean } = {}) {
    this.current = new PdfPage();
    this.section = section;
    this.pages.push({ page: this.current, section, cover: options.cover });
    if (options.cover) {
      this.cursor = 0;
      return this.current;
    }
    this.current.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.white);
    this.current.fillRect(0, 0, PAGE_WIDTH, 58, COLORS.navy);
    this.current.fillRect(0, 58, PAGE_WIDTH, 4, COLORS.cyan);
    this.current.text("DBIN", MARGIN, 16, 16, { bold: true, fill: COLORS.white });
    this.current.text("IMPACT INTELLIGENCE", MARGIN + 51, 20, 7, { bold: true, fill: [0.66, 0.86, 0.93] });
    this.current.text(options.continuation ? `${section} / CONTINUED` : section, MARGIN, 76, 8, { bold: true, fill: COLORS.blue });
    this.cursor = 98;
    return this.current;
  }

  addDivider(kicker: string, title: string, number: string, description: string, accent: RGB = COLORS.cyan) {
    const page = this.addPage(title, { cover: true });
    page.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.navyDeep);
    page.fillRect(0, 0, PAGE_WIDTH, 10, accent);
    page.fillRect(390, 0, 205, PAGE_HEIGHT, COLORS.navy);
    page.fillRect(430, 0, 165, PAGE_HEIGHT, COLORS.navyLight);
    page.circle(492, 170, 118, [0.07, 0.25, 0.43]);
    page.circle(492, 170, 78, COLORS.navyLight);
    page.circle(492, 170, 42, accent);
    page.text(number, 55, 120, 74, { bold: true, fill: [0.12, 0.31, 0.47] });
    page.text(kicker.toUpperCase(), 58, 245, 8, { bold: true, fill: accent });
    page.wrappedText(title, 55, 278, 400, 31, { bold: true, fill: COLORS.white, lineHeight: 37, maxLines: 3 });
    page.fillRect(55, 425, 76, 5, accent);
    page.wrappedText(description, 55, 463, 385, 11, { fill: [0.76, 0.84, 0.91], lineHeight: 17, maxLines: 6 });
    page.text("DBIN IMPACT INTELLIGENCE", 55, 780, 7, { bold: true, fill: [0.45, 0.67, 0.78] });
    page.text("BOARD REPORT", 55, 799, 7, { bold: true, fill: COLORS.white });
  }

  page() {
    return this.current;
  }

  ensure(height: number) {
    if (this.cursor + height > 790) this.addPage(this.section, { continuation: true });
  }

  sectionTitle(title: string, description?: string) {
    this.ensure(description ? 68 : 48);
    this.current.text(title, MARGIN, this.cursor, 20, { bold: true, fill: COLORS.ink });
    this.cursor += 30;
    if (description) {
      const height = this.current.wrappedText(description, MARGIN, this.cursor, CONTENT_WIDTH, 9, {
        fill: COLORS.muted,
        lineHeight: 13,
      });
      this.cursor += height + 12;
    } else {
      this.cursor += 10;
    }
  }

  badge(value: unknown, x: number, top: number, tone?: Tone, width = 82) {
    const label = humanize(value);
    const selected = tone ?? statusTone(label);
    const styles: Record<Tone, { bg: RGB; fg: RGB }> = {
      navy: { bg: COLORS.navy, fg: COLORS.white },
      green: { bg: COLORS.greenLight, fg: COLORS.green },
      amber: { bg: COLORS.amberLight, fg: [0.58, 0.31, 0.02] },
      red: { bg: COLORS.redLight, fg: COLORS.red },
      blue: { bg: [0.91, 0.945, 0.996], fg: COLORS.blue },
      slate: { bg: COLORS.panel, fg: COLORS.muted },
    };
    this.current.fillRect(x, top, width, 20, styles[selected].bg, 10);
    this.current.text(truncate(label, 20), x, top + 5, 7, {
      bold: true,
      fill: styles[selected].fg,
      align: "center",
      width,
    });
  }

  note(value: unknown, tone: "info" | "warning" | "danger" | "success" = "info") {
    const styles = {
      info: { bg: [0.925, 0.953, 0.996] as RGB, bar: COLORS.blue },
      warning: { bg: COLORS.amberLight, bar: COLORS.amber },
      danger: { bg: COLORS.redLight, bar: COLORS.red },
      success: { bg: COLORS.greenLight, bar: COLORS.green },
    };
    const lines = wrapText(value, CONTENT_WIDTH - 34, 8.5);
    const height = Math.max(38, 20 + lines.length * 11);
    this.ensure(height + 8);
    const top = this.cursor;
    this.current.fillRect(MARGIN, top, CONTENT_WIDTH, height, styles[tone].bg, 7);
    this.current.fillRect(MARGIN, top, 5, height, styles[tone].bar, 3);
    lines.forEach((line, index) => this.current.text(line, MARGIN + 18, top + 11 + index * 11, 8.5, { fill: COLORS.body }));
    this.cursor += height + 8;
  }

  keyValueGrid(items: Array<{ label: string; value: unknown }>, columns = 2) {
    const gap = 10;
    const width = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
    const rows = Math.ceil(items.length / columns);
    for (let row = 0; row < rows; row += 1) {
      const rowItems = items.slice(row * columns, row * columns + columns);
      const heights = rowItems.map((item) => 35 + wrapText(item.value, width - 24, 9, 3).length * 12);
      const height = Math.max(...heights, 58);
      this.ensure(height + gap);
      rowItems.forEach((item, column) => {
        const x = MARGIN + column * (width + gap);
        this.current.fillRect(x, this.cursor, width, height, COLORS.panel, 8);
        this.current.text(item.label.toUpperCase(), x + 12, this.cursor + 11, 6.5, { bold: true, fill: COLORS.muted });
        this.current.wrappedText(item.value, x + 12, this.cursor + 29, width - 24, 9, {
          bold: true,
          fill: COLORS.ink,
          lineHeight: 12,
          maxLines: 3,
        });
      });
      this.cursor += height + gap;
    }
  }

  table(
    columns: Array<{ label: string; width: number; align?: "left" | "right" | "center" }>,
    rows: unknown[][],
    options: { empty?: string; fontSize?: number; section?: string } = {},
  ) {
    if (rows.length === 0) {
      this.note(options.empty ?? "No qualified records were available.", "warning");
      return;
    }
    const fontSize = options.fontSize ?? 7.2;
    const headerHeight = 30;
    const drawHeader = () => {
      this.ensure(headerHeight + 20);
      this.current.fillRect(MARGIN, this.cursor, CONTENT_WIDTH, headerHeight, COLORS.navy, 5);
      let x = MARGIN;
      columns.forEach((column) => {
        this.current.wrappedText(column.label.toUpperCase(), x + 6, this.cursor + 8, column.width - 12, 6.2, {
          bold: true,
          fill: COLORS.white,
          lineHeight: 8,
          maxLines: 2,
        });
        x += column.width;
      });
      this.cursor += headerHeight;
    };
    drawHeader();
    rows.forEach((row, rowIndex) => {
      const cellLines = columns.map((column, index) => wrapText(row[index], column.width - 12, fontSize, 5));
      const rowHeight = Math.max(29, 14 + Math.max(...cellLines.map((lines) => lines.length)) * (fontSize + 2));
      if (this.cursor + rowHeight > 790) {
        this.addPage(options.section ?? this.section, { continuation: true });
        drawHeader();
      }
      if (rowIndex % 2 === 0) this.current.fillRect(MARGIN, this.cursor, CONTENT_WIDTH, rowHeight, [0.978, 0.982, 0.99]);
      this.current.strokeRect(MARGIN, this.cursor, CONTENT_WIDTH, rowHeight, COLORS.line, 0, 0.45);
      let x = MARGIN;
      columns.forEach((column, index) => {
        if (index > 0) this.current.line(x, this.cursor, x, this.cursor + rowHeight, COLORS.line, 0.45);
        cellLines[index].forEach((line, lineIndex) => {
          this.current.text(line, x + 6, this.cursor + 8 + lineIndex * (fontSize + 2), fontSize, {
            fill: COLORS.body,
            align: column.align,
            width: column.width - 12,
          });
        });
        x += column.width;
      });
      this.cursor += rowHeight;
    });
    this.cursor += 10;
  }

  finalize(versionNumber: number, sourceCutoffAt: string) {
    const total = this.pages.length;
    this.pages.forEach(({ page, cover }, index) => {
      if (cover) return;
      page.line(MARGIN, 807, PAGE_WIDTH - MARGIN, 807, COLORS.line, 0.6);
      page.text(`DBIN Impact Intelligence | Version ${versionNumber} | Source cutoff ${displayDate(sourceCutoffAt, true)}`, MARGIN, 817, 6.5, {
        fill: COLORS.muted,
      });
      page.text(`Page ${index + 1} of ${total}`, PAGE_WIDTH - MARGIN - 70, 817, 6.5, {
        fill: COLORS.muted,
        align: "right",
        width: 70,
      });
    });
  }
}

function statusTone(value: unknown): Tone {
  const status = clean(value).toLowerCase();
  if (["approved", "verified", "generated", "ready", "healthy", "complete", "completed", "reviewed"].includes(status)) return "green";
  if (["returned", "rejected", "blocked", "failed", "not ready", "incomplete"].includes(status)) return "red";
  if (["warning", "pending", "draft", "unavailable"].includes(status)) return "amber";
  if (["in review", "in_review", "submitted"].includes(status)) return "blue";
  return "slate";
}

function metadataNumber(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = numberValue(metadata[key]);
    if (value !== null) return value;
  }
  return null;
}

function reportingPeriod(metadata: Record<string, unknown>) {
  const start = metadata.reporting_period_start;
  const end = metadata.reporting_period_end;
  if (typeof start === "string" && typeof end === "string") return `${displayDate(start)} - ${displayDate(end)}`;
  return typeof metadata.reporting_period === "string" ? clean(metadata.reporting_period) : UNAVAILABLE;
}

function sourceCount(summary: Record<string, unknown>, key: string) {
  return numberValue(summary[key]);
}

function uniqueInterventions(input: InstitutionalReportPdfInput) {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value) ids.add(value);
  };
  add(input.scope.intervention_id);
  input.assessments.forEach((item) => add(item.intervention_id));
  input.fieldVisits.forEach((item) => add(item.intervention_id));
  input.evidence.forEach((item) => add(item.intervention_id));
  return ids.size > 0 ? ids.size : null;
}

function assuranceState(input: InstitutionalReportPdfInput) {
  const approved = input.status === "approved";
  const hasEvidence = input.evidence.length > 0;
  const hasIndicators = input.indicators.length > 0;
  if (approved && hasEvidence && hasIndicators && input.warnings.length === 0) return "Ready";
  if (!approved || input.warnings.length > 0 || !hasEvidence || !hasIndicators) return "Review Needed";
  return UNAVAILABLE;
}

function reportHealth(input: InstitutionalReportPdfInput) {
  if (input.status !== "approved") return { label: "Not Approved", tone: "amber" as Tone };
  if (input.evidence.length === 0 || input.indicators.length === 0) return { label: "Assurance Gap", tone: "red" as Tone };
  if (input.warnings.length > 0) return { label: "Approved With Warnings", tone: "amber" as Tone };
  return { label: "Executive Ready", tone: "green" as Tone };
}

function evidenceSupport(input: InstitutionalReportPdfInput) {
  if (input.evidence.length === 0) return "No verified evidence in version";
  return "Version evidence present; direct indicator linkage unavailable";
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => clean(item, "")).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function geographyLabels(input: InstitutionalReportPdfInput) {
  const labels = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) labels.add(clean(value));
  };
  ["state", "lga", "location", "location_text"].forEach((key) => {
    add(input.scope[key]);
    add(input.metadata[key]);
  });
  stringList(input.metadata.states).forEach(add);
  stringList(input.metadata.lgas).forEach(add);
  stringList(input.metadata.geographic_coverage).forEach(add);
  input.fieldVisits.forEach((visit) => {
    add(visit.state);
    add(visit.lga);
    add(visit.location);
    add(visit.location_text);
  });
  input.evidence.forEach((item) => {
    add(item.state);
    add(item.lga);
    add(item.location);
  });
  return Array.from(labels);
}

function evidenceNarratives(input: InstitutionalReportPdfInput) {
  if (input.status !== "approved") return [];
  return input.evidence.flatMap((item) => {
    const narrative = [item.narrative, item.description, item.story, item.note]
      .find((value) => typeof value === "string" && value.trim().length >= 24);
    if (!narrative) return [];
    return [{
      title: item.story_title ?? item.title ?? item.original_filename,
      narrative,
      beneficiary: item.beneficiary_name ?? item.msme_name ?? input.scope.msme_name,
      location: item.location ?? item.lga ?? item.state,
      evidenceId: item.evidence_id,
    }];
  }).slice(0, 4);
}

const NIGERIA_STATE_POINTS: Record<string, [number, number]> = {
  abia: [355, 472], adamawa: [397, 347], "akwa ibom": [360, 505], anambra: [327, 459],
  bauchi: [337, 332], bayelsa: [299, 503], benue: [350, 409], borno: [421, 276],
  "cross river": [381, 479], delta: [296, 467], ebonyi: [358, 450], edo: [286, 430],
  ekiti: [251, 400], enugu: [340, 439], gombe: [370, 322], imo: [337, 479],
  jigawa: [307, 256], kaduna: [284, 320], kano: [297, 279], katsina: [273, 241],
  kebbi: [211, 286], kogi: [294, 395], kwara: [244, 361], lagos: [215, 430],
  nasarawa: [325, 378], niger: [247, 330], ogun: [226, 414], ondo: [264, 426],
  osun: [244, 408], oyo: [221, 392], plateau: [342, 354], rivers: [329, 499],
  sokoto: [222, 250], taraba: [391, 382], yobe: [391, 289], zamfara: [253, 278],
  "federal capital territory": [302, 359], fct: [302, 359], abuja: [302, 359],
};

function buildPdf(pageStreams: string[]) {
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 5;
  for (const stream of pageStreams) {
    const contentId = nextId;
    const pageId = nextId + 1;
    objects.push(`${contentId} 0 obj\n<< /Length ${bytes(stream).length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    pageIds.push(pageId);
    nextId += 2;
  }
  const objectsInOrder = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`,
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
    ...objects,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const part of objectsInOrder) {
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

function addCover(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  const page = doc.addPage("Cover", { cover: true });
  page.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.navyDeep);
  page.fillRect(0, 0, 11, PAGE_HEIGHT, COLORS.greenBright);
  page.fillRect(11, 0, 5, PAGE_HEIGHT, COLORS.cyan);
  page.polygon([[360, 0], [595, 0], [595, 285], [430, 238]], COLORS.navyLight);
  page.polygon([[430, 0], [595, 0], [595, 180], [490, 154]], COLORS.blue);
  page.polygon([[500, 0], [595, 0], [595, 96], [535, 84]], COLORS.cyan);
  page.circle(492, 193, 88, [0.08, 0.24, 0.41]);
  page.circle(492, 193, 55, COLORS.navyLight);
  page.circle(492, 193, 25, COLORS.greenBright);

  page.text("DBIN", 54, 60, 26, { bold: true, fill: COLORS.white });
  page.text("BOI DIGITAL INNOVATION NETWORK", 55, 96, 8, { bold: true, fill: [0.62, 0.83, 0.91] });
  page.fillRect(55, 153, 172, 24, [0.06, 0.24, 0.39], 12);
  page.text("IMPACT INTELLIGENCE REPORT", 55, 160, 7, { bold: true, fill: COLORS.cyan, align: "center", width: 172 });
  page.wrappedText(input.title, 55, 207, 425, 29, {
    bold: true,
    fill: COLORS.white,
    lineHeight: 35,
    maxLines: 4,
  });
  page.fillRect(55, 365, 82, 5, COLORS.greenBright);
  page.wrappedText(input.summary ?? "Institutional impact assurance report generated from governed programme sources.", 55, 398, 425, 11, {
    fill: [0.77, 0.84, 0.91],
    lineHeight: 16,
    maxLines: 4,
  });
  const health = reportHealth(input);
  const healthColor = health.tone === "green" ? COLORS.greenBright : health.tone === "red" ? COLORS.red : COLORS.amber;
  page.fillRect(380, 335, 145, 48, [0.04, 0.15, 0.27], 24);
  page.circle(401, 359, 9, healthColor);
  page.text("REPORT HEALTH", 418, 346, 6, { bold: true, fill: [0.54, 0.72, 0.82] });
  page.text(health.label, 418, 361, 9, { bold: true, fill: COLORS.white });

  const details = [
    ["PROGRAMME", input.scope.programme_name],
    ["REPORTING PERIOD", reportingPeriod(input.metadata)],
    ["REPORT STATUS", humanize(input.status)],
    ["VERSION", `Version ${input.versionNumber}`],
    ["GENERATED", displayDate(input.generatedAt, true)],
  ];
  let top = 520;
  details.forEach(([label, value]) => {
    page.text(label, 55, top, 7, { bold: true, fill: [0.45, 0.7, 0.81] });
    page.text(value, 185, top - 1, 10, { bold: true, fill: COLORS.white });
    page.line(55, top + 19, 515, top + 19, [0.15, 0.27, 0.41], 0.6);
    top += 45;
  });
  page.text("PREPARED BY", 55, 758, 7, { bold: true, fill: [0.45, 0.7, 0.81] });
  page.text("DBIN Impact Intelligence Platform", 55, 776, 11, { bold: true, fill: COLORS.white });
  page.text(`Report ID ${input.reportId}`, 55, 808, 6.5, { fill: [0.55, 0.66, 0.76] });
}

function addDashboard(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Executive Dashboard");
  doc.sectionTitle("Executive Dashboard", "A concise view of programme scope, qualified sources, verification coverage, and executive readiness.");
  const page = doc.page();
  const cardWidth = (CONTENT_WIDTH - 24) / 4;
  const cards = [
    { label: "Programme / Cohort", value: input.scope.cohort_name ? "1 / 1" : "1 / Unavailable", tone: COLORS.blue },
    {
      label: "Beneficiaries Reached",
      value: displayNumber(metadataNumber(input.metadata, ["beneficiaries_reached", "beneficiary_count", "msmes_reached", "msme_count"])),
      tone: COLORS.cyan,
    },
    { label: "Interventions", value: displayNumber(uniqueInterventions(input)), tone: COLORS.green },
    { label: "Assessments", value: displayNumber(sourceCount(input.sourceSummary, "approved_assessments")), tone: [0.35, 0.25, 0.7] as RGB },
    { label: "Monitoring Visits", value: displayNumber(sourceCount(input.sourceSummary, "reviewed_field_visits")), tone: COLORS.blue },
    { label: "Verified Evidence", value: displayNumber(sourceCount(input.sourceSummary, "verified_evidence")), tone: COLORS.green },
    { label: "Verified Indicators", value: displayNumber(sourceCount(input.sourceSummary, "verified_indicator_measurements")), tone: COLORS.cyan },
    { label: "Executive Readiness", value: assuranceState(input), tone: input.warnings.length === 0 ? COLORS.green : COLORS.amber },
  ];
  cards.forEach((card, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = MARGIN + column * (cardWidth + 8);
    const top = doc.cursor + row * 94;
    page.fillRect(x, top, cardWidth, 82, COLORS.white, 9);
    page.strokeRect(x, top, cardWidth, 82, COLORS.line, 9);
    page.fillRect(x, top, 5, 82, card.tone, 4);
    page.text(card.label.toUpperCase(), x + 16, top + 14, 6.3, { bold: true, fill: COLORS.muted });
    page.wrappedText(card.value, x + 16, top + 37, cardWidth - 28, card.value.length > 10 ? 11 : 18, {
      bold: true,
      fill: COLORS.ink,
      lineHeight: 13,
      maxLines: 2,
    });
  });
  doc.cursor += 196;
  const health = reportHealth(input);
  const healthColor = health.tone === "green" ? COLORS.green : health.tone === "red" ? COLORS.red : COLORS.amber;
  page.fillRect(MARGIN, doc.cursor, CONTENT_WIDTH, 82, COLORS.navy, 12);
  page.circle(MARGIN + 48, doc.cursor + 41, 27, [0.08, 0.24, 0.39]);
  page.circle(MARGIN + 48, doc.cursor + 41, 17, healthColor);
  page.text("EXECUTIVE REPORT HEALTH", MARGIN + 88, doc.cursor + 17, 7, { bold: true, fill: [0.57, 0.77, 0.86] });
  page.text(health.label, MARGIN + 88, doc.cursor + 36, 17, { bold: true, fill: COLORS.white });
  page.text(
    `${input.evidence.length} verified evidence | ${input.indicators.length} verified indicators | ${input.warnings.length} warnings`,
    MARGIN + 88,
    doc.cursor + 61,
    7.5,
    { fill: [0.73, 0.82, 0.89] },
  );
  doc.badge(input.status, PAGE_WIDTH - MARGIN - 92, doc.cursor + 30, undefined, 92);
  doc.cursor += 96;
  doc.keyValueGrid([
    { label: "Programme", value: input.scope.programme_name },
    { label: "Cohort", value: input.scope.cohort_name },
    { label: "Beneficiary / MSME Scope", value: input.scope.msme_name ?? input.scope.dbin_msme_id },
    { label: "Intervention Scope", value: input.scope.intervention_title },
    { label: "Approval / Export Status", value: input.status === "approved" ? "Approved and export-ready" : humanize(input.status) },
    { label: "Assurance State", value: assuranceState(input) },
  ], 3);
  doc.note(
    input.warnings.length === 0
      ? "No completeness warnings were recorded in the immutable report version."
      : `${input.warnings.length} completeness warning(s) require executive attention. See Risk & Completeness.`,
    input.warnings.length === 0 ? "success" : "warning",
  );
}

function addExecutiveSummary(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Executive Summary");
  doc.sectionTitle("Executive Summary", "Deterministic summary generated exclusively from the immutable report version and recorded governance metadata.");
  const delivered = [
    `${input.assessments.length} approved assessment(s)`,
    `${input.fieldVisits.length} reviewed monitoring visit(s)`,
    `${input.evidence.length} verified evidence record(s)`,
    `${input.indicators.length} verified indicator measurement(s)`,
  ].join(", ");
  const summaryBlocks = [
    {
      title: "What was assessed",
      text: input.assessments.length > 0
        ? `${input.assessments.length} approved assessment(s) within the ${clean(input.scope.programme_name)} report scope were included. ${input.scoreRunIds.length} review score run(s) supported the assessment set.`
        : "No approved assessments were available in the immutable report version.",
      tone: COLORS.blue,
    },
    {
      title: "What was delivered",
      text: `The report version captured ${delivered}. The source cutoff was ${displayDate(input.sourceCutoffAt, true)}.`,
      tone: COLORS.cyan,
    },
    {
      title: "What was verified",
      text: input.evidence.length + input.indicators.length > 0
        ? `${input.evidence.length} evidence record(s) and ${input.indicators.length} indicator measurement(s) carry verified status in the report version.`
        : "No verified evidence or indicator measurements were available.",
      tone: COLORS.green,
    },
    {
      title: "What remains unavailable or incomplete",
      text: input.warnings.length > 0
        ? input.warnings.join(" ")
        : "No completeness gaps were recorded. Fields not captured by governed sources are shown as Unavailable throughout this report.",
      tone: COLORS.amber,
    },
    {
      title: "Key risks and warnings",
      text: input.warnings.length > 0
        ? `${input.warnings.length} warning(s) are recorded. No claims beyond verified indicator measurements should be inferred.`
        : "No version-level warnings were recorded. Direct evidence-to-indicator linkage is not asserted unless explicitly available.",
      tone: input.warnings.length > 0 ? COLORS.red : COLORS.green,
    },
  ];
  summaryBlocks.forEach((block) => {
    const lines = wrapText(block.text, CONTENT_WIDTH - 42, 9, 6);
    const height = 43 + lines.length * 12;
    doc.ensure(height + 10);
    const page = doc.page();
    page.fillRect(MARGIN, doc.cursor, CONTENT_WIDTH, height, COLORS.white, 9);
    page.strokeRect(MARGIN, doc.cursor, CONTENT_WIDTH, height, COLORS.line, 9);
    page.fillRect(MARGIN, doc.cursor, 6, height, block.tone, 4);
    page.text(block.title, MARGIN + 20, doc.cursor + 14, 11, { bold: true, fill: COLORS.ink });
    page.wrappedText(block.text, MARGIN + 20, doc.cursor + 36, CONTENT_WIDTH - 42, 9, {
      fill: COLORS.body,
      lineHeight: 12,
      maxLines: 6,
    });
    doc.cursor += height + 10;
  });
}

function addTheoryOfChange(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Theory of Change / Impact Logic");
  doc.sectionTitle("Theory of Change / Impact Logic", "A governed source map from programme support through verified outcomes. This is a source logic view, not a causal attribution claim.");
  const stages = [
    {
      label: "Inputs",
      value: input.scope.intervention_title
        ? `Programme: ${clean(input.scope.programme_name)}. Intervention support: ${clean(input.scope.intervention_title)}.`
        : `Programme support: ${clean(input.scope.programme_name)}. Intervention detail: ${UNAVAILABLE}.`,
      count: uniqueInterventions(input),
      color: COLORS.navyLight,
    },
    {
      label: "Activities",
      value: `${input.assessments.length} approved assessment(s) and ${input.fieldVisits.length} reviewed field or monitoring visit(s).`,
      count: input.assessments.length + input.fieldVisits.length,
      color: COLORS.blue,
    },
    {
      label: "Outputs",
      value: `${input.evidence.length} verified evidence record(s) and ${input.fieldVisits.length} reviewed activity record(s).`,
      count: input.evidence.length,
      color: COLORS.cyan,
    },
    {
      label: "Outcomes",
      value: `${input.indicators.length} verified indicator measurement(s) with recorded outcome status.`,
      count: input.indicators.length,
      color: COLORS.green,
    },
    {
      label: "Impact",
      value: input.status === "approved"
        ? `${input.indicators.length} approved report claim(s), limited to verified indicator measurements.`
        : "Approved impact claims are unavailable because the report is not approved.",
      count: input.status === "approved" ? input.indicators.length : null,
      color: input.status === "approved" ? COLORS.green : COLORS.amber,
    },
  ];
  const page = doc.page();
  const boxWidth = 92;
  const gap = 14.4;
  const top = doc.cursor + 12;
  stages.forEach((stage, index) => {
    const x = MARGIN + index * (boxWidth + gap);
    page.fillRect(x, top, boxWidth, 228, COLORS.white, 10);
    page.strokeRect(x, top, boxWidth, 228, COLORS.line, 10);
    page.fillRect(x, top, boxWidth, 43, stage.color, 10);
    page.text(stage.label.toUpperCase(), x, top + 15, 8, { bold: true, fill: COLORS.white, align: "center", width: boxWidth });
    page.text(displayNumber(stage.count), x, top + 67, 24, { bold: true, fill: stage.color, align: "center", width: boxWidth });
    page.wrappedText(stage.value, x + 10, top + 111, boxWidth - 20, 8, {
      fill: COLORS.body,
      lineHeight: 11,
      maxLines: 9,
    });
    if (index < stages.length - 1) {
      const arrowX = x + boxWidth + 3;
      page.line(arrowX, top + 112, arrowX + 8, top + 112, COLORS.muted, 1.2);
      page.line(arrowX + 5, top + 108, arrowX + 9, top + 112, COLORS.muted, 1.2);
      page.line(arrowX + 5, top + 116, arrowX + 9, top + 112, COLORS.muted, 1.2);
    }
  });
  doc.cursor = top + 255;
  doc.note("Interpretation boundary: the report presents qualified records and verified measurements. It does not infer causality, additional beneficiaries, or unrecorded impact.", "info");
  doc.keyValueGrid([
    { label: "Source qualification", value: "Approved assessments, reviewed visits, verified evidence, and verified measurements only" },
    { label: "Impact claim boundary", value: input.indicators.length > 0 ? `${input.indicators.length} verified measurement(s)` : UNAVAILABLE },
    { label: "Source cutoff", value: displayDate(input.sourceCutoffAt, true) },
    { label: "Approval state", value: humanize(input.status) },
  ], 2);
}

function addGeographicImpact(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  const labels = geographyLabels(input);
  doc.addPage("Nigeria Geographic Impact");
  doc.sectionTitle("Nigeria Geographic Impact", "Geographic coverage shown only where location fields exist in the governed report content.");
  const page = doc.page();
  if (labels.length === 0) {
    page.fillRect(MARGIN, doc.cursor, CONTENT_WIDTH, 360, COLORS.panel, 14);
    page.polygon([
      [265, doc.cursor + 58], [335, doc.cursor + 44], [393, doc.cursor + 83], [421, doc.cursor + 151],
      [400, doc.cursor + 221], [363, doc.cursor + 274], [323, doc.cursor + 326], [267, doc.cursor + 303],
      [219, doc.cursor + 265], [183, doc.cursor + 206], [199, doc.cursor + 137], [228, doc.cursor + 86],
    ], [0.87, 0.9, 0.93], COLORS.line, 1.2);
    page.text("GEOGRAPHIC COVERAGE", MARGIN, doc.cursor + 385, 7, { bold: true, fill: COLORS.muted });
    page.text(UNAVAILABLE, MARGIN, doc.cursor + 405, 18, { bold: true, fill: COLORS.ink });
    page.wrappedText("No state, LGA, or location field was present in the immutable report content. No geographic reach has been inferred.", MARGIN, doc.cursor + 438, CONTENT_WIDTH, 9, {
      fill: COLORS.body,
      lineHeight: 13,
      maxLines: 3,
    });
    doc.cursor += 500;
    return;
  }

  page.fillRect(MARGIN, doc.cursor, 340, 490, [0.955, 0.973, 0.968], 14);
  page.text("NIGERIA PROGRAMME FOOTPRINT", MARGIN + 18, doc.cursor + 17, 7, { bold: true, fill: COLORS.green });
  const mapTop = doc.cursor + 42;
  page.polygon([
    [243, mapTop + 35], [306, mapTop + 21], [372, mapTop + 45], [409, mapTop + 100],
    [421, mapTop + 170], [393, mapTop + 235], [368, mapTop + 300], [331, mapTop + 366],
    [278, mapTop + 348], [228, mapTop + 316], [194, mapTop + 267], [173, mapTop + 210],
    [184, mapTop + 145], [207, mapTop + 87],
  ], [0.86, 0.93, 0.89], [0.52, 0.7, 0.59], 1.2);
  labels.forEach((label, index) => {
    const normalized = label.toLowerCase().replace(/\s+state$/, "");
    const known = Object.entries(NIGERIA_STATE_POINTS).find(([state]) => normalized.includes(state));
    const point = known?.[1] ?? [225 + (index % 4) * 42, mapTop + 405 + Math.floor(index / 4) * 18];
    page.circle(point[0], known ? mapTop + point[1] - 215 : point[1], known ? 6 : 4, COLORS.greenBright, COLORS.white, 1);
  });

  const sideX = MARGIN + 358;
  page.fillRect(sideX, doc.cursor, CONTENT_WIDTH - 358, 490, COLORS.navy, 14);
  page.text("RECORDED LOCATIONS", sideX + 17, doc.cursor + 18, 7, { bold: true, fill: [0.58, 0.78, 0.87] });
  page.text(labels.length, sideX + 17, doc.cursor + 43, 28, { bold: true, fill: COLORS.white });
  page.text("location reference(s)", sideX + 17, doc.cursor + 78, 8, { fill: [0.72, 0.82, 0.89] });
  labels.slice(0, 12).forEach((label, index) => {
    const top = doc.cursor + 115 + index * 29;
    page.circle(sideX + 22, top + 5, 4, COLORS.greenBright);
    page.wrappedText(label, sideX + 34, top, CONTENT_WIDTH - 405, 8, {
      bold: true,
      fill: COLORS.white,
      lineHeight: 10,
      maxLines: 2,
    });
  });
  if (labels.length > 12) page.text(`+ ${labels.length - 12} additional location(s)`, sideX + 17, doc.cursor + 466, 7, { fill: COLORS.cyan });
  doc.cursor += 510;
  doc.note("Map markers are presentation anchors for recorded state names. Unknown or free-text locations remain listed without inferred coordinates.", "info");
}

function addEvidence(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Evidence Assurance");
  doc.sectionTitle("Evidence Assurance", "Verified evidence metadata frozen into this report version. Private storage locations are intentionally excluded.");
  const page = doc.page();
  const trustItems = [
    { label: "Verified", value: input.evidence.length, color: COLORS.green },
    { label: "Checksummed", value: input.evidence.filter((item) => clean(item.checksum_sha256) !== UNAVAILABLE).length, color: COLORS.blue },
    { label: "Source Linked", value: input.evidence.filter((item) => item.assessment_id || item.field_visit_id || item.intervention_id).length, color: COLORS.cyan },
    { label: "Private Storage", value: input.evidence.length > 0 ? "Protected" : UNAVAILABLE, color: COLORS.navyLight },
  ];
  const trustWidth = (CONTENT_WIDTH - 24) / 4;
  trustItems.forEach((item, index) => {
    const x = MARGIN + index * (trustWidth + 8);
    page.fillRect(x, doc.cursor, trustWidth, 92, COLORS.white, 10);
    page.strokeRect(x, doc.cursor, trustWidth, 92, COLORS.line, 10);
    page.circle(x + 24, doc.cursor + 27, 11, item.color);
    page.text("V", x + 20, doc.cursor + 21, 10, { bold: true, fill: COLORS.white });
    page.text(item.label.toUpperCase(), x + 43, doc.cursor + 20, 6.2, { bold: true, fill: COLORS.muted });
    page.text(item.value, x + 14, doc.cursor + 55, typeof item.value === "string" ? 11 : 20, { bold: true, fill: COLORS.ink });
  });
  doc.cursor += 108;
  const rows = input.evidence.map((item) => {
    const linked = [
      item.assessment_id ? `Assessment ${truncate(item.assessment_id, 12)}` : null,
      item.field_visit_id ? `Visit ${truncate(item.field_visit_id, 12)}` : null,
      item.intervention_id ? `Intervention ${truncate(item.intervention_id, 12)}` : null,
    ].filter(Boolean).join("; ") || UNAVAILABLE;
    return [
      item.original_filename,
      humanize(item.verification_status),
      clean(item.checksum_sha256) === UNAVAILABLE ? UNAVAILABLE : "Available",
      `${clean(item.mime_type)}\n${displayBytes(item.file_size_bytes)}`,
      linked,
    ];
  });
  doc.table([
    { label: "Evidence File", width: 135 },
    { label: "Status", width: 70 },
    { label: "Checksum", width: 65 },
    { label: "Type / Size", width: 95 },
    { label: "Linked Source", width: CONTENT_WIDTH - 365 },
  ], rows, { empty: "No verified evidence files were available within the selected report scope.", section: "Evidence Assurance" });
  if (input.evidence.length === 0) doc.note("Evidence assurance is unavailable. No verified, non-placeholder evidence file qualified for this version.", "danger");
}

function addBeneficiaryStories(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  const stories = evidenceNarratives(input);
  if (stories.length === 0) return;
  doc.addPage("Beneficiary Impact Stories");
  doc.sectionTitle("Beneficiary Impact Stories", "Narrative content reproduced only from approved, verified evidence included in the report version.");
  stories.forEach((story, index) => {
    const lines = wrapText(story.narrative, CONTENT_WIDTH - 110, 9, 8);
    const height = Math.max(130, 62 + lines.length * 13);
    doc.ensure(height + 12);
    const page = doc.page();
    const top = doc.cursor;
    page.fillRect(MARGIN, top, CONTENT_WIDTH, height, index % 2 === 0 ? [0.95, 0.976, 0.964] : [0.94, 0.963, 0.992], 12);
    page.fillRect(MARGIN, top, 72, height, index % 2 === 0 ? COLORS.green : COLORS.blue, 12);
    page.text(`0${index + 1}`, MARGIN + 18, top + 22, 28, { bold: true, fill: COLORS.white });
    page.text("IMPACT", MARGIN + 18, top + 62, 7, { bold: true, fill: COLORS.white });
    page.text("STORY", MARGIN + 18, top + 76, 7, { bold: true, fill: COLORS.white });
    page.text(story.title, MARGIN + 92, top + 16, 11, { bold: true, fill: COLORS.ink });
    page.wrappedText(story.narrative, MARGIN + 92, top + 41, CONTENT_WIDTH - 110, 9, {
      fill: COLORS.body,
      lineHeight: 13,
      maxLines: 8,
    });
    page.text(`Beneficiary: ${clean(story.beneficiary)} | Location: ${clean(story.location)}`, MARGIN + 92, top + height - 25, 7, { fill: COLORS.muted });
    page.text(`Evidence ${truncate(story.evidenceId, 18)}`, PAGE_WIDTH - MARGIN - 126, top + height - 25, 7, {
      fill: COLORS.muted,
      align: "right",
      width: 126,
    });
    doc.cursor += height + 12;
  });
}

function addIndicators(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Indicator & Outcome Performance");
  doc.sectionTitle("Indicator & Outcome Performance", "Verified measurements and progress states included in the immutable report version.");
  if (input.indicators.length === 0) {
    doc.note("No verified indicator measurements were available. This report contains no official impact claims.", "danger");
    return;
  }
  const page = doc.page();
  const chartHeight = Math.min(210, 54 + input.indicators.slice(0, 6).length * 25);
  page.fillRect(MARGIN, doc.cursor, CONTENT_WIDTH, chartHeight, COLORS.navy, 12);
  page.text("OUTCOME ACHIEVEMENT OVERVIEW", MARGIN + 18, doc.cursor + 16, 7, { bold: true, fill: [0.57, 0.78, 0.87] });
  page.text(`${input.indicators.length} verified outcome measurement(s)`, MARGIN + 18, doc.cursor + 34, 13, { bold: true, fill: COLORS.white });
  input.indicators.slice(0, 6).forEach((item, index) => {
    const progress = numberValue(item.progress_percentage);
    const top = doc.cursor + 59 + index * 25;
    page.text(truncate(item.indicator_name, 31), MARGIN + 18, top, 7, { fill: COLORS.white });
    page.fillRect(MARGIN + 205, top + 1, 245, 8, [0.12, 0.26, 0.39], 4);
    if (progress !== null) {
      const width = 245 * Math.max(0, Math.min(100, progress)) / 100;
      page.fillRect(MARGIN + 205, top + 1, width, 8, progress >= 100 ? COLORS.greenBright : COLORS.cyan, 4);
    }
    page.text(displayNumber(progress, "%"), MARGIN + 460, top - 1, 7, { bold: true, fill: progress === null ? COLORS.amber : COLORS.white });
  });
  doc.cursor += chartHeight + 14;
  input.indicators.forEach((item) => {
    const progress = numberValue(item.progress_percentage);
    const height = 136;
    doc.ensure(height + 10);
    const page = doc.page();
    const top = doc.cursor;
    page.fillRect(MARGIN, top, CONTENT_WIDTH, height, COLORS.white, 9);
    page.strokeRect(MARGIN, top, CONTENT_WIDTH, height, COLORS.line, 9);
    page.text(item.indicator_name, MARGIN + 14, top + 13, 11, { bold: true, fill: COLORS.ink });
    doc.badge(item.verification_status, PAGE_WIDTH - MARGIN - 82, top + 10, undefined, 82);
    page.text(`${clean(item.unit_of_measure)} | Measured ${displayDate(item.measurement_date)}`, MARGIN + 14, top + 33, 7.5, { fill: COLORS.muted });
    const values = [
      ["Baseline", displayNumber(item.baseline_value)],
      ["Target", displayNumber(item.target_value)],
      ["Current", displayNumber(item.measured_value)],
      ["Progress", displayNumber(progress, "%")],
      ["Outcome", humanize(item.outcome_status)],
    ];
    values.forEach(([label, value], index) => {
      const x = MARGIN + 14 + index * 96;
      page.text(label.toUpperCase(), x, top + 57, 6, { bold: true, fill: COLORS.muted });
      page.text(value, x, top + 72, value.length > 12 ? 8 : 10, { bold: true, fill: COLORS.ink });
    });
    page.text("EVIDENCE SUPPORT", MARGIN + 14, top + 94, 6, { bold: true, fill: COLORS.muted });
    page.text(evidenceSupport(input), MARGIN + 93, top + 93, 7, { fill: input.evidence.length > 0 ? COLORS.blue : COLORS.amber });
    page.fillRect(MARGIN + 14, top + 116, CONTENT_WIDTH - 28, 7, COLORS.line, 3.5);
    if (progress !== null) {
      const progressWidth = (CONTENT_WIDTH - 28) * Math.max(0, Math.min(100, progress)) / 100;
      page.fillRect(MARGIN + 14, top + 116, progressWidth, 7, progress >= 100 ? COLORS.green : COLORS.blue, 3.5);
    }
    doc.cursor += height + 10;
  });
  doc.note(evidenceSupport(input), input.evidence.length > 0 ? "info" : "warning");
}

function addAssessmentMonitoring(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Assessment & Monitoring Assurance");
  doc.sectionTitle("Assessment & Monitoring Assurance", "Qualified assessments, review score runs, and reviewed monitoring visits used by the report version.");
  doc.keyValueGrid([
    { label: "Approved assessments used", value: input.assessments.length },
    { label: "Review score runs used", value: input.scoreRunIds.length },
    { label: "Reviewed monitoring visits", value: input.fieldVisits.length },
    { label: "Source cutoff", value: displayDate(input.sourceCutoffAt, true) },
  ], 4);
  doc.note("Source qualification: assessments must be approved, score runs must be review runs, and monitoring visits must be reviewed before the source cutoff.", "info");
  doc.table([
    { label: "Assessment", width: 145 },
    { label: "Type", width: 92 },
    { label: "Score", width: 64 },
    { label: "Readiness", width: 94 },
    { label: "Reviewed", width: CONTENT_WIDTH - 395 },
  ], input.assessments.map((item) => [
    item.title,
    humanize(item.assessment_type),
    displayNumber(item.weighted_score),
    humanize(item.readiness_category),
    displayDate(item.reviewed_at),
  ]), { empty: "No approved assessments qualified for this report version.", section: "Assessment & Monitoring Assurance" });
  doc.table([
    { label: "Monitoring Visit", width: 155 },
    { label: "Visit Date", width: 85 },
    { label: "Status", width: 75 },
    { label: "Findings", width: 105 },
    { label: "Recommendations", width: CONTENT_WIDTH - 420 },
  ], input.fieldVisits.map((item) => [
    item.title,
    displayDate(item.visit_date),
    humanize(item.status),
    item.findings,
    item.recommendations,
  ]), { empty: "No reviewed monitoring visits qualified for this report version.", section: "Assessment & Monitoring Assurance", fontSize: 6.8 });
  const excluded = sourceCount(input.sourceSummary, "completed_unreviewed_field_visits_excluded");
  if (excluded && excluded > 0) doc.note(`${excluded} completed monitoring visit(s) were excluded because institutional review was pending.`, "warning");
}

function addEvaluationMatrix(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Evaluation Matrix");
  doc.sectionTitle("Evaluation Matrix", "A structured view of criteria, source support, verification state, and report findings.");
  const rows: unknown[][] = [];
  if (input.assessments.length > 0) {
    rows.push([
      "Assessment readiness",
      input.assessments.map((item) => clean(item.title)).join("; "),
      input.scoreRunIds.length > 0 ? `${input.scoreRunIds.length} review score run(s)` : UNAVAILABLE,
      input.scoreRunIds.length === input.assessments.length ? "Verified" : "Warning",
      `${input.assessments.length} approved assessment(s); ${input.scoreRunIds.length} review score run(s).`,
    ]);
  }
  if (input.fieldVisits.length > 0) {
    rows.push([
      "Monitoring delivery",
      input.fieldVisits.map((item) => clean(item.title)).join("; "),
      UNAVAILABLE,
      "Reviewed",
      `${input.fieldVisits.length} reviewed monitoring visit(s) qualified before the source cutoff.`,
    ]);
  }
  input.indicators.forEach((item) => {
    rows.push([
      item.indicator_name,
      evidenceSupport(input),
      `${clean(item.indicator_name)} (${clean(item.unit_of_measure)})`,
      humanize(item.verification_status),
      `Measured ${displayNumber(item.measured_value)} against target ${displayNumber(item.target_value)}; outcome ${humanize(item.outcome_status)}.`,
    ]);
  });
  doc.table([
    { label: "Criteria / Outcome Area", width: 106 },
    { label: "Evidence Used", width: 112 },
    { label: "Indicator Used", width: 105 },
    { label: "Verification", width: 76 },
    { label: "Report Finding", width: CONTENT_WIDTH - 399 },
  ], rows, { empty: "No qualified sources were available to populate the evaluation matrix.", section: "Evaluation Matrix", fontSize: 6.7 });
}

function addRisks(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Risk & Completeness");
  doc.sectionTitle("Risk & Completeness", "Recorded completeness conditions, source warnings, and export readiness blockers.");
  const risks = [
    ...input.warnings.map((warning) => ({ category: "Completeness warning", detail: warning, state: "Warning" })),
    ...(input.evidence.length === 0 ? [{ category: "Missing evidence", detail: "No verified evidence records qualified for this version.", state: "Blocked" }] : []),
    ...(input.indicators.length === 0 ? [{ category: "Missing indicators", detail: "No verified indicator measurements qualified; official impact claims are unavailable.", state: "Blocked" }] : []),
    ...(input.status !== "approved" ? [{ category: "Export blocker", detail: `Report status is ${humanize(input.status)}; official export requires approval.`, state: "Blocked" }] : []),
    ...(input.metadata.legacy_unverified === true ? [{ category: "Legacy source", detail: "Report metadata identifies legacy or unverified source conditions.", state: "Warning" }] : []),
  ];
  const page = doc.page();
  const scorecards = [
    { label: "Completeness", value: input.warnings.length === 0 ? "Clear" : `${input.warnings.length} warning(s)`, color: input.warnings.length === 0 ? COLORS.green : COLORS.amber },
    { label: "Evidence Risk", value: input.evidence.length > 0 ? "Controlled" : "Blocked", color: input.evidence.length > 0 ? COLORS.green : COLORS.red },
    { label: "Outcome Risk", value: input.indicators.length > 0 ? "Controlled" : "Blocked", color: input.indicators.length > 0 ? COLORS.green : COLORS.red },
    { label: "Export Risk", value: input.status === "approved" ? "Clear" : "Blocked", color: input.status === "approved" ? COLORS.green : COLORS.red },
  ];
  const width = (CONTENT_WIDTH - 24) / 4;
  scorecards.forEach((item, index) => {
    const x = MARGIN + index * (width + 8);
    page.fillRect(x, doc.cursor, width, 94, COLORS.white, 10);
    page.strokeRect(x, doc.cursor, width, 94, COLORS.line, 10);
    page.fillRect(x, doc.cursor, width, 7, item.color, 5);
    page.text(item.label.toUpperCase(), x + 13, doc.cursor + 22, 6.2, { bold: true, fill: COLORS.muted });
    page.wrappedText(item.value, x + 13, doc.cursor + 48, width - 26, 12, { bold: true, fill: COLORS.ink, lineHeight: 14, maxLines: 2 });
  });
  doc.cursor += 110;
  if (risks.length === 0) {
    doc.note("No recorded completeness warnings or export blockers were identified for the selected version.", "success");
  } else {
    doc.table([
      { label: "Risk Category", width: 125 },
      { label: "Condition", width: CONTENT_WIDTH - 205 },
      { label: "State", width: 80 },
    ], risks.map((risk) => [risk.category, risk.detail, risk.state]), { section: "Risk & Completeness" });
  }
  doc.keyValueGrid([
    { label: "Completeness warnings", value: input.warnings.length },
    { label: "Missing evidence warning", value: input.evidence.length === 0 ? "Yes" : "No" },
    { label: "Missing indicator warning", value: input.indicators.length === 0 ? "Yes" : "No" },
    { label: "Export blocker", value: input.status === "approved" ? "None recorded" : humanize(input.status) },
    { label: "Legacy / unverified source", value: input.metadata.legacy_unverified === true ? "Warning" : "No legacy flag recorded" },
    { label: "Unavailable source note", value: "Any uncaptured field is rendered as Unavailable" },
  ], 3);
}

function addGovernance(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Governance & Approval");
  doc.sectionTitle("Governance & Approval", "Recorded lifecycle attribution, immutable version history, and official export history.");
  doc.keyValueGrid([
    { label: "Report status", value: humanize(input.status) },
    { label: "Created by / date", value: `${clean(input.governance.createdByUserId)} | ${displayDate(input.governance.createdAt, true)}` },
    { label: "Submitted by / date", value: `${clean(input.governance.submittedByUserId)} | ${displayDate(input.governance.submittedAt, true)}` },
    { label: "Reviewed by / date", value: `${clean(input.governance.reviewedByUserId)} | ${displayDate(input.governance.reviewedAt, true)}` },
    { label: "Approved by / date", value: `${clean(input.governance.approvedByUserId)} | ${displayDate(input.governance.approvedAt, true)}` },
    { label: "Returned reason", value: input.governance.returnedReason },
  ], 2);
  doc.table([
    { label: "Version", width: 60 },
    { label: "Generated", width: 92 },
    { label: "Generated By", width: 100 },
    { label: "Source Composition", width: 165 },
    { label: "Warnings", width: CONTENT_WIDTH - 417 },
  ], input.versions.map((version) => [
    `v${version.versionNumber}`,
    displayDate(version.generatedAt, true),
    version.generatedByUserId,
    `${version.assessmentCount} assessments; ${version.fieldVisitCount} visits; ${version.evidenceCount} evidence; ${version.indicatorCount} indicators`,
    version.warningCount,
  ]), { empty: "No version history was available.", section: "Governance & Approval", fontSize: 6.8 });
  doc.table([
    { label: "Format", width: 65 },
    { label: "Status", width: 70 },
    { label: "Generated", width: 100 },
    { label: "Generated By", width: 105 },
    { label: "File / Checksum", width: CONTENT_WIDTH - 340 },
  ], input.exports.map((item) => [
    item.format.toUpperCase(),
    humanize(item.status),
    displayDate(item.generatedAt, true),
    item.generatedByUserId,
    `${displayBytes(item.fileSizeBytes)} | Checksum ${item.checksumSha256 ? "available" : UNAVAILABLE}`,
  ]), { empty: "No prior export history was available when this PDF was generated.", section: "Governance & Approval", fontSize: 6.8 });
}

function addAppendix(doc: ReportDocument, input: InstitutionalReportPdfInput) {
  doc.addPage("Appendix / Source Register");
  doc.sectionTitle("Appendix / Source Register", "Identifiers and provenance references captured by the immutable report version. Storage paths are not included.");
  doc.keyValueGrid([
    { label: "Report ID", value: input.reportId },
    { label: "Report version ID", value: input.versionId },
    { label: "Version number", value: input.versionNumber },
    { label: "Generated by", value: input.generatedByUserId },
    { label: "Generated at", value: displayDate(input.generatedAt, true) },
    { label: "Source cutoff timestamp", value: displayDate(input.sourceCutoffAt, true) },
  ], 2);
  const sourceRows = [
    ...input.assessments.map((item) => ["Assessment", item.id, item.score_run_id ?? UNAVAILABLE, item.reviewed_at ?? UNAVAILABLE]),
    ...input.fieldVisits.map((item) => ["Monitoring visit", item.id, item.assessment_id ?? UNAVAILABLE, item.reviewed_at ?? item.visit_date ?? UNAVAILABLE]),
    ...input.evidence.map((item) => ["Evidence", item.evidence_id, `SHA-256 ${clean(item.checksum_sha256)}`, item.verification_status]),
    ...input.indicators.map((item) => ["Indicator measurement", item.indicator_measurement_id, item.indicator_definition_id, item.measurement_date]),
  ];
  doc.table([
    { label: "Source Type", width: 105 },
    { label: "Source ID", width: 142 },
    { label: "Reference / Checksum", width: 165 },
    { label: "Date / Status", width: CONTENT_WIDTH - 412 },
  ], sourceRows, { empty: "No source identifiers were available.", section: "Appendix / Source Register", fontSize: 6.4 });
  doc.note("Assurance note: checksum references indicate metadata availability in the frozen report version. This report does not expose private object-storage paths or signed URLs.", "info");
}

export function createInstitutionalReportPdf(input: InstitutionalReportPdfInput) {
  const doc = new ReportDocument();
  addCover(doc, input);
  doc.addDivider(
    "Section One",
    "Executive Intelligence",
    "01",
    "Board-level programme context, report health, verified delivery scope, and deterministic executive findings.",
    COLORS.cyan,
  );
  addDashboard(doc, input);
  addExecutiveSummary(doc, input);
  doc.addDivider(
    "Section Two",
    "Impact Performance",
    "02",
    "Impact logic, geographic reach, verified outcome achievement, evidence trust, and delivery assurance.",
    COLORS.greenBright,
  );
  addTheoryOfChange(doc, input);
  addGeographicImpact(doc, input);
  addIndicators(doc, input);
  addEvidence(doc, input);
  addBeneficiaryStories(doc, input);
  addAssessmentMonitoring(doc, input);
  doc.addDivider(
    "Section Three",
    "Assurance & Governance",
    "03",
    "Evaluation findings, completeness risks, approval provenance, version control, and immutable source references.",
    COLORS.amber,
  );
  addEvaluationMatrix(doc, input);
  addRisks(doc, input);
  addGovernance(doc, input);
  addAppendix(doc, input);
  doc.finalize(input.versionNumber, input.sourceCutoffAt);
  return buildPdf(doc.pages.map(({ page }) => page.commands.join("\n")));
}
