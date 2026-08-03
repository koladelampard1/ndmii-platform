#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function loadRoutingModule() {
  const source = read("src/lib/routing/dbin-hosts.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };

  vm.runInNewContext(transpiled, {
    module: commonJsModule,
    exports: commonJsModule.exports,
    process,
    Set,
    URL,
  });

  return commonJsModule.exports;
}

const routing = read("src/lib/routing/dbin-hosts.ts");
const proxy = read("src/proxy.ts");
const loginDestination = read("src/lib/auth/login-destination.ts");
const loginPage = read("src/app/(auth)/login/page.tsx");
const logoutRoute = read("src/app/logout/route.ts");
const accessDenied = read("src/app/access-denied/page.tsx");
const registry = read("src/lib/workspaces/workspace-registry.ts");
const sitemap = read("src/app/sitemap.ts");
const lcdboContent = read("src/lib/lcdbo/content.ts");
const lcdboShell = read("src/components/lcdbo/lcdbo-shell.tsx");
const authSessionRoute = read("src/app/api/auth/session/route.ts");

const publicRoutes = [
  "page",
  "about/page",
  "clusters/page",
  "clusters/map/page",
  "clusters/catalogue/page",
  "clusters/state/[stateSlug]/page",
  "clusters/lga/[lgaPublicReference]/page",
  "clusters/[publicClusterReference]/page",
  "contact/page",
  "events/page",
  "model/page",
  "opportunities/page",
  "partners/page",
  "resources/page",
];
for (const route of publicRoutes) {
  assert(exists(`src/app/lcdbo/${route}.tsx`), `Missing LCDBO public route file: src/app/lcdbo/${route}.tsx`);
}

assert(routing.includes('"lcdbo"'), "Host surface union must include lcdbo.");
assert(routing.includes('export const LCDBO_CANONICAL_HOST = "lcdbo.dbin.ng"'), "Canonical LCDBO host constant is missing.");
assert(routing.includes("LCDBO_CANONICAL_ORIGIN"), "Canonical LCDBO origin constant is missing.");
assert(routing.includes("DBIN_LCDBO_HOSTS"), "LCDBO host environment override is missing.");
assert(routing.includes('"lcdbo.com"') && routing.includes('"www.lcdbo.com"'), "LCDBO commercial domains must remain recognized host aliases.");
assert(routing.includes("LCDBO_PUBLIC_PATHS"), "LCDBO valid public path allow-list is missing.");
assert(routing.includes("resolveDbinCanonicalRedirectUrl"), "Canonical redirect helper is missing.");
assert(routing.includes("pathname === \"/dashboard\"") && routing.includes('redirectUrl.pathname = "/dashboard/lcdbo"'), "LCDBO /dashboard canonical redirect is missing.");
assert(routing.includes('redirectUrl.searchParams.set("workspace", "lcdbo")'), "LCDBO login workspace canonicalization is missing.");

assert(proxy.indexOf("resolveDbinCanonicalRedirectUrl") >= 0, "Proxy must import the canonical redirect helper.");
assert(
  proxy.indexOf("resolveDbinCanonicalRedirectUrl") < proxy.indexOf("resolveDbinRewritePath"),
  "Proxy must evaluate canonical redirects before rewrites.",
);
assert(proxy.includes("NextResponse.redirect(redirectUrl, 308)"), "Proxy must use permanent redirects for canonical LCDBO URL changes.");

assert(loginDestination.includes("LCDBO_ROUTE_BY_ROLE"), "LCDBO post-login role route map is missing.");
for (const role of ["programme_officer", "institution_admin", "data_analyst", "auditor", "observer", "state_coordinator", "lga_coordinator", "cluster_manager"]) {
  assert(loginDestination.includes(role), `LCDBO post-login destination is missing role ${role}.`);
}
assert(loginDestination.includes('requestedWorkspace === "lcdbo"'), "Login destination resolver must honor workspace=lcdbo.");
assert(loginDestination.includes('"/access-denied?workspace=lcdbo&returnTo=/lcdbo"'), "LCDBO login must deny unscoped workspace users safely.");
assert(!loginDestination.includes('assignment.scope_type === "global"'), "LCDBO host login must not accept global assignments as scoped LCDBO access.");

assert(loginPage.includes("isLcdboLogin"), "Login page must render LCDBO-aware language.");
assert(loginPage.includes('requestedWorkspace === "lcdbo"'), "Login page must detect workspace=lcdbo.");
assert(logoutRoute.includes('surface === "lcdbo"'), "Logout route must preserve LCDBO-aware sign-out destination.");
assert(accessDenied.includes('workspace === "lcdbo"'), "Access-denied page must explain LCDBO workspace access.");

