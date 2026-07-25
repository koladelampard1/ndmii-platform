import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error(`LCDBO delivery validation failed: ${message}`);
    process.exit(1);
  }
};

const migrationPath = "supabase/migrations/20260622120000_lcdbo_delivery_core_sprint1.sql";
const migration = read(migrationPath);
const data = read("src/lib/data/lcdbo-delivery.ts");
const registry = read("src/lib/workspaces/workspace-registry.ts");
const overview = read("src/app/dashboard/lcdbo/delivery/page.tsx");
const workstreams = read("src/app/dashboard/lcdbo/workstreams/page.tsx");
const milestonePage = read("src/app/dashboard/lcdbo/milestones/page.tsx");
const raidPage = read("src/app/dashboard/lcdbo/raid/page.tsx");
const decisionsPage = read("src/app/dashboard/lcdbo/decisions/page.tsx");
const calendarPage = read("src/app/dashboard/lcdbo/calendar/page.tsx");
const actions = read("src/app/dashboard/lcdbo/delivery-actions.ts");
const exportRoute = read("src/app/api/lcdbo/delivery/export/[dataset]/route.ts");

for (const table of ["lcdbo_workstreams", "lcdbo_delivery_items", "lcdbo_raid_items", "lcdbo_decisions"]) {
  assert(migration.includes(`public.${table}`), `Missing table ${table}.`);
  assert(migration.includes(`alter table public.${table} enable row level security`), `Missing RLS for ${table}.`);
}

for (const status of ["not_started", "planned", "in_progress", "at_risk", "blocked", "submitted", "completed", "cancelled"]) {
  assert(migration.includes(`'${status}'`), `Missing governed delivery status ${status}.`);
}

for (const eventType of [
  "lcdbo.delivery.workstream.created",
  "lcdbo.delivery.item.created",
  "lcdbo.delivery.raid.created",
  "lcdbo.delivery.decision.created",
  "lcdbo.delivery.export.generated",
]) {
  assert(data.includes(eventType), `Missing audit event ${eventType}.`);
}

for (const route of ["/dashboard/lcdbo/delivery", "/dashboard/lcdbo/workstreams", "/dashboard/lcdbo/milestones", "/dashboard/lcdbo/raid", "/dashboard/lcdbo/decisions", "/dashboard/lcdbo/calendar"]) {
  assert(registry.includes(route), `Workspace registry missing ${route}.`);
}

assert(data.includes("requireLcdboDeliveryAccess"), "Missing central delivery access helper.");
assert(data.includes("MANAGE_ROLES") && data.includes("EXPORT_ROLES"), "Missing delivery permission sets.");
assert(data.includes("isLcdboDeliverySchemaUnavailable"), "Missing migration-unavailable fallback helper.");
assert(data.includes("calculateDeliveryMetrics"), "Missing governed progress calculation.");
assert(data.includes("/^[=+\\-@]/"), "CSV formula-injection hardening missing.");
assert(actions.includes("requireLcdboDeliveryAccess(\"manage\")"), "Server actions do not enforce manage access.");
assert(exportRoute.includes("requireLcdboDeliveryAccess(\"export\""), "Export route does not enforce export access.");
assert(migration.includes("lcdbo_can_view_delivery_programme") && migration.includes("data_analyst") && migration.includes("auditor"), "RLS read helper does not include read-only delivery roles.");
assert(overview.includes("WorkspacePageHeader") && overview.includes("LcdboDeliveryMetricGrid"), "Overview does not use shared workspace components.");
assert(workstreams.includes("WorkstreamTable") && workstreams.includes("saveWorkstreamAction"), "Workstream register is incomplete.");
assert(milestonePage.includes("DeliveryItemTable") && milestonePage.includes("saveDeliveryItemAction"), "Milestone register is incomplete.");
assert(raidPage.includes("RaidTable") && raidPage.includes("saveRaidItemAction"), "RAID register is incomplete.");
assert(decisionsPage.includes("DecisionTable") && decisionsPage.includes("saveDecisionAction"), "Decision register is incomplete.");
assert(calendarPage.includes("CalendarAgenda"), "Delivery calendar is incomplete.");

console.log(JSON.stringify({
  ok: true,
  migration: path.join(root, migrationPath),
  routes: 6,
  tables: 4,
  validation: "lcdbo_delivery_core_sprint1",
}, null, 2));
