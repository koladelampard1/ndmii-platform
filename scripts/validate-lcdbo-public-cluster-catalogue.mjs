import fs from "node:fs";
import assert from "node:assert/strict";

const routing = fs.readFileSync("src/lib/routing/dbin-hosts.ts", "utf8");
const data = fs.readFileSync("src/lib/lcdbo/cluster-catalogue.ts", "utf8");
const clustersPage = fs.readFileSync("src/app/lcdbo/clusters/page.tsx", "utf8");
const cataloguePage = fs.readFileSync("src/app/lcdbo/clusters/catalogue/page.tsx", "utf8");
const lgaPage = fs.readFileSync("src/app/lcdbo/clusters/lga/[lgaPublicReference]/page.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260803120000_lcdbo_lga_anchor_product_catalogue_governance.sql", "utf8");

for (const route of [
  "src/app/lcdbo/clusters/map/page.tsx",
  "src/app/lcdbo/clusters/state/[stateSlug]/page.tsx",
  "src/app/lcdbo/clusters/lga/[lgaPublicReference]/page.tsx",
  "src/app/lcdbo/clusters/catalogue/page.tsx",
  "src/app/lcdbo/clusters/[publicClusterReference]/page.tsx",
  "src/app/dashboard/lcdbo/source-intelligence/page.tsx",
]) {
  assert(fs.existsSync(route), `Missing route ${route}.`);
}

assert(data.includes(".select(\"public_reference,public_slug,name,slug,cluster_type,sector,status,public_summary,investment_required,jobs_target,msme_target,data_classification,last_public_reviewed_at\")"), "Public catalogue loader must use an explicit projection.");
assert(!data.includes(".select(\"*\")"), "Public catalogue data helper must not use select('*').");
assert(data.includes(".eq(\"public_visibility\", \"public_catalogue\")"), "Catalogue must filter public catalogue visibility.");
assert(data.includes(".eq(\"publication_status\", \"published\")"), "Catalogue must filter published records.");
assert(data.includes(".in(\"data_classification\", [\"approved_programme_record\", \"live_operational_data\"])"), "Catalogue must restrict data classifications.");
assert(!cataloguePage.includes("fallbackClusters"), "Approved catalogue must not render fallback clusters.");
assert(!cataloguePage.includes("featuredClusters"), "Approved catalogue must not render hard-coded featured clusters.");
assert(clustersPage.includes("Opportunity evidence is not the same as an approved cluster."), "Opportunity explorer must explain classification.");
assert(lgaPage.includes("Approved Anchor Product") && lgaPage.includes("None"), "LGA profile must avoid fabricated approvals.");
assert(migration.includes("industrial_clusters_public_catalogue_check"), "Migration must enforce public catalogue publication prerequisites.");
assert(routing.includes('publicPath.startsWith("/clusters/state/")'), "Host routing must support state cluster profiles.");
assert(routing.includes('publicPath.startsWith("/clusters/lga/")'), "Host routing must support LGA cluster profiles.");

console.log(JSON.stringify({
  validation: "lcdbo_public_cluster_catalogue",
  status: "passed",
  routes: 6,
}, null, 2));
