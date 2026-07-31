export type StateRevenueJurisdictionId = "ekiti";

export type StateRevenueLanguage = {
  code: string;
  label: string;
  status: "active" | "foundation_ready" | "pending";
};

export type StateRevenueGeography = {
  state: string;
  stateCode: string;
  constitutionalLgas: string[];
  lcdaStatus: {
    supported: boolean;
    configuredCount: number;
    records: string[];
    note: string;
  };
  towns: string[];
};

export type StateRevenueEligibilitySignal = {
  key: string;
  label: string;
  description: string;
  evidence: string[];
  status: "configured" | "foundation_ready";
};

export type StateRevenueIntegration = {
  key: string;
  name: string;
  category: "identity" | "tax" | "registry" | "payments" | "field" | "communications";
  status: "foundation_ready" | "simulated" | "future";
  description: string;
  liveData: boolean;
};

export type StateRevenueJurisdictionConfig = {
  jurisdictionId: StateRevenueJurisdictionId;
  workspaceId: "ekirs";
  type: "state_revenue_service";
  name: string;
  acronym: string;
  state: string;
  host: string;
  publicRoute: string;
  workspaceRoute: string;
  institutionSlug: string;
  palette: {
    primary: string;
    accent: string;
  };
  languages: StateRevenueLanguage[];
  geography: StateRevenueGeography;
  eligibilitySignals: StateRevenueEligibilitySignal[];
  binPrefix: string;
  verificationLevels: Array<{
    level: number;
    label: string;
    description: string;
  }>;
  modules: string[];
  integrations: StateRevenueIntegration[];
  reporting: {
    liveRevenueMetricsEnabled: false;
    permittedMetrics: string[];
    prohibitedMetrics: string[];
  };
  demonstration: {
    deterministicRecords: number;
    dataClassification: "synthetic_demo";
    disclosure: string;
  };
  privacy: {
    privateFieldsExcluded: string[];
    publicIdentifiers: string[];
  };
  pilot: {
    status: "foundation_ready";
    targetBusinesses: number;
    onboardingMode: "controlled_uat";
    nextGate: string;
  };
  readiness: Array<{
    area: string;
    status: "ready" | "foundation_ready" | "requires_confirmation";
    note: string;
  }>;
  disclaimers: string[];
};

export const EKITI_CONSTITUTIONAL_LGAS = [
  "Ado Ekiti",
  "Efon",
  "Ekiti East",
  "Ekiti South-West",
  "Ekiti West",
  "Emure",
  "Gbonyin",
  "Ido/Osi",
  "Ijero",
  "Ikere",
  "Ikole",
  "Ilejemeje",
  "Irepodun/Ifelodun",
  "Ise/Orun",
  "Moba",
  "Oye",
];

