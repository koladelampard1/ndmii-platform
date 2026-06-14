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

test("BOI authenticated workspaces remain directly accessible", () => {
  assert.equal(resolveDbinRewritePath("boi", "/dashboard/admin"), null);
  assert.equal(resolveDbinRewritePath("boi", "/dashboard/impact-intelligence"), null);
  assert.equal(resolveDbinRewritePath("boi", "/admin"), null);
});

test("existing DBIN production hosts retain their surfaces", () => {
  assert.equal(resolveDbinHostSurface("dbin.ng"), "marketing");
  assert.equal(resolveDbinHostSurface("app.dbin.ng"), "app");
  assert.equal(resolveDbinHostSurface("admin.dbin.ng"), "admin");
  assert.equal(resolveDbinHostSurface("verify.dbin.ng"), "verify");
});

test("super admin landing route remains direct on app, BOI, and admin surfaces", () => {
  for (const host of ["app.dbin.ng", "boi.dbin.ng", "admin.dbin.ng"]) {
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

test("localhost development continues to use the app surface", () => {
  assert.equal(resolveDbinHostSurface("localhost:3000"), "app");
  assert.equal(resolveDbinHostSurface("127.0.0.1:3000"), "app");
  assert.equal(resolveDbinHostSurface("[::1]:3000"), "app");
  assert.equal(resolveDbinRewritePath("app", "/dashboard"), null);
});

test("the first forwarded hostname is used", () => {
  assert.equal(resolveDbinHostSurface("boi.dbin.ng, proxy.internal"), "boi");
});
