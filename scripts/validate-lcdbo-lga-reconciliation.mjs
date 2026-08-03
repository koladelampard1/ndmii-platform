import fs from "node:fs";
import assert from "node:assert/strict";

const source = JSON.parse(fs.readFileSync("data/lcdbo/rmrdc-lga-resource-source.json", "utf8"));
const migration = fs.readFileSync("supabase/migrations/20260620120000_platform_workspace_foundation.sql", "utf8");

const lgaValues = [...migration.matchAll(/\('([^']+)', '([^']+)', '([^']+)'\)/g)]
  .filter(([, , , code]) => code.includes("-"))
  .map(([, state, lga, code]) => ({ state, lga, code }));

assert(lgaValues.length > 0, "Could not inspect canonical LGA seed values.");
assert(lgaValues.length < 774, "This validator expects the current repository to report partial canonical LGA coverage honestly.");

const canonical = new Set(lgaValues.map((row) => `${row.state.toLowerCase()}|${row.lga.toLowerCase()}`));
const exact = source.rows.filter((row) => canonical.has(`${row.normalised_state.toLowerCase()}|${row.source_lga_label.toLowerCase()}`));
const duplicateSourceRows = source.rows.length - new Set(source.rows.map((row) => row.source_row_id)).size;
const duplicateCanonicalAssignments = exact.length - new Set(exact.map((row) => `${row.normalised_state}|${row.source_lga_label}`)).size;
const ambiguous = source.rows.length - exact.length;

assert.equal(duplicateSourceRows, 0, "Source row ids must be unique.");
assert.equal(duplicateCanonicalAssignments, 0, "Exact canonical mappings must not duplicate an LGA.");
assert(ambiguous > 0, "Most rows should remain review-required until a complete canonical LGA register exists.");

console.log(JSON.stringify({
  validation: "lcdbo_lga_reconciliation",
  status: "passed",
  sourceRows: source.rows.length,
  canonicalLgaSeedCount: lgaValues.length,
  exactMatches: exact.length,
  aliasMatches: 0,
  ambiguous,
  all774AccountedFor: false,
}, null, 2));
