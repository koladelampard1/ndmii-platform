#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const landing = read("src/app/amaanah/page.tsx");
const dashboard = read("src/app/dashboard/amaanah/page.tsx");
const loginDestination = read("src/lib/auth/login-destination.ts");
const login = read("src/app/(auth)/login/page.tsx");

test("Amaanah has a dedicated branded landing page", () => {
  assert.match(landing, /Amaanah Finance Company/);
  assert.match(landing, /amaanah-finance-logo\.svg/);
  assert.match(landing, /workspace=amaanah/);
  assert.doesNotMatch(landing, /BOI Institutional Workspace/);
});

test("Amaanah dashboard resolves the institution by stable slug", () => {
  assert.match(dashboard, /amaanah-finance/);
  assert.match(dashboard, /dashboard\/institutions\/\$\{institution\.id\}\/overview/);
});

test("Amaanah login destination requires an active scoped membership", () => {
  assert.match(loginDestination, /resolveAmaanahDefault/);
  assert.match(loginDestination, /institution_members/);
  assert.match(loginDestination, /\.eq\("status", "active"\)/);
  assert.match(loginDestination, /amaanah_scoped_default/);
  assert.match(loginDestination, /amaanah_denied/);
});

test("shared login presents Amaanah-specific secure access copy", () => {
  assert.match(login, /isAmaanahLogin/);
  assert.match(login, /Amaanah secure access/);
  assert.match(login, /Sign in to Amaanah/);
});
