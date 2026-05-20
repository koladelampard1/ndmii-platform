import type { SupabaseClient } from "@supabase/supabase-js";
import { toSupabaseErrorInfo } from "@/lib/data/compliance-evidence";

type RequirementRow = {
  id: string;
  regulator_id: string;
  is_mandatory: boolean | null;
};

type ComplianceItemRow = {
  id: string;
  status: string | null;
  is_required: boolean | null;
  expires_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  updated_at: string | null;
};

type BaselineDiagnostic = {
  operation: string;
  msmeId: string;
  requirementDefinitionCount?: number;
  existingItemCount?: number;
  insertedItemCount?: number;
  skippedItemCount?: number;
  profileExists?: boolean;
  code?: string | null;
  message?: string | null;
};

export type BaselineGenerationResult = {
  ok: boolean;
  existingItemCount: number;
  insertedItemCount: number;
  skippedItemCount: number;
  requirementDefinitionCount: number;
};

const MVP_REGULATORS = [
  { code: "CAC", name: "Corporate Affairs Commission", regulator_type: "cac", jurisdiction: "federal" },
  { code: "FIRS", name: "Federal Inland Revenue Service", regulator_type: "firs", jurisdiction: "federal" },
  { code: "VAT", name: "Value Added Tax Administration", regulator_type: "vat", jurisdiction: "federal" },
  { code: "PLATFORM_KYC", name: "NDMII Platform KYC", regulator_type: "platform", jurisdiction: "platform" },
] as const;

const MVP_REQUIREMENTS = [
  {
    regulatorCode: "CAC",
    code: "CAC_REGISTRATION",
    title: "CAC registration",
    description: "Business registration with CAC.",
    category: "registration",
    frequency: "one_time",
    requires_document: true,
    requires_reference_number: true,
    requires_issue_date: false,
    requires_expiry_date: false,
    default_validity_months: null,
    renewal_window_days: 30,
    is_mandatory: true,
    sort_order: 10,
  },
  {
    regulatorCode: "CAC",
    code: "CAC_ANNUAL_RETURN",
    title: "CAC annual return",
    description: "Annual return filing status.",
    category: "annual_return",
    frequency: "annual",
    requires_document: true,
    requires_reference_number: true,
    requires_issue_date: true,
    requires_expiry_date: true,
    default_validity_months: 12,
    renewal_window_days: 60,
    is_mandatory: true,
    sort_order: 20,
  },
  {
    regulatorCode: "FIRS",
    code: "TIN_VALIDATION",
    title: "TIN validation",
    description: "Tax identification validation with FIRS.",
    category: "tax",
    frequency: "one_time",
    requires_document: false,
    requires_reference_number: true,
    requires_issue_date: false,
    requires_expiry_date: false,
    default_validity_months: null,
    renewal_window_days: 30,
    is_mandatory: true,
    sort_order: 30,
  },
  {
    regulatorCode: "VAT",
    code: "VAT_REGISTRATION",
    title: "VAT registration",
    description: "VAT registration status.",
    category: "vat",
    frequency: "one_time",
    requires_document: true,
    requires_reference_number: true,
    requires_issue_date: false,
    requires_expiry_date: false,
    default_validity_months: null,
    renewal_window_days: 30,
    is_mandatory: true,
    sort_order: 40,
  },
  {
    regulatorCode: "VAT",
    code: "VAT_FILING_STATUS",
    title: "VAT filing status",
    description: "Periodic VAT filing and remittance posture.",
    category: "vat",
    frequency: "monthly",
    requires_document: true,
    requires_reference_number: false,
    requires_issue_date: false,
    requires_expiry_date: false,
    default_validity_months: null,
    renewal_window_days: 30,
    is_mandatory: true,
    sort_order: 50,
  },
  {
    regulatorCode: "PLATFORM_KYC",
    code: "GENERAL_CERTIFICATION",
    title: "General certification",
    description: "General business certification placeholder for future regulator-specific certificates.",
    category: "certification",
    frequency: "rolling_expiry",
    requires_document: true,
    requires_reference_number: true,
    requires_issue_date: true,
    requires_expiry_date: true,
    default_validity_months: 12,
    renewal_window_days: 60,
    is_mandatory: false,
    sort_order: 100,
  },
] as const;

