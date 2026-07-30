import type { StateRevenueJurisdictionConfig } from "@/lib/state-revenue/jurisdictions";

export type StateRevenueSyntheticBusiness = {
  id: string;
  bin: string;
  businessName: string;
  sector: string;
  lga: string;
  lcda: string | null;
  town: string;
  declaredJurisdiction: string;
  formalityStatus: "formal" | "informal" | "transitioning";
  verificationLevel: 0 | 1 | 2 | 3 | 4;
  eligibilityStatus: "eligible" | "under_review" | "needs_evidence" | "not_eligible";
  tinLinkageStatus: "linked" | "unlinked" | "pending";
  recordKeepingStatus: "paper" | "spreadsheet" | "digital";
  invoicingAdoption: "none" | "basic" | "digital";
  supportNeeds: string[];
  dataQualityFlags: string[];
  consentStatus: "granted" | "pending";
  fieldVerificationStatus: "not_started" | "scheduled" | "completed";
  lastUpdated: string;
  dataClassification: "synthetic_demo";
};

export const STATE_REVENUE_SECTORS = [
  "Retail and Trade",
  "Agro Processing",
  "Hospitality",
  "Fashion and Textiles",
  "Transport and Logistics",
  "Light Manufacturing",
  "Professional Services",
  "Food Processing",
];

const supportNeeds = ["TIN linkage", "Digital record keeping", "Business address evidence", "Invoice setup", "Formal registration guidance", "Field verification"];
const qualityFlags = ["missing landmark", "TIN pending", "address needs review", "duplicate contact check", "sector clarification", "GPS consent pending"];

function pad(value: number) {
  return value.toString().padStart(4, "0");
}

export function createStateRevenueSyntheticBusinesses(config: StateRevenueJurisdictionConfig): StateRevenueSyntheticBusiness[] {
  const towns = config.geography.towns.length ? config.geography.towns : config.geography.constitutionalLgas;

  return Array.from({ length: config.demonstration.deterministicRecords }, (_, index) => {
    const lga = config.geography.constitutionalLgas[index % config.geography.constitutionalLgas.length];
    const verificationLevel = (index % 5) as StateRevenueSyntheticBusiness["verificationLevel"];
    const eligibilityStatus = verificationLevel >= 3
      ? "eligible"
      : index % 7 === 0
        ? "not_eligible"
        : index % 4 === 0
          ? "needs_evidence"
          : "under_review";

    return {
      id: `${config.jurisdictionId}-synthetic-${pad(index + 1)}`,
      bin: `${config.binPrefix}-2026-${pad(index + 1)}`,
      businessName: `${config.geography.state} Enterprise ${pad(index + 1)}`,
      sector: STATE_REVENUE_SECTORS[index % STATE_REVENUE_SECTORS.length],
      lga,
      lcda: null,
      town: towns[index % towns.length],
      declaredJurisdiction: config.geography.state,
      formalityStatus: (["formal", "informal", "transitioning"] as const)[index % 3],
      verificationLevel,
      eligibilityStatus,
      tinLinkageStatus: (["linked", "unlinked", "pending"] as const)[index % 3],
      recordKeepingStatus: (["paper", "spreadsheet", "digital"] as const)[(index + 1) % 3],
      invoicingAdoption: index % 4 === 0 ? "none" : index % 2 === 0 ? "digital" : "basic",
      supportNeeds: [supportNeeds[index % supportNeeds.length], supportNeeds[(index + 2) % supportNeeds.length]],
      dataQualityFlags: index % 5 === 0 ? [qualityFlags[index % qualityFlags.length]] : [],
      consentStatus: index % 6 === 0 ? "pending" : "granted",
      fieldVerificationStatus: verificationLevel >= 4 ? "completed" : index % 3 === 0 ? "scheduled" : "not_started",
      lastUpdated: `2026-07-${String((index % 24) + 1).padStart(2, "0")}`,
      dataClassification: "synthetic_demo",
    };
  });
}

export function getStateRevenueMetrics(records: StateRevenueSyntheticBusiness[]) {
  return {
    totalBusinesses: records.length,
    contactVerified: records.filter((business) => business.verificationLevel >= 1).length,
    jurisdictionVerified: records.filter((business) => business.verificationLevel >= 2).length,
    identityLinked: records.filter((business) => business.verificationLevel >= 3).length,
    fieldConfirmed: records.filter((business) => business.verificationLevel >= 4).length,
    tinLinked: records.filter((business) => business.tinLinkageStatus === "linked").length,
    digitalRecords: records.filter((business) => business.recordKeepingStatus === "digital").length,
    supportRequired: records.filter((business) => business.supportNeeds.length > 0).length,
    dataQualityExceptions: records.reduce((count, business) => count + business.dataQualityFlags.length, 0),
  };
}

export function getStateRevenueLgaMetrics(config: StateRevenueJurisdictionConfig, records: StateRevenueSyntheticBusiness[]) {
  return config.geography.constitutionalLgas.map((lga) => {
    const lgaRecords = records.filter((business) => business.lga === lga);
    return {
      lga,
      total: lgaRecords.length,
      jurisdictionVerified: lgaRecords.filter((business) => business.verificationLevel >= 2).length,
      tinLinked: lgaRecords.filter((business) => business.tinLinkageStatus === "linked").length,
      supportRequired: lgaRecords.filter((business) => business.supportNeeds.length > 0).length,
      qualityFlags: lgaRecords.reduce((count, business) => count + business.dataQualityFlags.length, 0),
    };
  });
}
