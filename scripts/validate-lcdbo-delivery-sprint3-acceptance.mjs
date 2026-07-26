#!/usr/bin/env node
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const pdfSource = read("src/lib/reports/lcdbo-programme-pdf.ts");
const pdfModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(pdfSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  module: pdfModule,
  exports: pdfModule.exports,
  TextEncoder,
  console,
});

const { createLcdboProgrammePdf } = pdfModule.exports;
assert(typeof createLcdboProgrammePdf === "function", "LCDBO PDF generator must be reusable by Sprint 3 reports.");

const acceptanceReports = [
  "programme-delivery",
  "workstream-performance",
  "state-delivery",
  "lga-delivery",
  "cluster-delivery",
  "executive-exceptions",
  "pilot-readiness",
];

const sampleInput = (reportType) => ({
  title: `LCDBO ${reportType.replaceAll("-", " ")} Acceptance Report`,
  reportType,
  generatedAt: "26 July 2026",
  subtitle: "Representative Sprint 3 governed delivery report for PDF rendering QA",
  kpis: [
    { label: "Health score", value: "82" },
    { label: "Attention items", value: "3" },
    { label: "Pilot-ready", value: "2" },
    { label: "Evidence links", value: "5" },
    { label: "Included records", value: "47" },
    { label: "Excluded UAT/test", value: "4" },
    { label: "Health scopes", value: "12" },
    { label: "Report rows", value: "24" },
  ],
  pipeline: [
    { label: "Programme", value: 47 },
    { label: "Workstreams", value: 8 },
    { label: "Milestones", value: 21 },
    { label: "Risks", value: 5 },
    { label: "States", value: 6 },
    { label: "Clusters", value: 4 },
    { label: "Evidence", value: 5 },
  ],
  readiness: [
    ["not_ready", 2],
    ["conditionally_ready", 3],
    ["ready_for_controlled_pilot", 2],
  ],
  topSectors: [
    ["Very Long Workstream Name For Industrial Delivery Governance And Traceable Reporting", 88],
    ["State Delivery Plan With Controlled Pilot Readiness", 76],
    ["Cluster Readiness And Evidence Verification", 69],
  ],
  topStates: [
    ["Lagos State Industrial Coordination Corridor With Long Name", 91],
    ["Kano Leather And Light Manufacturing Estate", 74],
    ["Ogun Agro Processing Shared Infrastructure Zone", 64],
  ],
  qualityScore: 86,
  healthScore: 82,
  estimates: [
    { label: "Health model", value: "lcdbo-delivery-health-v1.0.0" },
    { label: "Readiness model", value: "lcdbo-pilot-readiness-v1.0.0" },
    { label: "Classification", value: "Governed delivery report" },
    { label: "Test data included", value: "No" },
    { label: "Generated records", value: "24" },
  ],
  disclosures: [
    "UAT/test records are excluded by default and inclusion requires explicit authorized diagnostic mode.",
    "Configured targets, reference geography and governed estimates are not presented as live operational achievements.",
    "Health model: lcdbo-delivery-health-v1.0.0. Readiness model: lcdbo-pilot-readiness-v1.0.0.",
  ],
  executiveSummary: "Representative current operating period report with status text, disclosure language and long-name wrapping.",
  opportunities: ["Trace metric lineage from national view to the operational record.", "Use evidence links before controlled pilot decisions."],
  risks: ["HIGH: Critical risk requires executive action - long description wraps without clipping or overlapping in the report."],
  recommendations: ["Review attention items, evidence status and readiness blockers before pilot approval."],
});

const tmp = path.join(os.tmpdir(), "ndmii-platform", "lcdbo-sprint3-acceptance");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

const overrideBin = "/Users/koladeadebimpe/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override";
const fallbackBin = "/Users/koladeadebimpe/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback";
const binPath = `${overrideBin}${path.delimiter}${fallbackBin}${path.delimiter}${process.env.PATH ?? ""}`;

