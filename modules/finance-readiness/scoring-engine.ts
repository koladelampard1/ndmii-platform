export type ReadinessSignals = {
  verificationStatus: string | null;
  reviewStatus: string | null;
  ninStatus: string | null;
  bvnStatus: string | null;
  cacStatus: string | null;
  tinStatus: string | null;
  complianceOverallStatus: string | null;
  complianceRiskLevel: string | null;
  complianceScore: number | null;
  invoicesIssued: number;
  invoicesPaid: number;
  paymentsCount: number;
  profileUpdatedAt: string | null;
  hasAssociationMembership: boolean;
  hasProviderProfile: boolean;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreIdentitySignal(status: string | null) {
  const normalized = normalize(status);
  if (["verified", "approved", "match", "active", "compliant", "success"].includes(normalized)) return 25;
  if (["pending", "pending_review", "reviewing", "in review"].includes(normalized)) return 12;
  return 4;
}

export function identityScore(signals: ReadinessSignals) {
  const score =
    scoreIdentitySignal(signals.verificationStatus) +
    scoreIdentitySignal(signals.ninStatus) +
    scoreIdentitySignal(signals.bvnStatus) +
    scoreIdentitySignal(signals.cacStatus);

  return clamp(score);
}

export function financialScore(signals: ReadinessSignals) {
  const paidRatio = signals.invoicesIssued > 0 ? signals.invoicesPaid / signals.invoicesIssued : 0;

  let score = 25;
  score += Math.min(35, signals.invoicesIssued * 4);
  score += Math.min(25, signals.paymentsCount * 2);
  score += Math.round(paidRatio * 15);

  return clamp(score);
}

export function complianceScore(signals: ReadinessSignals) {
  let score = signals.complianceScore ?? 0;

  if (normalize(signals.complianceOverallStatus) === "verified") score += 20;
  if (normalize(signals.complianceRiskLevel) === "low") score += 10;
  if (normalize(signals.tinStatus) === "verified") score += 10;

  return clamp(score);
}

export function operationalScore(signals: ReadinessSignals) {
  let score = 20;

  if (signals.hasProviderProfile) score += 25;
  if (signals.hasAssociationMembership) score += 20;
  if (signals.profileUpdatedAt) score += 15;
  if (signals.invoicesIssued > 0) score += 20;

  return clamp(score);
}

export function growthScore(signals: ReadinessSignals) {
  let score = 15;

  const trustStatus = normalize(signals.verificationStatus);
  if (["verified", "approved"].includes(trustStatus)) score += 30;

  score += Math.min(20, signals.invoicesIssued * 2);
  score += Math.min(20, signals.invoicesPaid * 2);

  if (normalize(signals.reviewStatus) === "approved") score += 15;

  return clamp(score);
}
