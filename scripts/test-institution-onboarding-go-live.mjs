import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCsv, parseImportRows, validCheckUpdate, validOnboardingSetup } from "../src/lib/institutional/onboarding-policy.ts";

const migration = readFileSync("supabase/migrations/20261018143724_institution_onboarding_go_live.sql", "utf8");
const hardening = readFileSync("supabase/migrations/20261018144218_harden_institution_onboarding_controls.sql", "utf8");
const onboarding = readFileSync("src/app/api/institutions/[institutionId]/onboarding/route.ts", "utf8");
const imports = readFileSync("src/app/api/institutions/[institutionId]/onboarding/imports/route.ts", "utf8");

test("setup and evidence validation bound institution onboarding input", () => {
  assert.equal(validOnboardingSetup({ operatingModel: "relationship_mfb", targetGoLiveDate: "2026-12-01", expectedAgents: 20, expectedBusinesses: 500, programmeOwner: "Operations", technicalOwner: "Technology" }), true);
  assert.equal(validOnboardingSetup({ operatingModel: "custom_bank", targetGoLiveDate: null, expectedAgents: 20, expectedBusinesses: 500, programmeOwner: "", technicalOwner: "" }), false);
  assert.equal(validCheckUpdate({ checkId: "11111111-1111-4111-8111-111111111111", status: "passed", evidenceNote: "UAT signed", evidenceUrl: "https://example.test/evidence" }), true);
  assert.equal(validCheckUpdate({ checkId: "bad", status: "passed", evidenceNote: "", evidenceUrl: null }), false);
});
test("CSV parsing supports quoted cells and rejects incomplete documents", () => {
  assert.deepEqual(parseCsv('email,bdsp_name,service_states\nagent@example.test,"North, South",Lagos|Ogun'), [{ email: "agent@example.test", bdsp_name: "North, South", service_states: "Lagos|Ogun" }]);
  assert.equal(parseCsv("email\n"), null);
  assert.equal(parseCsv('email\n"unfinished'), null);
});
test("bulk rows are normalized and duplicate identities are rejected", () => {
  const rows = parseImportRows([{ email: "AGENT@example.test", serviceStates: ["Lagos"] }, { email: "agent@example.test", serviceStates: ["Lagos"] }], "agents");
  assert.equal(rows?.[0].rowData.email, "agent@example.test");
  assert.deepEqual(rows?.[1].errors, ["Duplicate email in this import."]);
  assert.equal(parseImportRows([], "agents"), null);
});

test("schema is server-only, institution-scoped and computes activation readiness", () => {
  for (const table of ["institution_onboarding_projects", "institution_onboarding_checks", "institution_import_batches", "institution_import_rows"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /institution_initialize_onboarding/);
  assert.match(migration, /institution_go_live_readiness/);
  assert.match(migration, /institution_activate_onboarding/);
  assert.match(migration, /where c\.institution_id = p_institution_id/);
  assert.match(migration, /revoke all on function public\.institution_go_live_readiness\(uuid\) from public, anon, authenticated/);
  assert.match(hardening, /prevent_institution_onboarding_model_change/);
  assert.match(hardening, /c\.required and c\.status <> 'passed'/);
});

test("routes revalidate manager access and reserve provisioning and activation for platform admins", () => {
  assert.match(onboarding, /requireInstitutionActor/); assert.match(onboarding, /requireManager/); assert.match(onboarding, /requirePlatformOnboardingManager/);
  assert.match(onboarding, /institution_activate_onboarding/); assert.match(onboarding, /institution\.onboarding\.activated/);
  assert.match(onboarding, /mandatory control must be passed/);
  assert.match(imports, /requireInstitutionActor/); assert.match(imports, /\.eq\("institution_id", actor\.institution\.id\)/);
  assert.match(imports, /findVerifiedExistingUser/); assert.match(imports, /institution_import_rows/);
});
