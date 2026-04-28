export type FinancePathway = "loan" | "grant" | "investment";

export type FundingAmountRange =
  | "under_500k"
  | "500k_2m"
  | "2m_10m"
  | "10m_50m"
  | "above_50m";

export type ReadinessBand = "Excellent" | "Strong" | "Emerging" | "At Risk";

export type AssessmentResponses = {
  hasBusinessRegistration: boolean;
  hasFormalBankAccount: boolean;
  hasMonthlyRecords: boolean;
  bookkeepingMethod: "none" | "manual" | "spreadsheet" | "software";
  hasCashflowProjection: boolean;
  hasRecentTaxFiling: boolean;
  hasVatRegistration: boolean;
  complianceStatus: "pending" | "partial" | "verified";
  hasOperatingPlan: boolean;
  hasDocumentedProcesses: boolean;
  teamSizeBand: "solo" | "2_5" | "6_20" | "21_plus";
  fundingAmountRange: FundingAmountRange;
  fundingPurpose: string;
  growthPriority: "market_expansion" | "equipment" | "working_capital" | "digital_upgrade" | "hiring";
};

export type MsmeReadinessSnapshot = {
  businessName: string;
  msmeIdLabel: string;
  verificationStatus: string;
  profileCompletion: number;
  complianceStatus: string;
  taxComplianceStatus: string;
  openComplaints: number;
  resolvedComplaints: number;
  invoiceCount: number;
  paymentSuccessRate: number;
};

export type CategoryBreakdown = {
  key: "identity" | "financialDiscipline" | "compliance" | "operationalStability" | "growthPreparedness";
  label: string;
  score: number;
  maxScore: number;
};

export type ReadinessResult = {
  score: number;
  band: ReadinessBand;
  breakdown: CategoryBreakdown[];
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  riskFlags: string[];
};
