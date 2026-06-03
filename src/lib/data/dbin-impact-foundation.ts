import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAdminDigitalIdQueue } from "@/lib/data/admin-digital-ids";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
type Query = any;

export type DbinImpactMetric = {
  label: string;
  value: number | null;
  suffix?: string;
  definition: string;
  source: string;
  available: boolean;
  error?: string | null;
};

export type DbinImpactSourceHealth = {
  table: string;
  available: boolean;
  count: number | null;
  lastUpdated: string | null;
  error: string | null;
};

export type DbinImpactDistribution = {
  label: string;
  value: number;
};

export type DbinImpactSection = {
  title: string;
  description: string;
  metrics: DbinImpactMetric[];
  sources: DbinImpactSourceHealth[];
  distributions?: Array<{ title: string; values: DbinImpactDistribution[] }>;
  warnings?: string[];
  notYetWired?: string[];
};

export type DbinImpactFoundation = {
  generatedAt: string;
  operational: DbinImpactSection;
  associations: DbinImpactSection;
  verificationCompliance: DbinImpactSection;
  programmeMonitoring: DbinImpactSection;
};

type SourceConfig = {
  table: string;
  columns: string;
  freshnessColumn?: string;
};

type LoadedSource = {
  rows: Row[] | null;
  health: DbinImpactSourceHealth;
};

const READ_PAGE_SIZE = 1000;

function logSourceFailure(table: string, operation: string, error: { message?: string | null; code?: string | null } | null) {
  if (!error) return;
  console.warn("[dbin-impact-foundation]", {
    table,
    operation,
    errorCode: error.code ?? null,
    errorMessage: error.message ?? "Source unavailable",
  });
}

async function readAllRows(supabase: SupabaseClient<any>, table: string, columns: string) {
  const rows: Row[] = [];
  for (let from = 0; ; from += READ_PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + READ_PAGE_SIZE - 1);
    if (error) return { rows: null, error };
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < READ_PAGE_SIZE) return { rows, error: null };
  }
}

