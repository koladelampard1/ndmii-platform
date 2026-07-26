#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const auditPath = "src/lib/data/platform-foundation.ts";
const sprint1Path = "src/lib/data/lcdbo-delivery.ts";
const sprint2Path = "src/lib/data/lcdbo-delivery-geography.ts";
const audit = read(auditPath);
const sprint1 = read(sprint1Path);
const sprint2 = read(sprint2Path);
const deliveryAuditLines = (source) => source.split("\n").filter((line) => line.includes("recordPlatformEvent") || line.includes("recordTrustedLcdboDeliveryEvent"));

assert(audit.includes("export async function recordTrustedLcdboDeliveryEvent"), "Trusted LCDBO delivery audit writer is missing.");
assert(audit.includes("createServiceRoleSupabaseClient()"), "Trusted audit writer must use the server-only service-role Supabase client.");
assert(audit.includes('input.eventType.startsWith("lcdbo.delivery.")'), "Trusted audit writer must restrict events to the LCDBO delivery namespace.");
assert(audit.includes("Verified actor identity is required"), "Trusted audit writer must require the verified application-user actor.");
assert(audit.includes("sanitizeAuditMetadata"), "Trusted audit writer must sanitize metadata before insertion.");
assert(audit.includes("SENSITIVE_AUDIT_METADATA_KEY"), "Trusted audit writer must strip sensitive metadata keys.");
assert(audit.includes("Unable to record the LCDBO delivery audit event."), "Trusted audit writer must fail with a controlled server-side error.");
assert(!audit.includes("SUPABASE_SERVICE_ROLE_KEY") || audit.includes("createServiceRoleSupabaseClient"), "Audit writer must not expose service-role credentials directly.");

for (const [label, source] of [["Sprint 1", sprint1], ["Sprint 2", sprint2]]) {
  assert(source.includes("recordTrustedLcdboDeliveryEvent"), `${label} delivery actions must call the trusted audit writer.`);
  assert(deliveryAuditLines(source).every((line) => !line.includes("recordPlatformEvent")), `${label} delivery actions must not use the generic signed-client platform event path.`);
  assert(deliveryAuditLines(source).every((line) => !line.includes("client: supabase")), `${label} delivery audit calls must not pass the signed-in client to platform_events.`);
}

for (const eventType of [
  "lcdbo.delivery.activity.created",
  "lcdbo.delivery.progress_update.submitted",
  "lcdbo.delivery.progress_update.approved",
  "lcdbo.delivery.progress_update.rejected",
  "lcdbo.delivery.progress_update.under_review",
]) {
  assert(sprint2.includes(eventType) || sprint2.includes("`lcdbo.delivery.progress_update.${input.reviewStatus}`"), `Missing Sprint 2 audit event ${eventType}.`);
}

console.log(JSON.stringify({
  ok: true,
  audit: path.join(root, auditPath),
  sprint1: path.join(root, sprint1Path),
  sprint2: path.join(root, sprint2Path),
  validation: "lcdbo_delivery_trusted_audit_writer",
}, null, 2));
