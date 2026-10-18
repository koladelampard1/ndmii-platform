import assert from "node:assert/strict";
import test from "node:test";
import { decideInstitutionAccess } from "../src/lib/institutional/engagement-access-policy.ts";

const bankA = "11111111-1111-4111-8111-111111111111";
const bankB = "22222222-2222-4222-8222-222222222222";
const user = "33333333-3333-4333-8333-333333333333";
const otherUser = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-10-18T09:00:00Z");
const roles = ["institution_admin", "institution_officer", "institution_reviewer"];
const membership = (overrides = {}) => ({
  institution_id: bankA, user_id: user, role: "institution_officer",
  status: "active", expires_at: null, ...overrides,
});
const decide = (m, institutionId = bankA, userId = user) => decideInstitutionAccess({
  institutionId, userId, membership: m, allowedRoles: roles, now,
});

test("an active bank officer can access only the bank named in their membership", () => {
  assert.deepEqual(decide(membership()), { allowed: true, role: "institution_officer" });
  assert.deepEqual(decide(membership(), bankB), { allowed: false, reason: "missing_membership" });
  assert.deepEqual(decide(membership(), bankA, otherUser), { allowed: false, reason: "missing_membership" });
});

test("revoked, suspended, invited and expired memberships never grant access", () => {
  for (const status of ["revoked", "suspended", "invited", "inactive"]) {
    assert.deepEqual(decide(membership({ status })), { allowed: false, reason: "inactive_membership" });
  }
  assert.deepEqual(decide(membership({ expires_at: now.toISOString() })), { allowed: false, reason: "expired_membership" });
  assert.deepEqual(decide(membership({ expires_at: "invalid" })), { allowed: false, reason: "expired_membership" });
  assert.deepEqual(decide(null), { allowed: false, reason: "missing_membership" });
});

test("a membership in an unrelated role does not confer bank engagement access", () => {
  assert.deepEqual(decide(membership({ role: "agent" })), { allowed: false, reason: "role_denied" });
  assert.deepEqual(decide(membership({ role: "boi_executive" })), { allowed: false, reason: "role_denied" });
});

test("a person belonging to both banks has a separate decision for each context", () => {
  const memberships = [membership(), membership({ institution_id: bankB, role: "institution_reviewer" })];
  assert.deepEqual(decide(memberships[0], bankA), { allowed: true, role: "institution_officer" });
  assert.deepEqual(decide(memberships[1], bankB), { allowed: true, role: "institution_reviewer" });
  assert.deepEqual(decide(memberships[0], bankB), { allowed: false, reason: "missing_membership" });
});
