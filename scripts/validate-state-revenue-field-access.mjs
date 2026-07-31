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

const migrationPath = "supabase/migrations/20260731150000_state_revenue_field_assignment_access_remediation.sql";
const servicePath = "src/lib/state-revenue/onboarding.ts";
const fieldPagePath = "src/app/dashboard/ekirs/verification/field/page.tsx";
const detailPagePath = "src/app/dashboard/ekirs/applications/[id]/page.tsx";
const evidenceRoutePath = "src/app/api/ekirs/evidence/[evidenceId]/route.ts";
const docsPath = "docs/state-revenue-sprint1-onboarding.md";

for (const file of [migrationPath, servicePath, fieldPagePath, detailPagePath, evidenceRoutePath, docsPath]) {
  assert(exists(file), `Missing expected field-access file: ${file}`);
}

const migration = exists(migrationPath) ? read(migrationPath) : "";
const service = exists(servicePath) ? read(servicePath) : "";
const fieldPage = exists(fieldPagePath) ? read(fieldPagePath) : "";
const detailPage = exists(detailPagePath) ? read(detailPagePath) : "";
const evidenceRoute = exists(evidenceRoutePath) ? read(evidenceRoutePath) : "";
const docs = exists(docsPath) ? read(docsPath) : "";

assert(migration.includes("state_revenue_is_assigned_field_officer"), "Migration must add assigned-field-officer helper.");
assert(migration.includes("state_revenue_can_submit_field_outcome"), "Migration must add field-outcome helper.");
assert(migration.includes("public.state_revenue_is_assigned_field_officer(a.id, true)"), "Application read policy must prove assignment, not just role.");
assert(migration.includes("status in ('assigned', 'in_progress')"), "RLS must restrict field officer task mutation to active assignments.");
assert(migration.includes("status in ('in_progress', 'submitted')"), "RLS with-check must restrict field officer task final statuses.");
assert(!migration.toLowerCase().includes("password") && !migration.toLowerCase().includes("auth.users"), "Remediation migration must not provision users or passwords.");
assert(!migration.toLowerCase().includes("truncate") && !migration.toLowerCase().includes("delete from") && !migration.toLowerCase().includes("drop table"), "Remediation migration must be non-destructive.");
assert(!migration.toLowerCase().includes("grant all"), "Remediation migration must not use broad grants.");

assert(service.includes("FIELD_ASSIGNMENT_MANAGEMENT_ROLES"), "Service must define explicit field assignment management roles.");
assert(service.includes("hasAssignedStateRevenueFieldTask"), "Service must centralize assigned field task checks.");
assert(service.includes("canSubmitStateRevenueFieldOutcome"), "Service must centralize field outcome submission checks.");
assert(service.includes("isScopedFieldOfficerOnly"), "Service must identify field-only scoped access.");
assert(service.includes('queue?: "all" | "field"'), "Application list service must support a field queue mode.");
assert(service.includes('if (input.queue === "field") query = query.in("current_status"'), "Field queue must be filtered server-side by field statuses.");
assert(service.includes("query = query.eq(\"assigned_field_officer_id\", input.ctx.appUserId)"), "Field-only list must filter assigned officer before returning rows.");
assert(service.includes('mode?: "view" | "operate" | "approve" | "field" | "assign_field"'), "Application access helper must distinguish assignment management from field submission.");
assert(service.includes('input.action === "assign_field_officer"') && service.includes('? "assign_field"'), "Assign-field action must use assignment-management authorization.");
assert(service.includes("assertEligibleStateRevenueFieldOfficer"), "Assignment must verify selected officer eligibility.");
assert(service.includes("Selected user does not have an active ${input.jurisdiction.acronym} field-officer assignment."), "Assignment must reject ineligible officers.");
assert(service.includes("Only the assigned field officer or an authorised field supervisor can submit this field outcome."), "Field outcome must require exact assignment or explicit override.");
assert(service.includes("state_revenue.field_assignment.created"), "Assignment creation audit event must be recorded.");
assert(service.includes("state_revenue.field_assignment.reassigned"), "Assignment reassignment audit event must be recorded.");
assert(service.includes("state_revenue.field_verification.completed"), "Field completion audit event must be recorded.");
assert(service.includes("state_revenue.field_verification.unable_to_verify"), "Unable-to-verify audit event must be recorded.");
assert(service.includes("This evidence is not available for the assigned field-verification task."), "Evidence access must deny non-field-relevant evidence to field-only users.");

assert(fieldPage.includes("getCurrentUserContext"), "Field page must load current user context.");
assert(fieldPage.includes('queue: "field"'), "Field page must call field queue mode.");
assert(!fieldPage.includes(".filter((row: any)") && !fieldPage.includes("field_verification_required\", \"field_verification_assigned"), "Field page must not rely on post-fetch UI filtering.");

assert(detailPage.includes("fieldOnly"), "Detail page must distinguish field-only users.");
assert(detailPage.includes("FIELD_RELEVANT_EVIDENCE_TYPES"), "Detail page must filter field-only evidence categories.");
assert(detailPage.includes("Available to EKIRS reviewers"), "Field-only detail must hide private reviewer-only contact information.");
assert(detailPage.includes("{!fieldOnly ?") && detailPage.includes("reviewEkirsEvidenceAction"), "Evidence-review controls must be hidden from field-only users.");
assert(detailPage.includes('value="assign_field_officer"') && detailPage.includes('value="approve"') && detailPage.includes("!fieldOnly"), "Assignment and approval controls must be hidden from field-only users.");

assert(evidenceRoute.includes("getStateRevenueEvidenceForAccess"), "Evidence route must use central authorized evidence access.");
assert(!evidenceRoute.includes("console."), "Evidence route must not log signed URLs.");

assert(docs.includes("Field-officer assignment boundary"), "Docs must explain the field-officer assignment boundary.");
assert(docs.includes("scoped `field_officer` role is not enough"), "Docs must clarify role possession is insufficient.");
assert(docs.includes("state_revenue.field_assignment.revoked") && docs.includes("state_revenue.field_verification.started"), "Docs must identify unsupported future audit events rather than fabricating them.");

if (failures.length) {
  console.error("State revenue field access validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("State revenue field access validation passed.");