function logBaselineDiagnostic(payload: BaselineDiagnostic) {
  console.info("[msme-compliance-baseline]", payload);
}

function deriveOverallStatus(items: ComplianceItemRow[]) {
  if (items.some((item) => item.status === "suspended" || item.status === "revoked")) return "suspended";
  if (items.some((item) => item.status === "expired")) return "expired";
  if (items.some((item) => item.status === "rejected")) return "rejected";
  if (items.some((item) => item.status === "changes_requested")) return "changes_requested";
  if (items.some((item) => item.status === "submitted" || item.status === "resubmitted" || item.status === "under_review")) return "under_review";

  const requiredItems = items.filter((item) => item.is_required);
  if (requiredItems.length > 0 && requiredItems.every((item) => item.status === "approved")) return "approved";
  return "not_started";
}

function deriveRiskLevel(items: ComplianceItemRow[]) {
  if (items.some((item) => item.status === "suspended" || item.status === "revoked" || item.status === "expired")) return "critical";
  if (items.some((item) => item.status === "rejected" || item.status === "changes_requested")) return "high";
  if (items.some((item) => ["not_started", "draft", "submitted", "resubmitted", "under_review"].includes(item.status ?? ""))) return "medium";
  return items.length > 0 ? "low" : "medium";
}

function latestTimestamp(values: Array<string | null>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function earliestDate(values: Array<string | null>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (!timestamps.length) return null;
  return new Date(Math.min(...timestamps)).toISOString();
}

async function seedMvpRequirementDefinitions(serviceSupabase: SupabaseClient, msmeId: string) {
  const { error: regulatorError } = await serviceSupabase.from("compliance_regulators").upsert(
    MVP_REGULATORS.map((regulator) => ({
      ...regulator,
      is_active: true,
      metadata: { phase: "phase1", source: "runtime_baseline_seed" },
    })),
    { onConflict: "code" },
  );

  if (regulatorError) throw regulatorError;

  const { data: regulators, error: regulatorLookupError } = await serviceSupabase
    .from("compliance_regulators")
    .select("id,code")
    .in(
      "code",
      MVP_REGULATORS.map((regulator) => regulator.code),
    );

  if (regulatorLookupError) throw regulatorLookupError;

  const regulatorByCode = new Map((regulators ?? []).map((regulator) => [String(regulator.code), String(regulator.id)]));
  const requirementPayload = MVP_REQUIREMENTS.flatMap((requirement) => {
    const regulatorId = regulatorByCode.get(requirement.regulatorCode);
    if (!regulatorId) return [];
    return [{
      regulator_id: regulatorId,
      code: requirement.code,
      title: requirement.title,
      description: requirement.description,
      category: requirement.category,
      frequency: requirement.frequency,
      requires_document: requirement.requires_document,
      requires_reference_number: requirement.requires_reference_number,
      requires_issue_date: requirement.requires_issue_date,
      requires_expiry_date: requirement.requires_expiry_date,
      default_validity_months: requirement.default_validity_months,
      renewal_window_days: requirement.renewal_window_days,
      is_mandatory: requirement.is_mandatory,
      sort_order: requirement.sort_order,
      is_active: true,
      metadata: { phase: "phase1", source: "runtime_baseline_seed" },
    }];
  });

  const { error: requirementError } = await serviceSupabase
    .from("compliance_requirement_definitions")
    .upsert(requirementPayload, { onConflict: "code" });

  if (requirementError) throw requirementError;

  logBaselineDiagnostic({
    operation: "mvp_requirements_seeded",
    msmeId,
    requirementDefinitionCount: requirementPayload.length,
    existingItemCount: 0,
    insertedItemCount: 0,
    skippedItemCount: 0,
  });
}

async function recalculateComplianceProfile(serviceSupabase: SupabaseClient, msmeId: string) {
  const { data, error } = await serviceSupabase
    .from("msme_compliance_items")
    .select("id,status,is_required,expires_at,submitted_at,approved_at,rejected_at,updated_at")
    .eq("msme_id", msmeId)
    .is("renewal_of", null);

  if (error) throw error;

  const items = (data ?? []) as ComplianceItemRow[];
  const requiredItems = items.filter((item) => item.is_required);
  const approvedRequiredCount = requiredItems.filter((item) => item.status === "approved").length;
  const expiredPenalty = requiredItems.filter((item) => ["expired", "suspended", "revoked"].includes(item.status ?? "")).length * 20;
  const rejectedPenalty = requiredItems.filter((item) => item.status === "rejected").length * 10;
  const complianceScore = requiredItems.length
    ? Math.max(0, Math.min(100, Math.round((approvedRequiredCount / requiredItems.length) * 100) - expiredPenalty - rejectedPenalty))
    : 0;

  const { error: profileError } = await serviceSupabase.from("msme_compliance_profiles").upsert(
    {
      msme_id: msmeId,
      overall_status: deriveOverallStatus(items),
      compliance_score: complianceScore,
      risk_level: deriveRiskLevel(items),
      total_required_count: requiredItems.length,
      approved_count: items.filter((item) => item.status === "approved").length,
      pending_count: items.filter((item) => ["not_started", "draft", "submitted", "resubmitted"].includes(item.status ?? "")).length,
      under_review_count: items.filter((item) => item.status === "under_review").length,
      changes_requested_count: items.filter((item) => item.status === "changes_requested").length,
      rejected_count: items.filter((item) => item.status === "rejected").length,
      expired_count: items.filter((item) => item.status === "expired").length,
      expiring_soon_count: items.filter((item) => item.status === "expiring_soon").length,
      suspended_count: items.filter((item) => item.status === "suspended").length,
      revoked_count: items.filter((item) => item.status === "revoked").length,
      last_submitted_at: latestTimestamp(items.map((item) => item.submitted_at)),
      last_reviewed_at: latestTimestamp(items.flatMap((item) => [item.approved_at, item.rejected_at, item.updated_at])),
      next_deadline_at: earliestDate(items.map((item) => item.expires_at)),
      last_recalculated_at: new Date().toISOString(),
      metadata: {
        source: "baseline_repair_recalculation",
        generated_reason: "baseline_mvp_requirement",
        certified_truth: false,
      },
    },
    { onConflict: "msme_id" },
  );

  if (profileError) throw profileError;
}

export async function ensureBaselineComplianceItemsForMsme(params: {
  serviceSupabase: SupabaseClient;
  msmeId: string;
  appUserId: string | null;
  email: string | null;
}): Promise<BaselineGenerationResult> {
  const { serviceSupabase, msmeId, appUserId, email } = params;
  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  let requirementDefinitionCount = 0;
  let existingItemCount = 0;
  let insertedItemCount = 0;
  let skippedItemCount = 0;
  let profileExists = false;

  try {
    const { data: msme, error: msmeError } = await serviceSupabase
      .from("msmes")
      .select("id,created_by,contact_email")
      .eq("id", msmeId)
      .maybeSingle();

    if (msmeError) throw msmeError;
    profileExists = Boolean(msme);

    const ownsWorkspace = msme
      ? (appUserId && msme.created_by === appUserId) ||
        (normalizedEmail && typeof msme.contact_email === "string" && msme.contact_email.trim().toLowerCase() === normalizedEmail)
      : false;

    if (!ownsWorkspace) {
      logBaselineDiagnostic({
        operation: "ownership_denied",
        msmeId,
        requirementDefinitionCount,
        existingItemCount,
        insertedItemCount,
        skippedItemCount,
        profileExists,
        code: "ownership_denied",
        message: "MSME workspace ownership validation failed.",
      });
      return { ok: false, existingItemCount, insertedItemCount, skippedItemCount, requirementDefinitionCount };
    }

    const { data: existingRows, error: existingError } = await serviceSupabase
      .from("msme_compliance_items")
      .select("requirement_id")
      .eq("msme_id", msmeId)
      .is("renewal_of", null);

    if (existingError) throw existingError;

    const existingRequirementIds = new Set((existingRows ?? []).map((row) => String(row.requirement_id)));
    existingItemCount = existingRequirementIds.size;

    const { data: initialRequirements, error: requirementsError } = await serviceSupabase
      .from("compliance_requirement_definitions")
      .select("id,regulator_id,is_mandatory")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (requirementsError) throw requirementsError;
    let requirements = initialRequirements;
    requirementDefinitionCount = (requirements ?? []).length;

    if (requirementDefinitionCount === 0) {
      await seedMvpRequirementDefinitions(serviceSupabase, msmeId);
      const retry = await serviceSupabase
        .from("compliance_requirement_definitions")
        .select("id,regulator_id,is_mandatory")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (retry.error) throw retry.error;
      requirements = retry.data;
      requirementDefinitionCount = (requirements ?? []).length;
    }

    const missingRequirements = ((requirements ?? []) as RequirementRow[]).filter((requirement) => !existingRequirementIds.has(requirement.id));
    skippedItemCount = requirementDefinitionCount - missingRequirements.length;

    if (missingRequirements.length === 0) {
      await recalculateComplianceProfile(serviceSupabase, msmeId);
      logBaselineDiagnostic({
        operation: "baseline_noop",
        msmeId,
        requirementDefinitionCount,
        existingItemCount,
        insertedItemCount,
        skippedItemCount,
        profileExists,
      });
      return { ok: true, existingItemCount, insertedItemCount, skippedItemCount, requirementDefinitionCount };
    }

    const { data: insertedRows, error: insertError } = await serviceSupabase
      .from("msme_compliance_items")
      .insert(
        missingRequirements.map((requirement) => ({
          msme_id: msmeId,
          requirement_id: requirement.id,
          regulator_id: requirement.regulator_id,
          status: "not_started",
          is_required: requirement.is_mandatory ?? true,
          source: "system_generated",
          metadata: {
            phase: "phase1",
            generated_reason: "baseline_mvp_requirement",
            certified_truth: false,
          },
        })),
      )
      .select("id,regulator_id,status");

    if (insertError) throw insertError;

    const inserted = (insertedRows ?? []) as Array<{ id: string; regulator_id: string; status: string }>;
    insertedItemCount = inserted.length;

    if (inserted.length > 0) {
      const { error: eventError } = await serviceSupabase.from("compliance_events").insert(
        inserted.map((item) => ({
          msme_id: msmeId,
          compliance_item_id: item.id,
          regulator_id: item.regulator_id,
          event_type: "item_created",
          actor_type: "system",
          actor_role: "system",
          to_status: item.status,
          summary: "Baseline compliance requirement prepared for evidence upload.",
          metadata: {
            phase: "phase1",
            source: "system_generated",
            generated_reason: "baseline_mvp_requirement",
            certified_truth: false,
          },
        })),
      );

      if (eventError) throw eventError;
    }

    await recalculateComplianceProfile(serviceSupabase, msmeId);

    const { count: postInsertCount, error: postInsertCountError } = await serviceSupabase
      .from("msme_compliance_items")
      .select("id", { count: "exact", head: true })
      .eq("msme_id", msmeId)
      .is("renewal_of", null);

    if (postInsertCountError) throw postInsertCountError;

    if (requirementDefinitionCount > 0 && existingItemCount === 0 && (postInsertCount ?? 0) === 0) {
      throw new Error("Baseline invariant failed: active requirement definitions exist but no compliance items persisted.");
    }

    logBaselineDiagnostic({
      operation: "baseline_generated",
      msmeId,
      requirementDefinitionCount,
      existingItemCount,
      insertedItemCount,
      skippedItemCount,
      profileExists,
    });
    return { ok: true, existingItemCount, insertedItemCount, skippedItemCount, requirementDefinitionCount };
  } catch (error) {
    const errorInfo = toSupabaseErrorInfo(error);
    logBaselineDiagnostic({
      operation: "baseline_failed",
      msmeId,
      requirementDefinitionCount,
      existingItemCount,
      insertedItemCount,
      skippedItemCount,
      profileExists,
      code: errorInfo.code ?? "unknown",
      message: errorInfo.message ?? "Unable to generate baseline compliance items.",
    });
    return { ok: false, existingItemCount, insertedItemCount, skippedItemCount, requirementDefinitionCount };
  }
}
