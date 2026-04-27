export const FEATURE_FINANCE_READINESS =
  process.env.NEXT_PUBLIC_FEATURE_FINANCE_READINESS !== "false" && process.env.FEATURE_FINANCE_READINESS !== "false";

export type AssessmentCategory =
  | "identity"
  | "financial_discipline"
  | "compliance"
  | "operational_stability"
  | "growth_preparedness";

export type AssessmentInputType = "yes_no" | "select" | "short_text" | "amount_range" | "funding_purpose";

export type AssessmentQuestion = {
  id: string;
  category: AssessmentCategory;
  label: string;
  helper?: string;
  type: AssessmentInputType;
  options?: string[];
};

export type ReadinessBand = "High" | "Moderate" | "Emerging";

export type AutoSignals = {
  verificationStatus: string | null;
  profileCompletion: number;
  openComplaints: number;
  taxProfileStatus: string | null;
  vatApplicable: boolean | null;
  complianceScore: number | null;
  invoicesIssued: number;
  paymentsRecorded: number;
};

export type AssessmentResponses = Record<string, string>;

export type CategoryBreakdown = Record<AssessmentCategory, number>;

export type FinanceReadinessResult = {
  totalScore: number;
  band: ReadinessBand;
  breakdown: CategoryBreakdown;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  riskFlags: string[];
};

const YES = "yes";

export const FINANCE_READINESS_QUESTIONS: AssessmentQuestion[] = [
  { id: "registered_name", category: "identity", label: "Does your business name match CAC records?", type: "yes_no" },
  { id: "active_bank_account", category: "identity", label: "Do you operate a dedicated business bank account?", type: "yes_no" },
  { id: "updated_contact", category: "identity", label: "Is your business contact information current?", type: "yes_no" },
  {
    id: "business_stage",
    category: "identity",
    label: "How long has the business been operating?",
    type: "select",
    options: ["Under 6 months", "6-12 months", "1-3 years", "Over 3 years"],
  },

  { id: "bookkeeping", category: "financial_discipline", label: "Do you keep monthly bookkeeping records?", type: "yes_no" },
  {
    id: "records_tool",
    category: "financial_discipline",
    label: "What tool do you use for financial records?",
    type: "select",
    options: ["No formal tool", "Notebook/manual", "Spreadsheet", "Accounting software"],
  },
  { id: "separate_personal_business", category: "financial_discipline", label: "Do you separate personal and business spending?", type: "yes_no" },
  {
    id: "monthly_revenue_band",
    category: "financial_discipline",
    label: "Average monthly revenue range",
    type: "amount_range",
    options: ["Under ₦250k", "₦250k-₦1m", "₦1m-₦5m", "Above ₦5m"],
  },
  { id: "cashflow_forecast", category: "financial_discipline", label: "Do you maintain a 3-month cashflow forecast?", type: "yes_no" },

  { id: "tin_available", category: "compliance", label: "Do you have an active TIN?", type: "yes_no" },
  { id: "vat_returns", category: "compliance", label: "Are VAT returns filed consistently (if applicable)?", type: "yes_no" },
  { id: "regulatory_dues", category: "compliance", label: "Are statutory dues currently up to date?", type: "yes_no" },
  {
    id: "compliance_policy",
    category: "compliance",
    label: "Internal compliance discipline level",
    type: "select",
    options: ["None", "Basic checklist", "Documented routine", "Auditable routine"],
  },

  { id: "supplier_contracts", category: "operational_stability", label: "Do you have written supplier or customer contracts?", type: "yes_no" },
  { id: "team_capacity", category: "operational_stability", label: "Can your current team deliver larger orders?", type: "yes_no" },
  {
    id: "continuity_plan",
    category: "operational_stability",
    label: "Business continuity readiness",
    type: "select",
    options: ["None", "Informal backup", "Documented backup", "Tested continuity plan"],
  },
  { id: "digital_presence", category: "operational_stability", label: "Do you maintain an active digital/public profile?", type: "yes_no" },

  {
    id: "funding_need_range",
    category: "growth_preparedness",
    label: "Funding need (next 12 months)",
    type: "amount_range",
    options: ["Under ₦500k", "₦500k-₦2m", "₦2m-₦10m", "Above ₦10m"],
  },
  {
    id: "funding_purpose",
    category: "growth_preparedness",
    label: "Primary funding purpose",
    type: "funding_purpose",
    options: ["Working capital", "Equipment", "Inventory", "Market expansion", "Digital transformation"],
  },
  { id: "funding_plan", category: "growth_preparedness", label: "Do you have a written plan for the requested funding?", type: "yes_no" },
  { id: "repayment_strategy", category: "growth_preparedness", label: "Do you have a repayment or return strategy defined?", type: "yes_no" },
  { id: "growth_comment", category: "growth_preparedness", label: "Briefly describe your biggest growth opportunity.", type: "short_text" },
];

