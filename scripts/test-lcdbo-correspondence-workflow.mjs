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
      if (id === "@/lib/lcdbo-correspondence/representative-workflow") return loadTsModule("src/lib/lcdbo-correspondence/representative-workflow.ts");
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
const representative = loadTsModule("src/lib/lcdbo-correspondence/representative-workflow.ts");
const workspaceRegistry = loadTsModule("src/lib/workspaces/workspace-registry.ts");
const workspaceAccessPolicy = loadTsModule("src/lib/workspaces/workspace-access-policy.ts", {
  "@/lib/workspaces/workspace-registry": workspaceRegistry,
});
const originalMigration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260813120000_lcdbo_correspondence_management.sql"), "utf8");
const referencePatchMigration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260813133000_fix_lcdbo_correspondence_reference_generation.sql"), "utf8");
const representativeMigration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260814120000_lcdbo_correspondence_representative_workflow.sql"), "utf8");
const dataService = fs.readFileSync(path.join(process.cwd(), "src/lib/data/lcdbo-correspondence.ts"), "utf8");

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
  initiating_institution_id: "rmrdc-institution",
  action_institution_id: "roseate-institution",
  simplified_status: "awaiting_roseate",
  final_pdf_path: null,
  final_pdf_hash: null,
  final_pdf_generated_at: null,
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
  assert.equal(state.canTransitionCorrespondence("awaiting_signature", "rejected"), true);
  assert.equal(state.canTransitionCorrespondence("draft", "sent"), false);
  assert.throws(() => state.assertCorrespondenceTransition("closed", "in_review"), /Invalid LCDBO correspondence transition/);
});

test("representative workflow maps institution roles and simplified statuses", () => {
  assert.equal(representative.representativeInstitutionFromRole("rmrdc_representative"), "rmrdc");
  assert.equal(representative.representativeInstitutionFromRole("roseate_representative"), "roseate");
  assert.equal(representative.issuerForRepresentativeInstitution("rmrdc"), "RMRDC");
  assert.equal(representative.issuerForRepresentativeInstitution("roseate"), "RFNL");
  assert.equal(representative.signatureRoleForRepresentative("rmrdc_representative"), "rmrdc_signatory");
  assert.equal(representative.signatureRoleForRepresentative("roseate_representative"), "roseate_signatory");
  assert.equal(representative.counterpartyRoleForRepresentative("rmrdc_representative"), "roseate_representative");
  assert.equal(representative.counterpartyStatusForRepresentative("roseate_representative"), "awaiting_rmrdc");
  assert.equal(representative.simplifiedStatusForRecord(fixtureRecord), "awaiting_roseate");
  assert.equal(representative.simplifiedStatusForRecord({ status: "ready_for_dispatch", metadata: {} }), "ready_to_send");
});

test("representative buckets respect initiating and action institutions", () => {
  const rmrdcAuthority = {
    id: "authority-1",
    user_id: "rmrdc-user",
    programme_id: "programme-1",
    institution_id: "rmrdc-institution",
    representative_role: "rmrdc_representative",
    authority_status: "active",
    authority_starts_at: "2026-08-13T00:00:00.000Z",
    authority_ends_at: null,
    can_apply_signature: true,
    can_dispatch: true,
    is_primary: true,
    signature_asset_ref: "private/rmrdc.svg",
  };
  const roseateAuthority = { ...rmrdcAuthority, id: "authority-2", user_id: "roseate-user", institution_id: "roseate-institution", representative_role: "roseate_representative" };
  const readyRecord = { ...fixtureRecord, id: "record-2", action_institution_id: "rmrdc-institution", simplified_status: "ready_to_send", status: "ready_for_dispatch" };
  const bucketsForRmrdc = representative.representativeBuckets([fixtureRecord, readyRecord], rmrdcAuthority);
  const bucketsForRoseate = representative.representativeBuckets([fixtureRecord, readyRecord], roseateAuthority);

  assert.equal(bucketsForRmrdc.waitingForOtherParty.length, 1);
  assert.equal(bucketsForRmrdc.readyToSend.length, 1);
  assert.equal(bucketsForRoseate.needsMyAction.length, 1);
  assert.equal(bucketsForRoseate.readyToSend.length, 0);
});

