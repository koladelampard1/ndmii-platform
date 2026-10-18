export const ONBOARDING_OPERATING_MODELS = ["development_finance", "relationship_mfb", "agent_network_mfb", "non_interest_finance"] as const;
export type OnboardingOperatingModel = (typeof ONBOARDING_OPERATING_MODELS)[number];

export const ONBOARDING_STATUSES = ["configuration", "data_setup", "uat", "ready", "live", "blocked"] as const;
export const CHECK_STATUSES = ["not_started", "passed", "failed", "not_applicable"] as const;
export const IMPORT_TYPES = ["bdsp_organisations", "agents"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];
export const VOLUME_BASES = ["pending_confirmation", "planning_assumption", "institution_confirmed"] as const;
export const OWNER_STATUSES = ["pending_nomination", "nominated", "confirmed"] as const;

const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max;
const integer = (value: unknown, max: number) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;

export function validOnboardingSetup(value: unknown): value is {
  operatingModel: OnboardingOperatingModel; targetGoLiveDate: string | null; expectedAgents: number;
  expectedBusinesses: number; expectedInternalOfficers: number; expectedExternalAgents: number;
  volumeBasis: (typeof VOLUME_BASES)[number]; programmeOwner: string; technicalOwner: string;
} {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ONBOARDING_OPERATING_MODELS.includes(item.operatingModel as OnboardingOperatingModel) &&
    (item.targetGoLiveDate === null || /^\d{4}-\d{2}-\d{2}$/.test(String(item.targetGoLiveDate))) &&
    integer(item.expectedAgents, 100000) && integer(item.expectedBusinesses, 10000000) &&
    integer(item.expectedInternalOfficers, 100000) && integer(item.expectedExternalAgents, 100000) &&
    Number(item.expectedAgents) === Number(item.expectedInternalOfficers) + Number(item.expectedExternalAgents) &&
    VOLUME_BASES.includes(item.volumeBasis as (typeof VOLUME_BASES)[number]) &&
    text(item.programmeOwner, 160) && text(item.technicalOwner, 160);
}

export function validOwnerUpdate(value: unknown): value is {
  ownerId: string; namedOwner: string; ownerEmail: string; status: (typeof OWNER_STATUSES)[number];
} {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const status = item.status as (typeof OWNER_STATUSES)[number];
  const namedOwner = String(item.namedOwner ?? "").trim();
  const email = String(item.ownerEmail ?? "").trim();
  return typeof item.ownerId === "string" && /^[0-9a-f-]{36}$/i.test(item.ownerId) &&
    OWNER_STATUSES.includes(status) && text(namedOwner, 160) && text(email, 254) &&
    (status === "pending_nomination" ? !namedOwner && !email : namedOwner.length >= 2) &&
    (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}
export function validCheckUpdate(value: unknown): value is {
  checkId: string; status: (typeof CHECK_STATUSES)[number]; evidenceNote: string; evidenceUrl: string | null;
} {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.checkId === "string" && /^[0-9a-f-]{36}$/i.test(item.checkId) &&
    CHECK_STATUSES.includes(item.status as (typeof CHECK_STATUSES)[number]) && text(item.evidenceNote, 4000) &&
    (item.evidenceUrl === null || item.evidenceUrl === "" || (text(item.evidenceUrl, 500) && /^https:\/\//.test(String(item.evidenceUrl))));
}
export function parseImportRows(value: unknown, type: ImportType) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) return null;
  const seen = new Set<string>();
  return value.map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const errors: string[] = [];
    const serviceStates = Array.isArray(item.serviceStates)
      ? [...new Set(item.serviceStates.map(String).map((state) => state.trim()).filter(Boolean))] : [];
    if (serviceStates.length > 37 || serviceStates.some((state) => !/^[A-Za-z][A-Za-z\s-]{1,79}$/.test(state))) errors.push("Invalid service states.");
    if (type === "bdsp_organisations") {
      const name = String(item.name ?? "").trim();
      const registrationNumber = String(item.registrationNumber ?? "").trim();
      if (name.length < 2 || name.length > 160) errors.push("Name must contain 2–160 characters.");
      if (registrationNumber.length > 80) errors.push("Registration number is too long.");
      const key = name.toLowerCase(); if (key && seen.has(key)) errors.push("Duplicate name in this import."); seen.add(key);
      return { rowNumber: index + 1, rowData: { name, registrationNumber, serviceStates }, errors };
    }
    const email = String(item.email ?? "").trim().toLowerCase();
    const bdspName = String(item.bdspName ?? "").trim();
    const deliveryType = String(item.deliveryType ?? "external_agent").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.push("Enter a valid email.");
    if (bdspName.length > 160) errors.push("BDSP name is too long.");
    if (!["internal_officer", "external_agent"].includes(deliveryType)) errors.push("Delivery type must be internal_officer or external_agent.");
    if (deliveryType === "internal_officer" && bdspName) errors.push("Internal officers cannot have a partner organisation.");
    if (deliveryType === "external_agent" && !bdspName) errors.push("External agents require a partner organisation.");
    if (email && seen.has(email)) errors.push("Duplicate email in this import."); seen.add(email);
    return { rowNumber: index + 1, rowData: { email, bdspName, deliveryType, serviceStates }, errors };
  });
}

export function parseCsv(textValue: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < textValue.length; index++) {
    const char = textValue[index];
    if (quoted && char === '"' && textValue[index + 1] === '"') { cell += '"'; index++; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && char === ",") { row.push(cell.trim()); cell = ""; continue; }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && textValue[index + 1] === "\n") index++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; continue;
    }
    cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  if (quoted || rows.length < 2) return null;
  const headers = rows[0].map((header) => header.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}
