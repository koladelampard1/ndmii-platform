#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const routes = [
  "src/app/ekirs/page.tsx",
  "src/app/dashboard/ekirs/page.tsx",
  "src/app/dashboard/ekirs/businesses/page.tsx",
  "src/app/dashboard/ekirs/businesses/[id]/page.tsx",
  "src/app/dashboard/ekirs/verification/page.tsx",
  "src/app/dashboard/ekirs/formalisation/page.tsx",
  "src/app/dashboard/ekirs/intelligence/page.tsx",
  "src/app/dashboard/ekirs/integrations/page.tsx",
  "src/app/dashboard/ekirs/pilot-readiness/page.tsx",
];
for (const route of routes) assert(exists(route), `Missing required EKIRS route: ${route}`);

const landing = read("src/app/ekirs/page.tsx");
const registry = read("src/lib/workspaces/workspace-registry.ts");
const jurisdiction = read("src/lib/state-revenue/jurisdictions.ts");
const data = read("src/lib/state-revenue/ekirs-demo-data.ts");
const migration = read("supabase/migrations/20260730120000_state_revenue_ekirs_sprint0.sql");
const routingTest = read("scripts/test-dbin-host-routing.mjs");
const docs = read("docs/ekirs-sprint0-demonstration-walkthrough.md");

assert(landing.includes("Ekiti Business Formalisation and Revenue Readiness Platform"), "Public landing title must match Sprint 0 requirement.");
assert(landing.includes("/login?workspace=ekirs"), "Public landing must link to EKIRS staff sign-in.");
assert(landing.includes("Verify a business identity"), "Public landing must expose business verification CTA.");
assert(registry.includes('allowedRoles: ["admin", "super_admin"]'), "EKIRS global allowed roles should be limited to platform administrators.");
assert(registry.includes('"workspace_user"') && registry.includes('"observer"'), "EKIRS scoped role model must include workspace_user and observer.");
assert(jurisdiction.includes("Ado Ekiti") && jurisdiction.includes("Irepodun/Ifelodun"), "Ekiti LGA configuration must include constitutional LGAs.");
assert((jurisdiction.match(/constitutionalLgas/g) ?? []).length >= 1, "Jurisdiction must expose constitutional LGAs.");
assert(jurisdiction.includes("configuredCount: 22"), "LCDA expected count must be documented without inventing names.");
assert(!jurisdiction.includes("Tax revenue") && !data.includes("collectionAmount") && !data.includes("liabilityAmount"), "Sprint 0 must not define live tax revenue or liability fields.");
assert(data.includes("createStateRevenueSyntheticBusinesses(EKIRS_JURISDICTION)"), "Synthetic dataset must use the reusable deterministic generator and EKIRS configuration.");
assert(migration.includes("ekiti-state-internal-revenue-service"), "Migration must seed EKIRS institution.");
assert(migration.includes("state_revenue_service_workspace"), "Migration must seed state revenue module.");
assert(!migration.includes("create user") && !migration.includes("auth.users") && !migration.includes("password"), "Migration must not provision users or credentials.");
assert(routingTest.includes("ekirs.dbin.ng") && routingTest.includes('"/ekirs"'), "Routing tests must cover EKIRS host rewrites.");
assert(docs.includes("No live revenue") && docs.includes("LCDA"), "Demonstration walkthrough must include revenue and LCDA safety notes.");
assert(!landing.includes("Placeholder") && !landing.includes("Try demo"), "EKIRS landing must not use placeholder or casual demo language.");
assert(!jurisdiction.includes("placeholder"), "EKIRS jurisdiction config must not use placeholder language.");

function loadTsModule(file, requireMap = {}) {
  const source = read(file);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: file,
  });
  const cjsModule = { exports: {} };
  vm.runInNewContext(outputText, {
    module: cjsModule,
    exports: cjsModule.exports,
    require(specifier) {
      if (specifier in requireMap) return requireMap[specifier];
      throw new Error(`Unexpected import ${specifier} from ${file}`);
    },
    Set,
    decodeURIComponent,
  });
  return cjsModule.exports;
}

const jurisdictionModule = loadTsModule("src/lib/state-revenue/jurisdictions.ts");
const syntheticModule = loadTsModule("src/lib/state-revenue/synthetic-data.ts", {
  "@/lib/state-revenue/jurisdictions": jurisdictionModule,
});
const dataModule = loadTsModule("src/lib/state-revenue/ekirs-demo-data.ts", {
  "@/lib/state-revenue/jurisdictions": jurisdictionModule,
  "@/lib/state-revenue/synthetic-data": syntheticModule,
});

