#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const files = {
  roles: read("src/types/roles.ts"),
  session: read("src/lib/auth/session.ts"),
  authorization: read("src/lib/auth/authorization.ts"),
  workspaceTypes: read("src/lib/workspaces/workspace-types.ts"),
  workspaceRegistry: read("src/lib/workspaces/workspace-registry.ts"),
  workspacePolicy: read("src/lib/workspaces/workspace-access-policy.ts"),
  workspaceServer: read("src/lib/workspaces/workspace-access-server.ts"),
  lcdboDashboard: read("src/app/dashboard/lcdbo/page.tsx"),
  lcdboDelivery: read("src/lib/data/lcdbo-delivery.ts"),
  lcdboIntelligenceAccess: read("src/lib/auth/lcdbo-intelligence-access.ts"),
  lcdboOperationsExport: read("src/app/api/lcdbo/export/[dataset]/route.ts"),
  governanceActions: read("src/app/dashboard/lcdbo/governance-actions.ts"),
  migration: read("supabase/migrations/20260622143000_lcdbo_scoped_workspace_access_hardening.sql"),
};

assert(files.roles.includes('| "workspace_user"'), "workspace_user is missing from UserRole.");
assert(files.session.includes('"workspace_user"'), "workspace_user is missing from server session validation.");
assert(files.authorization.includes("workspace_user: []"), "workspace_user must not receive legacy route prefixes or navigation by default.");
assert(files.authorization.includes('role === "workspace_user" && routeMatchesPrefix(path, "/dashboard/lcdbo")'), "workspace_user must only be allowed through the LCDBO route gate for server-side scoped checks.");
assert(files.workspaceTypes.includes("WorkspaceScopedAccess"), "Workspace scoped access metadata is missing.");
assert(files.workspaceRegistry.includes('baseRoles: ["workspace_user"]'), "LCDBO scoped access must be limited to workspace_user base identities.");
assert(["programme_officer", "institution_admin", "data_analyst", "auditor", "observer"].every((role) => files.workspaceRegistry.includes(`"${role}"`)), "LCDBO scoped roles are incomplete.");
assert(files.workspacePolicy.includes("canAccessWorkspaceWithAssignments") && files.workspacePolicy.includes("canAccessWorkspaceRouteWithAssignments"), "Central scoped workspace evaluator is missing.");
assert(files.workspacePolicy.includes('assignment.status !== "active"') && files.workspacePolicy.includes("expires_at"), "Scoped evaluator must deny inactive or expired assignments.");
assert(files.workspaceServer.includes("role_assignments") && files.workspaceServer.includes("canAccessWorkspaceRouteWithAssignments"), "Workspace server guard must resolve scoped assignments centrally.");
assert(files.lcdboDashboard.includes("VIEW_ROLES") && files.lcdboDashboard.includes("REVIEW_ROLES"), "LCDBO command page must separate view and review/manage roles.");
assert(files.lcdboDashboard.includes("visibleWorkspaceCards") && files.lcdboDashboard.includes('"/dashboard/impact-intelligence"'), "LCDBO-only users must not see out-of-scope Impact Intelligence cards.");
assert(files.lcdboDelivery.includes('"observer"') && files.lcdboDelivery.includes("EXPORT_ROLES"), "LCDBO delivery view/export roles are not correctly separated.");
assert(!files.lcdboIntelligenceAccess.includes('"executive"'), "LCDBO scoped executive role should not be added when observer is the supported read-only role.");
assert(files.lcdboOperationsExport.includes('"data_analyst"') && files.lcdboOperationsExport.includes('"auditor"') && !files.lcdboOperationsExport.includes('"observer"'), "Operational export roles must include analyst/auditor and exclude observer.");
assert(files.governanceActions.includes("canManageLcdboGovernanceSnapshot") && files.governanceActions.includes("institution_admin"), "Governance snapshot actions must support scoped manage roles.");
assert(files.migration.includes("'workspace_user'"), "Migration must add workspace_user to the users.role constraint.");
assert(files.migration.includes("'observer'") && files.migration.includes("lcdbo_can_view_delivery_programme") && files.migration.includes("lcdbo_can_view_intelligence"), "Migration must update LCDBO read RLS helpers for scoped observer access.");

function loadCommonJsModule(file, requireMap = {}) {
  const source = read(file);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: file,
  });
  const module = { exports: {} };
  const dirname = path.dirname(path.join(root, file));
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier in requireMap) return requireMap[specifier];
      throw new Error(`Unexpected validator import ${specifier} from ${file}`);
    },
    __dirname: dirname,
    __filename: path.join(root, file),
  };
  vm.runInNewContext(outputText, sandbox, { filename: file });
  return module.exports;
}

