#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const deliveryAuditLines = (source) => source.split("\n").filter((line) => line.includes("recordPlatformEvent") || line.includes("recordTrustedLcdboDeliveryEvent"));

const migrationPath = "supabase/migrations/20260623120000_lcdbo_delivery_core_sprint2.sql";
const migration = read(migrationPath);
const service = read("src/lib/data/lcdbo-delivery-geography.ts");
const audit = read("src/lib/data/platform-foundation.ts");
const route = read("src/app/api/lcdbo/delivery/export/[dataset]/route.ts");
const registry = read("src/lib/workspaces/workspace-registry.ts");
const scopedAccess = read("scripts/validate-lcdbo-scoped-access.mjs");

const requiredTables = [
  "lcdbo_state_delivery_plans",
  "lcdbo_lga_delivery_plans",
  "lcdbo_cluster_delivery_plans",
  "lcdbo_delivery_activities",
  "lcdbo_delivery_progress_updates",
];

for (const table of requiredTables) {
  assert(migration.includes(`create table if not exists public.${table}`), `${table} table is missing from Sprint 2 migration.`);
  assert(migration.includes(`alter table public.${table} enable row level security`), `${table} must enable RLS.`);
}

assert(migration.includes("state_plan_id uuid not null references public.lcdbo_state_delivery_plans"), "LGA and cluster plans must depend on state plans.");
assert(migration.includes("cluster_id uuid not null references public.industrial_clusters"), "Cluster plans must reference canonical industrial_clusters.");
assert(migration.includes("lga_id uuid not null references public.lgas"), "LGA plans must reference canonical LGAs.");
assert(migration.includes("state_id uuid not null references public.states"), "State plans must reference canonical states.");
assert(migration.includes("lcdbo_validate_lga_delivery_plan"), "LGA state matching trigger is missing.");
assert(migration.includes("Selected LGA does not belong to the selected state"), "LGA cross-state rejection is missing.");
assert(migration.includes("lcdbo_validate_cluster_delivery_plan"), "Cluster geography validation trigger is missing.");
assert(migration.includes("Industrial cluster belongs to a different state"), "Cluster cross-state rejection is missing.");
assert(migration.includes("num_nonnulls(workstream_id, state_plan_id, lga_plan_id, cluster_plan_id, delivery_item_id, activity_id) = 1"), "Progress updates must target exactly one scope.");
assert(migration.includes("reviewed_by <> submitted_by"), "Self-approval prevention is missing.");
assert(migration.includes("delivery_scope_type") && migration.includes("alter table public.lcdbo_delivery_items") && migration.includes("alter table public.lcdbo_raid_items"), "Sprint 1 delivery items and RAID records must support geographic scope.");
for (const role of ["state_coordinator", "lga_coordinator", "cluster_manager"]) {
  assert(migration.includes(`'${role}'`) && service.includes(`"${role}"`) && registry.includes(`"${role}"`), `${role} must be supported as a scoped geographic delivery role.`);
}
assert(migration.includes("lcdbo_can_manage_state_delivery_plan") && migration.includes("lcdbo_can_save_state_delivery_plan"), "State coordinator RLS helpers are missing.");
assert(migration.includes("lcdbo_can_manage_lga_delivery_plan") && migration.includes("lcdbo_can_save_lga_delivery_plan"), "LGA coordinator RLS helpers are missing.");
assert(migration.includes("lcdbo_can_manage_cluster_delivery_plan") && migration.includes("lcdbo_can_save_cluster_delivery_plan"), "Cluster manager RLS helpers are missing.");
assert(migration.includes("lcdbo_can_submit_delivery_progress_update"), "Scoped progress-update submission RLS helper is missing.");
assert(migration.includes("lcdbo_can_view_state_delivery_plan(id)") && migration.includes("lcdbo_can_view_lga_delivery_plan(id)") && migration.includes("lcdbo_can_view_cluster_delivery_plan(id)"), "Geographic delivery read policies must be row-scoped.");
assert(migration.includes("lcdbo_can_view_all_delivery_programme") && migration.includes("'observer'") && migration.includes("'data_analyst'") && migration.includes("'auditor'"), "Read-only LCDBO programme roles must retain programme-wide read visibility.");
assert(migration.includes("record_classification', 'configured_target'"), "Seeded plans must be classified as configured planning data.");
assert(!migration.includes("'active',\n  'approved'"), "Seeded plans must not be silently activated.");

