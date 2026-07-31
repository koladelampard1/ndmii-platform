#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const sessionRoute = read("src/app/api/auth/session/route.ts");
const loginPage = read("src/app/(auth)/login/page.tsx");
const accessDenied = read("src/app/access-denied/page.tsx");
const loginDestination = read("src/lib/auth/login-destination.ts");

assert(sessionRoute.includes("resolveLoginDestination"), "Session route must resolve post-login destinations server-side.");
assert(sessionRoute.includes("targetRoute: destination.targetRoute"), "Session route must return the authorised target route.");
assert(!sessionRoute.includes("responseSetCookieHeaders"), "Session route must not log Set-Cookie values or token-bearing headers.");
assert(loginPage.includes("sessionDebug?.targetRoute"), "Login page must use the server-authorised target route.");
assert(!loginPage.includes("canAccessRoute(verifiedRole"), "Login page must not authorize scoped return paths using only the global role.");
assert(accessDenied.includes("workspace === \"ekirs\""), "Access denied page must include EKIRS-aware messaging.");
assert(loginDestination.includes("canAccessWorkspaceRouteWithAssignments"), "Login destination resolver must reuse central scoped workspace route policy.");
assert(loginDestination.includes("institutionSlug"), "Login destination resolver must resolve institution-scoped workspaces.");
assert(loginDestination.includes("field_officer") && loginDestination.includes("/dashboard/ekirs/verification/field"), "Field officers must default to the field verification queue.");
assert(loginDestination.includes("registration_reviewer") && loginDestination.includes("/dashboard/ekirs/applications"), "Registration reviewers must default to applications.");

function loadLoginDestinationModule() {
  const { outputText } = ts.transpileModule(loginDestination, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: "src/lib/auth/login-destination.ts",
  });

  const cjsModule = { exports: {} };
  vm.runInNewContext(outputText, {
    module: cjsModule,
    exports: cjsModule.exports,
    require(specifier) {
      if (specifier === "@/lib/auth/authorization") {
        return {
          canAccessRoute(role, route) {
            if (route === "/ekirs" || route.startsWith("/ekirs/")) return true;
            if ((role === "admin" || role === "super_admin") && route.startsWith("/dashboard/ekirs")) return true;
            if ((role === "nrs_officer" || role === "firs_officer") && route.startsWith("/dashboard/nrs")) return true;
            return false;
          },
          getDefaultDashboardRoute(role) {
            if (role === "msme") return "/dashboard/msme";
            if (role === "workspace_user") return "/dashboard";
            if (role === "admin" || role === "super_admin") return "/dashboard/admin";
            return "/login";
          },
        };
      }
      if (specifier === "@/lib/routing/dbin-hosts") {
        return {
          resolveDbinHostSurface(host) {
            return String(host ?? "").toLowerCase().includes("ekirs") ? "ekirs" : "marketing";
          },
        };
      }
      if (specifier === "@/lib/workspaces/workspace-registry") {
        return {
          getWorkspaceDefinition(id) {
            if (id !== "ekirs") throw new Error(`Unexpected workspace ${id}`);
            return {
              id: "ekirs",
              scopedAccess: {
                baseRoles: ["workspace_user"],
                roles: [
                  "state_revenue_admin",
                  "registration_reviewer",
                  "field_supervisor",
                  "field_officer",
                  "taxpayer_support_officer",
                  "state_revenue_executive",
                  "data_analyst",
                  "auditor",
                  "observer",
                ],
                scopeType: "institution",
                institutionSlug: "ekiti-state-internal-revenue-service",
              },
            };
          },
        };
      }
      if (specifier === "@/lib/workspaces/workspace-access-policy") {
        return {
          findWorkspaceByRoute(route) {
            return route.startsWith("/dashboard/ekirs") ? { id: "ekirs", scopedAccess: { scopeType: "institution" } } : null;
          },
          canAccessWorkspaceRouteWithAssignments(ctx, workspaceId, route, assignments, scope) {
            const allowedRoles = new Set([
              "state_revenue_admin",
              "registration_reviewer",
              "field_supervisor",
              "field_officer",
              "taxpayer_support_officer",
              "state_revenue_executive",
              "data_analyst",
              "auditor",
              "observer",
            ]);
            return {
              allowed: workspaceId === "ekirs"
                && ctx.role === "workspace_user"
                && route.startsWith("/dashboard/ekirs")
                && assignments.some((assignment) => (
                  assignment.status === "active"
                  && allowedRoles.has(assignment.role)
                  && assignment.scope_type === "institution"
                  && assignment.institution_id === scope.institutionId
                )),
            };
          },
        };
      }
      throw new Error(`Unexpected import ${specifier}`);
    },
    Set,
    Date,
    String,
    encodeURIComponent,
  });
  return cjsModule.exports;
}

