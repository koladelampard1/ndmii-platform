#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const experienceFiles = [
  "src/app/ekirs/page.tsx",
  "src/app/ekirs/apply/page.tsx",
  "src/app/ekirs/apply/new/page.tsx",
  "src/app/ekirs/apply/existing/page.tsx",
  "src/app/ekirs/apply/status/page.tsx",
  "src/app/ekirs/apply/resume/[reference]/page.tsx",
  "src/app/dashboard/ekirs/page.tsx",
  "src/app/dashboard/ekirs/applications/page.tsx",
  "src/app/dashboard/ekirs/applications/[id]/page.tsx",
  "src/app/dashboard/ekirs/businesses/page.tsx",
  "src/app/dashboard/ekirs/businesses/[id]/page.tsx",
  "src/app/dashboard/ekirs/verification/page.tsx",
  "src/app/dashboard/ekirs/verification/field/page.tsx",
  "src/app/dashboard/ekirs/verification/duplicates/page.tsx",
  "src/app/dashboard/ekirs/formalisation/page.tsx",
  "src/app/dashboard/ekirs/intelligence/page.tsx",
  "src/app/dashboard/ekirs/integrations/page.tsx",
  "src/app/dashboard/ekirs/pilot-readiness/page.tsx",
  "src/components/state-revenue/application-form.tsx",
  "src/components/state-revenue/state-revenue-components.tsx",
  "src/app/(auth)/login/page.tsx",
  "src/app/access-denied/page.tsx",
];

for (const file of experienceFiles) assert(exists(file), `Missing EKIRS experience file: ${file}`);

const publicLanding = read("src/app/ekirs/page.tsx");
const applyLanding = read("src/app/ekirs/apply/page.tsx");
const publicComponents = read("src/components/state-revenue/state-revenue-components.tsx");
const applicationForm = read("src/components/state-revenue/application-form.tsx");
const loginPage = read("src/app/(auth)/login/page.tsx");
const accessDenied = read("src/app/access-denied/page.tsx");
const jurisdiction = read("src/lib/state-revenue/jurisdictions.ts");
const sessionRoute = read("src/app/api/auth/session/route.ts");

assert(publicComponents.includes("StateRevenuePublicShell"), "EKIRS public pages must use the premium public shell.");
assert(publicComponents.includes("StateRevenueHero"), "EKIRS public landing must have a dedicated hero component.");
assert(publicComponents.includes("StateRevenueProgressTracker"), "EKIRS application journey must include a progress tracker.");
assert(publicComponents.includes("StateRevenueInsightCard"), "EKIRS pages must expose polished institutional insight cards.");
assert(applicationForm.includes("StateRevenueProgressTracker"), "Application form must include visible application-stage guidance.");
assert(publicLanding.includes("Ekiti Business Formalisation and Revenue Readiness Platform"), "EKIRS landing headline must remain institutionally positioned.");
assert(publicLanding.includes("/ekirs/apply") && publicLanding.includes("/login?workspace=ekirs"), "EKIRS landing must preserve applicant and staff CTAs.");
assert(applyLanding.includes("/ekirs/apply/new") && applyLanding.includes("/ekirs/apply/existing"), "Application pathway page must preserve new and existing business journeys.");
assert(loginPage.includes("isEkirsLogin") && loginPage.includes("Sign in to EKIRS"), "Login must provide an EKIRS-aware sign-in experience.");
assert(sessionRoute.includes("resolveLoginDestination"), "Login flow must keep server-authorised routing.");
assert(accessDenied.includes("workspace === \"ekirs\""), "Access denied page must keep EKIRS-aware messaging.");
assert(jurisdiction.includes("Operational Readiness"), "Visible EKIRS module language must use Operational Readiness.");
assert(jurisdiction.toLowerCase().includes("controlled uat"), "EKIRS disclosure must classify the environment as controlled UAT.");

const forbiddenAudienceLanguage = [
  "Sprint 0",
  "Sprint 1",
  "workspace shell",
  "configured businesses",
  "Live feeds",
  "live feeds",
  "Pilot Readiness",
  "pilot users",
  "user provisioning remains out of scope",
  "deterministic demonstration records",
  "demonstration records",
  "live demonstration",
  "Try demo",
  "Placeholder",
  "prototype",
];

for (const file of experienceFiles) {
  const source = read(file);
  for (const token of forbiddenAudienceLanguage) {
    assert(!source.includes(token), `${file} must not expose old scaffold language: ${token}`);
  }
}

const forbiddenOperationalSignals = ["collectionAmount", "liabilityAmount", "taxpayer payment", "live revenue feeds"];
for (const file of experienceFiles) {
  const source = read(file);
  for (const token of forbiddenOperationalSignals) {
    assert(!source.includes(token), `${file} must not expose revenue/liability implementation signal: ${token}`);
  }
}

if (failures.length) {
  console.error("EKIRS experience validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("EKIRS experience validation passed.");