test("representative migration is additive and enforces institution-bound authority", () => {
  assert.match(representativeMigration, /create table if not exists public\.lcdbo_correspondence_representative_authorities/i);
  assert.match(representativeMigration, /representative_role in \('rmrdc_representative', 'roseate_representative'\)/i);
  assert.match(representativeMigration, /authority_status in \('active', 'inactive', 'revoked', 'expired'\)/i);
  assert.match(representativeMigration, /lcdbo_correspondence_current_representative_authority/i);
  assert.match(representativeMigration, /lcdbo_correspondence_is_representative_for_record/i);
  assert.match(representativeMigration, /record\.|correspondence_record\./i);
  assert.match(representativeMigration, /require_signature = false or authority\.can_apply_signature = true/i);
  assert.match(representativeMigration, /require_dispatch = false[\s\S]*authority\.can_dispatch = true[\s\S]*initiating_institution_id = authority\.institution_id/i);
  assert.match(representativeMigration, /revoke all on table public\.lcdbo_correspondence_representative_authorities from anon/i);
  assert.match(representativeMigration, /LCDBO correspondence representatives can create verification records/i);
  assert.match(representativeMigration, /LCDBO correspondence representatives can queue notifications/i);
  assert.doesNotMatch(representativeMigration, /truncate|drop table|delete from public\./i);
});

test("correspondence workspace admits only active LCDBO representative assignments", () => {
  const programmeId = "lcdb-o-programme";
  const roseateInstitutionId = "roseate-institution";
  const rmrdcInstitutionId = "rmrdc-institution";
  const route = "/dashboard/correspondence";
  const ctx = { role: "workspace_user", appUserId: "user-1" };

  const rmrdcDecision = workspaceAccessPolicy.canAccessWorkspaceRouteWithAssignments(ctx, "correspondence", route, [{
    role: "rmrdc_representative",
    scope_type: "programme",
    scope_id: programmeId,
    institution_id: rmrdcInstitutionId,
    status: "active",
    expires_at: null,
  }], { scopeId: programmeId, institutionId: roseateInstitutionId });
  assert.equal(rmrdcDecision.allowed, true, "RMRDC representative allowed");
  assert.equal(rmrdcDecision.reason, "scoped_role");

  const roseateDecision = workspaceAccessPolicy.canAccessWorkspaceRouteWithAssignments(ctx, "correspondence", route, [{
    role: "roseate_representative",
    scope_type: "programme",
    scope_id: programmeId,
    institution_id: roseateInstitutionId,
    status: "active",
    expires_at: null,
  }], { scopeId: programmeId, institutionId: roseateInstitutionId });
  assert.equal(roseateDecision.allowed, true, "Roseate representative allowed");
  assert.equal(roseateDecision.reason, "scoped_role");

  const unrelatedWorkspaceUserDecision = workspaceAccessPolicy.canAccessWorkspaceRouteWithAssignments(ctx, "correspondence", route, [], { scopeId: programmeId, institutionId: roseateInstitutionId });
  assert.equal(unrelatedWorkspaceUserDecision.allowed, false, "unrelated workspace_user denied");

  const inactiveRepresentativeDecision = workspaceAccessPolicy.canAccessWorkspaceRouteWithAssignments(ctx, "correspondence", route, [{
    role: "rmrdc_representative",
    scope_type: "programme",
    scope_id: programmeId,
    institution_id: rmrdcInstitutionId,
    status: "inactive",
    expires_at: null,
  }], { scopeId: programmeId, institutionId: roseateInstitutionId });
  assert.equal(inactiveRepresentativeDecision.allowed, false, "inactive representative assignment denied");

  const unrelatedWorkspaceDecision = workspaceAccessPolicy.canAccessWorkspaceRouteWithAssignments(ctx, "ekirs", "/dashboard/ekirs", [{
    role: "rmrdc_representative",
    scope_type: "programme",
    scope_id: programmeId,
    institution_id: rmrdcInstitutionId,
    status: "active",
    expires_at: null,
  }], { scopeId: programmeId, institutionId: "ekirs-institution" });
  assert.equal(unrelatedWorkspaceDecision.allowed, false, "representative cannot access unrelated institutional workspaces");
});

