#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const migration = read("supabase/migrations/20260813120000_lcdbo_correspondence_management.sql");
const referencePatch = read("supabase/migrations/20260813133000_fix_lcdbo_correspondence_reference_generation.sql");
const data = read("src/lib/data/lcdbo-correspondence.ts");
const types = read("src/lib/lcdbo-correspondence/types.ts");
const state = read("src/lib/lcdbo-correspondence/state-machine.ts");
const pdf = read("src/lib/lcdbo-correspondence/pdf.ts");
const routing = read("src/lib/routing/dbin-hosts.ts");
const workspaceRegistry = read("src/lib/workspaces/workspace-registry.ts");
const tests = read("scripts/test-dbin-host-routing.mjs");

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
assert.match(types, /LCDBO_CORRESPONDENCE_CANONICAL_HOST = "correspondence\.dbin\.ng"/, "canonical host constant missing");
assert.match(types, /LCDBO_CORRESPONDENCE_BRANDED_HOST = "correspondence\.lcdbo\.com"/, "branded host constant missing");
assert.match(state, /draft: \["in_review", "cancelled"\]/, "draft transition missing");
assert.match(state, /awaiting_signature: \["signed"/, "signature transition missing");
assert.match(state, /closed: \[\]/, "terminal closed status missing");

assert.match(data, /requireLcdboCorrespondenceAccess/, "access helper missing");
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

assert.match(workspaceRegistry, /id: "correspondence"/, "correspondence workspace missing");
assert.match(workspaceRegistry, /href: "\/dashboard\/correspondence\/register"/, "register nav missing");
assert.match(workspaceRegistry, /href: "\/dashboard\/correspondence\/administration"/, "admin nav missing");
assert.match(routing, /correspondenceHosts/, "correspondence host config missing");
assert.match(routing, /CORRESPONDENCE_CANONICAL_HOST = "correspondence\.dbin\.ng"/, "host constant missing");
assert.match(tests, /correspondence host resolves to the LCDBO correspondence surface/, "routing test missing");

console.log("LCDBO correspondence validation passed.");
