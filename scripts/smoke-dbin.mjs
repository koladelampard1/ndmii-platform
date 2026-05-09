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

check("public verification resolves msmes.msme_id", () => {
  assert(
    publicVerification.includes('.from("msmes")') &&
      publicVerification.includes('.eq("msme_id", normalizedId)'),
    "Expected getPublicVerificationDetail to query msmes by normalized msme_id.",
  );
});

check("public verification resolves digital_ids.ndmii_id", () => {
  assert(
    publicVerification.includes('.from("digital_ids")') &&
      publicVerification.includes('.eq("ndmii_id", normalizedId)') &&
      publicVerification.includes("toPublicRecordFromDigitalRow"),
    "Expected getPublicVerificationDetail to query digital_ids by normalized ndmii_id and map the linked MSME.",
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
