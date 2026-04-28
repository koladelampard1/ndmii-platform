import type { AssessmentResponses, CategoryBreakdown, FinancePathway, MsmeReadinessSnapshot, ReadinessBand, ReadinessResult } from "./types";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveBand(score: number): ReadinessBand {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 45) return "Emerging";
  return "At Risk";
}

function pathwayRecommendation(pathway: FinancePathway): string {
  if (pathway === "grant") return "Prepare a concise impact narrative and align your ask to measurable outcomes required by grant issuers.";
  if (pathway === "investment") return "Build a one-page investment memo with traction metrics, unit economics, and an achievable 18-month plan.";
  return "Strengthen debt-service readiness by maintaining predictable cashflow records and repayment buffers.";
}

export function evaluateFinanceReadiness(input: {
  pathway: FinancePathway;
  responses: AssessmentResponses;
  snapshot: MsmeReadinessSnapshot;
}): ReadinessResult {
  const { responses, snapshot, pathway } = input;

  const identityScore =
    (responses.hasBusinessRegistration ? 10 : 0) +
    (responses.hasFormalBankAccount ? 8 : 0) +
    (snapshot.verificationStatus === "verified" || snapshot.verificationStatus === "approved" ? 7 : 0) +
    Math.round((snapshot.profileCompletion / 100) * 5);

  const financialScore =
    (responses.hasMonthlyRecords ? 8 : 0) +
    ({ none: 0, manual: 4, spreadsheet: 7, software: 10 }[responses.bookkeepingMethod] ?? 0) +
    (responses.hasCashflowProjection ? 6 : 0) +
    Math.min(6, snapshot.invoiceCount >= 8 ? 6 : snapshot.invoiceCount);

  const complianceScore =
    (responses.hasRecentTaxFiling ? 8 : 0) +
    (responses.hasVatRegistration ? 4 : 0) +
    ({ pending: 3, partial: 6, verified: 10 }[responses.complianceStatus] ?? 0) +
    (snapshot.taxComplianceStatus === "compliant" ? 8 : snapshot.taxComplianceStatus === "pending" ? 4 : 2);

  const operationsScore =
    (responses.hasOperatingPlan ? 8 : 0) +
    (responses.hasDocumentedProcesses ? 8 : 0) +
    ({ solo: 3, "2_5": 5, "6_20": 7, "21_plus": 8 }[responses.teamSizeBand] ?? 0) +
    (snapshot.openComplaints === 0 ? 6 : snapshot.openComplaints <= 2 ? 4 : 1);

  const growthScore =
    ({ under_500k: 6, "500k_2m": 8, "2m_10m": 10, "10m_50m": 8, above_50m: 6 }[responses.fundingAmountRange] ?? 0) +
    (responses.fundingPurpose.trim().length > 20 ? 8 : 3) +
    (snapshot.paymentSuccessRate >= 80 ? 7 : snapshot.paymentSuccessRate >= 60 ? 5 : 2) +
    (responses.growthPriority ? 5 : 0);

  const rawBreakdown: CategoryBreakdown[] = [
    { key: "identity", label: "Identity", score: identityScore, maxScore: 30 },
    { key: "financialDiscipline", label: "Financial Discipline", score: financialScore, maxScore: 30 },
    { key: "compliance", label: "Compliance", score: complianceScore, maxScore: 30 },
    { key: "operationalStability", label: "Operational Stability", score: operationsScore, maxScore: 30 },
    { key: "growthPreparedness", label: "Growth Preparedness", score: growthScore, maxScore: 30 },
  ];

  const score = clampScore(
    rawBreakdown.reduce((sum, item) => sum + Math.round((item.score / item.maxScore) * 20), 0),
  );

  const band = resolveBand(score);

  const strengths = rawBreakdown
    .filter((item) => item.score / item.maxScore >= 0.65)
    .map((item) => `${item.label} readiness is solid for ${pathway} applications.`);

  const gaps = rawBreakdown
    .filter((item) => item.score / item.maxScore < 0.5)
    .map((item) => `${item.label} currently falls below preferred funder benchmarks.`);

  const riskFlags = [
    snapshot.openComplaints > 2 ? "Multiple open complaints may reduce lender confidence." : null,
    !responses.hasRecentTaxFiling ? "Recent tax filing evidence is missing." : null,
    !responses.hasCashflowProjection ? "Cashflow projection is unavailable." : null,
  ].filter((item): item is string => Boolean(item));

  const recommendations = [
    pathwayRecommendation(pathway),
    responses.bookkeepingMethod === "none"
      ? "Start simple bookkeeping immediately using spreadsheet or accounting software before next funding application."
      : "Keep six months of reconciled financial records ready for due diligence.",
    snapshot.openComplaints > 0
      ? "Resolve open complaints and document outcomes to improve risk perception."
      : "Maintain your low complaint profile and preserve evidence of service quality.",
  ];

  return {
    score,
    band,
    breakdown: rawBreakdown.map((item) => ({ ...item, score: Math.min(item.maxScore, item.score) })),
    strengths: strengths.length ? strengths : ["Your business has baseline readiness indicators across core areas."],
    gaps: gaps.length ? gaps : ["No critical gaps were detected, but continuous improvements are still recommended."],
    recommendations,
    riskFlags,
  };
}
