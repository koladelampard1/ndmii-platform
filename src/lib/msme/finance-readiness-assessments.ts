export type FinanceReadinessPathway = "loan" | "grant" | "investment";

export type FinanceReadinessAssessmentSnapshot = {
  pathway: FinanceReadinessPathway;
  score: number;
  completion: number;
  band: string;
  createdAtIso: string;
};

const ttlMs = 1000 * 60 * 60 * 24;
const assessments = new Map<string, FinanceReadinessAssessmentSnapshot>();

function pruneExpired(nowMs: number) {
  for (const [id, value] of assessments.entries()) {
    if (nowMs - new Date(value.createdAtIso).getTime() > ttlMs) {
      assessments.delete(id);
    }
  }
}

export function createFinanceReadinessAssessment(
  data: Omit<FinanceReadinessAssessmentSnapshot, "createdAtIso">,
) {
  const now = new Date();
  pruneExpired(now.getTime());
  const id = crypto.randomUUID();
  assessments.set(id, { ...data, createdAtIso: now.toISOString() });
  return id;
}

export function getFinanceReadinessAssessment(assessmentId: string) {
  const nowMs = Date.now();
  pruneExpired(nowMs);
  return assessments.get(assessmentId) ?? null;
}
