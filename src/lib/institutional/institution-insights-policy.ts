export const OPERATING_MODELS = ["development_finance", "relationship_mfb", "agent_network_mfb", "non_interest_finance"] as const;
export type OperatingModel = (typeof OPERATING_MODELS)[number];
export const EXPORT_DATASETS = ["portfolio", "agent_delivery", "support_activity"] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];
export const EXPORT_FORMATS = ["csv", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const SUPPORT_PATHWAYS = ["post_finance", "development_return", "continuing_support", "closed"] as const;

export type InstitutionProfileInput = {
  operatingModel: OperatingModel; shortName: string; logoUrl: string | null;
  primaryColor: string; accentColor: string; agentLabelSingular: string; agentLabelPlural: string;
  businessLabelSingular: string; businessLabelPlural: string; diagnosticLabel: string;
  financeLabel: string; supportLabel: string; followUpWarningDays: number; criticalIssueSlaDays: number;
  postFinanceDays: number; developmentReturnDays: number; additionalInformationDays: number;
  defaultFollowUpDays: number; exportFormats: ExportFormat[];
};

const profile = (value: InstitutionProfileInput) => value;
export const OPERATING_PRESETS: Record<OperatingModel, InstitutionProfileInput> = {
  development_finance: profile({ operatingModel: "development_finance", shortName: "BOI", logoUrl: null,
    primaryColor: "#005B5C", accentColor: "#D4A72C", agentLabelSingular: "BDSP", agentLabelPlural: "BDSPs",
    businessLabelSingular: "Enterprise", businessLabelPlural: "Enterprises", diagnosticLabel: "Enterprise diagnostic",
    financeLabel: "Finance readiness", supportLabel: "Enterprise development support", followUpWarningDays: 7,
    criticalIssueSlaDays: 3, postFinanceDays: 180, developmentReturnDays: 90, additionalInformationDays: 30,
    defaultFollowUpDays: 7, exportFormats: ["csv", "json"] }),
  relationship_mfb: profile({ operatingModel: "relationship_mfb", shortName: "MFB", logoUrl: null,
    primaryColor: "#1D4ED8", accentColor: "#F59E0B", agentLabelSingular: "Relationship Officer", agentLabelPlural: "Relationship Officers",
    businessLabelSingular: "Customer", businessLabelPlural: "Customers", diagnosticLabel: "Business assessment",
    financeLabel: "Loan readiness", supportLabel: "Portfolio support", followUpWarningDays: 3,
    criticalIssueSlaDays: 2, postFinanceDays: 90, developmentReturnDays: 45, additionalInformationDays: 14,
    defaultFollowUpDays: 3, exportFormats: ["csv"] }),
  agent_network_mfb: profile({ operatingModel: "agent_network_mfb", shortName: "MFB", logoUrl: null,
    primaryColor: "#7C3AED", accentColor: "#10B981", agentLabelSingular: "Field Agent", agentLabelPlural: "Field Agents",
    businessLabelSingular: "Microenterprise", businessLabelPlural: "Microenterprises", diagnosticLabel: "Field business check",
    financeLabel: "Credit preparation", supportLabel: "Business follow-up", followUpWarningDays: 2,
    criticalIssueSlaDays: 1, postFinanceDays: 60, developmentReturnDays: 30, additionalInformationDays: 7,
    defaultFollowUpDays: 2, exportFormats: ["csv", "json"] }),
  non_interest_finance: profile({ operatingModel: "non_interest_finance", shortName: "Finance Co.", logoUrl: null,
    primaryColor: "#176B3A", accentColor: "#C7A53B", agentLabelSingular: "Business Support Officer", agentLabelPlural: "Business Support Officers",
    businessLabelSingular: "MSME", businessLabelPlural: "MSMEs", diagnosticLabel: "Business and financing assessment",
    financeLabel: "Ethical financing readiness", supportLabel: "Enterprise partnership support", followUpWarningDays: 3,
    criticalIssueSlaDays: 2, postFinanceDays: 120, developmentReturnDays: 60, additionalInformationDays: 14,
    defaultFollowUpDays: 3, exportFormats: ["csv", "json"] }),
};

const text = (value: unknown, min: number, max: number) => typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
const integer = (value: unknown, min: number, max: number) => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
export function validInstitutionProfile(value: unknown): value is InstitutionProfileInput {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return OPERATING_MODELS.includes(item.operatingModel as OperatingModel) && text(item.shortName, 2, 40) &&
    (item.logoUrl === null || item.logoUrl === "" || (text(item.logoUrl, 8, 500) && /^https:\/\//.test(String(item.logoUrl)))) &&
    /^#[0-9A-Fa-f]{6}$/.test(String(item.primaryColor)) && /^#[0-9A-Fa-f]{6}$/.test(String(item.accentColor)) &&
    ["agentLabelSingular","agentLabelPlural","businessLabelSingular","businessLabelPlural"].every(key => text(item[key],2,40)) &&
    ["diagnosticLabel","financeLabel","supportLabel"].every(key => text(item[key],3,80)) &&
    integer(item.followUpWarningDays,1,60) && integer(item.criticalIssueSlaDays,1,30) && integer(item.postFinanceDays,1,730) &&
    integer(item.developmentReturnDays,1,365) && integer(item.additionalInformationDays,1,90) && integer(item.defaultFollowUpDays,1,60) &&
    Array.isArray(item.exportFormats) && item.exportFormats.length >= 1 && item.exportFormats.length <= 2 &&
    item.exportFormats.every(format => EXPORT_FORMATS.includes(format as ExportFormat)) && new Set(item.exportFormats).size === item.exportFormats.length;
}

export function validSupportTemplate(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>; const closed = item.pathway === "closed";
  return SUPPORT_PATHWAYS.includes(item.pathway as typeof SUPPORT_PATHWAYS[number]) && text(item.name,3,120) && text(item.objective,3,2000) &&
    integer(item.targetDays,closed ? 0 : 1,730) && (!closed || item.targetDays === 0) &&
    ((closed && item.followUpDays === null) || (!closed && integer(item.followUpDays,1,60)));
}

export function defaultProfile(institutionType: string, name: string): InstitutionProfileInput {
  const base = institutionType === "development_finance_institution" ? OPERATING_PRESETS.development_finance
    : institutionType === "finance_company" ? OPERATING_PRESETS.non_interest_finance : OPERATING_PRESETS.relationship_mfb;
  return { ...base, shortName: name.length <= 40 ? name : base.shortName, exportFormats: [...base.exportFormats] };
}

export function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  let serialized = Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(serialized)) serialized = `'${serialized}`;
  return /[",\n\r]/.test(serialized) ? `"${serialized.replaceAll('"','""')}"` : serialized;
}

export function rowsToCsv(rows: Record<string, unknown>[]) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  if (!columns.length) return "";
  return [columns.map(csvCell).join(","), ...rows.map(row => columns.map(column => csvCell(row[column])).join(","))].join("\r\n");
}
