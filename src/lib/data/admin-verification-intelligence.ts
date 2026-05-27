export type VerificationConfidenceCategory = "Strong" | "Moderate" | "Weak" | "Critical Review Needed";
export type VerificationAttentionLevel = "normal" | "watch" | "elevated" | "critical";
export type VerificationQueuePriority = "Low" | "Medium" | "High" | "Urgent";
export type VerificationAgingBucket = "0-2 days" | "3-7 days" | "8-14 days" | "15+ days" | "No queue date available";

export type VerificationSignal = {
  code: string;
  label: string;
  severity: "info" | "watch" | "elevated" | "critical";
  focusArea: "Identity" | "Credential" | "Complaints" | "Duplicates" | "Compliance" | "Profile" | "Queue" | "Review";
};

export type VerificationIntelligenceInput = {
  flagged: boolean;
  suspended: boolean;
  kycOverall: string;
  failedCoreChecks: string[];
  pendingCoreChecks: string[];
  credentialStatus: string | null;
  hasActiveCredential: boolean;
  openComplaints: number | null;
  highSeverityComplaints: number | null;
  duplicateSignals: string[];
  strongDuplicateSignals: boolean;
  profileCompleteness: number | null;
  missingProfileFields: string[];
  complianceStatus: string | null;
  complianceFailedCount: number | null;
  compliancePendingCount: number | null;
  repeatedRejectedReviews: number;
  reviewStatus: string | null;
  queueDate: string | null;
};

export type VerificationIntelligence = {
  confidenceCategory: VerificationConfidenceCategory;
  confidenceReasons: string[];
  attentionLevel: VerificationAttentionLevel;
  attentionReasons: string[];
  queuePriority: VerificationQueuePriority;
  priorityReasons: string[];
  signals: VerificationSignal[];
  recommendedFocusAreas: string[];
  duplicateSignals: string[];
  complaintLinked: boolean;
  credentialWeakness: string[];
  complianceWeakness: string[];
  profileCompletenessGaps: string[];
  repeatedReviewHistory: string[];
  queueAging: {
    queueDate: string | null;
    ageDays: number | null;
    bucket: VerificationAgingBucket;
    overdue: boolean;
    label: string;
  };
  indicators: {
    repeatedFailure: boolean;
    complaintLinked: boolean;
    duplicateSignal: boolean;
    missingCredential: boolean;
    incompleteKyc: boolean;
    staleReview: boolean;
  };
};

const HEALTHY = new Set(["verified", "approved", "active", "passed", "matched", "complete", "valid", "clear", "provided"]);
const PENDING = new Set(["pending", "incomplete", "not_started", "unverified", "unknown", "", "submitted", "under_review", "changes_requested"]);
const CRITICAL_CREDENTIALS = new Set(["revoked", "suspended"]);
const WEAK_COMPLIANCE = new Set(["rejected", "expired", "suspended", "revoked", "failed", "attention_required"]);

