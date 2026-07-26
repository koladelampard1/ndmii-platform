#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const migrationPath = "supabase/migrations/20260726120000_lcdbo_delivery_sprint2_rls_remediation.sql";
const migration = read(migrationPath);
const service = read("src/lib/data/lcdbo-delivery-geography.ts");

assert(migration.includes("create or replace function public.lcdbo_can_save_delivery_activity"), "Activity save helper must be replaced.");
assert(migration.includes("create or replace function public.lcdbo_can_submit_delivery_progress_update"), "Progress submit helper must be replaced.");
assert(migration.includes("security definer") && migration.includes("set search_path = public"), "RLS helpers must remain security-definer with a safe search_path.");
assert(!migration.includes("or target_owner_id = public.lcdbo_current_app_user_id()"), "Activity helper must not grant access from owner_id alone.");
assert(migration.includes("if target_cluster_plan_id is not null then") && migration.includes("return public.lcdbo_can_manage_cluster_delivery_plan(target_cluster_plan_id);"), "Activity/progress helpers must enforce cluster as the most-specific scope.");
assert(migration.includes("if target_lga_plan_id is not null then") && migration.includes("return public.lcdbo_can_manage_lga_delivery_plan(target_lga_plan_id);"), "Activity/progress helpers must enforce LGA scope.");
assert(migration.includes("if target_state_plan_id is not null then") && migration.includes("return public.lcdbo_can_manage_state_delivery_plan(target_state_plan_id);"), "Activity/progress helpers must enforce state scope.");
assert(migration.includes("target_submitted_by is distinct from public.lcdbo_current_app_user_id()"), "Progress helper must prevent submitter spoofing.");
assert(migration.includes("target_workstream_id is not null or target_delivery_item_id is not null"), "Geographic users must remain blocked from national progress scopes.");

assert(migration.includes('drop policy if exists "LCDBO delivery managers can manage activities"'), "Broad FOR ALL activity policy must be removed.");
assert(migration.includes('for insert') && migration.includes('with check'), "Activity/progress insert policies must be explicit insert policies.");
assert(migration.includes('for update') && migration.includes('using (public.lcdbo_can_manage_delivery_activity(id))'), "Activity update policy must remain row-scoped.");
assert(migration.includes("created_by = public.lcdbo_current_app_user_id()"), "Activity insert policy must bind creator identity to the current app user.");
assert(migration.includes("owner_id is null or owner_id = public.lcdbo_current_app_user_id()"), "Activity policy must prevent coordinator owner spoofing.");
assert(migration.includes("review_status = 'submitted'") && migration.includes("reviewed_by is null") && migration.includes("reviewed_at is null"), "Progress insert policy must force submitted, unreviewed rows.");
assert(migration.includes("reviewed_by = public.lcdbo_current_app_user_id()"), "Progress review policy must bind reviewer identity to the current app user.");
assert(migration.includes("review_status <> 'approved' or reviewed_by <> submitted_by"), "Progress review policy must preserve self-approval prevention.");

assert(service.includes("Geographic coordinators can only assign activities to themselves or leave them unassigned."), "Server action must reject client-supplied owner impersonation before the database write.");
assert(!service.includes("access.canManage || payload.owner_id === access.ctx.appUserId"), "Server activity scope check must not grant access by owner_id alone.");

console.log(JSON.stringify({
  ok: true,
  migration: path.join(root, migrationPath),
  validation: "lcdbo_delivery_sprint2_rls_remediation",
}, null, 2));