function createClient(assignments = []) {
  return {
    from(table) {
      const filters = {};
      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          filters[column] = value;
          return builder;
        },
        maybeSingle() {
          if (table === "institutions" && filters.slug === "ekiti-state-internal-revenue-service") {
            return Promise.resolve({ data: { id: "ekirs-institution" }, error: null });
          }
          return Promise.resolve({ data: null, error: new Error(`Unexpected maybeSingle ${table}`) });
        },
        then(resolve, reject) {
          if (table === "role_assignments") {
            return Promise.resolve({
              data: assignments.filter((assignment) => assignment.user_id === filters.user_id && assignment.status === filters.status),
              error: null,
            }).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

const activeAssignment = (userId, role, institutionId = "ekirs-institution") => ({
  user_id: userId,
  role,
  scope_type: "institution",
  scope_id: null,
  institution_id: institutionId,
  status: "active",
  expires_at: null,
});

const { resolveLoginDestination } = loadLoginDestinationModule();
const client = createClient([
  activeAssignment("reviewer", "registration_reviewer"),
  activeAssignment("field", "field_officer"),
  activeAssignment("admin", "state_revenue_admin"),
  activeAssignment("observer", "observer"),
  activeAssignment("other", "observer", "other-institution"),
]);

const cases = [
  {
    name: "Applicant return path stays on clean EKIRS application URL",
    input: { role: "msme", appUserId: "applicant", next: "/apply/new", requestHost: "ekirs.dbin.ng" },
    expected: "/apply/new",
  },
  {
    name: "Internal EKIRS applicant path is cleaned on EKIRS host",
    input: { role: "msme", appUserId: "applicant", next: "/ekirs/apply/existing", requestHost: "ekirs.dbin.ng" },
    expected: "/apply/existing",
  },
  {
    name: "Reviewer defaults to applications queue",
    input: { role: "workspace_user", appUserId: "reviewer", requestedWorkspace: "ekirs", requestHost: "ekirs.dbin.ng" },
    expected: "/dashboard/ekirs/applications",
  },
  {
    name: "Field officer defaults to field queue",
    input: { role: "workspace_user", appUserId: "field", requestedWorkspace: "ekirs", requestHost: "ekirs.dbin.ng" },
    expected: "/dashboard/ekirs/verification/field",
  },
  {
    name: "Observer defaults to executive overview",
    input: { role: "workspace_user", appUserId: "observer", requestedWorkspace: "ekirs", requestHost: "ekirs.dbin.ng" },
    expected: "/dashboard/ekirs",
  },
  {
    name: "Scoped return path is accepted for EKIRS workspace user",
    input: { role: "workspace_user", appUserId: "reviewer", returnTo: "/dashboard/ekirs/applications", requestHost: "ekirs.dbin.ng" },
    expected: "/dashboard/ekirs/applications",
  },
  {
    name: "Workspace user without EKIRS assignment fails closed",
    input: { role: "workspace_user", appUserId: "other", requestedWorkspace: "ekirs", requestHost: "ekirs.dbin.ng" },
    expected: "/access-denied?workspace=ekirs&returnTo=/ekirs",
  },
  {
    name: "External returnTo is rejected",
    input: { role: "msme", appUserId: "applicant", returnTo: "https://evil.example/dashboard/ekirs", requestHost: "ekirs.dbin.ng" },
    expected: "/apply",
  },
];

for (const testCase of cases) {
  const result = await resolveLoginDestination(client, testCase.input);
  assert(result.targetRoute === testCase.expected, `${testCase.name}: expected ${testCase.expected}, got ${result.targetRoute}`);
}

if (failures.length) {
  console.error("EKIRS auth routing validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("EKIRS auth routing validation passed.");