for (const routePath of [
  "src/app/dashboard/lcdbo/delivery/states/page.tsx",
  "src/app/dashboard/lcdbo/delivery/states/[id]/page.tsx",
  "src/app/dashboard/lcdbo/delivery/lgas/page.tsx",
  "src/app/dashboard/lcdbo/delivery/lgas/[id]/page.tsx",
  "src/app/dashboard/lcdbo/delivery/clusters/page.tsx",
  "src/app/dashboard/lcdbo/delivery/clusters/[id]/page.tsx",
  "src/app/dashboard/lcdbo/my-work/page.tsx",
]) {
  assert(exists(routePath), `${routePath} route is missing.`);
}

for (const symbol of [
  "getLcdboGeographyDeliverySnapshot",
  "createOrUpdateStatePlan",
  "createOrUpdateLgaPlan",
  "createOrUpdateClusterPlan",
  "createOrUpdateActivity",
  "submitProgressUpdate",
  "reviewProgressUpdate",
  "getMyLcdboDeliveryWork",
  "exportLcdboGeographyDeliveryData",
]) {
  assert(service.includes(` ${symbol}`) || service.includes(`function ${symbol}`), `${symbol} is missing from the Sprint 2 service.`);
}

assert(service.includes("requireLcdboDeliveryAccess(mode, client)") && service.includes("assertCanSaveStatePlan") && service.includes("assertCanSaveLgaPlan") && service.includes("assertCanSaveClusterPlan"), "Sprint 2 must reuse shared LCDBO access and enforce record-level geographic mutation checks.");
assert(service.includes("Geographic coordinators cannot submit updates directly against national delivery records"), "Geographic coordinators must not submit updates against national delivery records.");
assert(service.includes("Only programme officers, institution administrators or platform administrators can review"), "Progress update review must remain programme-manager controlled.");
assert(route.includes('requireLcdboDeliveryAccess("export"'), "Sprint 2 exports must use the shared export authorization guard.");
assert(service.includes("reviewStatus") && service.includes("existing.submitted_by === actorUserId"), "Progress review separation of duties is missing.");
assert(service.includes("recordTrustedLcdboDeliveryEvent"), "Sprint 2 delivery audit events must use the trusted server-side LCDBO delivery audit writer.");
assert(deliveryAuditLines(service).every((line) => !line.includes("recordPlatformEvent") && !line.includes("client: supabase")), "Sprint 2 delivery actions must not pass the signed-in client to platform_events audit inserts.");
assert(audit.includes("createServiceRoleSupabaseClient()") && audit.includes("Unable to record the LCDBO delivery audit event."), "Trusted LCDBO delivery audit writer must use the server-only service-role client and fail safely.");
assert(service.includes("classificationLabel"), "Exports must include data classification labels.");
assert(service.includes("/^[=+\\-@]/") || service.includes("/^[=+\\-@]/"), "CSV formula injection neutralization is missing.");
assert(route.includes("states") && route.includes("lgas") && route.includes("clusters") && route.includes("activities") && route.includes("progress-updates") && route.includes("my-work"), "Delivery export API must include Sprint 2 datasets.");
assert(registry.includes("/dashboard/lcdbo/delivery/states") && registry.includes("/dashboard/lcdbo/delivery/lgas") && registry.includes("/dashboard/lcdbo/delivery/clusters") && registry.includes("/dashboard/lcdbo/my-work"), "Workspace registry navigation is missing Sprint 2 routes.");
assert(scopedAccess.includes("LCDBO observer assignment must not grant NRS access"), "Scoped access regression coverage must remain in place.");

console.log(JSON.stringify({
  ok: true,
  migration: path.join(root, migrationPath),
  tables: requiredTables.length,
  routes: 7,
  validation: "lcdbo_delivery_core_sprint2",
}, null, 2));