export function normalizeVerificationValue(value: string | null | undefined, fallback = "unavailable") {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

export function verificationAgeDays(value: string | null) {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

export function verificationAging(queueDate: string | null): VerificationIntelligence["queueAging"] {
  const ageDays = verificationAgeDays(queueDate);
  if (ageDays === null) {
    return {
      queueDate: null,
      ageDays: null,
      bucket: "No queue date available",
      overdue: false,
      label: "No queue date available",
    };
  }

  const bucket: VerificationAgingBucket = ageDays <= 2 ? "0-2 days" : ageDays <= 7 ? "3-7 days" : ageDays <= 14 ? "8-14 days" : "15+ days";
  return {
    queueDate,
    ageDays,
    bucket,
    overdue: ageDays >= 15,
    label: `${ageDays}d in queue (${bucket})`,
  };
}

function titleStatus(value: string | null | undefined) {
  return normalizeVerificationValue(value).replace(/_/g, " ");
}

function signal(code: string, label: string, severity: VerificationSignal["severity"], focusArea: VerificationSignal["focusArea"]): VerificationSignal {
  return { code, label, severity, focusArea };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildVerificationIntelligence(input: VerificationIntelligenceInput): VerificationIntelligence {
  const kycOverall = normalizeVerificationValue(input.kycOverall);
  const credentialStatus = normalizeVerificationValue(input.credentialStatus, input.hasActiveCredential ? "active" : "missing");
  const complianceStatus = normalizeVerificationValue(input.complianceStatus, "");
  const reviewStatus = normalizeVerificationValue(input.reviewStatus, "");
  const openComplaints = input.openComplaints ?? 0;
  const highSeverityComplaints = input.highSeverityComplaints ?? 0;
  const failedCompliance = input.complianceFailedCount ?? 0;
  const pendingCompliance = input.compliancePendingCount ?? 0;
  const queueAging = verificationAging(input.queueDate);
  const profileCompleteness = input.profileCompleteness ?? 0;
  const duplicateSignals = unique(input.duplicateSignals);

  const signals: VerificationSignal[] = [];
  if (input.flagged) signals.push(signal("flagged_msme", "MSME is flagged", "elevated", "Review"));
  if (input.suspended) signals.push(signal("suspended_msme", "MSME is suspended", "critical", "Review"));
  if (input.failedCoreChecks.length) signals.push(signal("failed_core_checks", `Failed core checks: ${input.failedCoreChecks.join(", ")}`, "elevated", "Identity"));
  if (input.pendingCoreChecks.length || PENDING.has(kycOverall)) signals.push(signal("incomplete_kyc", "KYC checks are pending or incomplete", "watch", "Identity"));
  if (!input.hasActiveCredential) signals.push(signal("missing_active_credential", credentialStatus === "missing" ? "Missing active credential" : `Credential is ${titleStatus(credentialStatus)}`, CRITICAL_CREDENTIALS.has(credentialStatus) ? "critical" : "watch", "Credential"));
  if (openComplaints > 0) signals.push(signal("open_complaints", `${openComplaints} open complaint(s) linked`, highSeverityComplaints > 0 ? "critical" : "elevated", "Complaints"));
  if (highSeverityComplaints > 0) signals.push(signal("high_severity_complaints", `${highSeverityComplaints} high-severity complaint(s) linked`, "critical", "Complaints"));
  if (duplicateSignals.length) signals.push(signal("duplicate_signals", duplicateSignals.slice(0, 4).join(", "), input.strongDuplicateSignals ? "critical" : "elevated", "Duplicates"));
  if (profileCompleteness < 80 || input.missingProfileFields.length) signals.push(signal("profile_incomplete", `Profile completeness is ${profileCompleteness}%`, "watch", "Profile"));
  if (WEAK_COMPLIANCE.has(complianceStatus) || failedCompliance > 0) signals.push(signal("compliance_weakness", failedCompliance > 0 ? `${failedCompliance} failed compliance item(s)` : `Compliance is ${titleStatus(complianceStatus)}`, "elevated", "Compliance"));
  if (pendingCompliance > 0) signals.push(signal("pending_compliance", `${pendingCompliance} pending compliance item(s)`, "watch", "Compliance"));
  if (input.repeatedRejectedReviews >= 2) signals.push(signal("repeated_rejections", `${input.repeatedRejectedReviews} rejected verification review(s)`, "critical", "Review"));
  if (queueAging.overdue) signals.push(signal("stale_pending_review", `Queued for ${queueAging.ageDays} days`, "elevated", "Queue"));
  if (reviewStatus === "escalated") signals.push(signal("escalated_review", "Review is escalated", "elevated", "Review"));
  if (reviewStatus === "awaiting_documents") signals.push(signal("awaiting_documents", "Reviewer is awaiting documents", "watch", "Review"));

  const criticalReasons = signals.filter((item) => item.severity === "critical").map((item) => item.label);
  const elevatedReasons = signals.filter((item) => item.severity === "elevated").map((item) => item.label);
  const watchReasons = signals.filter((item) => item.severity === "watch").map((item) => item.label);
  const mostlyVerifiedKyc = HEALTHY.has(kycOverall) || input.failedCoreChecks.length === 0 && input.pendingCoreChecks.length <= 1;

  let confidenceCategory: VerificationConfidenceCategory = "Moderate";
  const confidenceReasons: string[] = [];
  if (criticalReasons.length) {
    confidenceCategory = "Critical Review Needed";
    confidenceReasons.push(...criticalReasons);
  } else if (!mostlyVerifiedKyc || !input.hasActiveCredential || profileCompleteness < 70 || failedCompliance > 0 || WEAK_COMPLIANCE.has(complianceStatus)) {
    confidenceCategory = "Weak";
    if (!mostlyVerifiedKyc) confidenceReasons.push("Core KYC checks are failed, pending, or incomplete");
    if (!input.hasActiveCredential) confidenceReasons.push("No active credential is available");
    if (profileCompleteness < 70) confidenceReasons.push("Profile completeness is below 70%");
    if (failedCompliance > 0 || WEAK_COMPLIANCE.has(complianceStatus)) confidenceReasons.push("Compliance evidence has failed or rejected signals");
  } else if (mostlyVerifiedKyc && input.hasActiveCredential && openComplaints === 0 && duplicateSignals.length === 0 && profileCompleteness >= 80) {
    confidenceCategory = "Strong";
    confidenceReasons.push("KYC checks are mostly verified", "Active credential exists", "No open complaints or duplicate signals detected", "Profile completeness is high");
  } else {
    confidenceCategory = "Moderate";
    if (watchReasons.length) confidenceReasons.push(...watchReasons.slice(0, 3));
    if (!confidenceReasons.length) confidenceReasons.push("Minor pending or missing fields exist, with no critical risk signal detected");
  }

  const attentionLevel: VerificationAttentionLevel = criticalReasons.length ? "critical" : elevatedReasons.length ? "elevated" : watchReasons.length ? "watch" : "normal";
  const attentionReasons = attentionLevel === "normal" ? ["No critical signals detected"] : [...criticalReasons, ...elevatedReasons, ...watchReasons].slice(0, 5);

  let queuePriority: VerificationQueuePriority = "Low";
  const priorityReasons: string[] = [];
  if (criticalReasons.length || queueAging.ageDays !== null && queueAging.ageDays >= 15) {
    queuePriority = "Urgent";
    priorityReasons.push(...criticalReasons.slice(0, 3));
    if (queueAging.ageDays !== null && queueAging.ageDays >= 15) priorityReasons.push("Queue age is 15+ days");
  } else if (elevatedReasons.length || queueAging.ageDays !== null && queueAging.ageDays >= 8) {
    queuePriority = "High";
    priorityReasons.push(...elevatedReasons.slice(0, 3));
    if (queueAging.ageDays !== null && queueAging.ageDays >= 8) priorityReasons.push("Queue age is 8+ days");
  } else if (watchReasons.length || queueAging.ageDays !== null && queueAging.ageDays >= 3) {
    queuePriority = "Medium";
    priorityReasons.push(...watchReasons.slice(0, 3));
    if (queueAging.ageDays !== null && queueAging.ageDays >= 3) priorityReasons.push("Queue age is 3+ days");
  } else {
    priorityReasons.push("No elevated or critical signal detected");
  }

  const recommendedFocusAreas = unique(signals.map((item) => item.focusArea));
  return {
    confidenceCategory,
    confidenceReasons: unique(confidenceReasons),
    attentionLevel,
    attentionReasons: unique(attentionReasons),
    queuePriority,
    priorityReasons: unique(priorityReasons),
    signals,
    recommendedFocusAreas: recommendedFocusAreas.length ? recommendedFocusAreas : ["Standard reviewer checks"],
    duplicateSignals,
    complaintLinked: openComplaints > 0,
    credentialWeakness: input.hasActiveCredential ? [] : [credentialStatus === "missing" ? "No active credential found" : `Credential is ${titleStatus(credentialStatus)}`],
    complianceWeakness: unique([
      failedCompliance > 0 ? `${failedCompliance} failed compliance item(s)` : "",
      WEAK_COMPLIANCE.has(complianceStatus) ? `Compliance status is ${titleStatus(complianceStatus)}` : "",
      pendingCompliance > 0 ? `${pendingCompliance} pending compliance item(s)` : "",
    ]),
    profileCompletenessGaps: input.missingProfileFields.length ? input.missingProfileFields : profileCompleteness < 80 ? [`Profile completeness is ${profileCompleteness}%`] : [],
    repeatedReviewHistory: input.repeatedRejectedReviews > 0 ? [`${input.repeatedRejectedReviews} rejected verification review(s) found`] : [],
    queueAging,
    indicators: {
      repeatedFailure: input.repeatedRejectedReviews >= 2 || input.failedCoreChecks.length > 0,
      complaintLinked: openComplaints > 0,
      duplicateSignal: duplicateSignals.length > 0,
      missingCredential: !input.hasActiveCredential,
      incompleteKyc: input.pendingCoreChecks.length > 0 || PENDING.has(kycOverall),
      staleReview: queueAging.overdue,
    },
  };
}
