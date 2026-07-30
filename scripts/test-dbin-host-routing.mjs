#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/lib/routing/dbin-hosts.ts"),
  "utf8",
);
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
});

const { resolveDbinHostSurface, resolveDbinRewritePath } = commonJsModule.exports;

test("boi.dbin.ng resolves to the BOI surface", () => {
  assert.equal(resolveDbinHostSurface("boi.dbin.ng"), "boi");
  assert.equal(resolveDbinHostSurface("BOI.DBIN.NG:443"), "boi");
});

test("BOI portal requests rewrite to /boi", () => {
  assert.equal(resolveDbinRewritePath("boi", "/"), "/boi");
  assert.equal(resolveDbinRewritePath("boi", "/applications/123"), "/boi");
});

test("BOI authentication routes remain directly accessible", () => {
  assert.equal(resolveDbinRewritePath("boi", "/login"), null);
  assert.equal(resolveDbinRewritePath("boi", "/logout"), null);
  assert.equal(resolveDbinRewritePath("boi", "/api/auth/session"), null);
  assert.equal(resolveDbinRewritePath("boi", "/_next/static/chunk.js"), null);
});

test("nrs.dbin.ng resolves to the NRS surface", () => {
  assert.equal(resolveDbinHostSurface("nrs.dbin.ng"), "nrs");
  assert.equal(resolveDbinHostSurface("NRS.DBIN.NG:443"), "nrs");
  assert.equal(resolveDbinHostSurface("nrs.localhost:3000"), "nrs");
  assert.equal(resolveDbinHostSurface("nrs.dbin.local:3000"), "nrs");
});

