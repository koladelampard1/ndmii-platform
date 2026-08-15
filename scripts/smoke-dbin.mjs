#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function compact(value) {
  return value.replace(/\s+/g, " ");
}

const checks = [];

function check(name, fn) {
  checks.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const publicVerification = read("src/lib/data/public-verification.ts");
const complaintsRoute = read("src/app/api/public-complaints/route.ts");
const financeRoute = read("src/app/api/msme/finance-readiness/assessments/route.ts");
const logoRoute = read("src/app/api/msme/provider-logo/route.ts");
const authSessionRoute = read("src/app/api/auth/session/route.ts");
const loginDestination = read("src/lib/auth/login-destination.ts");
const logoutRoute = read("src/app/logout/route.ts");
const authCookies = read("src/lib/auth/cookies.ts");
const supabaseServer = read("src/lib/supabase/server.ts");
const boiPortal = read("src/app/boi/page.tsx");
const boiWorkspacePage = read("src/app/dashboard/boi/page.tsx");
const boiWorkspaceLayout = read("src/app/dashboard/boi/layout.tsx");
const boiWorkspaceSectionPage = read("src/app/dashboard/boi/[section]/page.tsx");
const boiWorkspaceData = read("src/lib/data/boi-workspace.ts");
const boiNativePages = read("src/components/boi/boi-native-pages.tsx");
const dashboardLayout = read("src/app/dashboard/layout.tsx");
const proxyFile = read("src/proxy.ts");
const dbinHosts = read("src/lib/routing/dbin-hosts.ts");
const impactShell = read("src/app/dashboard/impact-intelligence/impact-intelligence-shell.tsx");
const workspaceRegistry = read("src/lib/workspaces/workspace-registry.ts");
const workspaceLanguage = read("src/lib/workspaces/workspace-language.ts");
const workspaceShell = read("src/components/workspace/workspace-shell.tsx");
const workspaceTypes = read("src/lib/workspaces/workspace-types.ts");
const workspaceAccessPolicy = read("src/lib/workspaces/workspace-access-policy.ts");
const workspaceAccessServer = read("src/lib/workspaces/workspace-access-server.ts");
const workspaceClassification = read("src/lib/workspaces/workspace-classification.ts");
const workspacePageComponents = read("src/components/workspace/workspace-page.tsx");
const workspaceMetrics = read("src/components/workspace/workspace-metrics.tsx");
const workspaceTable = read("src/components/workspace/workspace-table.tsx");
const workspaceReporting = read("src/components/workspace/workspace-reporting.tsx");
const ekirsLanding = read("src/app/ekirs/page.tsx");
const ekirsWorkspaceLayout = read("src/app/dashboard/ekirs/layout.tsx");
const ekirsWorkspacePage = read("src/app/dashboard/ekirs/page.tsx");
const ekirsJurisdiction = read("src/lib/state-revenue/jurisdictions.ts");
const ekirsDemoData = read("src/lib/state-revenue/ekirs-demo-data.ts");
const stateRevenueSyntheticData = read("src/lib/state-revenue/synthetic-data.ts");
const ekirsMigration = read("supabase/migrations/20260730120000_state_revenue_ekirs_sprint0.sql");
const lcdboDeliveryMigration = read("supabase/migrations/20260622120000_lcdbo_delivery_core_sprint1.sql");
const lcdboDeliveryData = read("src/lib/data/lcdbo-delivery.ts");
const lcdboDeliveryActions = read("src/app/dashboard/lcdbo/delivery-actions.ts");
const lcdboDeliveryOverview = read("src/app/dashboard/lcdbo/delivery/page.tsx");
const lcdboWorkstreamsPage = read("src/app/dashboard/lcdbo/workstreams/page.tsx");
const lcdboMilestonesPage = read("src/app/dashboard/lcdbo/milestones/page.tsx");
const lcdboRaidPage = read("src/app/dashboard/lcdbo/raid/page.tsx");
const lcdboDecisionsPage = read("src/app/dashboard/lcdbo/decisions/page.tsx");
const lcdboCalendarPage = read("src/app/dashboard/lcdbo/calendar/page.tsx");
const lcdboDeliveryExportRoute = read("src/app/api/lcdbo/delivery/export/[dataset]/route.ts");
const adminGateway = read("src/app/admin/page.tsx");
const adminDashboardLayout = read("src/app/dashboard/admin/layout.tsx");
const adminDashboardPage = read("src/app/dashboard/admin/page.tsx");
const associationAccess = read("src/lib/associations/access.ts");
const associationMemberActions = read("src/lib/data/admin-association-member-actions.ts");
const associationAccessMigration = read("supabase/migrations/20260531170000_association_member_fast_track_access.sql");
const associationWorkspaceMigration = read("supabase/migrations/20260531190000_association_member_fast_track_workspace.sql");
const onboardingSaveHardeningMigration = read("supabase/migrations/20260601100000_msme_onboarding_save_hardening.sql");
const loginPage = read("src/app/(auth)/login/page.tsx");
const msmeOnboardingPage = read("src/app/dashboard/msme/onboarding/page.tsx");
const impactEvidenceService = read("src/lib/data/impact-evidence.ts");
const impactEvidenceMigration = read(
  "supabase/migrations/20260606120000_impact_evidence_phase1.sql",
);
const impactEvidenceAccessRoute = read(
  "src/app/api/impact-intelligence/evidence/[evidenceId]/route.ts",
);
const impactEvidencePage = read(
  "src/app/dashboard/impact-intelligence/evidence/page.tsx",
);
const impactEvidenceUploadStudio = read(
  "src/app/dashboard/impact-intelligence/evidence/create-evidence-form.tsx",
);
const nextConfig = read("next.config.ts");
const impactDataService = read("src/lib/data/impact-intelligence.ts");
const impactIndicatorMigration = read(
  "supabase/migrations/20260606140000_impact_indicator_phase1.sql",
);
const impactIndicatorService = read("src/lib/data/impact-indicators.ts");
const impactIndicatorPage = read(
  "src/app/dashboard/impact-intelligence/indicators/page.tsx",
);
const impactIndicatorDesignStudio = read(
  "src/app/dashboard/impact-intelligence/indicators/create/indicator-design-studio.tsx",
);
const impactReportMigration = read(
  "supabase/migrations/20260606170000_impact_reports_phase1a.sql",
);
const impactReportService = read("src/lib/data/impact-reports.ts");
const impactReportListPage = read(
  "src/app/dashboard/impact-intelligence/reports/page.tsx",
);
const impactReportCreationStudio = read(
  "src/app/dashboard/impact-intelligence/reports/new/report-creation-studio.tsx",
);
const impactReportDetailPage = read(
  "src/app/dashboard/impact-intelligence/reports/[reportId]/page.tsx",
);
const impactReportExportRoute = read(
  "src/app/api/impact-intelligence/reports/exports/[exportId]/route.ts",
);
const institutionalReportPdf = read(
  "src/lib/reports/institutional-report-pdf.ts",
);
const institutionalReportPdfModule = (() => {
  const source = ts.transpileModule(institutionalReportPdf, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  vm.runInNewContext(source, {
    module: commonJsModule,
    exports: commonJsModule.exports,
    console,
    TextEncoder,
  });
  return commonJsModule.exports;
})();
const authorization = read("src/lib/auth/authorization.ts");
const nrsWorkspaceLayout = read("src/app/dashboard/nrs/layout.tsx");
const lcdboWorkspaceLayout = read("src/app/dashboard/lcdbo/layout.tsx");
const nrsWorkspacePage = read("src/app/dashboard/nrs/page.tsx");
const nrsWorkspaceData = read("src/lib/data/nrs-formalisation.ts");
const nrsWorkspaceComponent = read("src/components/nrs/nrs-formalisation-workspace.tsx");
const nrsPublicLanding = read("src/app/nrs/page.tsx");
const nrsBusinessProfilePage = read("src/app/dashboard/nrs/businesses/[businessId]/page.tsx");
const nrsBusinessesPage = read("src/app/dashboard/nrs/businesses/page.tsx");
const nrsReadinessPage = read("src/app/dashboard/nrs/readiness/page.tsx");
const nrsIntelligencePage = read("src/app/dashboard/nrs/intelligence/page.tsx");
const nrsRevenueGuidesPage = read("src/app/dashboard/nrs/revenue-guides/page.tsx");
const nrsProgrammesPage = read("src/app/dashboard/nrs/programmes/page.tsx");
const nrsReportsPage = read("src/app/dashboard/nrs/reports/page.tsx");
const nrsVerificationPage = read("src/app/dashboard/nrs/verification/page.tsx");
const nrsIntegrationsPage = read("src/app/dashboard/nrs/integrations/page.tsx");
const nrsLegacyInvoicesPage = read("src/app/dashboard/nrs/invoices/page.tsx");
const nrsLegacyInvoiceRegistryPage = read("src/app/dashboard/nrs/invoice-registry/page.tsx");
const nrsLegacyVatMonitorPage = read("src/app/dashboard/nrs/vat-monitor/page.tsx");
const nrsLegacyRevenuePage = read("src/app/dashboard/nrs/revenue/page.tsx");
const authProfile = read("src/lib/auth/profile.ts");
const accessDeniedPage = read("src/app/access-denied/page.tsx");
const workspaceGuards = read("src/lib/auth/workspace-guards.ts");
const dbinHostsModule = (() => {
  const source = ts.transpileModule(dbinHosts, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  vm.runInNewContext(source, {
    module: commonJsModule,
    exports: commonJsModule.exports,
    process,
    Set,
    URL,
  });
  return commonJsModule.exports;
})();
const authorizationModule = (() => {
  const source = ts.transpileModule(authorization, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  vm.runInNewContext(source, {
    module: commonJsModule,
    exports: commonJsModule.exports,
    require(moduleName) {
      if (moduleName === "@/lib/impact-intelligence/permissions") {
        return {
          canAccessRoute: () => true,
          getRoutePolicy: () => null,
          logImpactPolicyDrift: () => {},
        };
      }
      if (moduleName === "@/lib/workspaces/workspace-access-policy") {
        const lcdboRoles = new Set(["admin", "super_admin", "programme_officer", "assessment_officer", "field_officer", "data_analyst", "auditor"]);
        return {
          canAccessWorkspaceRoute: ({ role }, workspaceId, pathname) => ({
            allowed: workspaceId === "lcdbo" && pathname.startsWith("/dashboard/lcdbo") && lcdboRoles.has(role),
          }),
        };
      }
      throw new Error(`Unexpected authorization dependency: ${moduleName}`);
    },
  });
  return commonJsModule.exports;
})();
const authSession = read("src/lib/auth/session.ts");
const roleTypes = read("src/types/roles.ts");
const analyticsRoute = read(
  "src/app/dashboard/impact-intelligence/analytics/page.tsx",
);
const executiveRoute = read(
  "src/app/dashboard/impact-intelligence/executive/page.tsx",
);
const intelligenceRoute = read(
  "src/app/dashboard/impact-intelligence/intelligence/page.tsx",
);
const intelligenceDetailRoute = read(
  "src/app/dashboard/impact-intelligence/intelligence/[insightId]/page.tsx",
);
const riskFlagsRoute = read(
  "src/app/dashboard/impact-intelligence/risk-flags/page.tsx",
);
const riskFlagsLayout = read(
  "src/app/dashboard/impact-intelligence/risk-flags/layout.tsx",
);
const impactLauncher = read(
  "src/app/dashboard/impact-intelligence/impact-intelligence-content.tsx",
);
const impactPermissions = read(
  "src/lib/impact-intelligence/permissions.ts",
);
const impactPermissionsModule = (() => {
  const source = ts.transpileModule(impactPermissions, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  vm.runInNewContext(source, { module: commonJsModule, exports: commonJsModule.exports, console });
  return commonJsModule.exports;
})();
const impactAccessScope = read(
  "src/lib/impact-intelligence/access-scope.ts",
);
const impactRbacMigration = read(
  "supabase/migrations/20260607120000_impact_rbac_phase1_programme_assignments.sql",
);
const impactAssignmentBackfill = read(
  "scripts/backfill-impact-programme-assignments.mjs",
);
const impactRouteGuards = read(
  "src/app/dashboard/impact-intelligence/_route-guards.ts",
);
const impactRouteFixture = read("src/lib/auth/route-access.fixture.ts");
const impactAssessmentPage = read(
  "src/app/dashboard/impact-intelligence/assessments/page.tsx",
);
const impactAssessmentService = read("src/lib/data/impact-intelligence.ts");

check("public raw ID verification is blocked", () => {
  assert(
    publicVerification.includes("detail.raw_lookup_blocked") &&
      publicVerification.includes("return null"),
    "Expected raw MSME/DBIN public verification to be blocked.",
  );
});

check("public verification validates signed credential token", () => {
  assert(
    publicVerification.includes('.from("digital_identity_credentials")') &&
      publicVerification.includes('.eq("public_token_hash", lookupHash)') &&
      publicVerification.includes("verifyCredentialSignature") &&
      publicVerification.includes('digitalRow.status !== "active"') &&
      publicVerification.includes("isExpired(digitalRow.token_expires_at)") &&
      publicVerification.includes("toPublicRecordFromDigitalRow"),
    "Expected token verification to query by public_token_hash and enforce active, unexpired credential state.",
  );
});

check("public complaints accept related_reference directly", () => {
  assert(
    complaintsRoute.includes('String(formData.get("related_reference") ?? "").trim()') &&
      complaintsRoute.includes("related_reference: related_reference || null"),
    "Expected public complaints route to read related_reference from FormData and persist it directly.",
  );
});

check("finance readiness blocks unauthenticated requests", () => {
  assert(
    financeRoute.includes("!ctx.appUserId") &&
      financeRoute.includes('ctx.role === "public"') &&
      financeRoute.includes("{ status: 401 }"),
    "Expected finance readiness assessment POST to return 401 for missing/public auth context.",
  );
});

check("finance readiness blocks non-msme roles", () => {
  assert(
    financeRoute.includes('ctx.role !== "msme"') &&
      !financeRoute.includes('["msme", "admin"].includes(ctx.role)') &&
      financeRoute.includes("{ status: 403 }"),
    "Expected finance readiness assessment POST to reject every authenticated non-msme role.",
  );
});

check("provider logo upload persists provider_profiles.logo_url", () => {
  const route = compact(logoRoute);
  assert(
    route.includes('const payload = { logo_url: logoUrl, }') &&
      route.includes('.from("provider_profiles") .update(payload)') &&
      route.includes('.select("id,msme_id,logo_url")'),
    "Expected provider logo upload to update provider_profiles.logo_url and select the persisted logo_url.",
  );
});

check("provider logo upload does not write msmes.passport_photo_url", () => {
  assert(
    !logoRoute.includes("passport_photo_url") && !logoRoute.includes('.from("msmes").update'),
    "Provider logo upload route must not write msmes.passport_photo_url.",
  );
});

check("auth session derives helper metadata server-side", () => {
  assert(
    authSessionRoute.includes("resolveSessionMetadata(accessToken)") &&
      authSessionRoute.includes("authClient.auth.getUser(accessToken)") &&
      authSessionRoute.includes('.from("users")') &&
      authSessionRoute.includes("role: metadata.role") &&
      authSessionRoute.includes('response.cookies.set("ndmii_role", metadata.role'),
    "Expected auth session POST to derive role/app user metadata from the Supabase token and users table.",
  );
});

check("logout clears Supabase and DBIN cookies before returning safely", () => {
  assert(
    logoutRoute.includes("supabase.auth.signOut") &&
      logoutRoute.includes("clearSupabaseAuthCookies(response)") &&
      logoutRoute.includes("clearDbinAuthCookies(response)") &&
      logoutRoute.includes('surface === "nrs"') &&
      logoutRoute.includes('surface === "lcdbo"') &&
      logoutRoute.includes('"workspace", "lcdbo"') &&
      authCookies.includes("DBIN_AUTH_COOKIE_DOMAIN") &&
      authCookies.includes("Clear legacy host-only cookies") &&
      supabaseServer.includes("response.cookies.set(name, \"\", expiredOptions)") &&
      supabaseServer.includes("domain: authCookieDomain"),
    "Expected logout to revoke the Supabase session, clear host-only plus cross-subdomain auth cookies, and preserve dedicated host return behaviour.",
  );
});

check("authenticated BOI, Impact Intelligence, and admin surfaces expose account actions", () => {
  assert(
    boiPortal.includes("<AccountActions") &&
      boiWorkspaceLayout.includes("<WorkspaceShell") &&
      boiWorkspaceLayout.includes('requireWorkspaceAccess("boi"') &&
      workspaceShell.includes("<AccountActions") &&
      impactShell.includes("<AccountActions") &&
      adminGateway.includes("<AccountActions"),
    "Expected authenticated institutional surfaces to expose logout and switch-account actions.",
  );
});

check("association temporary access stores hashed PINs only", () => {
  assert(
    associationAccessMigration.includes("temporary_pin_hash text not null") &&
      !associationAccessMigration.includes("temporary_pin text") &&
      associationAccess.includes("crypto.scryptSync") &&
      associationMemberActions.includes("temporary_pin_hash: hashTemporaryPin(pin)"),
    "Expected fast-track access to persist only scrypt-hashed temporary PINs.",
  );
});

check("association temporary access expires PINs and forces password setup", () => {
  assert(
    associationAccess.includes("temporary_pin_expires_at") &&
      associationAccess.includes("must_change_password") &&
      associationAccess.includes('status: "expired"') &&
      associationAccess.includes('activation_state: "account_created"'),
    "Expected fast-track access to reject expired PINs and require first-login password setup.",
  );
});

check("association temporary access provisions an idempotent draft MSME workspace", () => {
  assert(
    associationAccess.includes("ensureMsmeUserProfile") &&
      associationAccess.includes("ensureDraftMsmeWorkspace") &&
      associationAccess.includes('source_association_member_id') &&
      associationAccess.includes('source: "association_fast_track"') &&
      associationAccess.includes('verification_status: "draft"') &&
      associationAccess.includes('review_status: "draft"') &&
      associationAccess.includes('msme_workspace_provisioned') &&
      associationWorkspaceMigration.includes("add column if not exists source_association_member_id uuid") &&
      associationAccess.includes('redirectTo: "/dashboard/msme"') &&
      !loginPage.includes('"/dashboard/msme/onboarding"'),
    "Expected temporary PIN setup to reuse or create a draft MSME workspace and allow fast-track accounts into the dashboard.",
  );
});

check("MSME onboarding save uses an ownership-gated server write", () => {
  assert(
    msmeOnboardingPage.includes("createServiceRoleSupabaseClient") &&
      msmeOnboardingPage.includes('.eq("id", existing.id)') &&
      msmeOnboardingPage.includes('.eq("created_by", appUserId)') &&
      msmeOnboardingPage.includes(".maybeSingle()") &&
      msmeOnboardingPage.includes("Unable to save profile details. Please refresh and try again."),
    "Expected MSME profile completion writes to use a server-side client only with an explicit owner constraint and zero-row handling.",
  );
});

check("MSME onboarding save does not issue credentials", () => {
  assert(
    !msmeOnboardingPage.includes("ensurePendingCredential") &&
      !msmeOnboardingPage.includes("issued_at"),
    "MSME onboarding save must not issue credentials or mark an identity as issued.",
  );
});

check("MSME onboarding tolerates a missing validation results table", () => {
  assert(
    msmeOnboardingPage.includes("isMissingValidationResultsTable") &&
      msmeOnboardingPage.includes('operation: isMissingValidationResultsTable(validationResultError) ? "skip_missing_table" : "upsert_failed"') &&
      onboardingSaveHardeningMigration.includes("create table if not exists public.validation_results"),
    "Expected onboarding to continue when validation_results is missing and the hardening migration to repair the table.",
  );
});

check("association member MSME linkage is unique when present", () => {
  assert(
    onboardingSaveHardeningMigration.includes("create unique index if not exists idx_msmes_source_association_member_unique") &&
      onboardingSaveHardeningMigration.includes("where source_association_member_id is not null"),
    "Expected a partial unique index to prevent duplicate association member MSME workspaces.",
  );
});

check("evidence storage is private and legacy placeholders remain drafts", () => {
  assert(
    impactEvidenceMigration.includes("'impact-evidence'") &&
      impactEvidenceMigration.includes("public = false") &&
      impactEvidenceMigration.includes("legacy_evidence_status") &&
      impactEvidenceMigration.includes("status = 'draft'"),
    "Expected a private evidence bucket and legacy placeholder preservation.",
  );
});

check("evidence upload hashes files and cleans up failed writes", () => {
  assert(
    impactEvidenceService.includes('createHash("sha256")') &&
      impactEvidenceService.includes("checksum_sha256: sha256Hash") &&
      impactEvidenceService.includes("sha256_hash: sha256Hash") &&
      impactEvidenceService.includes("validateEvidenceContext") &&
      impactEvidenceService.includes(".upload(storagePath") &&
      impactEvidenceService.includes(".remove([storagePath])"),
    "Expected constrained evidence upload with SHA-256 and storage cleanup.",
  );
});

check("evidence Server Action envelope preserves the 10 MiB file validation limit", () => {
  assert(
    nextConfig.includes('bodySizeLimit: "11mb"') &&
      impactEvidenceService.includes("IMPACT_EVIDENCE_MAX_FILE_SIZE = 10 * 1024 * 1024") &&
      impactEvidenceUploadStudio.includes("nextFile.size > maxFileSizeBytes") &&
      impactEvidenceUploadStudio.includes("event.preventDefault()") &&
      impactEvidenceUploadStudio.includes("Body exceeded"),
    "Expected a multipart-aware Server Action limit with unchanged 10 MiB backend validation and client preflight.",
  );
});

check("evidence access uses authorized signed URLs", () => {
  assert(
    impactEvidenceAccessRoute.includes("getImpactEvidence(ctx") &&
      impactEvidenceAccessRoute.includes("createSignedUrl") &&
      !impactEvidenceAccessRoute.includes("getPublicUrl"),
    "Expected evidence access to authorize the record before issuing a signed URL.",
  );
});

check("evidence list uses defensive loading", () => {
  assert(
    impactEvidencePage.includes("unstable_rethrow") &&
      impactEvidencePage.includes("loadError") &&
      impactEvidencePage.includes("Evidence Repository Unavailable"),
    "Expected the evidence route to render an unavailable state instead of crashing.",
  );
});

check("indicator tables deny anonymous and authenticated direct access", () => {
  assert(
    impactIndicatorMigration.includes("alter table public.impact_indicators enable row level security") &&
      impactIndicatorMigration.includes("alter table public.impact_kpi_metrics enable row level security") &&
      impactIndicatorMigration.includes("alter table public.impact_dashboard_snapshots enable row level security") &&
      impactIndicatorMigration.includes("revoke all on public.impact_indicator_definitions from anon") &&
      impactIndicatorMigration.includes("revoke all on public.impact_indicator_measurements from anon") &&
      impactIndicatorMigration.includes("revoke all on public.impact_indicator_measurement_events from anon") &&
      impactIndicatorMigration.includes("revoke all on public.impact_indicator_definitions from authenticated"),
    "Expected legacy and Phase 1 indicator tables to use RLS with direct client access revoked.",
  );
});

check("indicator Phase 1 separates definitions, measurements, and events", () => {
  assert(
    impactIndicatorMigration.includes("create table if not exists public.impact_indicator_definitions") &&
      impactIndicatorMigration.includes("create table if not exists public.impact_indicator_measurements") &&
      impactIndicatorMigration.includes("create table if not exists public.impact_indicator_measurement_events") &&
      impactIndicatorMigration.includes("legacy_indicator_status") &&
      impactIndicatorMigration.includes("'imported'"),
    "Expected separate indicator definition, measurement, and append-only event tables with safe legacy preservation.",
  );
});

check("indicator aggregation counts verified measurements only", () => {
  assert(
    impactIndicatorService.includes('measurements.filter((item) => item.verification_status === "verified")') &&
      impactIndicatorService.includes('verificationStatus: "verified"') &&
      impactIndicatorService.includes("calculateProgressPercentage") &&
      impactIndicatorService.includes("calculateOutcomeStatus"),
    "Expected official indicator aggregates to use verified measurements and explicit progress/outcome calculations.",
  );
});

check("indicator route loads defensively and field officers have scoped access", () => {
  assert(
    impactIndicatorPage.includes("unstable_rethrow") &&
      impactIndicatorPage.includes("loadError") &&
      impactIndicatorPage.includes("Indicators Unavailable") &&
      authorization.includes('"/dashboard/impact-intelligence/indicators"') &&
      impactIndicatorService.includes('ctx.role === "field_officer"') &&
      impactIndicatorService.includes("assertFieldOfficerMeasurementScope"),
    "Expected defensive indicator loading and explicit field-officer route plus record scoping.",
  );
});

check("evidence upload studio submits canonical metadata fields", () => {
  const studio = compact(impactEvidenceUploadStudio);
  const service = compact(impactEvidenceService);
  assert(
    service.includes('file: "evidence_file"') &&
      service.includes('programmeId: "programme_id"') &&
      service.includes('cohortId: "cohort_id"') &&
      service.includes('cohortMemberId: "cohort_member_id"') &&
      service.includes('interventionId: "intervention_id"') &&
      service.includes('assessmentId: "assessment_id"') &&
      service.includes('fieldVisitId: "field_visit_id"') &&
      service.includes('category: "evidence_category"') &&
      service.includes('capturedAt: "captured_at"') &&
      service.includes('description: "description"') &&
      studio.includes("name={IMPACT_EVIDENCE_UPLOAD_FIELDS.file}") &&
      studio.includes("name={IMPACT_EVIDENCE_UPLOAD_FIELDS.programmeId}") &&
      studio.includes("name={IMPACT_EVIDENCE_UPLOAD_FIELDS.cohortId}") &&
      studio.includes("name={IMPACT_EVIDENCE_UPLOAD_FIELDS.cohortMemberId}") &&
      studio.includes("name={IMPACT_EVIDENCE_UPLOAD_FIELDS.category}"),
    "Expected the evidence Upload Studio and server action to share canonical metadata field names.",
  );
});

check("institutional reports enforce programme-anchored scope", () => {
  assert(
    impactReportMigration.includes("cohort_id uuid") &&
      impactReportMigration.includes("cohort_member_id uuid") &&
      impactReportMigration.includes("validate_impact_report_scope") &&
      impactReportService.includes("validateReportScope") &&
      impactReportService.includes("applyScope"),
    "Expected programme-anchored report scope fields, database validation, and source query filtering.",
  );
});

check("report creation studio submits the canonical report payload", () => {
  const studio = compact(impactReportCreationStudio);
  assert(
    studio.includes('id="report-creation-form"') &&
      studio.includes('type="hidden" name="title" value={title}') &&
      studio.includes('type="hidden" name="report_type" value={reportType}') &&
      studio.includes('type="hidden" name="programme_id" value={programmeId}') &&
      studio.includes('type="hidden" name="cohort_id" value={cohortId}') &&
      studio.includes('type="hidden" name="cohort_member_id" value={memberId}') &&
      studio.includes('type="hidden" name="msme_id" value={selectedMember?.msme_id ?? ""}') &&
      studio.includes('type="hidden" name="intervention_id" value={interventionId}') &&
      studio.includes('type="hidden" name="summary" value={summary}') &&
      studio.includes('type="submit"'),
    "Expected the final report generation step to retain every canonical server-action field and a real submit control.",
  );
});

check("indicator design studio submits the canonical indicator payload", () => {
  const studio = compact(impactIndicatorDesignStudio);
  assert(
    studio.includes('id="indicator-design-form"') &&
      studio.includes('type="hidden" name="name" value={name}') &&
      studio.includes('type="hidden" name="description" value={description}') &&
      studio.includes('type="hidden" name="programme_id" value={programmeId}') &&
      studio.includes('type="hidden" name="cohort_id" value={cohortId}') &&
      studio.includes('type="hidden" name="intervention_id" value={interventionId}') &&
      studio.includes('type="hidden" name="indicator_type" value={indicatorType}') &&
      studio.includes('type="hidden" name="unit_of_measure" value={unitOfMeasure}') &&
      studio.includes('type="hidden" name="direction_of_improvement" value={direction}') &&
      studio.includes('type="hidden" name="calculation_method" value={calculationMethod}') &&
      studio.includes('type="hidden" name="measurement_frequency" value={frequency}') &&
      studio.includes('type="hidden" name="owner_user_id" value={ownerUserId}') &&
      studio.includes('type="hidden" name="status" value={status}') &&
      studio.includes('type="hidden" name="baseline_required" value={baselineRequired ? "true" : ""}') &&
      studio.includes('type="hidden" name="target_required" value={targetRequired ? "true" : ""}') &&
      studio.includes('type="submit"'),
    "Expected the final indicator creation step to retain every canonical server-action field and a real submit control.",
  );
});

check("institutional reports qualify official sources", () => {
  assert(
    impactReportService.includes('.eq("status", "approved")') &&
      impactReportService.includes('.eq("status", "reviewed")') &&
      impactReportService.includes('.eq("verification_status", "verified")') &&
      impactReportService.includes("legacy_placeholder !== true") &&
      impactReportService.includes("completed_unreviewed_field_visits_excluded"),
    "Expected approved assessments, reviewed visits, verified evidence/indicators, and explicit excluded monitoring counts.",
  );
});

check("institutional report versions and references are immutable", () => {
  assert(
    impactReportMigration.includes("create_impact_report_version") &&
      impactReportMigration.includes("prevent_impact_report_version_mutation") &&
      impactReportMigration.includes("impact_report_version_evidence_references") &&
      impactReportMigration.includes("impact_report_version_indicator_references") &&
      impactReportMigration.includes("prevent_impact_report_evidence_reference_update") &&
      impactReportMigration.includes("prevent_impact_report_indicator_reference_update"),
    "Expected transactional immutable versions with normalized immutable source references.",
  );
});

check("institutional report exports are private and file-backed", () => {
  assert(
    impactReportMigration.includes("'impact-reports'") &&
      impactReportMigration.includes("public = false") &&
      impactReportMigration.includes("impact_report_exports_generated_file_check") &&
      impactReportService.includes(".upload(storagePath") &&
      impactReportService.includes(".list(folder") &&
      impactReportExportRoute.includes("createSignedUrl") &&
      !impactReportExportRoute.includes("getPublicUrl"),
    "Expected private PDF/JSON files, storage verification, generated-file constraints, and authorized signed downloads.",
  );
});

check("institutional report PDF is executive-grade and source-governed", () => {
  const generatedAt = "2026-06-13T10:00:00.000Z";
  const pdfBytes = institutionalReportPdfModule.createInstitutionalReportPdf({
    reportId: "report-1",
    title: "MSME Programme Impact Report",
    summary: "Governed programme delivery and outcome assurance.",
    reportType: "programme_performance",
    versionNumber: 2,
    versionId: "version-2",
    generatedAt,
    generatedByUserId: "user-1",
    sourceCutoffAt: generatedAt,
    status: "approved",
    metadata: {
      reporting_period_start: "2026-01-01",
      reporting_period_end: "2026-06-30",
    },
    scope: {
      programme_name: "DBIN MSME Growth Programme",
      cohort_name: "2026 Growth Cohort",
      intervention_title: "Digital Capability Support",
    },
    sourceSummary: {
      approved_assessments: 1,
      review_score_runs: 1,
      reviewed_field_visits: 1,
      verified_evidence: 1,
      verified_indicator_measurements: 1,
    },
    warnings: [],
    assessments: [{
      id: "assessment-1",
      title: "Readiness Assessment",
      assessment_type: "readiness",
      weighted_score: 80,
      readiness_category: "ready",
      reviewed_at: generatedAt,
      score_run_id: "score-run-1",
    }],
    scoreRunIds: ["score-run-1"],
    fieldVisits: [{
      id: "visit-1",
      title: "Monitoring Visit",
      visit_date: "2026-06-01",
      status: "reviewed",
      reviewed_at: generatedAt,
    }],
    evidence: [{
      evidence_id: "evidence-1",
      original_filename: "verified-evidence.pdf",
      verification_status: "verified",
      checksum_sha256: "a".repeat(64),
      mime_type: "application/pdf",
      file_size_bytes: 1024,
    }],
    indicators: [{
      indicator_definition_id: "indicator-1",
      indicator_measurement_id: "measurement-1",
      indicator_name: "MSMEs completing support",
      unit_of_measure: "MSMEs",
      baseline_value: 0,
      target_value: 100,
      measured_value: 80,
      progress_percentage: 80,
      outcome_status: "on_track",
      measurement_date: "2026-06-01",
      verification_status: "verified",
    }],
    governance: {
      createdAt: generatedAt,
      createdByUserId: "user-1",
      submittedAt: generatedAt,
      submittedByUserId: "user-1",
      reviewedAt: generatedAt,
      reviewedByUserId: "user-2",
      approvedAt: generatedAt,
      approvedByUserId: "user-2",
      returnedReason: null,
    },
    versions: [{
      id: "version-2",
      versionNumber: 2,
      generatedAt,
      generatedByUserId: "user-1",
      sourceCutoffAt: generatedAt,
      assessmentCount: 1,
      fieldVisitCount: 1,
      evidenceCount: 1,
      indicatorCount: 1,
      warningCount: 0,
    }],
    exports: [],
  });
  const pdf = new TextDecoder().decode(pdfBytes);
  const requiredSections = [
    "Executive Intelligence",
    "Executive Dashboard",
    "Executive Summary",
    "Impact Performance",
    "Theory of Change / Impact Logic",
    "Nigeria Geographic Impact",
    "Evidence Assurance",
    "Indicator & Outcome Performance",
    "Assessment & Monitoring Assurance",
    "Assurance & Governance",
    "Evaluation Matrix",
    "Risk & Completeness",
    "Governance & Approval",
    "Appendix / Source Register",
  ];
  assert(pdf.startsWith("%PDF-1.4") && pdf.endsWith("%%EOF"), "Expected a complete PDF 1.4 document.");
  assert((pdf.match(/\/Type \/Page\b/g) ?? []).length >= 15, "Expected a visual board-report page structure.");
  assert(requiredSections.every((section) => pdf.includes(section)), "Expected every executive report section.");
  assert(
    pdf.includes("EXECUTIVE REPORT HEALTH") &&
      pdf.includes("OUTCOME ACHIEVEMENT OVERVIEW") &&
      pdf.includes("GEOGRAPHIC COVERAGE") &&
      pdf.includes("No state, LGA, or location field was present"),
    "Expected report health, outcome charting, and conditional Nigeria visualization.",
  );
  assert(!pdf.includes("storage_path") && !pdf.includes("impact-reports/"), "Private storage paths must not appear in the PDF.");
});

check("institutional report routes load defensively", () => {
  assert(
    impactReportListPage.includes("unstable_rethrow") &&
      impactReportListPage.includes("Reports unavailable") &&
      impactReportDetailPage.includes("unstable_rethrow") &&
      impactReportDetailPage.includes("Report Unavailable") &&
      impactReportDetailPage.includes("sourceErrors"),
    "Expected report routes to render unavailable states and isolate source widget failures.",
  );
});

check("data analyst is a recognized Impact Intelligence role", () => {
  assert(
    roleTypes.includes('| "data_analyst"') &&
      authorization.includes('"data_analyst"') &&
      authorization.includes('data_analyst: "/dashboard/impact-intelligence/analytics"') &&
      authSession.includes('"data_analyst"'),
    "Expected data_analyst in role types, normalization, session validation, and route-home configuration.",
  );
});

check("BOI persona aliases resolve to the BOI workspace without LCDBO leakage", () => {
  const {
    canAccessRoute,
    getDefaultDashboardRoute,
    normalizeUserRole,
  } = authorizationModule;
  const impactShellCompact = compact(impactShell);

  assert(
    normalizeUserRole("boi_officer") === "boi_executive" &&
      normalizeUserRole("boi_manager") === "boi_executive" &&
      normalizeUserRole("boi_admin") === "boi_executive" &&
      getDefaultDashboardRoute(normalizeUserRole("boi_officer")) === "/dashboard/boi" &&
      canAccessRoute("boi_executive", "/dashboard/boi") &&
      canAccessRoute("boi_executive", "/dashboard/boi/businesses") &&
      canAccessRoute("boi_executive", "/dashboard/boi/readiness") &&
      canAccessRoute("boi_executive", "/dashboard/boi/risk") &&
      canAccessRoute("boi_executive", "/dashboard/impact-intelligence") &&
      !canAccessRoute("boi_executive", "/dashboard/lcdbo") &&
      impactShellCompact.includes('role === "boi_executive"') &&
      impactShellCompact.includes('item.href.startsWith("/dashboard/lcdbo")') &&
      impactShellCompact.includes("BOI_NAV_LABELS"),
    "Expected BOI officer, manager, and admin aliases to land in the native BOI workspace while excluding LCDBO navigation.",
  );
});

check("workspace registry establishes product-specific DPI workspaces", () => {
  assert(
    workspaceTypes.includes("export type WorkspaceDefinition") &&
      workspaceTypes.includes("WorkspaceNavigationSection") &&
      workspaceTypes.includes("WorkspaceDataClassificationRule") &&
      workspaceRegistry.includes("defineWorkspace") &&
      workspaceRegistry.includes("canonicalName") &&
      workspaceRegistry.includes("institutionalOwner") &&
      workspaceRegistry.includes("capabilities") &&
      workspaceRegistry.includes("dataClassification") &&
      workspaceRegistry.includes('id: "boi"') &&
      workspaceRegistry.includes('homepage: "/dashboard/boi"') &&
      workspaceRegistry.includes("Business Pipeline") &&
      workspaceRegistry.includes("Investment Readiness") &&
      workspaceRegistry.includes('id: "nrs"') &&
      workspaceRegistry.includes('id: "fccpc"') &&
      workspaceRegistry.includes('id: "lcdbo"') &&
      workspaceRegistry.includes('id: "property"') &&
      workspaceRegistry.includes('id: "msme"') &&
      workspaceRegistry.includes('id: "association"') &&
      workspaceRegistry.includes('id: "admin"') &&
      workspaceLanguage.includes("workspaceTerm") &&
      workspaceAccessPolicy.includes("canAccessWorkspaceRoute") &&
      workspaceAccessPolicy.includes("getVisibleWorkspaceNavigation") &&
      workspaceAccessServer.includes("requireWorkspaceAccess") &&
      workspaceShell.includes("WorkspaceShell"),
    "Expected a typed central registry, access policy, terminology layer, and reusable workspace shell for institutional workspaces.",
  );
});

check("institutional workspace framework exposes shared page, state, classification, metric, table, and reporting primitives", () => {
  assert(
    workspaceClassification.includes("WORKSPACE_CLASSIFICATION_LABELS") &&
      workspacePageComponents.includes("WorkspacePageHeader") &&
      workspacePageComponents.includes("WorkspaceState") &&
      workspacePageComponents.includes("WorkspaceDataClassificationBadge") &&
      workspaceMetrics.includes("ExecutiveMetricCard") &&
      workspaceMetrics.includes("ProgressMetricCard") &&
      workspaceTable.includes("WorkspaceDataTable") &&
      workspaceTable.includes("WorkspaceFilterBar") &&
      workspaceReporting.includes("WorkspaceReportCatalogue") &&
      workspaceReporting.includes("WorkspaceReportCard"),
    "Expected shared institutional page, state, classification, metric, table/filter, and reporting components.",
  );
});

check("BOI product routes render native pages backed by proven Impact Intelligence loaders", () => {
  assert(
    boiPortal.includes('href="/dashboard/boi"') &&
      boiWorkspacePage.includes("getBoiOverview") &&
      boiWorkspaceSectionPage.includes("resolveBoiSection") &&
      !boiWorkspaceSectionPage.includes("redirect(") &&
      boiWorkspaceData.includes("listImpactCohorts") &&
      boiWorkspaceData.includes("listImpactInterventions") &&
      boiWorkspaceData.includes("listImpactAssessments") &&
      boiWorkspaceData.includes("listImpactEvidence") &&
      boiWorkspaceData.includes('"business-pipeline": "businesses"') &&
      boiNativePages.includes("Investment dossier") &&
      boiNativePages.includes("Risk signals are operational review indicators") &&
      boiNativePages.includes("/dashboard/boi/businesses/"),
    "Expected /dashboard/boi product routes to render native BOI pages without redirecting users into Impact Intelligence URLs.",
  );
});

check("super admin resolves a valid post-login admin workspace", () => {
  const {
    canAccessRoute,
    getDefaultDashboardRoute,
    isPlatformAdmin,
    normalizeUserRole,
  } = authorizationModule;
  const resolvedRole = normalizeUserRole("super_admin");
  const landingRoute = getDefaultDashboardRoute(resolvedRole);

  assert(
    resolvedRole === "super_admin" &&
      normalizeUserRole("superadmin") === "super_admin" &&
      normalizeUserRole("system_admin") === "super_admin" &&
      isPlatformAdmin(resolvedRole) &&
      landingRoute === "/dashboard/admin" &&
      canAccessRoute(resolvedRole, landingRoute) &&
      canAccessRoute(resolvedRole, "/dashboard/impact-intelligence") &&
      canAccessRoute(resolvedRole, "/admin"),
    "Expected super admin aliases, landing route, and platform/admin route access to resolve consistently.",
  );
});

check("super admin login and admin landing guards use the verified platform role", () => {
  assert(
    loginPage.includes("const verifiedRole = normalizeUserRole(") &&
      loginPage.includes("getDefaultDashboardRoute(verifiedRole)") &&
      adminDashboardLayout.includes("!isPlatformAdmin(ctx.role)") &&
      adminDashboardPage.includes("!isPlatformAdmin(ctx.role)") &&
      adminGateway.includes("isPlatformAdmin(ctx.role)"),
    "Expected the server-verified role and platform-admin guard on the post-login landing chain.",
  );
});

check("NRS/FIRS formalisation workspace route access is presentation-ready", () => {
  const { canAccessRoute } = authorizationModule;
  const nrsRoutes = [
    "/dashboard/nrs",
    "/dashboard/nrs/businesses",
    "/dashboard/nrs/businesses/example",
    "/dashboard/nrs/readiness",
    "/dashboard/nrs/intelligence",
    "/dashboard/nrs/revenue-guides",
    "/dashboard/nrs/programmes",
    "/dashboard/nrs/reports",
    "/dashboard/nrs/verification",
    "/dashboard/nrs/integrations",
    "/dashboard/firs",
  ];
  const legacyRedirectRoutes = ["/dashboard/nrs/invoices", "/dashboard/nrs/invoice-registry", "/dashboard/nrs/vat-monitor", "/dashboard/nrs/revenue"];
  const restrictedRoutes = ["/dashboard/msme", "/dashboard/msme/compliance", "/dashboard/associations", "/dashboard/payments", "/dashboard/reviews/compliance", "/dashboard/reports"];

  assert(
    ["nrs_officer", "firs_officer", "admin", "super_admin"].every((role) => [...nrsRoutes, ...legacyRedirectRoutes].every((route) => canAccessRoute(role, route))) &&
      ["nrs_officer", "firs_officer"].every((role) => restrictedRoutes.every((route) => !canAccessRoute(role, route))),
    "Expected NRS/FIRS/admin roles to access intended formalisation routes while transaction/compliance surfaces remain restricted.",
  );
});

check("NRS/FIRS navigation and route fixture stay aligned to formalisation workspace", () => {
  const fixture = compact(impactRouteFixture);
  const nrsFixture = fixture.match(/nrs_officer: \{(.*?)\}, firs_officer:/)?.[1] ?? "";
  const firsFixture = fixture.match(/firs_officer: \{(.*?)\},? \};/)?.[1] ?? "";
  const roleNavSection = authorization.slice(authorization.indexOf("export const ROLE_NAV_ITEMS"));
  const nrsNav = roleNavSection.match(/nrs_officer: \[(.*?)\],\s*firs_officer:/s)?.[1] ?? "";
  const firsNav = roleNavSection.match(/firs_officer: \[(.*?)\],\s*\};/s)?.[1] ?? "";
  const requiredRoutes = [
    "/dashboard/nrs/businesses",
    "/dashboard/nrs/readiness",
    "/dashboard/nrs/intelligence",
    "/dashboard/nrs/revenue-guides",
    "/dashboard/nrs/programmes",
    "/dashboard/nrs/reports",
    "/dashboard/nrs/verification",
    "/dashboard/nrs/integrations",
  ];
  const retiredRoutes = ["/dashboard/payments", "/dashboard/reviews/compliance", "/dashboard/reports"];

  assert(
    requiredRoutes.every((route) => nrsNav.includes(`{ href: "${route}"`) && firsNav.includes(`{ href: "${route}"`) && nrsFixture.includes(route) && firsFixture.includes(route)) &&
      retiredRoutes.every((route) => !nrsNav.includes(`{ href: "${route}"`) && !firsNav.includes(`{ href: "${route}"`) && nrsFixture.includes(route) && firsFixture.includes(route)) &&
      nrsFixture.includes('"/dashboard/associations", "/dashboard/msme", "/dashboard/payments", "/dashboard/reviews/compliance", "/dashboard/reports"') &&
      firsFixture.includes('"/dashboard/associations", "/dashboard/msme", "/dashboard/payments", "/dashboard/reviews/compliance", "/dashboard/reports"'),
    "Expected visible NRS/FIRS navigation, direct route access fixture, and restricted route denials to stay aligned to the formalisation boundary.",
  );
});

check("NRS workspace bypasses the legacy dashboard shell", () => {
  assert(
    proxyFile.includes('requestHeaders.set("x-dbin-pathname", request.nextUrl.pathname)') &&
      dashboardLayout.includes('headerStore.get("x-dbin-pathname")') &&
      dashboardLayout.includes('pathname.startsWith("/dashboard/nrs") || pathname.startsWith("/dashboard/firs")') &&
      dashboardLayout.includes('pathname.startsWith("/dashboard/boi")') &&
      dashboardLayout.includes('pathname.startsWith("/dashboard/lcdbo")') &&
      dashboardLayout.includes('return <div className="min-h-screen bg-slate-100">{children}</div>') &&
      nrsWorkspaceLayout.includes("<WorkspaceShell") &&
      workspaceShell.includes("z-40 hidden") &&
      workspaceShell.includes("border-r border-slate-200 bg-white text-slate-950 opacity-100") &&
      workspaceShell.includes("border-emerald-200 bg-emerald-50 text-emerald-950") &&
      workspaceShell.includes("mobileNavOpen") &&
      workspaceShell.includes("role=\"dialog\"") &&
      !workspaceShell.includes("opacity-50") &&
      !workspaceShell.includes("opacity-60") &&
      !workspaceShell.includes("opacity-70") &&
      !workspaceShell.includes("backdrop-blur") &&
      !workspaceShell.includes("filter") &&
      !workspaceShell.includes("bg-white/[") &&
      !workspaceShell.includes("border-white/") &&
      !nrsWorkspaceLayout.includes("<Sidebar") &&
      !nrsWorkspaceComponent.includes("NRS Officer Portal") &&
      !nrsWorkspaceComponent.includes("Core Workflows") &&
      !nrsWorkspaceComponent.includes("Operational Modules"),
    "Expected NRS/FIRS routes to bypass the legacy dashboard shell and render only the unified workspace shell.",
  );
});

check("LCDBO uses the institutional workspace shell without broad route-policy ambiguity", () => {
  const { canAccessRoute } = authorizationModule;
  assert(
    lcdboWorkspaceLayout.includes('requireWorkspaceAccess("lcdbo"') &&
      lcdboWorkspaceLayout.includes("<WorkspaceShell") &&
      workspaceRegistry.includes('id: "lcdbo"') &&
      workspaceRegistry.includes("Programme Operations") &&
      workspaceRegistry.includes("Governance & Reporting") &&
      authorization.includes('canAccessWorkspaceRoute({ role }, "lcdbo", path).allowed') &&
      !authorization.includes('routeMatchesPrefix(path, "/dashboard/lcdbo")) legacyAllowed = role !== "boi_executive"') &&
      canAccessRoute("programme_officer", "/dashboard/lcdbo") &&
      canAccessRoute("data_analyst", "/dashboard/lcdbo/intelligence") &&
      !canAccessRoute("msme", "/dashboard/lcdbo") &&
      !canAccessRoute("boi_executive", "/dashboard/lcdbo"),
    "Expected LCDBO to use the shared workspace shell and registry-backed access policy without exposing BOI or MSME roles.",
  );
});

check("LCDBO delivery core registers governed programme-planning routes and access", () => {
  const { canAccessRoute } = authorizationModule;
  const deliveryRoutes = [
    "/dashboard/lcdbo/delivery",
    "/dashboard/lcdbo/workstreams",
    "/dashboard/lcdbo/milestones",
    "/dashboard/lcdbo/raid",
    "/dashboard/lcdbo/decisions",
    "/dashboard/lcdbo/calendar",
  ];
  assert(
    deliveryRoutes.every((route) => workspaceRegistry.includes(route)) &&
      deliveryRoutes.every((route) => canAccessRoute("admin", route)) &&
      deliveryRoutes.every((route) => canAccessRoute("programme_officer", route)) &&
      deliveryRoutes.every((route) => canAccessRoute("data_analyst", route)) &&
      deliveryRoutes.every((route) => canAccessRoute("auditor", route)) &&
      deliveryRoutes.every((route) => !canAccessRoute("msme", route)) &&
      deliveryRoutes.every((route) => !canAccessRoute("boi_executive", route)),
    "Expected LCDBO delivery routes to be registry-driven, visible to authorized LCDBO roles, and denied to MSME/BOI roles.",
  );
});

check("LCDBO delivery core persists governed workstreams, commitments, RAID and decisions", () => {
  assert(
    ["lcdbo_workstreams", "lcdbo_delivery_items", "lcdbo_raid_items", "lcdbo_decisions"].every((table) => lcdboDeliveryMigration.includes(`public.${table}`)) &&
      lcdboDeliveryMigration.includes("enable row level security") &&
      lcdboDeliveryMigration.includes("lcdbo_can_review_programme") &&
      ["not_started", "planned", "in_progress", "at_risk", "blocked", "submitted", "completed", "cancelled"].every((status) => lcdboDeliveryMigration.includes(`'${status}'`)) &&
      lcdboDeliveryMigration.includes("lcdbo_can_view_delivery_programme") &&
      lcdboDeliveryMigration.includes("data_analyst") &&
      lcdboDeliveryMigration.includes("auditor") &&
      lcdboDeliveryMigration.includes("LCDBO-WS-001") &&
      lcdboDeliveryData.includes("requireLcdboDeliveryAccess") &&
      lcdboDeliveryData.includes("MANAGE_ROLES") &&
      lcdboDeliveryData.includes("EXPORT_ROLES") &&
      lcdboDeliveryData.includes("calculateDeliveryMetrics") &&
      lcdboDeliveryData.includes("isLcdboDeliverySchemaUnavailable"),
    "Expected Sprint 1 additive schema, RLS, deterministic seed records, access helpers, and governed progress calculations.",
  );
});

check("LCDBO delivery server actions and exports enforce authorization and auditability", () => {
  assert(
    lcdboDeliveryActions.includes('requireLcdboDeliveryAccess("manage")') &&
      lcdboDeliveryData.includes("lcdbo.delivery.workstream.created") &&
      lcdboDeliveryData.includes("lcdbo.delivery.item.created") &&
      lcdboDeliveryData.includes("lcdbo.delivery.raid.created") &&
      lcdboDeliveryData.includes("lcdbo.delivery.decision.created") &&
      lcdboDeliveryData.includes("lcdbo.delivery.export.generated") &&
      lcdboDeliveryData.includes("/^[=+\\-@]/") &&
      lcdboDeliveryExportRoute.includes('requireLcdboDeliveryAccess("export"'),
    "Expected delivery mutations and exports to enforce server-side permissions, audit events, and CSV formula protection.",
  );
});

check("LCDBO delivery pages use shared institutional workspace primitives", () => {
  assert(
    lcdboDeliveryOverview.includes("WorkspacePageHeader") &&
      lcdboDeliveryOverview.includes("LcdboDeliveryMetricGrid") &&
      lcdboWorkstreamsPage.includes("WorkspaceFilterBar") &&
      lcdboWorkstreamsPage.includes("WorkstreamTable") &&
      lcdboMilestonesPage.includes("DeliveryItemTable") &&
      lcdboRaidPage.includes("RaidTable") &&
      lcdboDecisionsPage.includes("DecisionTable") &&
      lcdboCalendarPage.includes("CalendarAgenda") &&
      [lcdboDeliveryOverview, lcdboWorkstreamsPage, lcdboMilestonesPage, lcdboRaidPage, lcdboDecisionsPage, lcdboCalendarPage].every((source) => source.includes("WorkspaceState")),
    "Expected Sprint 1 pages to reuse shared page, metric, table, filter and state components.",
  );
});

check("NRS formalisation workspace removes private transaction and liability exposure", () => {
  assert(
    nrsWorkspaceLayout.includes("WorkspaceShell") &&
      nrsWorkspacePage.includes("getNrsFormalisationWorkspace") &&
      nrsBusinessProfilePage.includes("getNrsBusinessProfile") &&
      nrsWorkspaceComponent.includes("Privacy-safe Business Registry") &&
      nrsWorkspaceComponent.includes("Partner systems own statutory invoicing") &&
      !nrsWorkspaceData.includes('.from("invoices")') &&
      !nrsWorkspaceData.includes('.from("payments")') &&
      !nrsWorkspaceData.includes("outstanding_amount") &&
      !nrsWorkspaceData.includes("estimated_monthly_obligation") &&
      !nrsWorkspaceData.includes("vat_amount") &&
      !nrsWorkspaceData.includes("total_amount") &&
      !nrsWorkspaceComponent.includes("VAT Exposure") &&
      !nrsWorkspaceComponent.includes("Revenue Opportunity") &&
      !nrsWorkspaceComponent.includes("Outstanding Exposure"),
    "Expected NRS formalisation loaders and pages to avoid invoices, payments, VAT exposure, revenue opportunity and liability fields.",
  );
});

check("NRS national intelligence dataset is seeded and shared across workspace pages", () => {
  assert(
    nrsWorkspaceData.includes("NATIONAL_BUSINESS_TARGET = 24_835") &&
      nrsWorkspaceData.includes('NRS_SNAPSHOT_VERSION = "3.5.1"') &&
      nrsWorkspaceData.includes("STATE_LGAS") &&
      nrsWorkspaceData.includes("Federal Capital Territory") &&
      nrsWorkspaceData.includes("Renewable Energy") &&
      nrsWorkspaceData.includes("createSeededBusinesses") &&
      nrsWorkspaceData.includes("SEEDED_BUSINESSES") &&
      nrsWorkspaceData.includes("deepFreeze") &&
      nrsWorkspaceData.includes("cloneSeededBusinesses") &&
      nrsWorkspaceData.includes("slice(0, NATIONAL_BUSINESS_TARGET)") &&
      nrsWorkspaceData.includes("buildProgrammes") &&
      nrsWorkspaceData.includes("buildReports") &&
      nrsWorkspaceData.includes("buildIntegrations") &&
      nrsWorkspaceData.includes("guideCoverage") &&
      nrsWorkspaceData.includes("activationTrend") &&
      nrsWorkspaceData.includes("verificationTrend") &&
      nrsWorkspaceData.includes("tinLinkageTrend") &&
      nrsWorkspaceComponent.includes("Activation trend") &&
      nrsWorkspaceComponent.includes("Business segmentation") &&
      nrsWorkspaceComponent.includes("Common support gaps") &&
      nrsWorkspaceComponent.includes("Upcoming campaigns") &&
      nrsWorkspaceComponent.includes("Support history") &&
      nrsWorkspaceComponent.includes("Partner referrals"),
    "Expected Sprint 3.5 to provide one shared national formalisation dataset with executive intelligence, programmes, reports, integrations, guides and profiles.",
  );
});

check("NRS workspace pages cannot silently turn session races into empty dashboards", () => {
  const nrsPages = [
    nrsWorkspacePage,
    nrsBusinessesPage,
    nrsReadinessPage,
    nrsIntelligencePage,
    nrsRevenueGuidesPage,
    nrsProgrammesPage,
    nrsReportsPage,
    nrsVerificationPage,
    nrsIntegrationsPage,
    nrsBusinessProfilePage,
  ];
  assert(
    nrsPages.every((page) => page.includes("requireWorkspaceRole([...NRS_ACCESS_ROLES]")) &&
      nrsWorkspaceData.includes("unavailableWorkspace(filters, \"unauthorized\", \"workspace_role_not_allowed\")") &&
      nrsWorkspaceData.includes("snapshot_record_count_mismatch") &&
      nrsWorkspaceData.includes("logNrsSnapshot") &&
      nrsWorkspaceComponent.includes("Intelligence data temporarily unavailable") &&
      nrsWorkspaceComponent.includes("prevents misleading zero dashboards"),
    "Expected every NRS page to use the workspace role guard and the NRS data layer to return explicit unavailable states instead of false empty dashboards.",
  );
});

check("NRS dedicated host resolves to the formalisation landing and workspace", () => {
  const { resolveDbinHostSurface, resolveDbinRewritePath } = dbinHostsModule;
  assert(
    resolveDbinHostSurface("nrs.dbin.ng") === "nrs" &&
      resolveDbinHostSurface("nrs.localhost:3000") === "nrs" &&
      resolveDbinRewritePath("nrs", "/") === "/nrs" &&
      resolveDbinRewritePath("nrs", "/nrs") === null &&
      resolveDbinRewritePath("nrs", "/dashboard/nrs") === null &&
      resolveDbinRewritePath("nrs", "/login") === null &&
      resolveDbinRewritePath("nrs", "/logout") === null &&
      resolveDbinRewritePath("nrs", "/") !== "/boi",
    "Expected nrs.dbin.ng to resolve to the NRS public entry while keeping auth and workspace paths host-relative.",
  );
});

check("EKIRS dedicated host resolves to the state revenue landing and workspace", () => {
  const { resolveDbinHostSurface, resolveDbinRewritePath } = dbinHostsModule;
  assert(
    resolveDbinHostSurface("ekirs.dbin.ng") === "ekirs" &&
      resolveDbinHostSurface("ekirs.localhost:3000") === "ekirs" &&
      resolveDbinRewritePath("ekirs", "/") === "/ekirs" &&
      resolveDbinRewritePath("ekirs", "/ekirs") === null &&
      resolveDbinRewritePath("ekirs", "/dashboard/ekirs") === null &&
      resolveDbinRewritePath("ekirs", "/login") === null &&
      resolveDbinRewritePath("ekirs", "/") !== "/nrs" &&
      resolveDbinRewritePath("ekirs", "/") !== "/boi",
    "Expected ekirs.dbin.ng to resolve to the EKIRS public entry while keeping auth and workspace paths host-relative.",
  );
});

check("LCDBO dedicated host resolves to canonical programme URLs and workspace routes", () => {
  const {
    LCDBO_CANONICAL_ORIGIN,
    resolveDbinCanonicalRedirectUrl,
    resolveDbinHostSurface,
    resolveDbinRewritePath,
  } = dbinHostsModule;
  assert(
    LCDBO_CANONICAL_ORIGIN === "https://lcdbo.dbin.ng" &&
      resolveDbinHostSurface("lcdbo.dbin.ng") === "lcdbo" &&
      resolveDbinHostSurface("lcdbo.com") === "lcdbo" &&
      resolveDbinHostSurface("www.lcdbo.com") === "lcdbo" &&
      resolveDbinHostSurface("lcdbo.localhost:3000") === "lcdbo" &&
      resolveDbinRewritePath("lcdbo", "/") === "/lcdbo" &&
      resolveDbinRewritePath("lcdbo", "/clusters") === "/lcdbo/clusters" &&
      resolveDbinRewritePath("lcdbo", "/dashboard/lcdbo") === null &&
      resolveDbinRewritePath("lcdbo", "/api/lcdbo/delivery/export/workstreams") === null &&
      resolveDbinRewritePath("lcdbo", "/reports") === null &&
      resolveDbinCanonicalRedirectUrl("marketing", new URL("https://dbin.ng/lcdbo/about"))?.toString() === "https://www.dbin.ng/lcdbo/about" &&
      resolveDbinCanonicalRedirectUrl("marketing", new URL("https://www.dbin.ng/lcdbo/about"))?.toString() === "https://lcdbo.dbin.ng/about" &&
      resolveDbinCanonicalRedirectUrl("lcdbo", new URL("https://lcdbo.dbin.ng/lcdbo/about"))?.toString() === "https://lcdbo.dbin.ng/about" &&
      resolveDbinCanonicalRedirectUrl("lcdbo", new URL("https://lcdbo.dbin.ng/dashboard"))?.toString() === "https://lcdbo.dbin.ng/dashboard/lcdbo",
    "Expected lcdbo.dbin.ng to present canonical clean programme URLs while preserving authenticated LCDBO workspace and API routes.",
  );
});

check("EKIRS Sprint 0 is scoped, synthetic and revenue-safe", () => {
  assert(
    workspaceTypes.includes('| "ekirs"') &&
      workspaceRegistry.includes('id: "ekirs"') &&
      workspaceRegistry.includes('institutionSlug: "ekiti-state-internal-revenue-service"') &&
      workspaceRegistry.includes('scopeType: "institution"') &&
      workspaceRegistry.includes('allowedRoles: ["admin", "super_admin"]') &&
      workspaceAccessServer.includes('.from("institutions")') &&
      ekirsLanding.includes("Ekiti Business Formalisation and Revenue Readiness Platform") &&
      ekirsLanding.includes('/login?workspace=ekirs') &&
      ekirsWorkspaceLayout.includes('requireStateRevenueWorkspaceAccess("ekiti", "/dashboard/ekirs")') &&
      ekirsWorkspacePage.includes("No collection, liability, payment or assessment values") &&
      ekirsJurisdiction.includes('binPrefix: "BIN-EK"') &&
      ekirsJurisdiction.includes("configuredCount: 22") &&
      ekirsDemoData.includes("createStateRevenueSyntheticBusinesses(EKIRS_JURISDICTION)") &&
      stateRevenueSyntheticData.includes('"synthetic_demo"') &&
      ekirsMigration.includes("state_revenue_service_workspace") &&
      !ekirsDemoData.includes("collectionAmount") &&
      !ekirsDemoData.includes("liabilityAmount") &&
      !stateRevenueSyntheticData.includes("collectionAmount") &&
      !stateRevenueSyntheticData.includes("liabilityAmount") &&
      !ekirsMigration.includes("auth.users") &&
      !ekirsMigration.includes("password"),
    "Expected EKIRS Sprint 0 to use institution-scoped access, deterministic synthetic data and no live revenue or user-provisioning artifacts.",
  );
});

check("NRS public landing is institutional, public and metadata-ready", () => {
  assert(
    authorization.includes('path === "/nrs"') &&
      nrsPublicLanding.includes('title: "Nigeria Revenue Service Business Formalisation Platform | DBIN"') &&
      nrsPublicLanding.includes('canonical: "https://nrs.dbin.ng/"') &&
      nrsPublicLanding.includes("Nigeria Revenue Service") &&
      nrsPublicLanding.includes("Business Formalisation Platform") &&
      nrsPublicLanding.includes("Powered by DBIN") &&
      nrsPublicLanding.includes("Formalising businesses. Expanding participation. Building a stronger economy.") &&
      nrsPublicLanding.includes('/login?workspace=nrs&next=/dashboard/nrs') &&
      nrsPublicLanding.includes("Access Authorized Portal") &&
      nrsPublicLanding.includes("No private revenue surveillance") &&
      nrsPublicLanding.includes("How DBIN fits into the revenue ecosystem.") &&
      nrsPublicLanding.includes("DBIN prepares and connects businesses.") &&
      nrsPublicLanding.includes("Private invoices") &&
      nrsPublicLanding.includes("Formalisation without financial surveillance.") &&
      nrsPublicLanding.includes("Revenue Guides support businesses through discovery") &&
      !nrsPublicLanding.includes("Marketplace") &&
      !nrsPublicLanding.includes("Try demo") &&
      !nrsPublicLanding.includes("Pilot") &&
      !nrsPublicLanding.includes("Placeholder") &&
      !nrsPublicLanding.includes("Invoice Monitoring") &&
      !nrsPublicLanding.includes("VAT Exposure") &&
      !nrsPublicLanding.includes("Revenue Opportunity"),
    "Expected /nrs to be a public, SEO-ready, NRS-owned formalisation landing page without generic navigation or retired transaction positioning.",
  );
});

check("NRS sign-in, denied and logout flows preserve workspace context safely", () => {
  assert(
      loginPage.includes('searchParams.get("workspace")') &&
      loginPage.includes('searchParams.get("next")') &&
      loginPage.includes("sessionDebug?.targetRoute") &&
      authSessionRoute.includes("resolveLoginDestination") &&
      authSessionRoute.includes("targetRoute: destination.targetRoute") &&
      loginDestination.includes('input.requestedWorkspace === "nrs"') &&
      loginDestination.includes('"/dashboard/nrs"') &&
      loginDestination.includes('/access-denied?workspace=nrs') &&
      dashboardLayout.includes('/login?workspace=nrs&next=') &&
      workspaceGuards.includes('"/access-denied?workspace=nrs"') &&
      accessDeniedPage.includes("This account does not have access to the NRS workspace.") &&
      logoutRoute.includes('surface === "nrs" ? "/" : "/login"') &&
      !loginPage.includes("http://") &&
      !loginPage.includes("https://www.dbin.ng"),
    "Expected NRS login to preserve a sanitized workspace destination, denied access to render a polished NRS state, and logout to return to the NRS host root.",
  );
});

check("legacy NRS transaction pages redirect into safe formalisation surfaces", () => {
  assert(
    nrsLegacyInvoicesPage.includes('redirect("/dashboard/nrs/integrations?legacy=invoices")') &&
      nrsLegacyInvoiceRegistryPage.includes('redirect("/dashboard/nrs/integrations?legacy=invoice-registry")') &&
      nrsLegacyVatMonitorPage.includes('redirect("/dashboard/nrs/readiness?legacy=vat-monitor")') &&
      nrsLegacyRevenuePage.includes('redirect("/dashboard/nrs/intelligence?legacy=revenue")') &&
      authProfile.includes('"officer@firs.gov.ng": "firs_officer"'),
    "Expected retired NRS transaction routes to redirect safely and legacy FIRS account role inference to remain configured.",
  );
});

check("data analyst page guards cover approved intelligence views", () => {
  assert(
    analyticsRoute.includes('"data_analyst"') &&
      executiveRoute.includes('"data_analyst"') &&
      intelligenceRoute.includes('"data_analyst"') &&
      intelligenceDetailRoute.includes('"data_analyst"') &&
      riskFlagsRoute.includes('"data_analyst"'),
    "Expected data_analyst in analytics, executive, intelligence, intelligence detail, and risk flag page guards.",
  );
});

check("canonical Impact permission registry covers core role decisions", () => {
  assert(
    impactPermissions.includes('export function canRole(') &&
      impactPermissions.includes('export function getRolePermissions(') &&
      impactPermissions.includes('export function getRoutePolicy(') &&
      impactPermissions.includes('export function canAccessRoute(') &&
      impactPermissions.includes('export function roleHasAny(') &&
      impactPermissions.includes("programme_officer: [") &&
      impactPermissions.includes("assessment_officer: [") &&
      impactPermissions.includes("field_officer: [") &&
      impactPermissions.includes("data_analyst: [") &&
      impactPermissions.includes("boi_executive: [") &&
      impactPermissions.includes("auditor: ["),
    "Expected a central permission registry with role, route, and any-check helpers.",
  );
});

check("canonical Impact route access is authoritative with policy drift diagnostics", () => {
  assert(
    authorization.includes("legacyAllowed") &&
      authorization.includes("logImpactPolicyDrift") &&
      authorization.includes("return canonicalAllowed") &&
      impactRouteGuards.includes("canAccessRoute(ctx.role, pathname)"),
    "Expected canonical Impact route decisions with legacy drift diagnostics.",
  );
});

check("field officer cannot read Risk Flags or Intelligence", () => {
  const { canAccessRoute, canRole } = impactPermissionsModule;
  assert(
    !canRole("field_officer", "risk_flag", "read") &&
      !canRole("field_officer", "risk_flag", "create") &&
      !canRole("field_officer", "risk_flag", "update") &&
      !canRole("field_officer", "intelligence", "read") &&
      !canAccessRoute("field_officer", "/dashboard/impact-intelligence/risk-flags") &&
      !canAccessRoute("field_officer", "/dashboard/impact-intelligence/intelligence"),
    "Expected canonical policy to deny Field Officer Risk Flags and Intelligence access.",
  );
});

check("field officer Risk Flags links are absent from sidebar and launcher", () => {
  const fieldOfficerNavigation = compact(authorization).match(
    /field_officer: \[(.*?)\], data_analyst:/,
  )?.[1] ?? "";
  const riskFlagLauncher = compact(impactLauncher).match(
    /href: "\/dashboard\/impact-intelligence\/risk-flags",(.*?)priority: 3,/,
  )?.[1] ?? "";
  assert(
    !fieldOfficerNavigation.includes("/dashboard/impact-intelligence/risk-flags") &&
      !fieldOfficerNavigation.includes("/dashboard/impact-intelligence/intelligence") &&
      !fieldOfficerNavigation.includes("Risk Flags") &&
      !riskFlagLauncher.includes('"field_officer"'),
    "Expected Field Officer sidebar and launcher configuration to exclude Risk Flags and Intelligence.",
  );
});

check("field officer Risk Flags direct route is guarded and explicitly denied", () => {
  const fixture = compact(impactRouteFixture);
  const fieldOfficerFixture = fixture.match(/field_officer: \{(.*?)\}, data_analyst:/)?.[1] ?? "";
  assert(
    riskFlagsLayout.includes('requireImpactRoute("/dashboard/impact-intelligence/risk-flags")') &&
      !riskFlagsRoute.match(/const INTELLIGENCE_ROLES = \[[^\]]*"field_officer"/) &&
      fieldOfficerFixture.includes('denied: [') &&
      fieldOfficerFixture.includes('"/dashboard/impact-intelligence/risk-flags"') &&
      fieldOfficerFixture.includes('"/dashboard/impact-intelligence/intelligence"') &&
      !fieldOfficerFixture.match(/allowed: \[[^\]]*"\/dashboard\/impact-intelligence\/risk-flags"/),
    "Expected guarded direct navigation and explicit Field Officer route denials.",
  );
});

check("approved roles retain Risk Flags access", () => {
  const { canAccessRoute, canRole } = impactPermissionsModule;
  const retainedRoles = ["assessment_officer", "data_analyst", "auditor", "admin", "super_admin"];
  assert(
    retainedRoles.every(
      (role) =>
        canRole(role, "risk_flag", "read") &&
        canAccessRoute(role, "/dashboard/impact-intelligence/risk-flags"),
    ) &&
      riskFlagsRoute.includes('"assessment_officer"') &&
      riskFlagsRoute.includes('"data_analyst"') &&
      riskFlagsRoute.includes('"auditor"') &&
      riskFlagsRoute.includes('"admin"') &&
      riskFlagsRoute.includes('"super_admin"'),
    "Expected approved Risk Flags roles to retain access.",
  );
});

check("intelligence services enforce canonical read permission", () => {
  const intelligenceReadGuards =
    impactDataService.match(/requireRolePermission\(ctx\.role, "intelligence", "read"/g) ?? [];
  assert(
    intelligenceReadGuards.length >= 2,
    "Expected Intelligence reads to fail closed before loading embedded Risk Flags.",
  );
});

check("programme officer canonical permissions are read-only for assessments, evidence, and indicators", () => {
  const programmeOfficerReadResources = compact(impactPermissions).match(
    /const PROGRAMME_OFFICER_READ_RESOURCES: ImpactResource\[\] = \[(.*?)\];/,
  )?.[1] ?? "";
  const programmeOfficerPermissions = compact(impactPermissions).match(
    /programme_officer: \[(.*?)\], assessment_officer:/,
  )?.[1] ?? "";
  assert(
    programmeOfficerReadResources.includes('"assessment"') &&
      programmeOfficerReadResources.includes('"evidence"') &&
      programmeOfficerReadResources.includes('"indicator"') &&
      !programmeOfficerReadResources.includes('"assessment_template"') &&
      !programmeOfficerReadResources.includes('"analytics"') &&
      !programmeOfficerReadResources.includes('"executive_dashboard"') &&
      !programmeOfficerReadResources.includes('"intelligence"') &&
      !programmeOfficerReadResources.includes('"risk_flag"') &&
      programmeOfficerPermissions.includes("PROGRAMME_OFFICER_READ_RESOURCES") &&
      !programmeOfficerPermissions.includes('permissions("assessment"') &&
      !programmeOfficerPermissions.includes('permissions("assessment_template"') &&
      !programmeOfficerPermissions.includes('permissions("evidence"') &&
      !programmeOfficerPermissions.includes('permissions("indicator"') &&
      !programmeOfficerPermissions.includes('permissions("intelligence"') &&
      !programmeOfficerPermissions.includes('permissions("risk_flag"'),
    "Expected Programme Officer to have no assessment, evidence, indicator, intelligence, or risk mutation grants.",
  );
});

check("programme officer canonical permission decisions execute as expected", () => {
  const { canAccessRoute, canRole } = impactPermissionsModule;
  assert(
    canRole("programme_officer", "programme", "create") &&
      canRole("programme_officer", "monitoring_visit", "assign") &&
      canRole("programme_officer", "report", "submit") &&
      canRole("programme_officer", "assessment", "read") &&
      canRole("programme_officer", "evidence", "read") &&
      canRole("programme_officer", "indicator", "read") &&
      !canRole("programme_officer", "assessment", "create") &&
      !canRole("programme_officer", "assessment_template", "read") &&
      !canRole("programme_officer", "evidence", "create") &&
      !canRole("programme_officer", "evidence", "submit") &&
      !canRole("programme_officer", "indicator", "create") &&
      !canRole("programme_officer", "indicator", "submit") &&
      !canRole("programme_officer", "executive_dashboard", "read") &&
      !canRole("programme_officer", "intelligence", "read") &&
      !canRole("programme_officer", "risk_flag", "read") &&
      canAccessRoute("programme_officer", "/dashboard/impact-intelligence/assessments") &&
      canAccessRoute("programme_officer", "/dashboard/impact-intelligence/evidence") &&
      canAccessRoute("programme_officer", "/dashboard/impact-intelligence/indicators") &&
      !canAccessRoute("programme_officer", "/dashboard/impact-intelligence/assessments/templates") &&
      !canAccessRoute("programme_officer", "/dashboard/impact-intelligence/executive") &&
      !canAccessRoute("programme_officer", "/dashboard/impact-intelligence/intelligence") &&
      !canAccessRoute("programme_officer", "/dashboard/impact-intelligence/risk-flags"),
    "Expected executable Programme Officer permission and route decisions to match Phase 3B policy.",
  );
});

check("programme officer hidden Impact routes are explicitly denied", () => {
  const fixture = compact(impactRouteFixture);
  assert(
    fixture.includes('programme_officer: { allowed: ["/dashboard/impact-intelligence"') &&
      fixture.includes('"/dashboard/impact-intelligence/assessments/templates"') &&
      fixture.includes('"/dashboard/impact-intelligence/executive"') &&
      fixture.includes('"/dashboard/impact-intelligence/intelligence"') &&
      fixture.includes('"/dashboard/impact-intelligence/risk-flags"'),
    "Expected explicit Programme Officer route denials for templates, executive, intelligence, and risk flags.",
  );
});

check("programme officer write actions use canonical permission checks", () => {
  assert(
    impactAssessmentService.includes('requireRolePermission(ctx.role, "assessment_template", "create"') &&
      impactAssessmentService.includes('requireRolePermission(ctx.role, "assessment", "create"') &&
      impactAssessmentService.includes('requireRolePermission(ctx.role, "assessment", "submit"') &&
      impactEvidenceService.includes('requireRolePermission(ctx.role, "evidence", "create"') &&
      impactEvidenceService.includes('requireRolePermission(ctx.role, "evidence", permissionAction') &&
      impactIndicatorService.includes('requireRolePermission(ctx.role, "indicator", "create"') &&
      impactIndicatorService.includes('requireRolePermission(ctx.role, "indicator", permissionAction'),
    "Expected canonical service-layer guards for assessment, evidence, and indicator mutations.",
  );
});

check("programme officer write controls render from canonical permissions", () => {
  assert(
    impactAssessmentPage.includes('canRole(ctx.role, "assessment", "create")') &&
      impactEvidencePage.includes('canRole(ctx.role, "evidence", "create")') &&
      impactIndicatorPage.includes('canRole(ctx.role, "indicator", "create")') &&
      impactIndicatorPage.includes('canRole(ctx.role, "indicator", "submit")'),
    "Expected assessment, evidence, and indicator controls to use canonical permissions.",
  );
});

check("programme assignment table is constrained and denies direct client access", () => {
  assert(
    impactRbacMigration.includes("create table if not exists public.impact_user_programme_assignments") &&
      impactRbacMigration.includes("impact_user_programme_assignments_status_check") &&
      impactRbacMigration.includes("impact_user_programme_assignments_role_check") &&
      impactRbacMigration.includes("idx_impact_user_programme_assignments_unique_active") &&
      impactRbacMigration.includes("enable row level security") &&
      impactRbacMigration.includes("revoke all on public.impact_user_programme_assignments from anon, authenticated"),
    "Expected temporal programme assignments, active uniqueness, RLS, and revoked anonymous/authenticated access.",
  );
});

check("scope resolver supports privileged and assigned programme decisions", () => {
  assert(
    impactAccessScope.includes('ctx.role === "super_admin"') &&
      impactAccessScope.includes('ctx.role === "admin"') &&
      impactAccessScope.includes('mode: "assigned"') &&
      impactAccessScope.includes("scope.programmeIds.includes(programmeId)") &&
      impactAccessScope.includes('mode: "legacy_fallback"') &&
      impactAccessScope.includes('"no_active_assignment"') &&
      impactAccessScope.includes('"programme_not_assigned"') &&
      impactAccessScope.includes("[impact-access-scope]"),
    "Expected admin/super-admin access, assigned programme checks, mutation fallback, hard read denial reasons, and safe diagnostics.",
  );
});

check("programme assignment scope supports Phase 2 read and write decisions", () => {
  assert(
    impactAccessScope.includes("getProgrammeScopeFilter") &&
      impactAccessScope.includes("applyProgrammeScope") &&
      impactAccessScope.includes("canReadProgrammeResource") &&
      impactAccessScope.includes("canWriteProgrammeResource") &&
      impactAccessScope.includes("explainScopeDecision") &&
      impactAccessScope.includes('scope.mode === "assigned" && scope.programmeIds.includes(programmeId)') &&
      impactAccessScope.includes('scope.mode === "delegated_field_scope"') &&
      impactAccessScope.includes('action === "write" && scope.readOnly'),
    "Expected assigned-programme decisions, admin/read-only handling, and no broad field-officer programme scope.",
  );
});

check("programme assignment reads are hard enforced while mutations remain shadow compatible", () => {
  assert(
      impactAccessScope.includes("enforceProgrammeReadAccess") &&
      impactAccessScope.includes("ImpactProgrammeReadDeniedError") &&
      impactAccessScope.includes("[impact-rbac]") &&
      impactAccessScope.includes('decision: explanation.allowed ? "allow" : "deny"') &&
      impactAccessScope.includes("[impact-rbac-shadow]") &&
      impactAccessScope.includes('"would_deny"') &&
      impactAccessScope.includes('"would_allow"') &&
      impactAccessScope.includes("legacyFallbackUsed") &&
      impactAccessScope.includes("assignmentCount") &&
      impactAccessScope.includes("appUserId") &&
      impactEvidenceService.includes("logProgrammeScopeShadowDecision") &&
      impactIndicatorService.includes("logProgrammeScopeShadowDecision") &&
      impactReportService.includes("logProgrammeScopeShadowDecision"),
    "Expected hard read decisions plus shadow write comparison logs across core services.",
  );
});

check("programme-scoped detail reads deny before loading descendants", () => {
  assert(
    impactDataService.includes('enforceProgrammeReadAccess({ ctx, programmeId: id, resource: "programme" })') &&
      impactDataService.includes('enforceProgrammeReadAccess({ ctx, programmeId: cohort.programme_id, resource: "cohort" })') &&
      impactDataService.includes('resource: "intervention"') &&
      impactDataService.includes('resource: "assessment"') &&
      impactDataService.includes('resource: "monitoring"') &&
      impactEvidenceService.includes('resource: "evidence"') &&
      impactIndicatorService.includes('resource: "indicator_definition"') &&
      impactReportService.includes('resource: "report"'),
    "Expected programme, cohort, intervention, assessment, monitoring, evidence, indicator, and report detail enforcement.",
  );
});

check("hard read enforcement preserves role-specific access modes", () => {
  assert(
    impactAccessScope.includes('reason: "administrative_access"') &&
      impactAccessScope.includes('reason: "global_read_access"') &&
      impactAccessScope.includes('reason = "read_only_role"') &&
      impactAccessScope.includes('reason = "unsupported_scope"') &&
      impactDataService.includes('if (ctx?.role === "field_officer") return []') &&
      impactDataService.includes("getFieldOfficerPortfolioScope") &&
      impactDataService.includes('query = query.eq("status", "approved")') &&
      impactEvidenceService.includes('query.eq("status", "verified").eq("verification_status", "verified")'),
    "Expected admin/global access reasons, read-only decisions, approved-data filters, and no broad field-officer programme scope.",
  );
});

check("unassigned users receive explicit empty and detail denial states", () => {
  assert(
    impactAccessScope.includes("No programmes have been assigned to your account yet.") &&
      impactAccessScope.includes("You are not assigned to this programme.") &&
      impactAccessScope.includes("getProgrammeScopeEmptyMessage"),
    "Expected clear no-assignment and unassigned-programme UI messages.",
  );
});

check("approved-data roles remain read only and receive approved sources", () => {
  assert(
    impactAccessScope.includes('mode: "approved_data"') &&
      impactAccessScope.includes("readOnly: true") &&
      impactEvidenceService.includes('ctx.role === "data_analyst"') &&
      impactEvidenceService.includes('query.eq("status", "verified")') &&
      impactIndicatorService.includes('ctx.role === "data_analyst"') &&
      impactReportService.includes('ctx.role === "data_analyst"') &&
      impactReportService.includes('query.eq("status", "approved")'),
    "Expected data analysts to retain read-only approved-data scope.",
  );
});

check("programme assignment backfill is dry-run and idempotent", () => {
  assert(
    impactAssignmentBackfill.includes('process.argv.includes("--apply")') &&
      impactAssignmentBackfill.includes("DRY RUN") &&
      impactAssignmentBackfill.includes("existing.has(key)") &&
      impactAssignmentBackfill.includes('"--user-email"') &&
      impactAssignmentBackfill.includes('"--programme-code"') &&
      impactAssignmentBackfill.includes('"--role"') &&
      impactAssignmentBackfill.includes("Provide both --user-email and --programme-code"),
    "Expected an explicit --apply gate, duplicate avoidance, and explicitly targeted assignment filters.",
  );
});

let failures = 0;

for (const { name, fn } of checks) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(`  ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} DBIN smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} DBIN smoke checks passed.`);
