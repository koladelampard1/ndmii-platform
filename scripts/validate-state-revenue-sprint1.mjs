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

const requiredFiles = [
  "supabase/migrations/20260731120000_state_revenue_business_onboarding_sprint1.sql",
  "src/lib/state-revenue/onboarding.ts",
  "src/components/state-revenue/application-form.tsx",
  "src/app/ekirs/apply/page.tsx",
  "src/app/ekirs/apply/new/page.tsx",
  "src/app/ekirs/apply/existing/page.tsx",
  "src/app/ekirs/apply/status/page.tsx",
  "src/app/ekirs/apply/resume/[reference]/page.tsx",
  "src/app/ekirs/apply/actions.ts",
  "src/app/api/ekirs/evidence/[evidenceId]/route.ts",
  "src/app/dashboard/ekirs/applications/page.tsx",
  "src/app/dashboard/ekirs/applications/[id]/page.tsx",
  "src/app/dashboard/ekirs/applications/actions.ts",
  "src/app/dashboard/ekirs/verification/field/page.tsx",
  "src/app/dashboard/ekirs/verification/duplicates/page.tsx",
  "docs/state-revenue-sprint1-onboarding.md",
];

for (const file of requiredFiles) assert(exists(file), `Missing Sprint 1 file: ${file}`);

const migration = read("supabase/migrations/20260731120000_state_revenue_business_onboarding_sprint1.sql");
const service = read("src/lib/state-revenue/onboarding.ts");
const form = read("src/components/state-revenue/application-form.tsx");
const actions = read("src/app/ekirs/apply/actions.ts");
const resumePage = read("src/app/ekirs/apply/resume/[reference]/page.tsx");
const evidenceRoute = read("src/app/api/ekirs/evidence/[evidenceId]/route.ts");
const landing = read("src/app/ekirs/page.tsx");
const routing = read("src/lib/routing/dbin-hosts.ts");
const routingTest = read("scripts/test-dbin-host-routing.mjs");
const workspaceRegistry = read("src/lib/workspaces/workspace-registry.ts");
const platformFoundation = read("src/lib/data/platform-foundation.ts");
const dashboardApplications = read("src/app/dashboard/ekirs/applications/page.tsx");
const detailPage = read("src/app/dashboard/ekirs/applications/[id]/page.tsx");
const duplicatesPage = read("src/app/dashboard/ekirs/verification/duplicates/page.tsx");
const docs = read("docs/state-revenue-sprint1-onboarding.md");

assert(migration.includes("create table if not exists public.state_revenue_applications"), "Migration must create state_revenue_applications.");
assert(migration.includes("create table if not exists public.state_revenue_operating_locations"), "Migration must create operating locations.");
assert(migration.includes("create table if not exists public.state_revenue_jurisdiction_relationships"), "Migration must create jurisdiction relationships.");
assert(migration.includes("create table if not exists public.state_revenue_application_evidence"), "Migration must create evidence metadata.");
assert(migration.includes("create table if not exists public.state_revenue_verification_tasks"), "Migration must create verification tasks.");
assert(migration.includes("state_revenue_application_status_history"), "Migration must preserve application status history.");
assert(migration.includes("state_revenue_identity_resolution_records"), "Migration must preserve identity-resolution records.");
assert(migration.includes("state_revenue_notifications"), "Migration must create notification outbox.");
assert(migration.includes("additional_information_request"), "Migration must preserve additional-information requests.");
assert(migration.includes("replacement_for_evidence_id"), "Migration must preserve evidence replacement history.");
assert(migration.includes("'replacement_requested'"), "Migration must support evidence replacement-request lifecycle.");
assert(migration.includes("enable row level security"), "Migration must enable RLS.");
assert(migration.includes("state_revenue_can_access_application"), "Migration must include per-application RLS helper.");
assert(migration.includes("revoke all on table public.state_revenue_applications from anon"), "Migration must revoke anonymous application table access.");
assert(migration.includes("'state-revenue-evidence'") && migration.includes("public = false"), "Evidence storage bucket must be private.");
assert(migration.includes("a.current_status in ('draft', 'evidence_required', 'additional_information_required')"), "Evidence insert policy must lock resubmitted applications.");
assert(!migration.toLowerCase().includes("auth.users"), "Migration must not provision Supabase Auth users.");
assert(!migration.toLowerCase().includes("password"), "Migration must not contain passwords.");
assert(!migration.toLowerCase().includes("drop table"), "Migration must be additive and not drop tables.");
assert(!migration.toLowerCase().includes("truncate"), "Migration must not truncate data.");
assert(!migration.toLowerCase().includes("delete from"), "Migration must not delete data.");
assert(!migration.includes("grant all"), "Migration must avoid broad grant all.");

