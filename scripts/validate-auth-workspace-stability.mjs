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

const authorization = read("src/lib/auth/authorization.ts");
const proxy = read("src/proxy.ts");
const workspaceAccessServer = read("src/lib/workspaces/workspace-access-server.ts");
const accessDeniedPage = read("src/app/access-denied/page.tsx");
const loginPage = read("src/app/(auth)/login/page.tsx");
const correspondenceLayout = read("src/app/dashboard/correspondence/layout.tsx");
const lcdboLayout = read("src/app/dashboard/lcdbo/layout.tsx");
const ekirsLayout = read("src/app/dashboard/ekirs/layout.tsx");
const boiLayout = read("src/app/dashboard/boi/layout.tsx");
const nrsLayout = read("src/app/dashboard/nrs/layout.tsx");
const loginDestination = read("src/lib/auth/login-destination.ts");

assert(!authorization.includes('role === "workspace_user" && (routeMatchesPrefix(path, "/dashboard/lcdbo")'), "workspace_user must not have blanket LCDBO/correspondence route access.");
assert(authorization.includes('routeMatchesPrefix(path, "/dashboard/correspondence")') && authorization.includes('canAccessWorkspaceRoute({ role }, "correspondence", path).allowed'), "Correspondence route checks must use workspace policy.");
assert(proxy.includes("loginRedirectForAuthFailure") && proxy.includes("clearSupabaseAuthCookies(response)") && proxy.includes("clearDbinAuthCookies(response)"), "Refresh failure must clear Supabase and DBIN cookies.");
assert(proxy.includes("SESSION_REFRESH_FAILED") && proxy.includes("session_refresh_failed"), "Refresh failure must be observable and redirected as authentication failure.");
assert(proxy.includes("x-dbin-request-id"), "Middleware must attach a safe request/correlation id.");
assert(proxy.includes('response.headers.get("x-dbin-canonical-redirect")'), "Canonical host redirects must complete before auth refresh handling.");
assert(workspaceAccessServer.includes("resolveWorkspaceAccess"), "Workspace access server must expose a central resolver.");
assert(workspaceAccessServer.includes("AUTH_REQUIRED") && workspaceAccessServer.includes("NO_ACTIVE_ASSIGNMENT") && workspaceAccessServer.includes("MODULE_DENIED"), "Central resolver must return typed denial reasons.");
assert(workspaceAccessServer.includes("scopedAssignments") && workspaceAccessServer.includes("programmeId") && workspaceAccessServer.includes("institutionId"), "Central resolver must expose safe scoped diagnostic fields.");
assert(accessDeniedPage.includes("Request reference") && accessDeniedPage.includes('workspace === "correspondence"'), "Access denied page must show request references and correspondence-aware messaging.");
assert(loginPage.includes("session_refresh_failed") && loginPage.includes("Your session could not be refreshed securely"), "Login page must distinguish refresh failures from authorization denials.");
for (const [name, source] of Object.entries({ correspondenceLayout, lcdboLayout, ekirsLayout, boiLayout, nrsLayout })) {
  assert(source.includes('export const dynamic = "force-dynamic"'), `${name} must force dynamic rendering for user-specific authorization.`);
}
assert(!boiLayout.includes("canAccessRoute") && !nrsLayout.includes("canAccessRoute"), "BOI/NRS layouts must not reapply legacy global-only route guards after shared scoped access.");

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
            if (route === "/lcdbo" || route.startsWith("/lcdbo/") || route === "/correspondence" || route.startsWith("/correspondence/")) return true;
            if ((role === "admin" || role === "super_admin") && route.startsWith("/dashboard")) return true;
            if (role === "programme_officer" && route.startsWith("/dashboard/lcdbo")) return true;
            if (role === "data_analyst" && route.startsWith("/dashboard/lcdbo/intelligence")) return true;
            return false;
          },
          getDefaultDashboardRoute(role) {
            if (role === "workspace_user") return "/dashboard";
            if (role === "admin" || role === "super_admin") return "/dashboard/admin";
            return "/login";
          },
        };
      }
      if (specifier === "@/lib/routing/dbin-hosts") {
        return {
          resolveDbinHostSurface() {
            return "marketing";
          },
        };
      }
      if (specifier === "@/lib/workspaces/workspace-registry") {
        return {
          getWorkspaceDefinition(id) {
            if (id === "correspondence") {
              return {
                id,
                scopedAccess: {
                  baseRoles: ["workspace_user"],
                  roles: ["rmrdc_representative", "roseate_representative", "observer"],
                  scopeType: "programme",
                  programmeSlug: "local-content-development-beyond-oil",
                  institutionSlug: "roseate-forte-nigeria-limited",
                },
              };
            }
            if (id === "lcdbo") {
              return {
                id,
                scopedAccess: {
                  baseRoles: ["workspace_user"],
                  roles: ["programme_officer", "observer"],
                  scopeType: "programme",
                  programmeSlug: "local-content-development-beyond-oil",
                  institutionSlug: "roseate-forte-nigeria-limited",
                },
              };
            }
            throw new Error(`Unexpected workspace ${id}`);
          },
        };
      }
      if (specifier === "@/lib/workspaces/workspace-access-policy") {
        return {
          findWorkspaceByRoute(route) {
            if (route.startsWith("/dashboard/correspondence")) return { id: "correspondence", scopedAccess: { scopeType: "programme" } };
            if (route.startsWith("/dashboard/lcdbo")) return { id: "lcdbo", scopedAccess: { scopeType: "programme" } };
            return null;
          },
          canAccessWorkspaceRouteWithAssignments(ctx, workspaceId, route, assignments, scope) {
            const rolesByWorkspace = {
              correspondence: new Set(["rmrdc_representative", "roseate_representative", "observer"]),
              lcdbo: new Set(["programme_officer", "observer"]),
            };
            const allowedRoles = rolesByWorkspace[workspaceId] ?? new Set();
            return {
              allowed: ctx.role === "workspace_user"
                && route.startsWith(`/dashboard/${workspaceId}`)
                && assignments.some((assignment) => (
                  assignment.status === "active"
                  && allowedRoles.has(assignment.role)
                  && assignment.scope_type === "programme"
                  && assignment.scope_id === scope.scopeId
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
          if (table === "programmes" && filters.slug === "local-content-development-beyond-oil") {
            return Promise.resolve({ data: { id: "lcdb-o-programme", owning_institution_id: "roseate-institution" }, error: null });
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

const activeAssignment = (userId, role, scopeId = "lcdb-o-programme") => ({
  user_id: userId,
  role,
  scope_type: "programme",
  scope_id: scopeId,
  institution_id: "rmrdc-institution",
  status: "active",
  expires_at: null,
});

const { resolveLoginDestination } = loadLoginDestinationModule();
const client = createClient([
  activeAssignment("rmrdc", "rmrdc_representative"),
  activeAssignment("roseate", "roseate_representative"),
  activeAssignment("other-programme", "rmrdc_representative", "other-programme"),
]);

const loginCases = [
  {
    name: "RMRDC representative may use safe correspondence next path",
    input: { role: "workspace_user", appUserId: "rmrdc", next: "/dashboard/correspondence", requestHost: "www.dbin.ng" },
    expected: "/dashboard/correspondence",
  },
  {
    name: "Roseate representative may use correspondence record path",
    input: { role: "workspace_user", appUserId: "roseate", returnTo: "/dashboard/correspondence/record-1", requestHost: "www.dbin.ng" },
    expected: "/dashboard/correspondence/record-1",
  },
  {
    name: "Unassigned workspace user cannot use correspondence next path",
    input: { role: "workspace_user", appUserId: "unassigned", next: "/dashboard/correspondence", requestHost: "www.dbin.ng" },
    expected: "/dashboard",
  },
  {
    name: "Wrong programme representative cannot use correspondence next path",
    input: { role: "workspace_user", appUserId: "other-programme", next: "/dashboard/correspondence", requestHost: "www.dbin.ng" },
    expected: "/dashboard",
  },
];

for (const testCase of loginCases) {
  const result = await resolveLoginDestination(client, testCase.input);
  assert(result.targetRoute === testCase.expected, `${testCase.name}: expected ${testCase.expected}, got ${result.targetRoute}`);
}

if (failures.length) {
  console.error("Authentication/workspace stability validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authentication/workspace stability validation passed.");
