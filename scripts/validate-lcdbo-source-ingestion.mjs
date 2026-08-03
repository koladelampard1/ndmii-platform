import fs from "node:fs";
import assert from "node:assert/strict";

const sourcePath = "data/lcdbo/rmrdc-lga-resource-source.json";
const extractorPath = "scripts/extract-rmrdc-lga-resource-source.py";

assert(fs.existsSync(sourcePath), "Missing governed RMRDC source artifact.");
assert(fs.existsSync(extractorPath), "Missing deterministic RMRDC extraction script.");

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
assert.equal(source.metadata.source_document_key, "rmrdc_lga_investment_opportunities_2017");
assert.equal(source.metadata.source_institution, "Raw Materials Research and Development Council");
assert.equal(source.metadata.publication_month, "August 2017");
assert.equal(source.metadata.pdf_pages, 235);
assert.equal(source.metadata.source_row_count, source.rows.length);
assert(source.rows.length >= 700, "Expected a substantial LGA source extraction.");
assert.equal(new Set(source.rows.map((row) => row.normalised_state)).size, 37, "Expected 36 states plus FCT coverage from source labels.");

for (const row of source.rows) {
  assert(row.source_row_id, "Every row must retain a source row id.");
  assert(Number.isInteger(row.source_page) && row.source_page > 0, "Every row must retain a source page.");
  assert(row.source_state_label, "Every row must retain original state label.");
  assert(row.source_lga_label_original, "Every row must retain original LGA label.");
  assert(row.source_text, "Every row must retain original source text.");
  assert(row.source_material_and_opportunity_text, "Every row must retain material/opportunity text.");
  assert.equal(row.source_classification, "RMRDC Reference Source — 2017");
}

assert(!JSON.stringify(source).includes("approved_anchor_product"), "Source artifact must not fabricate approved anchor products.");

console.log(JSON.stringify({
  validation: "lcdbo_source_ingestion",
  status: "passed",
  rows: source.rows.length,
  statesAndFct: new Set(source.rows.map((row) => row.normalised_state)).size,
}, null, 2));
