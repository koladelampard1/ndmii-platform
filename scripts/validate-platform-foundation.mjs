#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve("supabase/migrations/20260620120000_platform_workspace_foundation.sql");
const sql = readFileSync(migrationPath, "utf8");

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

console.log(JSON.stringify({
  ok: true,
  migration: migrationPath,
  tables: requiredTables.length,
  modules: requiredModuleKeys.length,
  institutions: requiredInstitutions.length,
  programmes: requiredProgrammes.length,
  clusters: requiredClusters.length,
}, null, 2));