const QUESTION_POINTS: Record<string, number> = {
  registered_name: 4,
  active_bank_account: 5,
  updated_contact: 4,
  business_stage: 7,
  bookkeeping: 6,
  records_tool: 4,
  separate_personal_business: 4,
  monthly_revenue_band: 3,
  cashflow_forecast: 3,
  tin_available: 5,
  vat_returns: 5,
  regulatory_dues: 5,
  compliance_policy: 5,
  supplier_contracts: 5,
  team_capacity: 5,
  continuity_plan: 5,
  digital_presence: 5,
  funding_need_range: 4,
  funding_purpose: 4,
  funding_plan: 6,
  repayment_strategy: 4,
  growth_comment: 2,
};

function scoreOption(questionId: string, value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 0;
  if (normalized === YES) return QUESTION_POINTS[questionId] ?? 0;

  const matrix: Record<string, Record<string, number>> = {
    business_stage: { "under 6 months": 2, "6-12 months": 3, "1-3 years": 5, "over 3 years": 7 },
    records_tool: { "no formal tool": 1, "notebook/manual": 2, spreadsheet: 3, "accounting software": 4 },
    monthly_revenue_band: { "under ₦250k": 1, "₦250k-₦1m": 2, "₦1m-₦5m": 3, "above ₦5m": 3 },
    compliance_policy: { none: 1, "basic checklist": 2, "documented routine": 4, "auditable routine": 5 },
    continuity_plan: { none: 1, "informal backup": 2, "documented backup": 4, "tested continuity plan": 5 },
    funding_need_range: { "under ₦500k": 2, "₦500k-₦2m": 3, "₦2m-₦10m": 4, "above ₦10m": 3 },
    funding_purpose: {
      "working capital": 3,
      equipment: 4,
      inventory: 3,
      "market expansion": 4,
      "digital transformation": 4,
    },
  };

  if (questionId === "growth_comment") return Math.min(2, normalized.length >= 20 ? 2 : 1);

  return matrix[questionId]?.[normalized] ?? 0;
}

function initialBreakdown(): CategoryBreakdown {
  return {
    identity: 0,
    financial_discipline: 0,
    compliance: 0,
    operational_stability: 0,
    growth_preparedness: 0,
  };
}

function normalizeCategoryScores(raw: CategoryBreakdown) {
  const maxByCategory: CategoryBreakdown = {
    identity: 20,
    financial_discipline: 20,
    compliance: 20,
    operational_stability: 20,
    growth_preparedness: 20,
  };

  return (Object.keys(raw) as AssessmentCategory[]).reduce((acc, category) => {
    const max = maxByCategory[category];
    acc[category] = Math.max(0, Math.min(20, Math.round((raw[category] / max) * 20)));
    return acc;
  }, initialBreakdown());
}

