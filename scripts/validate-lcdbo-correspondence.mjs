#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const migration = read("supabase/migrations/20260813120000_lcdbo_correspondence_management.sql");
const referencePatch = read("supabase/migrations/20260813133000_fix_lcdbo_correspondence_reference_generation.sql");
const functionGrantPatch = read("supabase/migrations/20260814100000_lcdbo_correspondence_function_anon_revoke.sql");
const workflowRlsPatch = read("supabase/migrations/20260814103000_lcdbo_correspondence_workflow_rls_uat_remediation.sql");
const representativeWorkflowPatch = read("supabase/migrations/20260814120000_lcdbo_correspondence_representative_workflow.sql");
const data = read("src/lib/data/lcdbo-correspondence.ts");
const types = read("src/lib/lcdbo-correspondence/types.ts");
const state = read("src/lib/lcdbo-correspondence/state-machine.ts");
const representativeWorkflow = read("src/lib/lcdbo-correspondence/representative-workflow.ts");
const pdf = read("src/lib/lcdbo-correspondence/pdf.ts");
const routing = read("src/lib/routing/dbin-hosts.ts");
const workspaceRegistry = read("src/lib/workspaces/workspace-registry.ts");
const tests = read("scripts/test-dbin-host-routing.mjs");
const correspondenceTests = read("scripts/test-lcdbo-correspondence-workflow.mjs");

function workspaceBlock(id) {
  const marker = `${id}: defineWorkspace({`;
  const start = workspaceRegistry.indexOf(marker);
  assert.notEqual(start, -1, `${id} workspace block missing`);
  const next = workspaceRegistry.indexOf("  }),", start);
  assert.notEqual(next, -1, `${id} workspace block is not closed`);
  return workspaceRegistry.slice(start, next);
}

const requiredTables = [
  "lcdbo_correspondence_reference_counters",
  "lcdbo_correspondence_records",
  "lcdbo_correspondence_contacts",
  "lcdbo_correspondence_templates",
  "lcdbo_correspondence_parties",
  "lcdbo_correspondence_document_versions",
  "lcdbo_correspondence_workflow_actions",
  "lcdbo_correspondence_approvals",
  "lcdbo_correspondence_signature_events",
  "lcdbo_correspondence_dispatch_events",
  "lcdbo_correspondence_responses",
  "lcdbo_correspondence_delegations",
  "lcdbo_correspondence_verification_records",
  "lcdbo_correspondence_comments",
  "lcdbo_correspondence_delivery_evidence",
  "lcdbo_correspondence_relationships",
  "lcdbo_correspondence_notification_jobs",
  "lcdbo_correspondence_email_dispatch_attempts",
];