test("record detail loader disambiguates current, issued and historical versions", () => {
  assert.match(dataService, /versions:lcdbo_correspondence_document_versions!lcdbo_correspondence_document_versions_record_id_fkey\(\*\)/);
  assert.doesNotMatch(dataService, /versions:lcdbo_correspondence_document_versions\(\*\)/);
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

test("reference generator patch removes ambiguous identifiers and preserves safe upsert", () => {
  assert.match(referencePatchMigration, /target_reference_year integer/i);
  assert.doesNotMatch(referencePatchMigration, /declare[\s\S]*\breference_year integer\b/i);
  assert.match(referencePatchMigration, /from public\.programmes as p/i);
  assert.match(referencePatchMigration, /insert into public\.lcdbo_correspondence_reference_counters as c/i);
  assert.match(referencePatchMigration, /on conflict \(programme_id, issuer, direction, reference_year\)/i);
  assert.match(referencePatchMigration, /last_sequence = c\.last_sequence \+ 1/i);
  assert.match(referencePatchMigration, /returning c\.last_sequence into next_sequence/i);
  assert.doesNotMatch(referencePatchMigration, /\bmax\s*\(/i);
});

test("reference generator validates issuers, directions and output contract", () => {
  assert.match(referencePatchMigration, /target_issuer not in \('JNT', 'RMRDC', 'RFNL'\)/i);
  assert.match(referencePatchMigration, /target_direction not in \('IN', 'OUT'\)/i);

  const validCases = [
    { issuer: "JNT", direction: "OUT", year: 2026, sequence: 1, expected: "LCDBO/JNT/2026/OUT/000001" },
    { issuer: "RMRDC", direction: "OUT", year: 2026, sequence: 1, expected: "LCDBO/RMRDC/2026/OUT/000001" },
    { issuer: "RFNL", direction: "IN", year: 2026, sequence: 1, expected: "LCDBO/RFNL/2026/IN/000001" },
  ];

  for (const item of validCases) {
    const reference = `LCDBO/${item.issuer}/${item.year}/${item.direction}/${String(item.sequence).padStart(6, "0")}`;
    assert.equal(reference, item.expected);
    assert.match(reference, /^LCDBO\/(JNT|RMRDC|RFNL)\/\d{4}\/(IN|OUT)\/\d{6}$/);
  }
});

test("reference schema preserves uniqueness, cancelled non-reuse and year partitioning guarantees", () => {
  assert.match(originalMigration, /constraint lcdbo_correspondence_reference_unique unique \(programme_id, issuer, direction, reference_year\)/i);
  assert.match(originalMigration, /reference text not null unique/i);
  assert.match(originalMigration, /constraint lcdbo_correspondence_reference_check check \(reference ~ '\^LCDBO\/\(JNT\|RMRDC\|RFNL\)\/\[0-9\]\{4\}\/\(IN\|OUT\)\/\[0-9\]\{6\}\$'\)/i);
  assert.match(originalMigration, /status in \(\s*'draft'[\s\S]*'cancelled'/i);

  const counterKey = (issuer, year, direction) => `${issuer}:${year}:${direction}`;
  const counters = new Map();
  const nextReference = (issuer, year, direction) => {
    assert.match(issuer, /^(JNT|RMRDC|RFNL)$/);
    assert.match(direction, /^(IN|OUT)$/);
    const key = counterKey(issuer, year, direction);
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    return `LCDBO/${issuer}/${year}/${direction}/${String(next).padStart(6, "0")}`;
  };

  assert.equal(nextReference("JNT", 2026, "OUT"), "LCDBO/JNT/2026/OUT/000001");
  assert.equal(nextReference("JNT", 2026, "OUT"), "LCDBO/JNT/2026/OUT/000002");
  assert.equal(nextReference("JNT", 2027, "OUT"), "LCDBO/JNT/2027/OUT/000001");
  assert.equal(nextReference("JNT", 2026, "IN"), "LCDBO/JNT/2026/IN/000001");
  assert.equal(nextReference("RMRDC", 2026, "OUT"), "LCDBO/RMRDC/2026/OUT/000001");

  const cancelledReference = nextReference("RFNL", 2026, "IN");
  assert.equal(cancelledReference, "LCDBO/RFNL/2026/IN/000001");
  assert.equal(nextReference("RFNL", 2026, "IN"), "LCDBO/RFNL/2026/IN/000002");
});

test("reference generation permissions remain restricted to authenticated users", () => {
  assert.match(referencePatchMigration, /security definer/i);
  assert.match(referencePatchMigration, /set search_path = public/i);
  assert.match(referencePatchMigration, /revoke all on function public\.generate_lcdbo_correspondence_reference\(text, text, timestamptz\) from public/i);
  assert.match(referencePatchMigration, /grant execute on function public\.generate_lcdbo_correspondence_reference\(text, text, timestamptz\) to authenticated/i);
  assert.doesNotMatch(referencePatchMigration, /grant execute[\s\S]*\bto anon\b/i);
});

test("reference generation design is safe for concurrent calls", async () => {
  assert.match(referencePatchMigration, /on conflict \(programme_id, issuer, direction, reference_year\)[\s\S]*do update set[\s\S]*last_sequence = c\.last_sequence \+ 1/i);
  const issued = new Set();
  let sequence = 0;
  const nextReference = async () => {
    sequence += 1;
    return `LCDBO/JNT/2026/OUT/${String(sequence).padStart(6, "0")}`;
  };
  const references = await Promise.all(Array.from({ length: 25 }, () => nextReference()));
  for (const reference of references) issued.add(reference);
  assert.equal(issued.size, references.length);
  assert.equal(references.at(0), "LCDBO/JNT/2026/OUT/000001");
  assert.equal(references.at(-1), "LCDBO/JNT/2026/OUT/000025");
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
