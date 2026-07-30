import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";
import {
  createStateRevenueSyntheticBusinesses,
  getStateRevenueLgaMetrics,
  getStateRevenueMetrics,
  STATE_REVENUE_SECTORS,
  type StateRevenueSyntheticBusiness,
} from "@/lib/state-revenue/synthetic-data";

export type EkirsBusiness = StateRevenueSyntheticBusiness;

export type EkirsFilters = {
  q?: string;
  lga?: string;
  sector?: string;
  verification?: string;
  tin?: string;
  formality?: string;
};

export const EKIRS_DEMO_BUSINESSES: EkirsBusiness[] = createStateRevenueSyntheticBusinesses(EKIRS_JURISDICTION);

export function normalizeEkirsFilters(filters: EkirsFilters = {}): Required<EkirsFilters> {
  return {
    q: filters.q?.trim() ?? "",
    lga: filters.lga?.trim() ?? "",
    sector: filters.sector?.trim() ?? "",
    verification: filters.verification?.trim() ?? "",
    tin: filters.tin?.trim() ?? "",
    formality: filters.formality?.trim() ?? "",
  };
}

export function filterEkirsBusinesses(filters: EkirsFilters = {}) {
  const normal = normalizeEkirsFilters(filters);
  const q = normal.q.toLowerCase();
  return EKIRS_DEMO_BUSINESSES.filter((business) => {
    const matchesQ = !q || [business.bin, business.businessName, business.sector, business.lga, business.town].some((value) => value.toLowerCase().includes(q));
    const matchesLga = !normal.lga || business.lga === normal.lga;
    const matchesSector = !normal.sector || business.sector === normal.sector;
    const matchesVerification = !normal.verification || String(business.verificationLevel) === normal.verification;
    const matchesTin = !normal.tin || business.tinLinkageStatus === normal.tin;
    const matchesFormality = !normal.formality || business.formalityStatus === normal.formality;
    return matchesQ && matchesLga && matchesSector && matchesVerification && matchesTin && matchesFormality;
  });
}

export function getEkirsBusiness(idOrBin: string) {
  const decoded = decodeURIComponent(idOrBin);
  return EKIRS_DEMO_BUSINESSES.find((business) => business.id === decoded || business.bin === decoded) ?? null;
}

export function getEkirsMetrics(records: EkirsBusiness[] = EKIRS_DEMO_BUSINESSES) {
  return getStateRevenueMetrics(records);
}

export function getEkirsLgaMetrics(records: EkirsBusiness[] = EKIRS_DEMO_BUSINESSES) {
  return getStateRevenueLgaMetrics(EKIRS_JURISDICTION, records);
}

export const EKIRS_SECTORS = STATE_REVENUE_SECTORS;