const outputs = [];
for (const reportType of acceptanceReports) {
  const pdf = createLcdboProgrammePdf(sampleInput(reportType));
  const pdfText = new TextDecoder().decode(pdf);
  assert(pdfText.startsWith("%PDF-1.4") && pdfText.endsWith("%%EOF"), `${reportType} PDF must be complete.`);
  assert(pdfText.includes("REPORT CLASSIFICATION"), `${reportType} PDF must include classification.`);
  assert(pdfText.includes("Generated 26 July 2026"), `${reportType} PDF must include generated date.`);
  assert(pdfText.includes("UAT/test records are excluded by default"), `${reportType} PDF must include test-data disclosure.`);
  assert(pdfText.includes("lcdbo-delivery-health-v1.0.0"), `${reportType} PDF must include health model version.`);
  assert(pdfText.includes("lcdbo-pilot-readiness-v1.0.0"), `${reportType} PDF must include readiness model version.`);
  assert(!pdfText.includes("storage_path") && !pdfText.includes("supabase.co/storage/v1/object"), `${reportType} PDF must not expose private storage paths.`);

  const pdfPath = path.join(tmp, `${reportType}.pdf`);
  fs.writeFileSync(pdfPath, pdf);
  const info = childProcess.execFileSync("pdfinfo", [pdfPath], { env: { ...process.env, PATH: binPath }, encoding: "utf8" });
  assert(/Pages:\s+4/.test(info), `${reportType} PDF should render four pages.`);
  const prefix = path.join(tmp, reportType);
  childProcess.execFileSync("pdftoppm", ["-png", "-r", "120", pdfPath, prefix], { env: { ...process.env, PATH: binPath }, stdio: "pipe" });
  const pngs = fs.readdirSync(tmp).filter((file) => file.startsWith(`${reportType}-`) && file.endsWith(".png"));
  assert(pngs.length === 4, `${reportType} PDF must render all four pages to PNG.`);
  outputs.push({ reportType, pdfPath, pages: 4, pngs: pngs.length });
}

const service = read("src/lib/data/lcdbo-delivery-intelligence.ts");
const pdfRoute = read("src/app/api/lcdbo/reports/[type]/pdf/route.ts");
const briefingPdfRoute = read("src/app/api/lcdbo/briefings/[type]/pdf/route.ts");
const reportsPage = read("src/app/dashboard/lcdbo/reports/page.tsx");
const executive = read("src/components/lcdbo/lcdbo-executive-dashboard.tsx");
const evidence = read("src/app/dashboard/lcdbo/evidence/page.tsx");
const deliveryComponents = read("src/components/lcdbo/lcdbo-delivery-components.tsx");
const geographyComponents = read("src/components/lcdbo/lcdbo-delivery-geography-components.tsx");
const readinessPage = read("src/app/dashboard/lcdbo/pilot-readiness/page.tsx");

for (const report of ["programme-delivery", "workstream-performance", "milestone-deliverable", "risk-issue", "state-delivery", "lga-delivery", "cluster-delivery", "executive-exceptions", "pilot-readiness", "evidence-verification"]) {
  assert(service.includes(report), `${report} must be implemented in the Sprint 3 service.`);
  assert(pdfRoute.includes(report), `${report} must be available through the existing LCDBO PDF route.`);
  assert(briefingPdfRoute.includes(report), `${report} must be available through the existing LCDBO briefing PDF route.`);
  assert(reportsPage.includes(report), `${report} must be discoverable in the reports UI.`);
}

assert(service.includes("applyHealthOverride") && service.includes("lcdbo.delivery.health_override.applied"), "Health override application must be implemented and audited.");
assert(service.includes("removeHealthOverride") && service.includes("lcdbo.delivery.health_override.removed"), "Health override removal must be implemented and audited.");
assert(service.includes("lcdbo.delivery.snapshot.generated"), "Sprint 3 snapshot generation must have a trusted audit event path.");
assert(service.includes("recordClassification") && service.includes("metadata.uat_reference") && service.includes("defensive"), "Structured test-data classification must be authoritative with defensive fallback.");
assert(!service.includes("\\btest\\b|uat|audit writer"), "Test-data fallback must not exclude ordinary production records containing the word test.");
assert(executive.includes("Multi-level health") && executive.includes("deliveryIntelligence.scopedHealth"), "Executive dashboard must expose multi-level health verification.");
assert(evidence.includes("snapshot.evidenceTargets") && evidence.includes("selectedTarget") && evidence.includes("Context coverage"), "Evidence UI must not depend only on attention records and must support contextual target preselection.");
assert(pdfRoute.includes("requireLcdboDeliveryAccess(\"export\""), "Sprint 3 delivery PDFs must deny observer restricted exports.");
assert(briefingPdfRoute.includes("requireLcdboDeliveryAccess(\"export\""), "Sprint 3 delivery briefing PDFs must deny observer restricted exports.");
for (const targetType of ["workstream", "delivery_item", "raid_item", "decision"]) {
  assert(deliveryComponents.includes(`type=\"${targetType}\"`), `${targetType} must expose contextual Add evidence links.`);
}
for (const targetType of ["state_plan", "lga_plan", "cluster_plan", "activity", "progress_update"]) {
  assert(geographyComponents.includes(`type=\"${targetType}\"`), `${targetType} must expose contextual Add evidence links.`);
}
assert(readinessPage.includes("pilot_readiness") && readinessPage.includes("EvidenceLink"), "Pilot-readiness dimensions must expose contextual Add evidence links.");

console.log(JSON.stringify({
  ok: true,
  validation: "lcdbo_delivery_sprint3_acceptance",
  renderedReports: outputs,
  qaDirectory: tmp,
}, null, 2));