for (const table of requiredTables) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\b`, "i"), `${table} table missing`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} RLS missing`);
  assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon`, "i"), `${table} anon revoke missing`);
}

assert.match(migration, /generate_lcdbo_correspondence_reference/i, "reference generator missing");
assert.match(migration, /LCDBO\/%s\/%s\/%s\/%s/i, "reference format missing");
assert.match(migration, /issuer in \('JNT', 'RMRDC', 'RFNL'\)/i, "issuer check missing");
assert.match(migration, /direction in \('IN', 'OUT'\)/i, "direction check missing");
assert.match(referencePatch, /create or replace function public\.generate_lcdbo_correspondence_reference\(\s*target_issuer text,\s*target_direction text,\s*registered_at timestamptz default now\(\)\s*\)/i, "reference patch must preserve function signature");
assert.match(referencePatch, /security definer/i, "reference patch must preserve security definer");
assert.match(referencePatch, /set search_path = public/i, "reference patch must preserve explicit search_path");
assert.match(referencePatch, /target_reference_year integer/i, "reference patch must use a non-ambiguous year variable");
assert.doesNotMatch(referencePatch, /declare[\s\S]*\breference_year integer\b/i, "reference patch must not redeclare ambiguous reference_year variable");
assert.match(referencePatch, /from public\.programmes as p/i, "reference patch must alias programme lookup");
assert.match(referencePatch, /insert into public\.lcdbo_correspondence_reference_counters as c/i, "reference patch must alias counter upsert target");
assert.match(referencePatch, /on conflict \(programme_id, issuer, direction, reference_year\)/i, "reference patch must preserve issuer/year/direction conflict target");
assert.match(referencePatch, /last_sequence = c\.last_sequence \+ 1/i, "reference patch must preserve transaction-safe sequence increment");
assert.match(referencePatch, /returning c\.last_sequence into next_sequence/i, "reference patch must return the generated sequence");
assert.match(referencePatch, /LCDBO\/%s\/%s\/%s\/%s/i, "reference patch must preserve reference format");
assert.match(referencePatch, /revoke all on function public\.generate_lcdbo_correspondence_reference\(text, text, timestamptz\) from public/i, "reference patch must revoke public execute");
assert.match(referencePatch, /grant execute on function public\.generate_lcdbo_correspondence_reference\(text, text, timestamptz\) to authenticated/i, "reference patch must grant authenticated execute");
assert.doesNotMatch(referencePatch, /grant execute[\s\S]*\bto anon\b/i, "reference patch must not grant anonymous execute");
assert.doesNotMatch(referencePatch, /\bmax\s*\(/i, "reference patch must not use MAX()+1 generation");
assert.doesNotMatch(referencePatch, /truncate|drop table|delete from public\./i, "reference patch must not contain destructive SQL");
for (const signature of [
  "public.lcdbo_correspondence_current_app_user_id()",
  "public.lcdbo_correspondence_has_role(uuid, text[])",
  "public.generate_lcdbo_correspondence_reference(text, text, timestamptz)",
  "public.lcdbo_correspondence_record_event(uuid, text, text, text, text, jsonb)",
]) {
  assert.match(functionGrantPatch, new RegExp(`revoke all on function ${signature.replace(/[()[\],]/g, "\\$&")} from anon`, "i"), `${signature} anon revoke missing`);
  assert.match(functionGrantPatch, new RegExp(`revoke all on function ${signature.replace(/[()[\],]/g, "\\$&")} from public`, "i"), `${signature} public revoke missing`);
  assert.match(functionGrantPatch, new RegExp(`grant execute on function ${signature.replace(/[()[\],]/g, "\\$&")} to authenticated`, "i"), `${signature} authenticated grant missing`);
}
assert.doesNotMatch(functionGrantPatch, /grant execute[\s\S]*\bto anon\b/i, "function grant patch must not grant anonymous execute");
assert.doesNotMatch(functionGrantPatch, /truncate|drop table|delete from public\./i, "function grant patch must not contain destructive SQL");
for (const fnName of [
  "lcdbo_correspondence_institution_for_record",
  "lcdbo_correspondence_has_scoped_role",
  "lcdbo_correspondence_can_access_record",
]) {
  assert.match(workflowRlsPatch, new RegExp(`create or replace function public\\.${fnName}`, "i"), `${fnName} helper missing`);
  assert.match(workflowRlsPatch, new RegExp(`revoke all on function public\\.${fnName}[\\s\\S]*from anon`, "i"), `${fnName} anon revoke missing`);
  assert.match(workflowRlsPatch, new RegExp(`grant execute on function public\\.${fnName}[\\s\\S]*to authenticated`, "i"), `${fnName} authenticated grant missing`);
}
assert.match(workflowRlsPatch, /metadata->>'institution_scope'/i, "institution-scope metadata boundary missing");
assert.match(
  workflowRlsPatch,
  /ra\.institution_id is null[\s\S]*ra\.role in \([\s\S]*'programme_officer'[\s\S]*'observer'[\s\S]*\)/i,
  "programme-scoped null-institution fallback must be restricted to privileged/read-only roles",
);
assert.doesNotMatch(
  workflowRlsPatch,
  /target_institution_id is null\s+or\s+ra\.institution_id is null\s+or\s+ra\.institution_id = target_institution_id/i,
  "institution-scoped requester/reviewer roles must not receive a blanket null-institution wildcard",
);
assert.match(workflowRlsPatch, /drop policy if exists "LCDBO correspondence participants can read records"/i, "record read policy replacement missing");
assert.match(workflowRlsPatch, /LCDBO correspondence writers can create document versions/i, "document-version insert policy missing");
assert.match(workflowRlsPatch, /LCDBO correspondence actors can record workflow actions/i, "workflow-action insert policy missing");
assert.match(workflowRlsPatch, /LCDBO correspondence reviewers can record approvals/i, "approval insert policy missing");
assert.match(workflowRlsPatch, /array\[approval_role\]/i, "approval role must be matched dynamically");
assert.match(workflowRlsPatch, /decision = 'approved'[\s\S]*r\.created_by = approver_id/i, "self-approval RLS guard missing");
assert.match(workflowRlsPatch, /LCDBO correspondence dispatch officers can record dispatch/i, "dispatch insert policy missing");
assert.match(workflowRlsPatch, /r\.status in \('signed', 'ready_for_dispatch', 'dispatch_failed'\)/i, "dispatch state gate missing");
assert.match(workflowRlsPatch, /lcdbo_correspondence_signature_events/i, "signature-before-dispatch RLS gate missing");
assert.match(workflowRlsPatch, /LCDBO correspondence operators can update delivery evidence/i, "delivery-evidence update policy missing");
assert.doesNotMatch(workflowRlsPatch, /grant execute[\s\S]*\bto anon\b/i, "workflow RLS patch must not grant anonymous execute");
assert.doesNotMatch(workflowRlsPatch, /truncate|drop table|delete from public\./i, "workflow RLS patch must not contain destructive SQL");
assert.match(representativeWorkflowPatch, /create table if not exists public\.lcdbo_correspondence_representative_authorities/i, "representative authority table missing");
assert.match(representativeWorkflowPatch, /representative_role in \('rmrdc_representative', 'roseate_representative'\)/i, "representative role constraint missing");
assert.match(representativeWorkflowPatch, /authority_status in \('active', 'inactive', 'revoked', 'expired'\)/i, "representative authority status constraint missing");
assert.match(representativeWorkflowPatch, /can_apply_signature boolean not null default false/i, "representative signature authority flag missing");
assert.match(representativeWorkflowPatch, /can_dispatch boolean not null default false/i, "representative dispatch authority flag missing");
assert.match(representativeWorkflowPatch, /create or replace function public\.lcdbo_correspondence_current_representative_authority/i, "current representative helper missing");
assert.match(representativeWorkflowPatch, /create or replace function public\.lcdbo_correspondence_is_representative_for_record/i, "representative record helper missing");
assert.match(representativeWorkflowPatch, /revoke all on function public\.lcdbo_correspondence_current_representative_authority\(uuid, uuid\) from anon/i, "representative helper anon revoke missing");
assert.match(representativeWorkflowPatch, /grant execute on function public\.lcdbo_correspondence_current_representative_authority\(uuid, uuid\) to authenticated/i, "representative helper authenticated grant missing");
assert.match(representativeWorkflowPatch, /LCDBO correspondence representatives can create verification records/i, "representative verification insert policy missing");
assert.match(representativeWorkflowPatch, /LCDBO correspondence representatives can queue notifications/i, "representative notification policy missing");
assert.match(representativeWorkflowPatch, /LCDBO correspondence representatives can maintain queued notifications/i, "representative notification update policy missing");
assert.match(representativeWorkflowPatch, /revoke all on table public\.lcdbo_correspondence_representative_authorities from anon/i, "representative authority anon revoke missing");
assert.match(representativeWorkflowPatch, /grant select, insert, update on table public\.lcdbo_correspondence_representative_authorities to authenticated/i, "representative authority authenticated grants missing");
assert.doesNotMatch(representativeWorkflowPatch, /grant execute[\s\S]*\bto anon\b/i, "representative workflow patch must not grant anonymous execute");
assert.doesNotMatch(representativeWorkflowPatch, /truncate|drop table|delete from public\./i, "representative workflow patch must not contain destructive SQL");
assert.match(migration, /status in \(\s*'draft'[\s\S]*'cancelled'/i, "status machine check missing");
assert.match(migration, /signature_mode in \('test_adapter', 'protected_asset', 'external_provider'\)/i, "signature adapter check missing");
assert.match(migration, /pending_approval[\s\S]*rejected/i, "template lifecycle statuses missing");
assert.match(migration, /lcdbo-correspondence-signatures'[\s\S]*false/i, "private signature bucket missing");
assert.match(migration, /LCDBO correspondence admins can manage contacts/i, "contact management policy missing");
assert.match(migration, /LCDBO correspondence admins can manage templates/i, "template management policy missing");
assert.match(migration, /LCDBO correspondence admins can manage delegations/i, "delegation management policy missing");
assert.match(migration, /LCDBO correspondence operators can write delivery evidence/i, "delivery evidence policy missing");
assert.match(migration, /lcdbo_correspondence_delivery_evidence_status_check/i, "delivery evidence status lifecycle constraint missing");
assert.match(migration, /LCDBO correspondence operators can create relationships/i, "relationship policy missing");
assert.doesNotMatch(migration, /truncate|drop table|delete from public\./i, "migration contains destructive SQL");
assert.doesNotMatch(migration, /password|service[_ -]?role[_ -]?key|supabase_service_role/i, "migration must not contain credentials or service-role keys");

assert.match(types, /CORRESPONDENCE_ROLE_GROUPS/, "role groups missing");
assert.match(types, /rmrdc_representative/, "RMRDC representative role missing from type role groups");
assert.match(types, /roseate_representative/, "Roseate representative role missing from type role groups");
assert.match(types, /LCDBO_CORRESPONDENCE_CANONICAL_HOST = "correspondence\.dbin\.ng"/, "canonical host constant missing");
assert.match(types, /LCDBO_CORRESPONDENCE_BRANDED_HOST = "correspondence\.lcdbo\.com"/, "branded host constant missing");
assert.match(state, /draft: \["in_review", "cancelled"\]/, "draft transition missing");
assert.match(state, /awaiting_signature: \["signed", "revision_requested", "rejected", "cancelled"\]/, "signature/counterparty rejection transition missing");
assert.match(state, /closed: \[\]/, "terminal closed status missing");
assert.match(representativeWorkflow, /REPRESENTATIVE_ROLES = \["rmrdc_representative", "roseate_representative"\]/, "representative role helper missing");
assert.match(representativeWorkflow, /SIMPLIFIED_CORRESPONDENCE_STATUSES/, "simplified statuses helper missing");
assert.match(representativeWorkflow, /counterpartyStatusForRepresentative/, "counterparty status helper missing");
assert.match(representativeWorkflow, /representativeBuckets/, "representative bucket helper missing");

assert.match(data, /requireLcdboCorrespondenceAccess/, "access helper missing");
assert.match(data, /versions:lcdbo_correspondence_document_versions!lcdbo_correspondence_document_versions_record_id_fkey\(\*\)/, "record detail loader must disambiguate document-version relationship");
assert.doesNotMatch(data, /versions:lcdbo_correspondence_document_versions\(\*\)/, "record detail loader must not use ambiguous document-version embed");
assert.match(data, /createCorrespondenceRecord/, "create workflow missing");
assert.match(data, /recordCorrespondenceApproval/, "approval workflow missing");
assert.match(data, /recordCorrespondenceSignature/, "signature workflow missing");
assert.match(data, /recordCorrespondenceDispatch/, "dispatch workflow missing");
assert.match(data, /upsertCorrespondenceContact/, "contact CRUD workflow missing");
assert.match(data, /getCorrespondenceContact/, "contact detail/history workflow missing");
assert.match(data, /transitionCorrespondenceContactStatus/, "contact lifecycle workflow missing");
assert.match(data, /upsertCorrespondenceTemplate/, "template CRUD workflow missing");
assert.match(data, /getCorrespondenceTemplate/, "template detail/version workflow missing");
assert.match(data, /transitionCorrespondenceTemplate/, "template lifecycle workflow missing");
assert.match(data, /upsertCorrespondenceDelegation/, "delegation CRUD workflow missing");
assert.match(data, /recordCorrespondenceDeliveryEvidence/, "delivery evidence workflow missing");
assert.match(data, /transitionCorrespondenceDeliveryEvidence/, "delivery evidence invalidation workflow missing");
assert.match(data, /createDeliveryEvidenceDownloadUrl/, "private delivery evidence download workflow missing");
assert.match(data, /malware_status_contract/, "delivery evidence malware status contract missing");
assert.match(data, /recordCorrespondenceResponse/, "response workflow missing");
assert.match(data, /createCorrespondenceRelationship/, "relationship workflow missing");
assert.match(data, /generateCorrespondenceNotificationJobs/, "reminder generation workflow missing");
assert.match(data, /sendCorrespondenceEmailDispatch/, "email dispatch adapter workflow missing");
assert.match(data, /getCorrespondenceRepresentativeAuthority/, "representative authority resolver missing");
assert.match(data, /createRepresentativeCorrespondenceLetter/, "representative create workflow missing");
assert.match(data, /saveRepresentativeDraftVersion/, "representative draft correction workflow missing");
assert.match(data, /submitRepresentativeLetterToCounterparty/, "representative submit workflow missing");
assert.match(data, /decideRepresentativeCounterpartyLetter/, "representative counterparty decision workflow missing");
assert.match(data, /generateRepresentativeFinalDocument/, "representative final document generation missing");
assert.match(data, /enqueueRepresentativeNotification/, "representative notification workflow missing");
assert.match(data, /dispatchReference = providerTracking \|\| record\.reference/, "LCDBO reference fallback tracking missing");
assert.match(data, /Provider or courier tracking identifier is required for this dispatch channel/, "provider tracking channel rule missing");
assert.match(data, /Required protected signature event is required before dispatch/, "signature-before-dispatch enforcement missing");
assert.match(data, /immutable final issued PDF/i, "immutable final PDF issuance rule missing");
assert.match(data, /Creator cannot approve their own correspondence/, "separation of duties missing");
assert.match(data, /Test signatures are disabled in production/, "production test-signature guard missing");
assert.match(data, /Signature replay is not allowed/, "signature replay guard missing");
assert.match(data, /sanitizePublicCorrespondenceText/, "public text sanitizer missing");
assert.match(data, /safeCsvValue/, "CSV formula hardening missing");
assert.doesNotMatch(data, /raw_signature/i, "raw signature wording must not be exposed in service layer");
assert.match(pdf, /mode: "draft" \| "final"/, "PDF draft/final modes missing");
assert.match(pdf, /DRAFT/, "draft watermark missing");
assert.match(pdf, /Document fingerprint/, "document fingerprint missing");
assert.match(pdf, /Page \$\{pageNumber\} of \$\{totalPages\}/, "repeated page furniture missing");

const requiredRoutes = [
  "src/app/correspondence/page.tsx",
  "src/app/correspondence/verify/page.tsx",
  "src/app/correspondence/verify/[token]/page.tsx",
  "src/app/dashboard/correspondence/page.tsx",
  "src/app/dashboard/correspondence/register/page.tsx",
  "src/app/dashboard/correspondence/create/page.tsx",
  "src/app/dashboard/correspondence/create/outgoing/page.tsx",
  "src/app/dashboard/correspondence/create/incoming/page.tsx",
  "src/app/dashboard/correspondence/[id]/page.tsx",
  "src/app/dashboard/correspondence/my-work/page.tsx",
  "src/app/dashboard/correspondence/waiting/page.tsx",
  "src/app/dashboard/correspondence/ready-to-send/page.tsx",
  "src/app/dashboard/correspondence/sent/page.tsx",
  "src/app/dashboard/correspondence/templates/page.tsx",
  "src/app/dashboard/correspondence/templates/[id]/page.tsx",
  "src/app/dashboard/correspondence/contacts/page.tsx",
  "src/app/dashboard/correspondence/contacts/[id]/page.tsx",
  "src/app/dashboard/correspondence/reports/page.tsx",
  "src/app/dashboard/correspondence/administration/page.tsx",
  "src/app/dashboard/correspondence/signatures/page.tsx",
  "src/app/dashboard/correspondence/dispatch/page.tsx",
  "src/app/dashboard/correspondence/drafts/page.tsx",
  "src/app/dashboard/correspondence/preview/page.tsx",
  "src/app/dashboard/correspondence/versions/page.tsx",
  "src/app/dashboard/correspondence/review/page.tsx",
  "src/app/dashboard/correspondence/approvals/page.tsx",
  "src/app/dashboard/correspondence/delivery-evidence/page.tsx",
  "src/app/dashboard/correspondence/responses/page.tsx",
  "src/app/dashboard/correspondence/related/page.tsx",
  "src/app/dashboard/correspondence/delegations/page.tsx",
  "src/app/api/correspondence/verify/route.ts",
  "src/app/api/lcdbo/correspondence/export/route.ts",
  "src/app/api/lcdbo/correspondence/[id]/draft-pdf/route.ts",
  "src/app/api/lcdbo/correspondence/[id]/final-pdf/route.ts",
  "src/app/api/lcdbo/correspondence/evidence/[evidenceId]/download/route.ts",
];
for (const route of requiredRoutes) assert.equal(exists(route), true, `${route} missing`);

const correspondenceWorkspace = workspaceBlock("correspondence");
const ekirsWorkspace = workspaceBlock("ekirs");
assert.match(correspondenceWorkspace, /id: "correspondence"/, "correspondence workspace missing");
assert.match(correspondenceWorkspace, /baseRoles: \["workspace_user"\]/, "representatives must enter via workspace_user scoped access");
assert.match(correspondenceWorkspace, /"rmrdc_representative"/, "RMRDC representative scoped role missing from correspondence workspace registry");
assert.match(correspondenceWorkspace, /"roseate_representative"/, "Roseate representative scoped role missing from correspondence workspace registry");
assert.doesNotMatch(ekirsWorkspace, /rmrdc_representative|roseate_representative/, "correspondence representatives must not be registered for EKIRS workspace access");
assert.match(correspondenceWorkspace, /label: "Needs My Action", href: "\/dashboard\/correspondence\/my-work"/, "representative action nav missing");
assert.match(correspondenceWorkspace, /label: "Waiting for Other Party", href: "\/dashboard\/correspondence\/waiting"/, "representative waiting nav missing");
assert.match(correspondenceWorkspace, /label: "Ready to Send", href: "\/dashboard\/correspondence\/ready-to-send"/, "representative ready-to-send nav missing");
assert.match(correspondenceWorkspace, /label: "Sent Letters", href: "\/dashboard\/correspondence\/sent"/, "representative sent nav missing");
assert.doesNotMatch(workspaceRegistry, /label: "Signature Queue"/, "legacy signature queue should not appear in primary correspondence navigation");
assert.match(correspondenceWorkspace, /href: "\/dashboard\/correspondence\/administration"/, "admin nav missing");
assert.match(correspondenceTests, /RMRDC representative allowed/i, "RMRDC representative route access regression test missing");
assert.match(correspondenceTests, /Roseate representative allowed/i, "Roseate representative route access regression test missing");
assert.match(correspondenceTests, /unrelated workspace_user denied/i, "unrelated workspace_user denial regression test missing");
assert.match(correspondenceTests, /inactive representative assignment denied/i, "inactive representative denial regression test missing");
assert.match(correspondenceTests, /representative cannot access unrelated institutional workspaces/i, "unrelated workspace denial regression test missing");
assert.match(routing, /correspondenceHosts/, "correspondence host config missing");
assert.match(routing, /CORRESPONDENCE_CANONICAL_HOST = "correspondence\.dbin\.ng"/, "host constant missing");
assert.match(tests, /correspondence host resolves to the LCDBO correspondence surface/, "routing test missing");

console.log("LCDBO correspondence validation passed.");
