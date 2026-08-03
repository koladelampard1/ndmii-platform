import fs from "node:fs";
import assert from "node:assert/strict";

const migrationPath = "supabase/migrations/20260803120000_lcdbo_lga_anchor_product_catalogue_governance.sql";
const migration = fs.readFileSync(migrationPath, "utf8");

for (const table of [
  "lcdbo_source_documents",
  "lcdbo_source_import_batches",
  "lcdbo_lga_source_aliases",
  "lcdbo_lga_resource_source_rows",
  "lcdbo_raw_materials",
  "lcdbo_lga_raw_material_evidence",
  "lcdbo_resource_investment_opportunities",
  "lcdbo_anchor_product_candidates",
  "lcdbo_anchor_product_decision_history",
  "lcdbo_cluster_publications",
]) {
  assert(migration.includes(`create table if not exists public.${table}`), `Missing table ${table}.`);
  assert(migration.includes(`alter table public.${table} enable row level security`), `${table} must enable RLS.`);
  assert(migration.includes(`revoke all on table public.${table} from anon`), `${table} must revoke anonymous access.`);
}

assert(migration.includes("idx_lcdbo_anchor_one_current_approved_per_lga"), "Missing one-current-approved-anchor unique index.");
assert(migration.includes("where approval_status = 'approved' and superseded_at is null"), "Current approved anchor index must only target non-superseded approvals.");
assert(migration.includes("override_reason text"), "Anchor-product override reason must be retained.");
assert(migration.includes("lcdbo_anchor_product_decision_history"), "Anchor decision history table must exist.");
assert(migration.includes("public.lcdbo_can_govern_anchor_products"), "Missing central LCDBO anchor governance helper.");
assert(migration.includes("public.lcdbo_can_read_anchor_governance"), "Missing read-only LCDBO anchor governance helper.");
assert(migration.includes("'observer'"), "Observer role must retain read-only source governance visibility.");
assert(!migration.includes("truncate table"), "Migration must not destructively truncate data.");
assert(!migration.includes("delete from public."), "Migration must not broadly delete data.");

console.log(JSON.stringify({
  validation: "lcdbo_anchor_product_governance",
  status: "passed",
  migration: migrationPath,
}, null, 2));