test("NRS host requests resolve to the public NRS entry without BOI leakage", () => {
  assert.equal(resolveDbinRewritePath("nrs", "/"), "/nrs");
  assert.equal(resolveDbinRewritePath("nrs", "/nrs"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/about"), "/nrs");
  assert.notEqual(resolveDbinRewritePath("nrs", "/"), "/boi");
});

test("NRS authentication and workspace routes remain host-relative", () => {
  assert.equal(resolveDbinRewritePath("nrs", "/login"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/logout"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/auth/callback"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/update-password"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/dashboard/nrs"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/dashboard/firs"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/api/auth/session"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/_next/static/chunk.js"), null);
});

test("NRS host keeps intentional public support routes direct", () => {
  assert.equal(resolveDbinRewritePath("nrs", "/verification"), "/verify");
  assert.equal(resolveDbinRewritePath("nrs", "/verify"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/register"), null);
  assert.equal(resolveDbinRewritePath("nrs", "/contact"), null);
});

test("ekirs.dbin.ng resolves to the EKIRS surface", () => {
  assert.equal(resolveDbinHostSurface("ekirs.dbin.ng"), "ekirs");
  assert.equal(resolveDbinHostSurface("EKIRS.DBIN.NG:443"), "ekirs");
  assert.equal(resolveDbinHostSurface("ekirs.localhost:3000"), "ekirs");
  assert.equal(resolveDbinHostSurface("ekirs.dbin.local:3000"), "ekirs");
});

test("EKIRS host requests resolve to the public EKIRS entry without NRS or BOI leakage", () => {
  assert.equal(resolveDbinRewritePath("ekirs", "/"), "/ekirs");
  assert.equal(resolveDbinRewritePath("ekirs", "/ekirs"), null);
  assert.equal(resolveDbinRewritePath("ekirs", "/about"), "/ekirs");
  assert.notEqual(resolveDbinRewritePath("ekirs", "/"), "/nrs");
  assert.notEqual(resolveDbinRewritePath("ekirs", "/"), "/boi");
});

test("EKIRS authentication and workspace routes remain host-relative", () => {
  assert.equal(resolveDbinRewritePath("ekirs", "/login"), null);
  assert.equal(resolveDbinRewritePath("ekirs", "/logout"), null);
  assert.equal(resolveDbinRewritePath("ekirs", "/auth/callback"), null);
  assert.equal(resolveDbinRewritePath("ekirs", "/dashboard/ekirs"), null);
  assert.equal(resolveDbinRewritePath("ekirs", "/dashboard/nrs"), null);
  assert.equal(resolveDbinRewritePath("ekirs", "/api/auth/session"), null);
  assert.equal(resolveDbinRewritePath("ekirs", "/_next/static/chunk.js"), null);
});

test("EKIRS host keeps intentional public support routes direct", () => {
  assert.equal(resolveDbinRewritePath("ekirs", "/verification"), "/verify");
  assert.equal(resolveDbinRewritePath("ekirs", "/verify"), null);
  assert.equal(resolveDbinRewritePath("ekirs", "/register"), null);
  assert.equal(resolveDbinRewritePath("ekirs", "/contact"), null);
});

test("BOI authenticated workspaces remain directly accessible", () => {
  assert.equal(resolveDbinRewritePath("boi", "/dashboard/boi"), null);
  assert.equal(resolveDbinRewritePath("boi", "/dashboard/admin"), null);
  assert.equal(resolveDbinRewritePath("boi", "/dashboard/impact-intelligence"), null);
  assert.equal(resolveDbinRewritePath("boi", "/admin"), null);
});

test("existing DBIN production hosts retain their surfaces", () => {
  assert.equal(resolveDbinHostSurface("dbin.ng"), "marketing");
  assert.equal(resolveDbinHostSurface("app.dbin.ng"), "app");
  assert.equal(resolveDbinHostSurface("admin.dbin.ng"), "admin");
  assert.equal(resolveDbinHostSurface("verify.dbin.ng"), "verify");
  assert.equal(resolveDbinHostSurface("nrs.dbin.ng"), "nrs");
  assert.equal(resolveDbinHostSurface("ekirs.dbin.ng"), "ekirs");
  assert.equal(resolveDbinHostSurface("lands.dbin.ng"), "lands");
});

test("super admin landing route remains direct on app, BOI, NRS, EKIRS and admin surfaces", () => {
  for (const host of ["app.dbin.ng", "boi.dbin.ng", "nrs.dbin.ng", "ekirs.dbin.ng", "admin.dbin.ng"]) {
    const surface = resolveDbinHostSurface(host);
    assert.equal(resolveDbinRewritePath(surface, "/dashboard/admin"), null);
  }
});

test("existing admin and verify rewrites remain unchanged", () => {
  assert.equal(resolveDbinRewritePath("admin", "/"), "/admin");
  assert.equal(resolveDbinRewritePath("admin", "/associations/123"), "/admin/associations/123");
  assert.equal(resolveDbinRewritePath("verify", "/"), "/verify");
  assert.equal(resolveDbinRewritePath("verify", "/c/token"), "/verify/c/token");
});

test("lands host rewrites to the public property explorer", () => {
  assert.equal(resolveDbinRewritePath("lands", "/"), "/property");
  assert.equal(resolveDbinRewritePath("lands", "/search"), "/property/search");
  assert.equal(resolveDbinRewritePath("lands", "/verify"), "/property/verify");
  assert.equal(resolveDbinRewritePath("lands", "/property/search"), null);
  assert.equal(resolveDbinRewritePath("lands", "/dashboard/property"), null);
  assert.equal(resolveDbinRewritePath("lands", "/api/property/verify"), null);
});

test("localhost development continues to use the app surface", () => {
  assert.equal(resolveDbinHostSurface("localhost:3000"), "app");
  assert.equal(resolveDbinHostSurface("127.0.0.1:3000"), "app");
  assert.equal(resolveDbinHostSurface("[::1]:3000"), "app");
  assert.equal(resolveDbinRewritePath("app", "/dashboard"), null);
});

test("the first forwarded hostname is used", () => {
  assert.equal(resolveDbinHostSurface("boi.dbin.ng, proxy.internal"), "boi");
  assert.equal(resolveDbinHostSurface("nrs.dbin.ng, proxy.internal"), "nrs");
  assert.equal(resolveDbinHostSurface("ekirs.dbin.ng, proxy.internal"), "ekirs");
});
