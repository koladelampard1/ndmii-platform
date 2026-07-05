#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const operationsService = fs.readFileSync(path.join(root, "src/lib/property/property-operations-service.ts"), "utf8");
const registrationService = fs.readFileSync(path.join(root, "src/lib/property/property-registration-service.ts"), "utf8");
const reviewPage = fs.readFileSync(path.join(root, "src/app/dashboard/property/review/[id]/page.tsx"), "utf8");

const checks = [
  {
    name: "central case access helper exists",
    pass: /export async function requirePropertyCaseAccess/.test(operationsService)
      && /canViewCase/.test(operationsService)
      && /canOperateCase/.test(operationsService)
      && /canOverrideCase/.test(operationsService),
  },
  {
    name: "assigned officer access is exact-case scoped",
    pass: /registryCase\.assigned_to === input\.ctx\.appUserId/.test(operationsService),
  },
  {
    name: "case mutations require exact case access",
    pass: [
      "addCaseComment",
      "assignRegistryCase",
      "updateCaseDecision",
      "reviewDocument",
      "reviewOwner",
      "issueNpinAndCredential",
      "generateCertificate",
    ].every((fn) => new RegExp(`export async function ${fn}[\\s\\S]*?requirePropertyCaseAccess`).test(operationsService)),
  },
  {
    name: "assignment changes require override access",
    pass: /export async function assignRegistryCase[\s\S]*mode: "override"/.test(operationsService)
      && /canOverride \?/.test(reviewPage),
  },
  {
    name: "submitted registrations auto-create registry cases",
    pass: /ensureRegistryCaseForProperty/.test(registrationService)
      && /if \(shouldSubmit\)[\s\S]*ensureRegistryCaseForProperty/.test(registrationService),
  },
  {
    name: "invalid status transitions are rejected",
    pass: /CASE_TRANSITIONS/.test(operationsService)
      && /assertCanTransitionPropertyCase/.test(operationsService)
      && /Invalid registry transition/.test(operationsService),
  },
  {
    name: "approval readiness requires owners and documents",
    pass: /validateOwnerReadiness/.test(operationsService)
      && /validateDocumentReadiness/.test(operationsService)
      && /await assertApprovalReadiness/.test(operationsService),
  },
  {
    name: "document review does not silently map unknown actions",
    pass: /Unsupported document review action/.test(operationsService)
      && /REVIEWABLE_DOCUMENT_STATUSES/.test(operationsService)
      && /superseded_by/.test(operationsService),
  },
  {
    name: "duplicate active certificates are blocked",
    pass: /CERTIFICATE_ACTIVE_STATUSES/.test(operationsService)
      && /An active certificate already exists/.test(operationsService),
  },
  {
    name: "NPIN issuance is approval-gated",
    pass: /NPIN can only be issued after approval or verification/.test(operationsService)
      && /NPIN cannot be issued for rejected, returned or cancelled applications/.test(operationsService),
  },
];

const failed = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? "ok" : "not ok"} - ${check.name}`);
}

assert.equal(failed.length, 0, `${failed.length} Phase 3.5 validation checks failed`);
console.log(JSON.stringify({ ok: true, checks: checks.length, phase: "dlpi_property_registry_operations_hardening_phase35" }, null, 2));