async function loadSource(supabase: SupabaseClient<any>, config: SourceConfig): Promise<LoadedSource> {
  const [countResult, rowResult, latestResult] = await Promise.all([
    supabase.from(config.table).select("*", { count: "exact", head: true }),
    readAllRows(supabase, config.table, config.columns),
    config.freshnessColumn
      ? supabase.from(config.table).select(config.freshnessColumn).order(config.freshnessColumn, { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const error = countResult.error ?? rowResult.error ?? latestResult.error;
  logSourceFailure(config.table, "source_read", error);
  return {
    rows: error ? null : rowResult.rows,
    health: {
      table: config.table,
      available: !error,
      count: error ? null : countResult.count ?? 0,
      lastUpdated: error || !config.freshnessColumn ? null : String((latestResult.data as Row | null)?.[config.freshnessColumn] ?? "") || null,
      error: error?.message ?? null,
    },
  };
}

async function exactCount(supabase: SupabaseClient<any>, table: string, apply?: (query: Query) => Query) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  logSourceFailure(table, "exact_count", error);
  return { value: error ? null : count ?? 0, error: error?.message ?? null };
}

function metric(label: string, count: { value: number | null; error: string | null }, definition: string, source: string, suffix?: string): DbinImpactMetric {
  return { label, value: count.value, suffix, definition, source, available: count.value !== null, error: count.error };
}

function computedMetric(label: string, value: number | null, definition: string, source: string, suffix?: string): DbinImpactMetric {
  return { label, value, suffix, definition, source, available: value !== null };
}

function sumRows(rows: Row[] | null, fields: string[]) {
  if (!rows) return null;
  return rows.reduce((total, row) => total + Math.max(...fields.map((field) => Number(row[field] ?? 0)), 0), 0);
}

function bucket(rows: Row[] | null, field: string) {
  if (!rows) return [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[field] ?? "").trim() || "Unspecified";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function sourceList(sourceMap: Map<string, LoadedSource>, tables: string[]) {
  return tables.map((table) => sourceMap.get(table)?.health ?? { table, available: false, count: null, lastUpdated: null, error: "Source was not loaded." });
}

export async function getDbinImpactFoundation(): Promise<DbinImpactFoundation> {
  const supabase = await createServiceRoleSupabaseClient();
  const configs: SourceConfig[] = [
    { table: "msmes", columns: "id,business_name,owner_name,contact_phone,contact_email,address,sector,state,lga,business_type,cac_number,tin,passport_photo_path,passport_photo_url,verification_status,review_status,association_id,source,source_association_member_id,created_at", freshnessColumn: "created_at" },
    { table: "users", columns: "id,role,created_at", freshnessColumn: "created_at" },
    { table: "activity_logs", columns: "id,action,created_at", freshnessColumn: "created_at" },
    { table: "msme_banking_profiles", columns: "id,msme_id,bank_name,account_name,account_number_masked,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "associations", columns: "id,status,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "association_members", columns: "id,member_status,activation_state,access_status,duplicate_signal,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "association_member_imports", columns: "id,total_rows,valid_rows,invalid_rows,success_rows,failed_rows,duplicate_rows,created_at", freshnessColumn: "created_at" },
    { table: "association_member_import_rows", columns: "id,duplicate_signal,created_at", freshnessColumn: "created_at" },
    { table: "association_member_invitations", columns: "id,status,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "association_member_access_credentials", columns: "id,status,first_login_completed_at,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "digital_identity_credentials", columns: "id,status,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "credential_events", columns: "id,action,created_at", freshnessColumn: "created_at" },
    { table: "verification_reviews", columns: "id,status,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "validation_results", columns: "msme_id,cac_status,tin_status,validated_at,updated_at", freshnessColumn: "updated_at" },
    { table: "msme_compliance_profiles", columns: "msme_id,overall_status,updated_at", freshnessColumn: "updated_at" },
    { table: "msme_compliance_items", columns: "id,status,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "compliance_documents", columns: "id,is_deleted,uploaded_at,updated_at", freshnessColumn: "updated_at" },
    { table: "complaints", columns: "id,status,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "impact_programmes", columns: "id,status,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "impact_interventions", columns: "id,status,created_at,updated_at", freshnessColumn: "updated_at" },
    { table: "impact_assessments", columns: "id,status,created_at", freshnessColumn: "created_at" },
    { table: "impact_field_visits", columns: "id,status,created_at", freshnessColumn: "created_at" },
    { table: "impact_evidence_files", columns: "id,verification_status,storage_path,created_at", freshnessColumn: "created_at" },
    { table: "impact_reports", columns: "id,status,created_at", freshnessColumn: "created_at" },
  ];
  const loaded = await Promise.all(configs.map((config) => loadSource(supabase, config)));
  const sourceMap = new Map(configs.map((config, index) => [config.table, loaded[index]]));
  const msmes = sourceMap.get("msmes")?.rows ?? null;
  const bankingRows = sourceMap.get("msme_banking_profiles")?.rows ?? null;
  const bankingMsmes = bankingRows ? new Set(bankingRows.map((row) => String(row.msme_id ?? "")).filter(Boolean)) : null;
  const profileScores = msmes && bankingMsmes
    ? msmes.map((row) => calculateProfileCompletion({
        businessName: String(row.business_name ?? ""),
        ownerName: String(row.owner_name ?? ""),
        phone: String(row.contact_phone ?? ""),
        email: String(row.contact_email ?? ""),
        businessAddress: String(row.address ?? ""),
        tradeSector: String(row.sector ?? ""),
        cacNumber: String(row.cac_number ?? ""),
        tin: String(row.tin ?? ""),
        passportPhoto: String(row.passport_photo_path ?? row.passport_photo_url ?? ""),
        bankDetailsPresent: bankingMsmes.has(String(row.id ?? "")),
      }).percentage)
    : null;
  const profileAverage = profileScores?.length ? Math.round(profileScores.reduce((sum, value) => sum + value, 0) / profileScores.length) : profileScores ? 0 : null;
  const incompleteProfiles = profileScores ? profileScores.filter((score) => score < 100).length : null;
  const importRows = sourceMap.get("association_member_imports")?.rows ?? null;
  const digitalQueue = await loadAdminDigitalIdQueue(supabase, {});

  const [
    totalMsmes, associationSourcedMsmes, associationFastTrackMsmes, draftMsmes, pendingReviewMsmes, verifiedMsmes, dashboardReached,
    totalAssociations, totalMembers, membersPendingReview, membersApproved, membersPendingActivation, membersActivated, accountCreated, onboardingCompleted,
    uploadedMemberRows, accessGenerated, firstLoginCompleted, invitationCount, acceptedInvitations,
    credentialsCreated, activeCredentials, pendingCredentials, suspendedCredentials, revokedCredentials, expiredCredentials,
    verificationReviews, validationResults, complianceProfiles, complianceItems, complianceDocuments, openComplaints, resolvedComplaints,
    programmes, interventions, assessments, fieldVisits, evidenceFiles, reports,
  ] = await Promise.all([
    exactCount(supabase, "msmes"),
    exactCount(supabase, "msmes", (q) => q.or("source.eq.association_fast_track,source_association_member_id.not.is.null")),
    exactCount(supabase, "msmes", (q) => q.eq("source", "association_fast_track")),
    exactCount(supabase, "msmes", (q) => q.eq("review_status", "draft")),
    exactCount(supabase, "msmes", (q) => q.eq("review_status", "pending_review")),
    exactCount(supabase, "msmes", (q) => q.eq("verification_status", "verified")),
    exactCount(supabase, "activity_logs", (q) => q.eq("action", "msme_dashboard_reached")),
    exactCount(supabase, "associations"),
    exactCount(supabase, "association_members"),
    exactCount(supabase, "association_members", (q) => q.eq("member_status", "pending_review")),
    exactCount(supabase, "association_members", (q) => q.eq("member_status", "approved")),
    exactCount(supabase, "association_members", (q) => q.eq("member_status", "pending_activation")),
    exactCount(supabase, "association_members", (q) => q.eq("member_status", "active")),
    exactCount(supabase, "association_members", (q) => q.eq("activation_state", "account_created")),
    exactCount(supabase, "association_members", (q) => q.eq("activation_state", "onboarding_completed")),
    exactCount(supabase, "association_member_import_rows"),
    exactCount(supabase, "association_member_access_credentials"),
    exactCount(supabase, "association_member_access_credentials", (q) => q.not("first_login_completed_at", "is", null)),
    exactCount(supabase, "association_member_invitations"),
    exactCount(supabase, "association_member_invitations", (q) => q.eq("status", "accepted")),
    exactCount(supabase, "digital_identity_credentials"),
    exactCount(supabase, "digital_identity_credentials", (q) => q.eq("status", "active")),
    exactCount(supabase, "digital_identity_credentials", (q) => q.eq("status", "pending")),
    exactCount(supabase, "digital_identity_credentials", (q) => q.eq("status", "suspended")),
    exactCount(supabase, "digital_identity_credentials", (q) => q.eq("status", "revoked")),
    exactCount(supabase, "digital_identity_credentials", (q) => q.eq("status", "expired")),
    exactCount(supabase, "verification_reviews"),
    exactCount(supabase, "validation_results"),
    exactCount(supabase, "msme_compliance_profiles"),
    exactCount(supabase, "msme_compliance_items"),
    exactCount(supabase, "compliance_documents", (q) => q.eq("is_deleted", false)),
    exactCount(supabase, "complaints", (q) => q.not("status", "in", '("resolved","closed","dismissed")')),
    exactCount(supabase, "complaints", (q) => q.in("status", ["resolved", "closed", "dismissed"])),
    exactCount(supabase, "impact_programmes"),
    exactCount(supabase, "impact_interventions"),
    exactCount(supabase, "impact_assessments"),
    exactCount(supabase, "impact_field_visits"),
    exactCount(supabase, "impact_evidence_files"),
    exactCount(supabase, "impact_reports"),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    operational: {
      title: "A. DBIN Operational Impact",
      description: "DBIN-wide registry, activation, profile completion, and credential counts. These figures are not programme outcomes.",
      metrics: [
        metric("Total MSMEs", totalMsmes, "All MSME registry rows.", "msmes"),
        metric("Association-sourced MSMEs", associationSourcedMsmes, "MSMEs with association fast-track provenance or a source association member.", "msmes.source, msmes.source_association_member_id"),
        metric("Association fast-track MSMEs", associationFastTrackMsmes, "MSMEs explicitly created through association fast-track onboarding.", "msmes.source"),
        metric("Draft MSMEs", draftMsmes, "MSMEs whose review status is draft.", "msmes.review_status"),
        metric("Pending review MSMEs", pendingReviewMsmes, "MSMEs queued for review.", "msmes.review_status"),
        metric("Verified MSMEs", verifiedMsmes, "MSMEs whose verification status is verified.", "msmes.verification_status"),
        computedMetric("Profile completion average", profileAverage, "Average of the existing ten-field DBIN profile completion helper.", "msmes, msme_banking_profiles", "%"),
        computedMetric("Incomplete profiles", incompleteProfiles, "MSME profiles below 100% completion using the existing DBIN helper.", "msmes, msme_banking_profiles"),
        metric("Dashboard reached events", dashboardReached, "Recorded MSME dashboard reach events. This depends on current activity instrumentation.", "activity_logs.action"),
        metric("Digital IDs issued", credentialsCreated, "Digital identity credential rows created.", "digital_identity_credentials"),
        metric("Active digital credentials", activeCredentials, "Digital identity credentials with active lifecycle status.", "digital_identity_credentials.status"),
        computedMetric("Public verification readiness issues", digitalQueue.sources.digital_identity_credentials.available ? digitalQueue.kpis.publicVerificationIssues : null, "Credentials flagged by the existing admin credential-readiness computation.", "digital_identity_credentials, credential_events, msmes"),
      ],
      sources: sourceList(sourceMap, ["msmes", "users", "activity_logs", "msme_banking_profiles", "digital_identity_credentials", "credential_events"]),
      distributions: [
        { title: "Raw state values (internal only)", values: bucket(msmes, "state") },
        { title: "Raw sector values (internal only)", values: bucket(msmes, "sector") },
      ],
      warnings: ["Data quality warning: state and sector values are raw and unstandardized. Regional charts are internal diagnostics, not official coverage reporting."],
      notYetWired: ["Active-user reporting needs an agreed activity window and complete login instrumentation.", "Funding and marketplace readiness are not presented until operational definitions are approved."],
    },
    associations: {
      title: "B. Association Onboarding Impact",
      description: "Association member upload, review, access, and onboarding funnel counts from the live association pipeline.",
      metrics: [
        metric("Associations onboarded", totalAssociations, "All association records.", "associations"),
        metric("Uploaded association member rows", uploadedMemberRows, "Rows received through association bulk-upload batches.", "association_member_import_rows"),
        computedMetric("Valid uploaded rows", sumRows(importRows, ["valid_rows", "success_rows"]), "Sum of valid or successful upload rows recorded by completed import batches.", "association_member_imports"),
        computedMetric("Failed uploaded rows", sumRows(importRows, ["invalid_rows", "failed_rows"]), "Sum of invalid or failed upload rows recorded by import batches.", "association_member_imports"),
        computedMetric("Duplicates flagged", sumRows(importRows, ["duplicate_rows"]), "Sum of duplicate rows flagged by import batches.", "association_member_imports"),
        metric("Members imported", totalMembers, "Association member records created from the member pipeline.", "association_members"),
        metric("Members pending review", membersPendingReview, "Members awaiting association onboarding review.", "association_members.member_status"),
        metric("Members approved", membersApproved, "Members approved for activation.", "association_members.member_status"),
        metric("Members pending activation", membersPendingActivation, "Approved members awaiting activation.", "association_members.member_status"),
        metric("Members activated", membersActivated, "Members whose member status is active.", "association_members.member_status"),
        metric("PIN/access generated", accessGenerated, "Generated association-member access credential rows.", "association_member_access_credentials"),
        metric("First login completed", firstLoginCompleted, "Access credentials with a recorded first login completion timestamp.", "association_member_access_credentials.first_login_completed_at"),
        metric("Account created", accountCreated, "Members whose activation state is account created.", "association_members.activation_state"),
        metric("Onboarding/profile completed", onboardingCompleted, "Members whose activation state is onboarding completed.", "association_members.activation_state"),
        metric("Invitation records", invitationCount, "Invitation records created for association members.", "association_member_invitations"),
        metric("Invitations accepted", acceptedInvitations, "Invitation records with accepted status.", "association_member_invitations.status"),
      ],
      sources: sourceList(sourceMap, ["associations", "association_members", "association_member_imports", "association_member_import_rows", "association_member_invitations", "association_member_access_credentials"]),
    },
    verificationCompliance: {
      title: "C. Verification & Compliance Impact",
      description: "Verification review, digital credential, compliance evidence, and complaint counts from live operational tables.",
      metrics: [
        metric("Verification reviews", verificationReviews, "Verification review records created.", "verification_reviews"),
        metric("Validation results", validationResults, "Stored adapter-validation result rows.", "validation_results"),
        metric("Compliance profiles", complianceProfiles, "MSME compliance aggregate profiles.", "msme_compliance_profiles"),
        metric("Compliance items", complianceItems, "MSME compliance requirement items.", "msme_compliance_items"),
        metric("Compliance documents", complianceDocuments, "Uploaded compliance document metadata rows that are not deleted.", "compliance_documents"),
        metric("Open complaints", openComplaints, "Complaints not marked resolved, closed, or dismissed.", "complaints.status"),
        metric("Resolved complaints", resolvedComplaints, "Complaints marked resolved, closed, or dismissed.", "complaints.status"),
        metric("Credentials created", credentialsCreated, "All digital identity credential rows.", "digital_identity_credentials"),
        metric("Active credentials", activeCredentials, "Credentials with active lifecycle status.", "digital_identity_credentials.status"),
        metric("Pending credentials", pendingCredentials, "Credentials with pending lifecycle status.", "digital_identity_credentials.status"),
        metric("Suspended credentials", suspendedCredentials, "Credentials with suspended lifecycle status.", "digital_identity_credentials.status"),
        metric("Revoked credentials", revokedCredentials, "Credentials with revoked lifecycle status.", "digital_identity_credentials.status"),
        metric("Expired credentials", expiredCredentials, "Credentials with expired lifecycle status.", "digital_identity_credentials.status"),
      ],
      sources: sourceList(sourceMap, ["verification_reviews", "validation_results", "msme_compliance_profiles", "msme_compliance_items", "compliance_documents", "complaints", "digital_identity_credentials", "credential_events"]),
      distributions: [
        { title: "Verification reviews by status", values: bucket(sourceMap.get("verification_reviews")?.rows ?? null, "status") },
        { title: "Compliance profiles by status", values: bucket(sourceMap.get("msme_compliance_profiles")?.rows ?? null, "overall_status") },
        { title: "Compliance items by status", values: bucket(sourceMap.get("msme_compliance_items")?.rows ?? null, "status") },
      ],
    },
    programmeMonitoring: {
      title: "D. Programme Monitoring",
      description: "Internal BOI programme-monitoring records. This is a separate subsystem and must not be interpreted as DBIN-wide impact.",
      metrics: [
        metric("Programmes", programmes, "Internal programme records.", "impact_programmes"),
        metric("Interventions", interventions, "Programme-linked intervention records.", "impact_interventions"),
        metric("Assessments", assessments, "Programme assessment records.", "impact_assessments"),
        metric("Field visits", fieldVisits, "Programme monitoring visit records.", "impact_field_visits"),
        metric("Evidence placeholders", evidenceFiles, "Storage-ready evidence metadata placeholders. This is not a verified evidence-file count.", "impact_evidence_files"),
        metric("Report snapshot records", reports, "Internal structured report records. Download export generation is not wired.", "impact_reports"),
      ],
      sources: sourceList(sourceMap, ["impact_programmes", "impact_interventions", "impact_assessments", "impact_field_visits", "impact_evidence_files", "impact_reports"]),
      warnings: ["Programme Monitoring is internal-only. It does not establish national outcomes, funding impact, or official regional coverage."],
      notYetWired: ["PDF, CSV, and XLSX file generation is disabled until real export generation exists.", "Evidence placeholders are not proof of uploaded or verified files."],
    },
  };
}
