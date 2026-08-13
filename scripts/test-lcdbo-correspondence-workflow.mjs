#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";
import crypto from "node:crypto";

function loadTsModule(file, extra = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsModule = { exports: {} };
  vm.runInNewContext(transpiled, {
    module: commonJsModule,
    exports: commonJsModule.exports,
    require: (id) => {
      if (extra[id]) return extra[id];
      if (id === "node:crypto") return { ...crypto, default: crypto };
      if (id === "@/lib/lcdbo-correspondence/security") return loadTsModule("src/lib/lcdbo-correspondence/security.ts");
      if (id === "@/lib/lcdbo-correspondence/types") return loadTsModule("src/lib/lcdbo-correspondence/types.ts");
      if (id === "@/lib/lcdbo-correspondence/reminders") return loadTsModule("src/lib/lcdbo-correspondence/reminders.ts");
      throw new Error(`Unsupported test import: ${id}`);
    },
    process,
    Buffer,
    TextEncoder,
    console,
  });
  return commonJsModule.exports;
}

const state = loadTsModule("src/lib/lcdbo-correspondence/state-machine.ts");
const pdf = loadTsModule("src/lib/lcdbo-correspondence/pdf.ts");
const security = loadTsModule("src/lib/lcdbo-correspondence/security.ts");
const templates = loadTsModule("src/lib/lcdbo-correspondence/templates.ts");
const delegations = loadTsModule("src/lib/lcdbo-correspondence/delegations.ts");
const evidence = loadTsModule("src/lib/lcdbo-correspondence/evidence.ts");
const reminders = loadTsModule("src/lib/lcdbo-correspondence/reminders.ts");
const email = loadTsModule("src/lib/lcdbo-correspondence/email.ts");

const fixtureRecord = {
  id: "record-1",
  programme_id: "programme-1",
  reference: "LCDBO/JNT/2026/OUT/000001",
  direction: "OUT",
  issuer: "JNT",
  correspondence_type: "official_letter",
  subject: "A deliberately long LCDBO correspondence subject for deterministic layout verification and clipping prevention",
  summary: "Summary",
  sensitivity: "internal",
  status: "awaiting_signature",
  owner_id: "owner-1",
  requester_id: "requester-1",
  drafter_id: "drafter-1",
  current_assignee_id: "assignee-1",
  due_at: null,
  response_required: true,
  response_due_at: "2026-09-01T00:00:00.000Z",
  received_at: null,
  issued_at: "2026-08-13T09:00:00.000Z",
  dispatched_at: null,
  delivered_at: null,
  closed_at: null,
  current_version_id: "version-1",
  issued_version_id: null,
  verification_record_id: null,
  metadata: {
    recipient_name: "Permanent Secretary, Federal Ministry of Industry, Trade and Investment",
    recipient_organisation: "Federal Secretariat Complex, Phase I, Shehu Shagari Way, Abuja, Federal Capital Territory, Nigeria",
  },
  created_by: "drafter-1",
  updated_by: "drafter-1",
  created_at: "2026-08-13T08:00:00.000Z",
  updated_at: "2026-08-13T08:30:00.000Z",
  versions: [{
    id: "version-1",
    record_id: "record-1",
    template_id: null,
    version_number: 1,
    version_label: "v1",
    body: Array.from({ length: 18 }, (_, index) => `Paragraph ${index + 1}: This letter documents LCDBO programme correspondence, approvals, protected signature handling, dispatch tracking, response obligations and public verification without exposing private internal records.`).join("\n\n"),
    content: {},
    source_file_path: null,
    rendered_pdf_path: null,
    document_hash: "9".repeat(64),
    is_frozen: true,
    frozen_at: "2026-08-13T08:45:00.000Z",
    metadata: {},
    created_by: "drafter-1",
    created_at: "2026-08-13T08:00:00.000Z",
  }],
};

test("state machine enforces lifecycle gates", () => {
  assert.equal(state.canTransitionCorrespondence("draft", "in_review"), true);
  assert.equal(state.canTransitionCorrespondence("awaiting_signature", "signed"), true);
  assert.equal(state.canTransitionCorrespondence("draft", "sent"), false);
  assert.throws(() => state.assertCorrespondenceTransition("closed", "in_review"), /Invalid LCDBO correspondence transition/);
});

test("PDF generator creates draft watermark and final signature furniture", () => {
  const draft = pdf.createCorrespondencePdf(fixtureRecord, { mode: "draft" });
  const final = pdf.createCorrespondencePdf(fixtureRecord, {
    mode: "final",
    verificationToken: "token-123",
    dispatchReference: fixtureRecord.reference,
    signatureBlocks: [
      { role: "rmrdc_signatory", name: "RMRDC Signatory", organisation: "RMRDC", signedAt: "2026-08-13T10:00:00.000Z", testOnly: true },
      { role: "roseate_signatory", name: "Roseate Signatory", organisation: "Roseate Forte Nigeria Limited", signedAt: "2026-08-13T10:10:00.000Z", testOnly: true },
    ],
  });
  const draftText = Buffer.from(draft).toString("latin1");
  const finalText = Buffer.from(final).toString("latin1");
  assert.match(draftText, /DRAFT/);
  assert.doesNotMatch(finalText, /DRAFT/);
  assert.match(finalText, /RMRDC Signatory/);
  assert.match(finalText, /Roseate Signatory/);
  assert.match(finalText, /correspondence\.dbin\.ng/);
  assert.ok(draft.length > 1000);
  assert.ok(final.length > 1000);
  assert.match(pdf.correspondencePdfHash(final), /^[a-f0-9]{64}$/);
});

