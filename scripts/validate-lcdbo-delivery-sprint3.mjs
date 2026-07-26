#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const migrationPath = "supabase/migrations/20260726190000_lcdbo_delivery_sprint3_executive_intelligence.sql";
const servicePath = "src/lib/data/lcdbo-delivery-intelligence.ts";
const executivePath = "src/components/lcdbo/lcdbo-executive-dashboard.tsx";
const attentionPath = "src/app/dashboard/lcdbo/executive/attention/page.tsx";
const evidencePath = "src/app/dashboard/lcdbo/evidence/page.tsx";
const readinessPath = "src/app/dashboard/lcdbo/pilot-readiness/page.tsx";
const actionsPath = "src/app/dashboard/lcdbo/executive-actions.ts";
const exportPath = "src/app/api/lcdbo/delivery/export/[dataset]/route.ts";
const pdfPath = "src/app/api/lcdbo/reports/[type]/pdf/route.ts";
const briefingPdfPath = "src/app/api/lcdbo/briefings/[type]/pdf/route.ts";
const snapshotsPath = "src/app/api/lcdbo/snapshots/route.ts";
const navPath = "src/lib/workspaces/workspace-registry.ts";
const reportsPath = "src/app/dashboard/lcdbo/reports/page.tsx";
const deliveryComponentsPath = "src/components/lcdbo/lcdbo-delivery-components.tsx";
const geographyComponentsPath = "src/components/lcdbo/lcdbo-delivery-geography-components.tsx";

const migration = read(migrationPath);
const service = read(servicePath);
const executive = read(executivePath);
const attention = read(attentionPath);
const evidence = read(evidencePath);
const readiness = read(readinessPath);
const actions = read(actionsPath);
const exportRoute = read(exportPath);
const pdfRoute = read(pdfPath);
const briefingPdfRoute = read(briefingPdfPath);
const snapshotsRoute = read(snapshotsPath);
const nav = read(navPath);
const reports = read(reportsPath);
const deliveryComponents = read(deliveryComponentsPath);
const geographyComponents = read(geographyComponentsPath);

for (const table of [
  "lcdbo_delivery_health_overrides",
  "lcdbo_delivery_evidence_links",
  "lcdbo_delivery_evidence_reviews",
  "lcdbo_pilot_readiness_assessments",
  "lcdbo_pilot_readiness_dimensions",
]) {
  assert(migration.includes(`create table if not exists public.${table}`), `${table} must be created by the Sprint 3 migration.`);
  assert(migration.includes(`alter table public.${table} enable row level security`), `${table} must enable RLS.`);
  assert(migration.includes(`revoke all on table public.${table} from anon`), `${table} must revoke anonymous access.`);
}

assert(migration.includes("create or replace function public.lcdbo_can_view_delivery_governance"), "Sprint 3 must define a central governance read helper.");
assert(migration.includes("create or replace function public.lcdbo_can_manage_delivery_governance"), "Sprint 3 must define a central governance manage helper.");
assert(migration.includes("ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin', 'data_analyst', 'auditor', 'observer', 'state_coordinator', 'lga_coordinator', 'cluster_manager')"), "Governance read helper must preserve scoped LCDBO roles.");
assert(migration.includes("ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin')"), "Governance manage helper must remain limited to managers.");
assert(!migration.includes("grant all") && !migration.toLowerCase().includes(" to anon;"), "Sprint 3 migration must not grant broad or anonymous privileges.");
assert(migration.includes("safe_url is null or safe_url ~* '^https?://'"), "Evidence links must constrain safe URLs to HTTP(S).");
assert(migration.includes("reviewed_by is null or reviewed_by <> submitted_by"), "Evidence self-verification must be blocked.");
assert(migration.includes("idx_lcdbo_pilot_readiness_state") && migration.includes("idx_lcdbo_pilot_readiness_lga") && migration.includes("idx_lcdbo_pilot_readiness_cluster"), "Readiness assessments must remain unique per programme scope.");
for (const reportType of ["programme_delivery", "workstream_performance", "milestone_deliverable", "risk_issue", "state_delivery", "lga_delivery", "cluster_delivery", "executive_delivery", "executive_exceptions", "pilot_readiness", "evidence_verification"]) {
  assert(migration.includes(reportType), `${reportType} must be allowed in governed report snapshots.`);
}

