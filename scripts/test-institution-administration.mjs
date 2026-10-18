import assert from "node:assert/strict";
import test from "node:test";
import { canManageMember, canSeeAgentQueue, parseServiceStates } from "../src/lib/institutional/administration-policy.ts";

const actor = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
const institutionA = "33333333-3333-4333-8333-333333333333";
const institutionB = "44444444-4444-4444-8444-444444444444";

test("a bank administrator can invite and revoke agents, but cannot create another bank admin", () => {
  const base = { platformAdmin: false, actorRole: "institution_admin", actorUserId: actor, targetUserId: target };
  assert.equal(canManageMember({ ...base, targetRole: "institution_agent", action: "invite" }), true);
  assert.equal(canManageMember({ ...base, targetRole: "institution_agent", action: "revoke" }), true);
  assert.equal(canManageMember({ ...base, targetRole: "institution_admin", action: "invite" }), false);
  assert.equal(canManageMember({ ...base, targetRole: "institution_agent", action: "suspend", targetUserId: actor }), false);
  assert.equal(canManageMember({ ...base, platformAdmin: true, targetRole: "institution_admin", action: "invite" }), true);
});

test("global roles and institution officers cannot manage the bank roster", () => {
  for (const actorRole of ["institution_officer", "institution_agent", "boi_executive", null]) {
    assert.equal(canManageMember({ platformAdmin: false, actorRole, actorUserId: actor, targetUserId: target,
      targetRole: "institution_agent", action: "invite" }), false);
  }
});

test("an agent queue requires an active unexpired membership and exact institution profile", () => {
  const base = { role: "institution_agent", membershipStatus: "active", expiresAt: null,
    profileInstitutionId: institutionA, institutionId: institutionA, now: Date.parse("2026-10-18T10:00:00Z") };
  assert.equal(canSeeAgentQueue(base), true);
  assert.equal(canSeeAgentQueue({ ...base, institutionId: institutionB }), false);
  assert.equal(canSeeAgentQueue({ ...base, membershipStatus: "revoked" }), false);
  assert.equal(canSeeAgentQueue({ ...base, membershipStatus: "invited" }), false);
  assert.equal(canSeeAgentQueue({ ...base, expiresAt: "2026-10-18T09:59:00Z" }), false);
  assert.equal(canSeeAgentQueue({ ...base, role: "institution_officer" }), false);
});

test("service areas are bounded and normalized", () => {
  assert.deepEqual(parseServiceStates(["Lagos", " Lagos ", "Ogun"]), ["Lagos", "Ogun"]);
  assert.equal(parseServiceStates("Lagos"), null);
  assert.equal(parseServiceStates(["Lagos", "x'.or(true)"]), null);
  assert.equal(parseServiceStates(Array(38).fill("Lagos")), null);
});