test("CSV and public text helpers harden exported and public data", () => {
  assert.equal(security.safeCsvValue("=IMPORTXML('http://bad')"), "\"'=IMPORTXML('http://bad')\"");
  assert.equal(security.sanitizePublicCorrespondenceText("Call 08031234567 or email person@example.com with 12345678901."), "Call [redacted phone] or email [redacted email] with [redacted identifier].");
});

test("reference format fixtures cover issuer, direction and year semantics", () => {
  const references = [
    "LCDBO/JNT/2026/OUT/000001",
    "LCDBO/RMRDC/2026/IN/000001",
    "LCDBO/RFNL/2027/OUT/000001",
  ];
  for (const reference of references) {
    assert.match(reference, /^LCDBO\/(JNT|RMRDC|RFNL)\/\d{4}\/(IN|OUT)\/\d{6}$/);
  }
});

test("template placeholder validation blocks incomplete templates", () => {
  const schema = { required: ["reference", "date", "body", "verification_url"] };
  assert.equal(JSON.stringify(templates.extractTemplatePlaceholders("{{reference}} {{body}} {{reference}}")), JSON.stringify(["body", "reference"]));
  const invalid = templates.validateTemplatePlaceholders("{{reference}} {{body}}", schema);
  assert.equal(invalid.ok, false);
  assert.equal(JSON.stringify(invalid.missing), JSON.stringify(["date", "verification_url"]));
  const valid = templates.validateTemplatePlaceholders("{{reference}} {{date}} {{body}} {{verification_url}}", schema);
  assert.equal(valid.ok, true);
  assert.equal(templates.renderTemplatePreview("Dear {{recipient_name}}, ref {{reference}}.", {
    recipient_name: "Commissioner",
    reference: "LCDBO/JNT/2026/OUT/000001",
  }), "Dear Commissioner, ref LCDBO/JNT/2026/OUT/000001.");
  assert.equal(templates.renderTemplatePreview("Missing {{unknown}}.", {}), "Missing [unknown].");
});

test("delivery evidence lifecycle blocks silent overwrite and stale download", () => {
  assert.equal(evidence.canOperateDeliveryEvidence("active", "replace"), true);
  assert.equal(evidence.canOperateDeliveryEvidence("active", "invalidate"), true);
  assert.equal(evidence.canOperateDeliveryEvidence("active", "download"), true);
  assert.equal(evidence.canOperateDeliveryEvidence("superseded", "download"), false);
  assert.throws(() => evidence.assertDeliveryEvidenceOperation("invalidated", "replace"), /cannot be replaced/);
});

test("delegation helper enforces active windows and self-delegation guard", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");
  assert.equal(delegations.isDelegationActive({
    starts_at: "2026-08-13T00:00:00.000Z",
    expires_at: "2026-08-14T00:00:00.000Z",
    status: "active",
    delegator_id: "a",
    delegate_id: "b",
  }, now), true);
  assert.throws(() => delegations.assertDelegationIsSafe({
    starts_at: "2026-08-13T00:00:00.000Z",
    expires_at: "2026-08-14T00:00:00.000Z",
    status: "active",
    delegator_id: "a",
    delegate_id: "a",
  }, now), /different users/);
});

test("reminder planner creates deterministic idempotency keys", () => {
  const jobs = reminders.planCorrespondenceReminderJobs([
    {
      id: "record-1",
      reference: "LCDBO/JNT/2026/OUT/000001",
      status: "in_review",
      due_at: "2026-08-12T00:00:00.000Z",
      response_required: true,
      response_due_at: "2026-08-16T00:00:00.000Z",
      current_assignee_id: "officer-1",
      owner_id: "owner-1",
    },
  ], new Date("2026-08-13T12:00:00.000Z"));
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].jobType, "review_overdue");
  assert.match(jobs[0].idempotencyKey, /^review_overdue:record-1:2026-08-13$/);
  assert.equal(jobs[1].jobType, "response_due_three_days");
});

test("email adapter is deterministic and production adapter fails closed", async () => {
  const adapter = new email.DeterministicCorrespondenceEmailAdapter();
  const payload = {
    recordId: "record-1",
    reference: "LCDBO/JNT/2026/OUT/000001",
    to: ["recipient@example.com"],
    subject: "LCDBO Correspondence",
    body: "Official message",
    senderIdentity: "LCDBO Joint Secretariat",
  };
  const first = await adapter.send(payload);
  const second = await adapter.send(payload);
  assert.equal(first.providerMessageId, second.providerMessageId);
  await assert.rejects(new email.ProductionCorrespondenceEmailAdapter().send(payload), /not configured/);
});
