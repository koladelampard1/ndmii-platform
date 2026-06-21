export type LcdboPdfReportInput = {
  title: string;
  reportType: string;
  generatedAt: string;
  subtitle?: string;
  kpis: Array<{ label: string; value: string }>;
  pipeline: Array<{ label: string; value: number }>;
  readiness: Array<[string, number]>;
  topSectors: Array<[string, number]>;
  topStates: Array<[string, number]>;
  qualityScore: number;
  healthScore: number;
  estimates: Array<{ label: string; value: string }>;
  disclosures: string[];
  executiveSummary?: string;
  opportunities?: string[];
  risks?: string[];
  recommendations?: string[];
};

const WIDTH = 595;
const HEIGHT = 842;
const encoder = new TextEncoder();

function ascii(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}
function escapePdf(value: unknown) { return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function text(value: unknown, x: number, y: number, size = 10, bold = false, color = "0.10 0.18 0.28") { return `${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`; }
function rect(x: number, y: number, width: number, height: number, fill: string, stroke?: string) { return `${fill} rg${stroke ? ` ${stroke} RG 0.8 w` : ""} ${x} ${y} ${width} ${height} re ${stroke ? "B" : "f"}`; }
function line(x1: number, y1: number, x2: number, y2: number, color = "0.86 0.89 0.92") { return `${color} RG 0.8 w ${x1} ${y1} m ${x2} ${y2} l S`; }
function wrap(value: string, max = 78) { const words = ascii(value).split(" "); const lines: string[] = []; let current = ""; for (const word of words) { const next = current ? `${current} ${word}` : word; if (next.length > max && current) { lines.push(current); current = word; } else current = next; } if (current) lines.push(current); return lines; }
function wrappedText(value: string, x: number, y: number, max = 78, size = 10, leading = 14, bold = false, color?: string) { return wrap(value, max).map((entry, index) => text(entry, x, y - index * leading, size, bold, color)).join("\n"); }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function pipelineLabel(value: string) { return value.toLowerCase().startsWith("documents") ? "Documents" : value.slice(0, 11); }

function footer(page: number, total: number) {
  return [line(42, 38, 553, 38), text("LCDBO - Digital Business Identity Network", 42, 22, 8, true, "0.04 0.18 0.35"), text(`Governed executive report | Page ${page} of ${total}`, 397, 22, 8, false, "0.36 0.43 0.52")].join("\n");
}

function cover(input: LcdboPdfReportInput) {
  const commands = [rect(0, 0, WIDTH, HEIGHT, "0.04 0.18 0.35"), rect(0, 0, WIDTH, 16, "0.83 0.63 0.09"), rect(44, 660, 72, 72, "0.00 0.53 0.32"), text("DBIN", 58, 691, 20, true, "1 1 1"), text("LOCAL CONTENT DEVELOPMENT BEYOND OIL", 44, 615, 10, true, "0.93 0.78 0.36"), wrappedText(input.title, 44, 535, 34, 30, 38, true, "1 1 1"), wrappedText(input.subtitle ?? "National programme intelligence and decision-support report", 44, 430, 62, 13, 19, false, "0.82 0.87 0.92"), rect(44, 280, 507, 92, "0.06 0.24 0.43", "0.18 0.38 0.55"), text("REPORT CLASSIFICATION", 62, 338, 9, true, "0.93 0.78 0.36"), text(humanize(input.reportType), 62, 316, 16, true, "1 1 1"), text(`Generated ${input.generatedAt}`, 62, 294, 10, false, "0.82 0.87 0.92"), text("PROGRAMME ESTIMATES ARE NOT OFFICIAL GOVERNMENT STATISTICS", 44, 88, 8, true, "0.93 0.78 0.36"), text("Prepared for executive review, programme governance and decision support.", 44, 66, 9, false, "0.82 0.87 0.92")];
  return commands.join("\n");
}

function summaryPage(input: LcdboPdfReportInput) {
  const commands = [text("EXECUTIVE PROGRAMME SUMMARY", 42, 790, 10, true, "0.00 0.53 0.32"), text(input.title, 42, 758, 22, true, "0.04 0.18 0.35"), text("Governed KPI summary", 42, 728, 12, true)];
  input.kpis.slice(0, 8).forEach((kpi, index) => { const col = index % 4; const row = Math.floor(index / 4); const x = 42 + col * 128; const y = 644 - row * 90; commands.push(rect(x, y, 116, 72, "0.96 0.97 0.98", "0.86 0.89 0.92"), text(kpi.value, x + 10, y + 39, 18, true, "0.04 0.18 0.35"), text(kpi.label.slice(0, 21), x + 10, y + 17, 8, true, "0.36 0.43 0.52")); });
  commands.push(text("PROGRAMME PIPELINE", 42, 532, 10, true, "0.00 0.53 0.32"));
  const peak = Math.max(...input.pipeline.map((item) => item.value), 1);
  input.pipeline.slice(0, 7).forEach((item, index) => { const x = 42 + index * 73; const barHeight = Math.max(8, (item.value / peak) * 105); commands.push(rect(x, 388, 48, 105, "0.93 0.95 0.96"), rect(x, 388, 48, barHeight, index === 6 ? "0.00 0.53 0.32" : "0.04 0.18 0.35"), text(String(item.value), x + 4, 500, 9, true), text(pipelineLabel(item.label), x, 370, 7, true, "0.36 0.43 0.52")); });
  commands.push(text("READINESS PROFILE", 42, 330, 10, true, "0.00 0.53 0.32"));
  const readinessPeak = Math.max(...input.readiness.map(([, count]) => count), 1);
  input.readiness.slice(0, 5).forEach(([level, count], index) => { const y = 292 - index * 40; commands.push(text(humanize(level), 42, y + 6, 9, true), rect(178, y, 300, 14, "0.93 0.95 0.96"), rect(178, y, Math.max(4, (count / readinessPeak) * 300), 14, index >= 3 ? "0.00 0.53 0.32" : "0.83 0.63 0.09"), text(String(count), 490, y + 3, 9, true)); });
  commands.push(footer(2, 4));
  return commands.join("\n");
}

function intelligencePage(input: LcdboPdfReportInput) {
  const commands = [text("SECTOR AND GEOGRAPHIC INTELLIGENCE", 42, 790, 10, true, "0.00 0.53 0.32"), text("Programme distribution", 42, 758, 22, true, "0.04 0.18 0.35"), text("TOP SECTORS", 42, 712, 10, true), text("TOP STATES", 315, 712, 10, true)];
  const chart = (rows: Array<[string, number]>, x: number) => { const peak = Math.max(...rows.map(([, count]) => count), 1); rows.slice(0, 8).forEach(([label, count], index) => { const y = 672 - index * 44; commands.push(text(label.slice(0, 26), x, y + 17, 8, true), rect(x, y, 210, 10, "0.93 0.95 0.96"), rect(x, y, Math.max(3, (count / peak) * 210), 10, "0.00 0.53 0.32"), text(String(count), x + 220, y + 1, 8, true)); }); };
  chart(input.topSectors, 42); chart(input.topStates, 315);
  commands.push(text("GOVERNANCE INDICATORS", 42, 292, 10, true, "0.00 0.53 0.32"));
  [["Data quality score", input.qualityScore], ["Programme health score", input.healthScore]].forEach(([label, value], index) => { const x = 42 + index * 260; commands.push(rect(x, 194, 240, 76, "0.96 0.97 0.98", "0.86 0.89 0.92"), text(String(value), x + 18, 226, 28, true, Number(value) >= 75 ? "0.00 0.53 0.32" : "0.83 0.45 0.05"), text(`${label} / 100`, x + 82, 231, 11, true)); });
  commands.push(wrappedText(input.executiveSummary ?? "This report consolidates governed programme KPIs, geographic coverage, readiness evidence and operational activity for executive decision support.", 42, 154, 84, 10, 15), footer(3, 4));
  return commands.join("\n");
}

function governancePage(input: LcdboPdfReportInput) {
  const commands = [text("PROGRAMME ESTIMATES AND ACTIONS", 42, 790, 10, true, "0.00 0.53 0.32"), text("Executive decision support", 42, 758, 22, true, "0.04 0.18 0.35")];
  input.estimates.slice(0, 5).forEach((item, index) => { const x = 42 + (index % 3) * 170; const y = index < 3 ? 650 : 558; commands.push(rect(x, y, 156, 76, "1.00 0.97 0.86", "0.91 0.78 0.40"), text(item.value, x + 12, y + 40, 16, true, "0.04 0.18 0.35"), text(item.label.slice(0, 24), x + 12, y + 18, 8, true, "0.45 0.34 0.08")); });
  const listSection = (title: string, items: string[], y: number, color: string) => { commands.push(text(title, 42, y, 10, true, color)); items.slice(0, 3).forEach((item, index) => { commands.push(rect(42, y - 28 - index * 35, 8, 8, color), wrappedText(item, 60, y - 22 - index * 35, 78, 9, 12)); }); };
  listSection("TOP OPPORTUNITIES", input.opportunities ?? ["Scale cluster participation where readiness and officer coverage are strongest."], 500, "0.00 0.53 0.32");
  listSection("TOP RISKS", input.risks ?? ["Address overdue reviews, incomplete location records and outstanding evidence requests."], 375, "0.73 0.16 0.18");
  listSection("RECOMMENDED ACTIONS", input.recommendations ?? ["Prioritise high-severity quality issues and refresh governed snapshots at the agreed frequency."], 250, "0.04 0.18 0.35");
  commands.push(text("DISCLOSURES", 42, 124, 9, true, "0.83 0.45 0.05"));
  input.disclosures.slice(0, 3).forEach((entry, index) => commands.push(wrappedText(entry, 42, 106 - index * 24, 88, 7.5, 10, false, "0.36 0.43 0.52")));
  commands.push(footer(4, 4));
  return commands.join("\n");
}

export function createLcdboProgrammePdf(input: LcdboPdfReportInput): Uint8Array {
  const pages = [cover(input), summaryPage(input), intelligencePage(input), governancePage(input)];
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  pages.forEach((content, index) => { const pageId = 5 + index * 2; const contentId = pageId + 1; objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`); });
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(encoder.encode(pdf).length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = encoder.encode(pdf).length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; }); pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return encoder.encode(pdf);
}