function applyAutoSignals(score: CategoryBreakdown, signals: AutoSignals): CategoryBreakdown {
  const adjusted = { ...score };

  if (signals.verificationStatus?.toLowerCase().includes("approved")) adjusted.identity += 3;
  if (signals.profileCompletion >= 85) adjusted.identity += 2;

  if (signals.invoicesIssued >= 3) adjusted.financial_discipline += 3;
  if (signals.paymentsRecorded >= 2) adjusted.financial_discipline += 2;

  if (signals.complianceScore !== null) adjusted.compliance += Math.round(Math.max(0, Math.min(2, signals.complianceScore / 50)));
  if (signals.taxProfileStatus?.toLowerCase().includes("compliant")) adjusted.compliance += 2;
  if (signals.vatApplicable !== null) adjusted.compliance += 1;

  if (signals.openComplaints === 0) adjusted.operational_stability += 2;
  if (signals.openComplaints >= 3) adjusted.operational_stability -= 2;

  if (signals.profileCompletion >= 75) adjusted.growth_preparedness += 2;

  (Object.keys(adjusted) as AssessmentCategory[]).forEach((category) => {
    adjusted[category] = Math.max(0, Math.min(20, adjusted[category]));
  });

  return adjusted;
}

function toBand(totalScore: number): ReadinessBand {
  if (totalScore >= 75) return "High";
  if (totalScore >= 50) return "Moderate";
  return "Emerging";
}

export function calculateProfileCompletion(values: {
  businessName?: string | null;
  ownerName?: string | null;
  sector?: string | null;
  state?: string | null;
  tin?: string | null;
  nin?: string | null;
  bvn?: string | null;
  cacNumber?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}) {
  const checks = [
    values.businessName,
    values.ownerName,
    values.sector,
    values.state,
    values.tin,
    values.nin,
    values.bvn,
    values.cacNumber,
    values.contactEmail,
    values.contactPhone,
  ].map((item) => Boolean(item && item.trim()));

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function computeFinanceReadiness(responses: AssessmentResponses, autoSignals: AutoSignals): FinanceReadinessResult {
  const rawBreakdown = initialBreakdown();

  for (const question of FINANCE_READINESS_QUESTIONS) {
    rawBreakdown[question.category] += scoreOption(question.id, responses[question.id] ?? "");
  }

  const normalized = normalizeCategoryScores(rawBreakdown);
  const adjusted = applyAutoSignals(normalized, autoSignals);
  const totalScore = Object.values(adjusted).reduce((sum, value) => sum + value, 0);
  const band = toBand(totalScore);

  const entries = Object.entries(adjusted) as Array<[AssessmentCategory, number]>;
  const sortedDesc = [...entries].sort((a, b) => b[1] - a[1]);
  const sortedAsc = [...entries].sort((a, b) => a[1] - b[1]);

  const strengths = sortedDesc.slice(0, 2).map(([category, value]) => `${prettyCategory(category)} (${value}/20)`);
  const gaps = sortedAsc.slice(0, 2).map(([category, value]) => `${prettyCategory(category)} (${value}/20)`);

  const recommendations = [
    "Update monthly bookkeeping and preserve at least 6 months of records for lender reviews.",
    "Keep tax and compliance filings current and retain acknowledgement receipts.",
    "Document a clear funding use-plan with repayment or return milestones.",
  ];

  const riskFlags: string[] = [];
  if (autoSignals.openComplaints > 0) riskFlags.push(`${autoSignals.openComplaints} unresolved complaint(s) may affect lender confidence.`);
  if (autoSignals.taxProfileStatus && !autoSignals.taxProfileStatus.toLowerCase().includes("compliant")) {
    riskFlags.push("Tax profile shows a non-compliant status.");
  }
  if ((responses.bookkeeping ?? "") !== YES) riskFlags.push("Bookkeeping records are incomplete or inconsistent.");

  return {
    totalScore,
    band,
    breakdown: adjusted,
    strengths,
    gaps,
    recommendations,
    riskFlags,
  };
}

export function prettyCategory(category: AssessmentCategory) {
  const labels: Record<AssessmentCategory, string> = {
    identity: "Identity",
    financial_discipline: "Financial Discipline",
    compliance: "Compliance",
    operational_stability: "Operational Stability",
    growth_preparedness: "Growth Preparedness",
  };

  return labels[category];
}
