#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve("supabase/migrations/20260620120000_platform_workspace_foundation.sql");
const sql = readFileSync(migrationPath, "utf8");
const phase3MigrationPath = resolve("supabase/migrations/20260620143000_lcdbo_msme_enrolment_phase3.sql");
const phase3Sql = readFileSync(phase3MigrationPath, "utf8");
const phase3DataPath = resolve("src/lib/data/lcdbo-enrolment.ts");
const phase3Data = readFileSync(phase3DataPath, "utf8");

const requiredTables = [
  "institutions",
  "institution_members",
  "institution_roles",
  "institution_settings",
  "role_assignments",
  "countries",
  "states",
  "lgas",
  "geopolitical_zones",
  "programmes",
  "programme_partners",
  "programme_members",
  "programme_enrolments",
  "programme_events",
  "industrial_clusters",
  "cluster_members",
  "cluster_facilities",
  "cluster_projects",
  "cluster_value_chains",
  "consent_records",
  "data_sharing_agreements",
  "platform_events",
  "platform_modules",
  "institution_module_access",
  "programme_module_access",
];

const requiredModuleKeys = [
  "core_identity",
  "msme_registry",
  "public_verification",
  "compliance",
  "marketplace",
  "complaints",
  "impact_intelligence",
  "association_management",
  "lcdb_o_workspace",
  "sicip_workspace",
  "cluster_registry",
  "investor_portal",
  "funding_hub",
  "partner_portal",
  "export_hub",
];

const requiredInstitutions = [
  "roseate-forte-nigeria-limited",
  "rmrdc",
  "nassi",
  "nse",
  "boi",
  "afcfta",
];

const requiredProgrammes = [
  "local-content-development-beyond-oil",
  "special-industrial-clusters-investment-programme",
];

const requiredClusters = [
  "southwest-leather-industrial-processing-hub",
  "agro-processing-pilot-hub",
  "technology-and-innovation-pilot-park",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const table of requiredTables) {
  assert(
    sql.includes(`create table if not exists public.${table}`),
    `Missing create table statement for public.${table}.`,
  );
}

for (const key of requiredModuleKeys) {
  assert(sql.includes(`'${key}'`), `Missing platform module key ${key}.`);
}

assert(!sql.includes("lcdb o"), "Migration contains invalid LCDBO module key with a space.");
assert(!sql.includes("lcdb_o?"), "Migration contains unresolved LCDBO key placeholder.");

for (const slug of requiredInstitutions) {
  assert(sql.includes(`'${slug}'`), `Missing seeded institution slug ${slug}.`);
}

for (const slug of requiredProgrammes) {
  assert(sql.includes(`'${slug}'`), `Missing seeded programme slug ${slug}.`);
}

for (const slug of requiredClusters) {
  assert(sql.includes(`'${slug}'`), `Missing seeded cluster slug ${slug}.`);
}

for (const status of ["pending_review", "suspended", "interested", "under_review", "accepted", "waitlisted"]) {
  assert(phase3Sql.includes(`'${status}'`), `Missing LCDBO Phase 3 workflow status ${status}.`);
}

for (const eventType of [
  "lcdbo.enrolment.created",
  "lcdbo.cluster_interest.created",
]) {
  assert(
    phase3Sql.includes(`'${eventType}'`) || phase3Data.includes(`"${eventType}"`),
    `Missing LCDBO Phase 3 event ${eventType}.`,
  );
}

assert(phase3Sql.includes("request_lcdbo_enrolment"), "Missing registration-safe LCDBO enrolment RPC.");
assert(phase3Sql.includes("registration_context"), "Missing MSME registration context persistence.");

console.log(JSON.stringify({
  ok: true,
  migration: migrationPath,
  phase3Migration: phase3MigrationPath,
  phase3DataLayer: phase3DataPath,
  tables: requiredTables.length,
  modules: requiredModuleKeys.length,
  institutions: requiredInstitutions.length,
  programmes: requiredProgrammes.length,
  clusters: requiredClusters.length,
  phase3: "lcdbo_msme_enrolment_and_cluster_participation",
}, null, 2));