assert(service.includes("createStateRevenueApplication"), "Shared service must create onboarding applications.");
assert(service.includes("reviewStateRevenueApplication"), "Shared service must review applications.");
assert(service.includes("lookupStateRevenueApplicationStatus"), "Shared service must expose safe status lookup.");
assert(service.includes("requireStateRevenueApplicationAccess"), "Shared service must enforce per-application access.");
assert(service.includes("findIdentityCandidates"), "Shared service must include duplicate screening.");
assert(service.includes("generateMsmeId(input.jurisdiction.geography.stateCode)"), "New identity generation must derive from jurisdiction state code.");
assert(service.includes("approveCredential"), "Approval must issue credential through existing credential service.");
assert(service.includes("recordTrustedStateRevenueEvent"), "Service must record trusted platform audit events.");
assert(service.includes("cleanPostgrestSearch"), "Service must sanitize free-text PostgREST search.");
assert(service.includes('"submit_field_verification"'), "Field-verification submission action must be supported.");
assert(service.includes("saveStateRevenueApplicationDraft"), "Shared service must support authenticated draft save/resume.");
assert(service.includes("uploadStateRevenueApplicationEvidence"), "Shared service must support secure evidence upload.");
assert(service.includes("reviewStateRevenueApplicationEvidence"), "Shared service must support evidence review decisions.");
assert(service.includes("assertOwnedExistingBusiness"), "Existing-business selection must be ownership-checked server-side.");
assert(service.includes("STATE_REVENUE_EVIDENCE_MIME_TYPES") && service.includes("STATE_REVENUE_EVIDENCE_MAX_FILE_SIZE"), "Evidence upload must validate MIME type and size.");
assert(service.includes("Uploaded evidence is required before evidence can be accepted."), "Metadata-only evidence must not be accepted.");
assert(service.includes("Accepted uploaded operating-presence evidence is required before approval."), "Approval must require accepted uploaded evidence.");
assert(service.includes("Application is already approved."), "Retried approval must be blocked before duplicate credential events.");
assert(service.includes('const APPLICANT_EDITABLE_STATUSES = new Set<StateRevenueApplicationStatus>(["draft", "evidence_required", "additional_information_required"])'), "Resubmitted applications must not remain applicant-editable.");
assert(service.includes('rejected: []'), "Rejected applications must remain terminal for applicant mutation.");
assert(service.includes('evidence_required: ["resubmitted", "rejected", "withdrawn"]'), "evidence_required must be a formal state-machine state.");
assert(service.includes('replacementTarget.evidence_status !== "replacement_requested"'), "Evidence replacement must require explicit reviewer replacement request.");
assert(service.includes("Evidence replacement is available only after a reviewer requests replacement."), "Evidence replacement denial must be enforced server-side.");

const forbiddenNeutralTokens = ["EKIRS", "Ekiti", "BIN-EK", "ekirs.dbin.ng", "/dashboard/ekirs", "ekiti-state-internal-revenue-service"];
for (const token of forbiddenNeutralTokens) {
  assert(!service.includes(token), `Shared onboarding service must not hard-code ${token}.`);
}