export const EKIRS_JURISDICTION: StateRevenueJurisdictionConfig = {
  jurisdictionId: "ekiti",
  workspaceId: "ekirs",
  type: "state_revenue_service",
  name: "Ekiti State Internal Revenue Service",
  acronym: "EKIRS",
  state: "Ekiti State",
  host: "ekirs.dbin.ng",
  publicRoute: "/ekirs",
  workspaceRoute: "/dashboard/ekirs",
  institutionSlug: "ekiti-state-internal-revenue-service",
  palette: {
    primary: "#0b2d26",
    accent: "#84cc16",
  },
  languages: [
    { code: "en", label: "English", status: "active" },
    { code: "yo", label: "Yoruba", status: "foundation_ready" },
  ],
  geography: {
    state: "Ekiti",
    stateCode: "EK",
    constitutionalLgas: EKITI_CONSTITUTIONAL_LGAS,
    lcdaStatus: {
      supported: true,
      configuredCount: 22,
      records: [],
      // Machine-checkable guardrail for validators and future implementers:
      // do not populate LCDA records until authoritative Ekiti data is confirmed.
      note: "pending_authoritative_confirmation: LCDA support is enabled in the data contract, but individual LCDA records are held pending authoritative confirmation from Ekiti State sources.",
    },
    towns: ["Ado", "Ikere", "Ikole", "Ijero", "Oye", "Iyin", "Aramoko", "Ise", "Emure", "Otun"],
  },
  eligibilitySignals: [
    {
      key: "declared_jurisdiction",
      label: "Declared Ekiti operating jurisdiction",
      description: "The business declares Ekiti as its operating state for formalisation readiness.",
      evidence: ["self declaration", "business address"],
      status: "configured",
    },
    {
      key: "operating_address",
      label: "Operating address and LGA",
      description: "The business records an Ekiti LGA, town, address landmark and optional GPS evidence.",
      evidence: ["address", "LGA", "town", "landmark", "GPS consent"],
      status: "configured",
    },
    {
      key: "supporting_evidence",
      label: "Supporting evidence",
      description: "Consent-backed evidence may include association validation, TIN linkage, field verification or uploaded proof.",
      evidence: ["consent", "association evidence", "TIN status", "field officer note"],
      status: "foundation_ready",
    },
    {
      key: "review_decision",
      label: "Review decision and audit trail",
      description: "Reviewer decisions, suspension reasons and audit events are represented in policy for the future operational workflow.",
      evidence: ["reviewer", "decision", "decision note", "audit event"],
      status: "foundation_ready",
    },
  ],
  binPrefix: "BIN-EK",
  verificationLevels: [
    { level: 0, label: "Self-declared", description: "Business profile exists with self-declared Ekiti operating context." },
    { level: 1, label: "Contact verified", description: "Contact channel and basic business details have been checked." },
    { level: 2, label: "Jurisdiction verified", description: "Operating LGA, address evidence or association context supports Ekiti eligibility." },
    { level: 3, label: "Identity linked", description: "DBIN business identity and optional TIN linkage are ready for institutional review." },
    { level: 4, label: "Field confirmed", description: "A field or officer review confirms readiness for state service workflows." },
  ],
  modules: [
    "Business Registry",
    "Eligibility Review",
    "Formalisation Journey",
    "LGA Intelligence",
    "Integration Catalogue",
    "Operational Readiness",
  ],
  integrations: [
    { key: "dbin_identity", name: "DBIN Business Identity", category: "identity", status: "foundation_ready", description: "Business identity credential linkage and verification history.", liveData: false },
    { key: "tin_linkage", name: "TIN Linkage", category: "tax", status: "simulated", description: "Controlled readiness signal for future TIN status coordination.", liveData: false },
    { key: "cac_reference", name: "CAC Reference", category: "registry", status: "simulated", description: "Business registration evidence readiness for future verified registry integration.", liveData: false },
    { key: "field_verification", name: "Field Verification", category: "field", status: "foundation_ready", description: "Officer review and physical operating-location evidence model.", liveData: false },
    { key: "payment_provider", name: "Payment Service Provider", category: "payments", status: "future", description: "Payment orchestration is reserved for a separately authorised production phase; this workspace does not record collections.", liveData: false },
    { key: "sms_email", name: "SMS and Email Notifications", category: "communications", status: "foundation_ready", description: "Controlled contact and onboarding communication readiness.", liveData: false },
  ],
  reporting: {
    liveRevenueMetricsEnabled: false,
    permittedMetrics: ["business count", "verification level", "TIN linkage status", "record keeping readiness", "support needs", "data quality flags"],
    prohibitedMetrics: ["tax revenue", "collections", "liabilities", "assessments", "debt", "enforcement revenue"],
  },
  demonstration: {
    deterministicRecords: 64,
    dataClassification: "synthetic_demo",
    disclosure: "EKIRS reference records shown in this workspace are controlled synthetic records for authorised UAT and executive review. No taxpayer liability, assessment, payment, collection or live revenue information is included.",
  },
  privacy: {
    privateFieldsExcluded: ["owner names", "phone numbers", "emails", "NIN", "BVN", "private documents", "internal tax notes", "payment information"],
    publicIdentifiers: ["BIN-EK synthetic identifier", "business display name", "LGA", "sector", "verification level"],
  },
  pilot: {
    status: "foundation_ready",
    targetBusinesses: 64,
    onboardingMode: "controlled_uat",
    nextGate: "EKIRS confirmation of UAT users, authoritative LCDA records and approved operating procedures.",
  },
  readiness: [
    { area: "Digital experience", status: "ready", note: "Public, applicant and institutional routes are configured through the DBIN state revenue framework." },
    { area: "Scoped access", status: "foundation_ready", note: "Institution-scoped role assignments are supported for authorised EKIRS users." },
    { area: "Geography", status: "requires_confirmation", note: "The 16 constitutional LGAs are configured. LCDA names remain pending authoritative confirmation." },
    { area: "Integrations", status: "foundation_ready", note: "Integration catalogue is defined without live external credentials or revenue feeds." },
    { area: "Live operations", status: "requires_confirmation", note: "Requires EKIRS approval, UAT accounts and production migration deployment." },
  ],
  disclaimers: [
    "This is a controlled UAT environment for EKIRS review and operational preparation.",
    "No live revenue, assessment, liability or taxpayer payment data is represented.",
    "No federal or state endorsement is implied beyond the configured workspace foundation.",
    "LCDA records require authoritative Ekiti confirmation before operational use.",
  ],
};

export const STATE_REVENUE_JURISDICTIONS = [EKIRS_JURISDICTION] as const;

export function listStateRevenueJurisdictions() {
  return [...STATE_REVENUE_JURISDICTIONS];
}

export function getStateRevenueJurisdiction(jurisdictionId: StateRevenueJurisdictionId) {
  return STATE_REVENUE_JURISDICTIONS.find((jurisdiction) => jurisdiction.jurisdictionId === jurisdictionId) ?? null;
}