const registryModule = loadCommonJsModule("src/lib/workspaces/workspace-registry.ts");
const policyModule = loadCommonJsModule("src/lib/workspaces/workspace-access-policy.ts", {
  "@/lib/workspaces/workspace-registry": registryModule,
});

const {
  canAccessWorkspace,
  canAccessWorkspaceWithAssignments,
  canAccessWorkspaceRouteWithAssignments,
} = policyModule;

const lcdbOProgrammeId = "00000000-0000-0000-0000-00000000lcd0";
const roseateInstitutionId = "00000000-0000-0000-0000-0000000rf001";
const now = new Date("2026-06-22T12:00:00.000Z");
const baseCtx = { role: "workspace_user", appUserId: "workspace-user-1" };
const matchingAssignment = (role) => ({
  role,
  scope_type: "programme",
  scope_id: lcdbOProgrammeId,
  institution_id: null,
  status: "active",
  expires_at: null,
});
const matchingInstitutionAssignment = (role) => ({
  role,
  scope_type: "institution",
  scope_id: null,
  institution_id: roseateInstitutionId,
  status: "active",
  expires_at: null,
});
const assertDecision = (condition, message) => assert(condition, `Scoped access scenario failed: ${message}`);

assertDecision(!canAccessWorkspace(baseCtx, "lcdbo").allowed, "workspace_user must not receive legacy LCDBO access without a scoped role.");
assertDecision(!canAccessWorkspaceWithAssignments(baseCtx, "lcdbo", [], { scopeId: lcdbOProgrammeId, institutionId: roseateInstitutionId }, now).allowed, "workspace_user with no assignments must be denied.");

for (const role of ["programme_officer", "institution_admin", "data_analyst", "auditor", "observer"]) {
  assertDecision(
    canAccessWorkspaceRouteWithAssignments(baseCtx, "lcdbo", "/dashboard/lcdbo", [matchingAssignment(role)], { scopeId: lcdbOProgrammeId, institutionId: roseateInstitutionId }, now).allowed,
    `${role} programme assignment should grant LCDBO route access.`,
  );
}

assertDecision(
  canAccessWorkspaceRouteWithAssignments(baseCtx, "lcdbo", "/dashboard/lcdbo/reports", [matchingInstitutionAssignment("institution_admin")], { scopeId: lcdbOProgrammeId, institutionId: roseateInstitutionId }, now).allowed,
  "institution_admin assignment tied to the LCDBO institution should grant LCDBO access.",
);
assertDecision(
  !canAccessWorkspaceRouteWithAssignments(baseCtx, "lcdbo", "/dashboard/lcdbo", [matchingAssignment("observer")], { scopeId: "different-programme", institutionId: roseateInstitutionId }, now).allowed,
  "observer assignment for the wrong programme should be denied when programme scope does not match.",
);
assertDecision(
  !canAccessWorkspaceRouteWithAssignments(baseCtx, "lcdbo", "/dashboard/lcdbo", [{ ...matchingAssignment("observer"), status: "revoked" }], { scopeId: lcdbOProgrammeId, institutionId: roseateInstitutionId }, now).allowed,
  "revoked observer assignment should be denied.",
);
assertDecision(
  !canAccessWorkspaceRouteWithAssignments(baseCtx, "lcdbo", "/dashboard/lcdbo", [{ ...matchingAssignment("observer"), expires_at: "2026-06-21T12:00:00.000Z" }], { scopeId: lcdbOProgrammeId, institutionId: roseateInstitutionId }, now).allowed,
  "expired observer assignment should be denied.",
);
assertDecision(
  !canAccessWorkspaceRouteWithAssignments(baseCtx, "nrs", "/dashboard/nrs", [matchingAssignment("observer")], { scopeId: lcdbOProgrammeId, institutionId: roseateInstitutionId }, now).allowed,
  "LCDBO observer assignment must not grant NRS access.",
);
assertDecision(
  !canAccessWorkspaceRouteWithAssignments(baseCtx, "boi", "/dashboard/boi", [matchingAssignment("observer")], { scopeId: lcdbOProgrammeId, institutionId: roseateInstitutionId }, now).allowed,
  "LCDBO observer assignment must not grant BOI access.",
);
assertDecision(
  !canAccessWorkspaceRouteWithAssignments(baseCtx, "impact-intelligence", "/dashboard/impact-intelligence", [matchingAssignment("observer")], { scopeId: lcdbOProgrammeId, institutionId: roseateInstitutionId }, now).allowed,
  "LCDBO observer assignment must not grant Impact Intelligence access.",
);
assertDecision(
  canAccessWorkspace({ role: "admin", appUserId: "admin-1" }, "lcdbo").allowed,
  "existing global admin access must remain intact.",
);

console.log("LCDBO scoped workspace access hardening checks passed.");
