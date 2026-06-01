#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function compact(value) {
  return value.replace(/\s+/g, " ");
}

const checks = [];

function check(name, fn) {
  checks.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const publicVerification = read("src/lib/data/public-verification.ts");
const complaintsRoute = read("src/app/api/public-complaints/route.ts");
const financeRoute = read("src/app/api/msme/finance-readiness/assessments/route.ts");
const logoRoute = read("src/app/api/msme/provider-logo/route.ts");
const authSessionRoute = read("src/app/api/auth/session/route.ts");
const associationAccess = read("src/lib/associations/access.ts");
const associationMemberActions = read("src/lib/data/admin-association-member-actions.ts");
const associationAccessMigration = read("supabase/migrations/20260531170000_association_member_fast_track_access.sql");
const associationWorkspaceMigration = read("supabase/migrations/20260531190000_association_member_fast_track_workspace.sql");
const onboardingSaveHardeningMigration = read("supabase/migrations/20260601100000_msme_onboarding_save_hardening.sql");
const loginPage = read("src/app/(auth)/login/page.tsx");
const msmeOnboardingPage = read("src/app/dashboard/msme/onboarding/page.tsx");

check("public raw ID verification is blocked", () => {
  assert(
    publicVerification.includes("detail.raw_lookup_blocked") &&
      publicVerification.includes("return null"),
    "Expected raw MSME/DBIN public verification to be blocked.",
  );
});

check("public verification validates signed credential token", () => {
  assert(
    publicVerification.includes('.from("digital_identity_credentials")') &&
      publicVerification.includes('.eq("public_token_hash", lookupHash)') &&
      publicVerification.includes("verifyCredentialSignature") &&
      publicVerification.includes('digitalRow.status !== "active"') &&
      publicVerification.includes("isExpired(digitalRow.token_expires_at)") &&
      publicVerification.includes("toPublicRecordFromDigitalRow"),
    "Expected token verification to query by public_token_hash and enforce active, unexpired credential state.",
  );
});

check("public complaints accept related_reference directly", () => {
  assert(
    complaintsRoute.includes('String(formData.get("related_reference") ?? "").trim()') &&
      complaintsRoute.includes("related_reference: related_reference || null"),
    "Expected public complaints route to read related_reference from FormData and persist it directly.",
  );
});

check("finance readiness blocks unauthenticated requests", () => {
  assert(
    financeRoute.includes("!ctx.appUserId") &&
      financeRoute.includes('ctx.role === "public"') &&
      financeRoute.includes("{ status: 401 }"),
    "Expected finance readiness assessment POST to return 401 for missing/public auth context.",
  );
});

check("finance readiness blocks non-msme roles", () => {
  assert(
    financeRoute.includes('ctx.role !== "msme"') &&
      !financeRoute.includes('["msme", "admin"].includes(ctx.role)') &&
      financeRoute.includes("{ status: 403 }"),
    "Expected finance readiness assessment POST to reject every authenticated non-msme role.",
  );
});

check("provider logo upload persists provider_profiles.logo_url", () => {
  const route = compact(logoRoute);
  assert(
    route.includes('const payload = { logo_url: logoUrl, }') &&
      route.includes('.from("provider_profiles") .update(payload)') &&
      route.includes('.select("id,msme_id,logo_url")'),
    "Expected provider logo upload to update provider_profiles.logo_url and select the persisted logo_url.",
  );
});

check("provider logo upload does not write msmes.passport_photo_url", () => {
  assert(
    !logoRoute.includes("passport_photo_url") && !logoRoute.includes('.from("msmes").update'),
    "Provider logo upload route must not write msmes.passport_photo_url.",
  );
});

check("auth session derives helper metadata server-side", () => {
  assert(
    authSessionRoute.includes("resolveSessionMetadata(accessToken)") &&
      authSessionRoute.includes("authClient.auth.getUser(accessToken)") &&
      authSessionRoute.includes('.from("users")') &&
      authSessionRoute.includes("role: metadata.role") &&
      authSessionRoute.includes('response.cookies.set("ndmii_role", metadata.role'),
    "Expected auth session POST to derive role/app user metadata from the Supabase token and users table.",
  );
});

check("association temporary access stores hashed PINs only", () => {
  assert(
    associationAccessMigration.includes("temporary_pin_hash text not null") &&
      !associationAccessMigration.includes("temporary_pin text") &&
      associationAccess.includes("crypto.scryptSync") &&
      associationMemberActions.includes("temporary_pin_hash: hashTemporaryPin(pin)"),
    "Expected fast-track access to persist only scrypt-hashed temporary PINs.",
  );
});

check("association temporary access expires PINs and forces password setup", () => {
  assert(
    associationAccess.includes("temporary_pin_expires_at") &&
      associationAccess.includes("must_change_password") &&
      associationAccess.includes('status: "expired"') &&
      associationAccess.includes('activation_state: "account_created"'),
    "Expected fast-track access to reject expired PINs and require first-login password setup.",
  );
});

check("association temporary access provisions an idempotent draft MSME workspace", () => {
  assert(
    associationAccess.includes("ensureMsmeUserProfile") &&
      associationAccess.includes("ensureDraftMsmeWorkspace") &&
      associationAccess.includes('source_association_member_id') &&
      associationAccess.includes('source: "association_fast_track"') &&
      associationAccess.includes('verification_status: "draft"') &&
      associationAccess.includes('review_status: "draft"') &&
      associationAccess.includes('msme_workspace_provisioned') &&
      associationWorkspaceMigration.includes("add column if not exists source_association_member_id uuid") &&
      loginPage.includes('"/dashboard/msme/onboarding"'),
    "Expected temporary PIN setup to reuse or create a draft MSME workspace and route fast-track accounts into onboarding.",
  );
});

check("MSME onboarding save uses an ownership-gated server write", () => {
  assert(
    msmeOnboardingPage.includes("createServiceRoleSupabaseClient") &&
      msmeOnboardingPage.includes('.eq("id", existing.id)') &&
      msmeOnboardingPage.includes('.eq("created_by", appUserId)') &&
      msmeOnboardingPage.includes(".maybeSingle()") &&
      msmeOnboardingPage.includes("Unable to save onboarding details. Please refresh and try again."),
    "Expected MSME onboarding writes to use a server-side client only with an explicit owner constraint and zero-row handling.",
  );
});

check("MSME onboarding save does not issue credentials", () => {
  assert(
    !msmeOnboardingPage.includes("ensurePendingCredential") &&
      !msmeOnboardingPage.includes("issued_at"),
    "MSME onboarding save must not issue credentials or mark an identity as issued.",
  );
});

check("MSME onboarding tolerates a missing validation results table", () => {
  assert(
    msmeOnboardingPage.includes("isMissingValidationResultsTable") &&
      msmeOnboardingPage.includes('operation: isMissingValidationResultsTable(validationResultError) ? "skip_missing_table" : "upsert_failed"') &&
      onboardingSaveHardeningMigration.includes("create table if not exists public.validation_results"),
    "Expected onboarding to continue when validation_results is missing and the hardening migration to repair the table.",
  );
});

check("association member MSME linkage is unique when present", () => {
  assert(
    onboardingSaveHardeningMigration.includes("create unique index if not exists idx_msmes_source_association_member_unique") &&
      onboardingSaveHardeningMigration.includes("where source_association_member_id is not null"),
    "Expected a partial unique index to prevent duplicate association member MSME workspaces.",
  );
});

let failures = 0;

for (const { name, fn } of checks) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(`  ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} DBIN smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} DBIN smoke checks passed.`);
