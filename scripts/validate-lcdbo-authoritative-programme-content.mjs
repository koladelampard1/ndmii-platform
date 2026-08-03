#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const model = read("src/lib/lcdbo/programme-model.ts");
const governance = read("src/lib/lcdbo/public-governance.ts");
const shell = read("src/components/lcdbo/lcdbo-shell.tsx");
const landing = read("src/components/lcdbo/lcdbo-landing.tsx");
const about = read("src/app/lcdbo/about/page.tsx");
const modelPage = read("src/app/lcdbo/model/page.tsx");
const clusters = read("src/app/lcdbo/clusters/page.tsx");
const partners = read("src/app/lcdbo/partners/page.tsx");
const opportunities = read("src/app/lcdbo/opportunities/page.tsx");
const contact = read("src/app/lcdbo/contact/page.tsx");
const routing = read("src/lib/routing/dbin-hosts.ts");
const sitemap = read("src/app/sitemap.ts");
const hostValidator = read("scripts/validate-lcdbo-host-routing.mjs");
const routingTest = read("scripts/test-dbin-host-routing.mjs");
const page = read("src/app/lcdbo/programme-and-milestones/page.tsx");
const allPublicContent = [
  model,
  governance,
  shell,
  landing,
  about,
  modelPage,
  clusters,
  partners,
  opportunities,
  contact,
  page,
].join("\n");

assert(exists("src/app/lcdbo/programme-and-milestones/page.tsx"), "Missing /lcdbo/programme-and-milestones route.");
assert(shell.includes('lcdboPublicHref("/programme-and-milestones")'), "LCDBO public navigation must include programme-and-milestones.");
assert(routing.includes('"/programme-and-milestones"'), "LCDBO host allow-list must include /programme-and-milestones.");
assert(sitemap.includes('"/programme-and-milestones"'), "Sitemap must include canonical programme-and-milestones route.");
assert(hostValidator.includes("programme-and-milestones/page"), "Host-routing validator must check the programme-and-milestones page.");
assert(routingTest.includes('"/programme-and-milestones"'), "Routing tests must cover clean LCDBO programme-and-milestones host path.");

for (const source of ["LCDBO MODEL IN NIGERIA.pdf", "LCBDO KEY PROGRAMMES AND MILESTONES.docx"]) {
  assert(model.includes(source), `Missing approved source reference: ${source}`);
}

for (const phrase of [
  "Source-backed programme ambition",
  "Source-backed programme projection",
  "Source-backed programme target",
  "Reference geography",
  "774",
  "5,000",
  "$100B",
  "$1T",
  "Top 10",
  "20M+",
  "Programme figures are presented as source-backed ambitions",
  "not live achieved results",
]) {
  assert(allPublicContent.includes(phrase), `Missing governed authoritative content phrase: ${phrase}`);
}

for (const pillar of [
  "Industrial Cluster Development",
  "Enterprise Identification and Formalisation",
  "Research Commercialisation and Innovation",
  "Infrastructure Enablement",
  "Investment and Finance Mobilisation",
  "Skills and Entrepreneurship Development",
  "Market Access and Export Development",
  "Policy and Institutional Coordination",
  "Security, Community Protection and Operational Resilience",
  "Digital Infrastructure and Programme Intelligence",
]) {
  assert(model.includes(pillar), `Missing LCDBO pillar: ${pillar}`);
}

for (const milestone of ["SEID", "SSAD", "SID", "TRID", "HHEID", "EPID", "IBID"]) {
  assert(model.includes(`abbreviation: "${milestone}"`), `Missing milestone programme ${milestone}.`);
}
assert(page.includes("lcdboMilestoneProgrammes.map"), "Programme-and-milestones page must render milestone programmes from typed content.");

for (const phase of ["Phase One", "Phase Two", "Phase Three", "Phase Four"]) {
  assert(model.includes(phase), `Missing implementation phase ${phase}.`);
}
assert(page.includes("lcdboImplementationPhases.map"), "Programme-and-milestones page must render implementation phases from typed content.");

for (const alignment of [
  "National Industrial Policy 2025",
  "One LGA One Product",
  "Double Your Export",
  "3 Million Technical Talent",
  "NYSC SAED",
  "National Single Window",
  "Backward Integration",
  "Nigeria First",
  "Special Agro-Industrial Processing Zones",
  "Skill Up Artisans",
]) {
  assert(allPublicContent.includes(alignment), `Missing policy alignment reference: ${alignment}`);
}

for (const institution of [
  "Raw Materials Research and Development Council",
  "Roseate Forte Nigeria Limited",
  "DBIN",
  "Nigerian Society of Engineers",
  "Bank of Industry",
  "African Development Bank Group",
  "Islamic Development Bank Group",
  "ALGON",
  "Nigeria Governors' Forum",
]) {
  assert(allPublicContent.includes(institution), `Missing institutional/stakeholder reference: ${institution}`);
}

for (const kpi of [
  "Industrial Clusters",
  "MSMEs Formalized",
  "Jobs Created",
  "Youth Trained",
  "Local Content Utilization",
  "Non-Oil Export Growth",
  "Digital Business IDs Issued",
  "Manufacturing Contribution to GDP",
  "Annual Private Investment Mobilized",
  "Increase in Government Revenue",
]) {
  assert(model.includes(kpi), `Missing KPI framework item: ${kpi}`);
}
assert(page.includes("lcdboKpiFramework.map"), "Programme-and-milestones page must render KPI framework from typed content.");

for (const forbidden of [
  "officially approved by the Federal Government",
  "nationwide implementation already active",
  "RMRDC-approved anchor products",
  "774/774 canonical reconciliation complete",
]) {
  assert(!allPublicContent.toLowerCase().includes(forbidden.toLowerCase()), `Forbidden claim found: ${forbidden}`);
}

const migrationFiles = fs.readdirSync(path.join(root, "supabase/migrations"));
assert(
  !migrationFiles.some((file) => file.includes("authoritative_programme") || file.includes("programme_milestones")),
  "This public-content integration must not add a Supabase migration.",
);

console.log(JSON.stringify({
  validation: "lcdbo_authoritative_programme_content",
  status: "passed",
  publicRoute: "/lcdbo/programme-and-milestones",
  cleanHostRoute: "/programme-and-milestones",
  sources: 2,
  measures: 7,
  pillars: 10,
  milestones: 7,
  phases: 4,
  kpis: 10,
}));