assert(registry.includes('id: "lcdbo"'), "Workspace registry must include LCDBO.");
assert(registry.includes('canonicalHost: "lcdbo.dbin.ng"'), "LCDBO registry entry must expose the canonical host.");
assert(!registry.includes('futureHosts: ["lcdbo.dbin.ng"]'), "LCDBO registry entry should no longer treat the live subdomain as a future host.");

assert(sitemap.includes("LCDBO_CANONICAL_ORIGIN"), "Sitemap must emit LCDBO entries from the canonical subdomain.");
assert(!sitemap.includes('"/lcdbo"'), "Sitemap PUBLIC_ROUTES must not emit dbin.ng/lcdbo as a competing canonical route.");
for (const pathName of ["", "/about", "/clusters", "/clusters/map", "/clusters/catalogue", "/opportunities", "/partners", "/resources", "/contact", "/events", "/model"]) {
  assert(sitemap.includes(`"${pathName}"`) || pathName === "", `Sitemap is missing canonical LCDBO route ${pathName || "/"}.`);
}

assert(lcdboContent.includes("lcdboPublicHref"), "LCDBO content must expose canonical public href helper.");
assert(lcdboShell.includes("lcdboPublicHref"), "LCDBO shell must use canonical public hrefs.");
assert(lcdboContent.includes("LCDBO_CANONICAL_ORIGIN"), "LCDBO partner/investor links must use the canonical host helper.");

assert(!authSessionRoute.includes("service_role"), "Auth session route must not expose or depend on service-role session behavior.");
assert(!authSessionRoute.includes("Set-Cookie"), "Auth session route must not manually write Set-Cookie headers.");

const {
  LCDBO_CANONICAL_ORIGIN,
  resolveDbinCanonicalRedirectUrl,
  resolveDbinHostSurface,
  resolveDbinRewritePath,
} = loadRoutingModule();

assert.equal(LCDBO_CANONICAL_ORIGIN, "https://lcdbo.dbin.ng");
assert.equal(resolveDbinHostSurface("lcdbo.dbin.ng"), "lcdbo");
assert.equal(resolveDbinHostSurface("lcdbo.com"), "lcdbo");
assert.equal(resolveDbinHostSurface("www.lcdbo.com"), "lcdbo");
assert.equal(resolveDbinHostSurface("lcdbo.localhost:3000"), "lcdbo");
assert.equal(resolveDbinRewritePath("lcdbo", "/"), "/lcdbo");
assert.equal(resolveDbinRewritePath("lcdbo", "/about"), "/lcdbo/about");
assert.equal(resolveDbinRewritePath("lcdbo", "/clusters/map"), "/lcdbo/clusters/map");
assert.equal(resolveDbinRewritePath("lcdbo", "/clusters/catalogue"), "/lcdbo/clusters/catalogue");
assert.equal(resolveDbinRewritePath("lcdbo", "/clusters/state/lagos"), "/lcdbo/clusters/state/lagos");
assert.equal(resolveDbinRewritePath("lcdbo", "/clusters/lga/lga-lagos-mushin"), "/lcdbo/clusters/lga/lga-lagos-mushin");
assert.equal(resolveDbinRewritePath("lcdbo", "/dashboard/lcdbo/my-work"), null);
assert.equal(resolveDbinRewritePath("lcdbo", "/api/lcdbo/delivery/export/workstreams"), null);
assert.equal(resolveDbinRewritePath("lcdbo", "/reports"), null);

assert.equal(
  resolveDbinCanonicalRedirectUrl("marketing", new URL("https://dbin.ng/lcdbo/clusters?utm=site"))?.toString(),
  "https://lcdbo.dbin.ng/clusters?utm=site",
);
assert.equal(resolveDbinCanonicalRedirectUrl("marketing", new URL("https://dbin.ng/lcdbo/reports")), null);
assert.equal(
  resolveDbinCanonicalRedirectUrl("lcdbo", new URL("https://lcdbo.dbin.ng/lcdbo/about"))?.toString(),
  "https://lcdbo.dbin.ng/about",
);
assert.equal(
  resolveDbinCanonicalRedirectUrl("lcdbo", new URL("https://lcdbo.dbin.ng/dashboard"))?.toString(),
  "https://lcdbo.dbin.ng/dashboard/lcdbo",
);
assert.equal(
  resolveDbinCanonicalRedirectUrl("lcdbo", new URL("https://lcdbo.dbin.ng/login?next=%2Fdashboard%2Flcdbo"))?.toString(),
  "https://lcdbo.dbin.ng/login?next=%2Fdashboard%2Flcdbo&workspace=lcdbo",
);

console.log(JSON.stringify({
  validation: "lcdbo_host_routing",
  status: "passed",
  canonicalHost: "lcdbo.dbin.ng",
  publicRoutes: publicRoutes.length,
}));