assert(actions.includes('jurisdictionId: "ekiti"'), "EKIRS adapter action must select the Ekiti jurisdiction explicitly.");
assert(actions.includes("Sign in is required") || actions.includes("redirect(`/login?workspace=ekirs"), "Application save/submit must require authentication instead of fake unauthenticated resume.");
assert(actions.includes("TODO(rate-limit)"), "Public status lookup must include a rate-limit integration point.");
assert(actions.includes("uploadEkirsApplicationEvidenceAction"), "EKIRS actions must include secure evidence upload.");
assert(form.includes('name="evidence_types"'), "Application form must capture evidence metadata types.");
assert(form.includes('name="declaration_accepted"'), "Application form must capture applicant declaration.");
assert(form.includes('name="intent"') && form.includes('value="draft"'), "Application form must support save draft.");
assert(form.includes("ownedBusinesses"), "Existing-business form must accept owned-business options.");
assert(!form.includes('Existing DBIN business UUID'), "Existing-business form must not ask applicants for raw UUIDs.");
assert(resumePage.includes("getOwnedStateRevenueApplicationByReference"), "Resume page must load only the authenticated applicant's application.");
assert(resumePage.includes('["draft", "evidence_required", "additional_information_required"].includes(application.current_status)'), "Resume page must render resubmitted applications read-only.");
assert(resumePage.includes('type="file"') && resumePage.includes("uploadEkirsApplicationEvidenceAction"), "Resume page must expose controlled evidence upload.");
assert(evidenceRoute.includes("createSignedUrl") && evidenceRoute.includes("getStateRevenueEvidenceForAccess"), "Evidence access route must create authorization-checked signed URLs.");
assert(!evidenceRoute.includes("signedUrl") || !evidenceRoute.includes("console."), "Evidence route must not log signed URLs.");
assert(landing.includes("/ekirs/apply"), "EKIRS landing must link to application intake.");
assert(routing.includes('pathname === "/apply"') && routing.includes('return `/ekirs${pathname}`'), "EKIRS host routing must expose /apply paths.");
assert(routingTest.includes('resolveDbinRewritePath("ekirs", "/apply/new")'), "Routing tests must cover EKIRS application paths.");
assert(workspaceRegistry.includes("/dashboard/ekirs/applications"), "Workspace navigation must include applications.");
assert(workspaceRegistry.includes("/dashboard/ekirs/verification/field"), "Workspace navigation must include field verification.");
assert(workspaceRegistry.includes("/dashboard/ekirs/verification/duplicates"), "Workspace navigation must include duplicate review.");
assert(platformFoundation.includes("recordTrustedStateRevenueEvent"), "Trusted state revenue audit writer must exist.");
assert(platformFoundation.includes('eventType.startsWith("state_revenue.")'), "Trusted state revenue writer must enforce namespace.");
assert(dashboardApplications.includes("listStateRevenueApplications"), "Applications dashboard must load application queue.");
assert(detailPage.includes("reviewEkirsApplicationAction"), "Application detail page must expose reviewer action.");
assert(detailPage.includes('value="submit_field_verification"'), "Detail page must expose field outcome submission.");
assert(detailPage.includes('value="request_additional_information"'), "Detail page must expose additional-information request.");
assert(detailPage.includes("reviewEkirsEvidenceAction"), "Detail page must expose evidence-review controls.");
assert(service.includes("field_verification_submitted"), "Field queue service must cover submitted field outcomes.");
assert(duplicatesPage.includes("strong_match"), "Duplicate page must cover strong-match duplicate candidates.");
assert(docs.includes("`resubmitted`: read-only"), "Docs must classify resubmitted applications as applicant read-only.");
assert(docs.includes("Production gates before unrestricted launch"), "Docs must classify production-readiness gates explicitly.");
assert(docs.includes("Transactional/RPC-based approval"), "Docs must list transactional approval as a production gate.");
assert(docs.includes("Rate limiting for the public application-status lookup"), "Docs must list status lookup rate limiting as a production gate.");
assert(docs.includes("Malware scanning or equivalent document-security control"), "Docs must list evidence scanning as a production gate.");
assert(docs.includes("Live Supabase RLS and Storage policy verification"), "Docs must list live RLS/storage verification as a production gate.");
assert(docs.includes("Authenticated browser QA and role-based UAT"), "Docs must list browser/role UAT as a production gate.");

if (failures.length) {
  console.error("State revenue Sprint 1 validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("State revenue Sprint 1 validation passed.");