assert(service.includes("LCDBO_DELIVERY_HEALTH_MODEL_VERSION"), "Service must expose a versioned delivery health model.");
assert(service.includes("HEALTH_FACTOR_WEIGHTS"), "Service must centrally define health-model weights.");
assert(service.includes("classifyDeliveryRecord"), "Service must classify records for lineage.");
assert(service.includes("metadata.uat_reference") && service.includes("metadata.source === \"live_uat\""), "Service must detect known UAT/test records.");
assert(service.includes("includeTestData") && service.includes("excludedTest"), "Service must exclude test/UAT records by default and report exclusions.");
assert(service.includes("calculateExplainableHealth"), "Service must calculate explainable programme health.");
assert(service.includes("buildScopedHealth") && service.includes("ScopedHealthExplanation"), "Service must expose multi-level health explanations.");
assert(service.includes("buildEvidenceTargets") && service.includes("EvidenceTarget"), "Service must expose contextual evidence targets beyond attention items.");
assert(service.includes("missingDataImpact"), "Health model must expose missing-data impact.");
assert(service.includes("Blocking readiness dimensions prevent ready or active status"), "Readiness rules must prevent blocked records from becoming ready/active.");
assert(service.includes("new URL(safeUrl)") && service.includes("http:") && service.includes("https:"), "Evidence action must validate URL protocols.");
assert(service.includes("Submitters cannot verify or reject their own evidence."), "Evidence verification must prevent self-review.");
assert(service.includes("lcdbo_delivery_evidence_reviews") && service.includes("if (review.error) throw review.error"), "Evidence verification history must be preserved and checked.");
assert(service.includes("generateReportSnapshot"), "Sprint 3 reports must reuse existing governed snapshot infrastructure.");
assert(service.includes("recordTrustedLcdboDeliveryEvent"), "Sprint 3 mutations/exports must use the trusted delivery audit writer.");
assert(service.includes("lcdbo.delivery.evidence.linked"), "Evidence linkage must emit a trusted audit event.");
assert(service.includes("lcdbo.delivery.health_override.applied") && service.includes("lcdbo.delivery.health_override.removed"), "Health overrides must have trusted audit events.");
assert(service.includes("lcdbo.delivery.pilot_readiness.assessed"), "Readiness assessment must emit a trusted audit event.");
assert(service.includes("lcdbo.delivery.pilot_readiness.approved") && service.includes("lcdbo.delivery.pilot_readiness.paused"), "Readiness approval and pause events must be distinguishable.");
assert(service.includes("lcdbo.delivery.snapshot.generated"), "Sprint 3 snapshots must have a trusted audit event path.");
assert(service.includes("lcdbo.delivery.executive_report.generated"), "Sprint 3 exports must emit a trusted audit event.");
assert(service.includes("/^[=+\\-@]/") || service.includes("/^[=+\\-@]/.test"), "CSV exports must neutralize formula-injection values.");
assert(!service.includes(".upsert(payload, { onConflict"), "Pilot readiness saves must avoid fragile partial-index upserts.");

assert(executive.includes("ExecutiveMetricGrid") && executive.includes("deliveryIntelligence"), "Executive dashboard must surface Sprint 3 metrics and health.");
assert(executive.includes("Multi-level health") && executive.includes("deliveryIntelligence.scopedHealth"), "Executive dashboard must surface multi-level health explanations.");
assert(attention.includes("getLcdboSprint3Snapshot") && attention.includes("include_test") && attention.includes("canExport"), "Executive attention route must support authorized include-test diagnostics.");
assert(evidence.includes("linkLcdboEvidenceAction") && evidence.includes("reviewLcdboEvidenceAction") && evidence.includes("snapshot.evidenceTargets") && evidence.includes("selectedTarget"), "Evidence page must support governed contextual link, preselection and review actions.");
assert(readiness.includes("savePilotReadinessAction") && readiness.includes("blocking_issue_count"), "Pilot-readiness page must expose controlled readiness review.");
assert(actions.includes("createEvidenceLink") && actions.includes("reviewEvidenceLink") && actions.includes("savePilotReadinessAssessment"), "Server actions must route Sprint 3 mutations through the shared service.");
for (const targetType of ["workstream", "delivery_item", "raid_item", "decision", "pilot_readiness"]) {
  assert(deliveryComponents.includes(`type=\"${targetType}\"`) || readiness.includes(`type=\"${targetType}\"`), `${targetType} records must expose contextual evidence links.`);
}
for (const targetType of ["state_plan", "lga_plan", "cluster_plan", "activity", "progress_update"]) {
  assert(geographyComponents.includes(`type=\"${targetType}\"`), `${targetType} records must expose contextual evidence links.`);
}

for (const dataset of ["programme-delivery", "workstream-performance", "milestone-deliverable", "risk-issue", "state-delivery", "lga-delivery", "cluster-delivery", "executive-exceptions", "pilot-readiness", "evidence-verification"]) {
  assert(exportRoute.includes(dataset), `${dataset} export dataset must be registered.`);
  assert(pdfRoute.includes(dataset), `${dataset} PDF report must be registered.`);
  assert(briefingPdfRoute.includes(dataset), `${dataset} briefing PDF must be registered.`);
  assert(reports.includes(dataset), `${dataset} must be discoverable from LCDBO reports.`);
}
assert(exportRoute.includes("requireLcdboDeliveryAccess(\"export\""), "Sprint 3 exports must preserve governed export authorization.");
assert(pdfRoute.includes("requireLcdboDeliveryAccess(\"export\""), "Sprint 3 PDFs must preserve governed export authorization.");
assert(briefingPdfRoute.includes("requireLcdboDeliveryAccess(\"export\""), "Sprint 3 briefing PDFs must preserve governed export authorization.");
assert(snapshotsRoute.includes("generateSprint3ReportSnapshot"), "Scheduled snapshots must reuse the Sprint 3 governed snapshot service.");
for (const reportType of ["programme_delivery", "workstream_performance", "milestone_deliverable", "risk_issue", "state_delivery", "lga_delivery", "cluster_delivery", "executive_delivery", "executive_exceptions", "pilot_readiness", "evidence_verification"]) {
  assert(snapshotsRoute.includes(reportType), `${reportType} must be generated by the existing snapshot route.`);
}

for (const href of [
  "/dashboard/lcdbo/executive/attention",
  "/dashboard/lcdbo/pilot-readiness",
  "/dashboard/lcdbo/evidence",
]) {
  assert(nav.includes(href), `${href} must be present in registry-driven LCDBO navigation.`);
}

console.log(JSON.stringify({
  ok: true,
  migration: path.join(root, migrationPath),
  service: path.join(root, servicePath),
  validation: "lcdbo_delivery_sprint3_executive_intelligence",
}, null, 2));