const records = dataModule.EKIRS_DEMO_BUSINESSES;
const config = jurisdictionModule.EKIRS_JURISDICTION;
assert(records.length === 64, "EKIRS deterministic dataset must contain exactly 64 records.");
assert(records.length === config.demonstration.deterministicRecords, "Configured deterministic record count must reconcile with records.");
assert(new Set(records.map((record) => record.id)).size === records.length, "Synthetic business IDs must be unique.");
assert(new Set(records.map((record) => record.bin)).size === records.length, "BIN-EK values must be unique.");
assert(records.every((record) => /^BIN-EK-2026-\d{4}$/.test(record.bin)), "BIN-EK values must be deterministic and well formed.");
assert(records.every((record) => record.dataClassification === "synthetic_demo"), "Every EKIRS record must be classified synthetic_demo.");
assert(records.every((record) => config.geography.constitutionalLgas.includes(record.lga)), "Every EKIRS record must map to a configured constitutional LGA.");
assert(records.every((record) => record.lcda === null), "No unverified LCDA record should be populated.");
assert(config.geography.constitutionalLgas.length === 16, "Ekiti must configure exactly 16 constitutional LGAs.");
assert(config.geography.stateCode === "EK", "Ekiti state code must be EK.");
assert(config.geography.lcdaStatus.note.includes("pending_authoritative_confirmation"), "LCDA capability must remain pending authoritative confirmation.");
assert(config.geography.lcdaStatus.records.length === 0, "No invented LCDA records should exist.");

const metrics = dataModule.getEkirsMetrics(records);
assert(metrics.totalBusinesses === records.length, "Total KPI must reconcile with records.");
assert(metrics.contactVerified === records.filter((record) => record.verificationLevel >= 1).length, "Contact verified KPI must reconcile.");
assert(metrics.jurisdictionVerified === records.filter((record) => record.verificationLevel >= 2).length, "Jurisdiction verified KPI must reconcile.");
assert(metrics.identityLinked === records.filter((record) => record.verificationLevel >= 3).length, "Identity linked KPI must reconcile.");
assert(metrics.fieldConfirmed === records.filter((record) => record.verificationLevel >= 4).length, "Field confirmed KPI must reconcile.");
assert(metrics.tinLinked === records.filter((record) => record.tinLinkageStatus === "linked").length, "TIN linked KPI must reconcile.");
assert(metrics.digitalRecords === records.filter((record) => record.recordKeepingStatus === "digital").length, "Digital records KPI must reconcile.");
assert(metrics.dataQualityExceptions === records.reduce((count, record) => count + record.dataQualityFlags.length, 0), "Data quality KPI must reconcile.");

const lgaMetrics = dataModule.getEkirsLgaMetrics(records);
assert(lgaMetrics.length === 16, "LGA metrics must include all 16 LGAs.");
assert(lgaMetrics.reduce((sum, lga) => sum + lga.total, 0) === records.length, "LGA totals must reconcile to total records.");
for (const lgaMetric of lgaMetrics) {
  const lgaRecords = records.filter((record) => record.lga === lgaMetric.lga);
  assert(lgaMetric.total === lgaRecords.length, `LGA total must reconcile for ${lgaMetric.lga}.`);
}

for (const sector of new Set(records.map((record) => record.sector))) {
  assert(records.filter((record) => record.sector === sector).length > 0, `Sector total must reconcile for ${sector}.`);
}
for (const level of [0, 1, 2, 3, 4]) {
  assert(records.filter((record) => record.verificationLevel === level).length > 0, `Verification level ${level} must be represented.`);
}
for (const tinStatus of ["linked", "pending", "unlinked"]) {
  assert(records.filter((record) => record.tinLinkageStatus === tinStatus).length > 0, `TIN status ${tinStatus} must be represented.`);
}
for (const recordStatus of ["paper", "spreadsheet", "digital"]) {
  assert(records.filter((record) => record.recordKeepingStatus === recordStatus).length > 0, `Record-keeping status ${recordStatus} must be represented.`);
}

const serializedRecords = JSON.stringify(records);
assert(!/\b\d{11}\b/.test(serializedRecords), "Synthetic records must not contain NIN/BVN-like 11 digit identifiers.");
assert(!/\b\d{10}\b/.test(serializedRecords), "Synthetic records must not contain bank-account-like 10 digit identifiers.");
assert(!/[@][a-z0-9.-]+\.[a-z]{2,}/i.test(serializedRecords), "Synthetic records must not contain email addresses.");
assert(!/(080|081|070|090|091)\d{8}/.test(serializedRecords), "Synthetic records must not contain Nigerian phone numbers.");

const migrationForbidden = ["drop table", "truncate", "delete from", "alter table public.users", "grant all", "disable row level security", "create policy", "role_assignments"];
for (const token of migrationForbidden) {
  assert(!migration.toLowerCase().includes(token), `Migration must not contain ${token}.`);
}
assert(migration.includes("on conflict (slug) do update"), "Institution seed must be idempotent by slug.");
assert(migration.includes("on conflict (module_key) do update"), "Module seed must be idempotent by module key.");
assert(migration.includes("on conflict (institution_id, module_id) do update"), "Module access seed must be idempotent by composite key.");
assert(migration.includes("'ekiti-state-internal-revenue-service'") && registry.includes('institutionSlug: "ekiti-state-internal-revenue-service"'), "Migration slug must match application config.");
assert(migration.includes("'state_revenue_service_workspace'"), "Migration must use deterministic module key.");

if (failures.length) {
  console.error("EKIRS Sprint 0 validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("EKIRS Sprint 0 validation passed.");
