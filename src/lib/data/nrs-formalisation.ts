import type { UserContext } from "@/lib/auth/authorization";
import { canAccessNrsWorkspace } from "@/lib/nrs/access";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type NrsSection =
  | "dashboard"
  | "businesses"
  | "readiness"
  | "intelligence"
  | "revenue-guides"
  | "programmes"
  | "reports"
  | "verification"
  | "integrations";

export type NrsFilters = {
  q?: string;
  state?: string;
  lga?: string;
  sector?: string;
  verification?: string;
  tin?: string;
  stage?: string;
  readiness?: string;
  page?: string;
};

export type NrsBusinessSummary = {
  internalId: string;
  bin: string;
  businessName: string;
  state: string;
  lga: string;
  sector: string;
  category: string;
  verificationStatus: string;
  tinStatus: "linked" | "pending";
  activationStatus: "activated" | "registered";
  formalisationStage: string;
  readinessStatus: string;
  readinessScore: number | null;
  revenueGuideAssignment: string;
  programmeParticipation: string;
  lastSupportActivity: string | null;
  nextAction: string;
};

export type NrsStateMetric = {
  state: string;
  businesses: number;
  activated: number;
  verified: number;
  tinLinked: number;
  formalised: number;
  ready: number;
  revenueGuides: number;
  sectors: string[];
};

export type NrsProgrammeSummary = {
  id: string;
  name: string;
  status: string;
  targetSectors: string[];
  targetStates: number;
  enrolledBusinesses: number;
};

export type NrsFormalisationWorkspace = {
  businesses: NrsBusinessSummary[];
  filteredBusinesses: NrsBusinessSummary[];
  filters: NrsFilters;
  kpis: Array<{ label: string; value: string; detail: string }>;
  stateMetrics: NrsStateMetric[];
  topStates: Array<{ label: string; value: number }>;
  topSectors: Array<{ label: string; value: number }>;
  readinessDistribution: Array<{ label: string; value: number }>;
  guideCoverage: Array<{ label: string; value: number }>;
  programmes: NrsProgrammeSummary[];
  integrations: Array<{ name: string; status: string; purpose: string; consent: string; categories: string[] }>;
  reports: Array<{ title: string; description: string; scope: string }>;
};

type MsmeRow = {
  id: string;
  msme_id: string | null;
  business_name: string | null;
  state: string | null;
  lga: string | null;
  sector: string | null;
  verification_status: string | null;
  tin: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ComplianceProfileRow = {
  msme_id: string | null;
  overall_status: string | null;
  compliance_score: number | null;
  risk_level: string | null;
  next_deadline_at: string | null;
};

const UNAVAILABLE = "Unavailable";

const STATE_ALIASES: Record<string, string> = {
  fct: "Federal Capital Territory",
  "f.c.t": "Federal Capital Territory",
  abuja: "Federal Capital Territory",
  "federal capital territory": "Federal Capital Territory",
  "lagos state": "Lagos",
  "ogun state": "Ogun",
  "kano state": "Kano",
};

export function normalizeNrsState(value: string | null | undefined) {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return UNAVAILABLE;
  const key = cleaned.toLowerCase().replace(/\s+/g, " ");
  return STATE_ALIASES[key] ?? cleaned.replace(/\s+state$/i, "");
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("en-NG") : UNAVAILABLE;
}

function normaliseFilter(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function normalizeNrsFilters(searchParams?: Record<string, string | string[] | undefined>): NrsFilters {
  return {
    q: normaliseFilter(searchParams?.q),
    state: normaliseFilter(searchParams?.state),
    lga: normaliseFilter(searchParams?.lga),
    sector: normaliseFilter(searchParams?.sector),
    verification: normaliseFilter(searchParams?.verification),
    tin: normaliseFilter(searchParams?.tin),
    stage: normaliseFilter(searchParams?.stage),
    readiness: normaliseFilter(searchParams?.readiness),
    page: normaliseFilter(searchParams?.page),
  };
}

async function safeLoad<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

function latestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = value || UNAVAILABLE;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function readinessStatus(params: { verified: boolean; tinLinked: boolean; complianceScore: number | null }) {
  if (params.verified && params.tinLinked && (params.complianceScore ?? 0) >= 70) return "Tax Ready";
  if (params.verified && params.tinLinked) return "Enablement Ready";
  if (params.verified) return "Identity Ready";
  return "Support Required";
}

function formalisationStage(params: { bin: string | null; verified: boolean; tinLinked: boolean; readiness: string }) {
  if (params.readiness === "Tax Ready") return "Tax Ready";
  if (params.tinLinked) return "TIN Linked";
  if (params.verified) return "Identity Verified";
  if (params.bin) return "BIN Issued";
  return "Registered";
}

function nextAction(business: Pick<NrsBusinessSummary, "verificationStatus" | "tinStatus" | "readinessStatus">) {
  if (business.verificationStatus !== "verified") return "Complete business identity verification";
  if (business.tinStatus !== "linked") return "Support TIN linkage";
  if (business.readinessStatus !== "Tax Ready") return "Assign readiness support";
  return "Maintain partner-system readiness";
}

function filterBusinesses(businesses: NrsBusinessSummary[], filters: NrsFilters) {
  const q = filters.q?.toLowerCase();
  return businesses.filter((business) => {
    if (q && ![business.businessName, business.bin, business.state, business.lga, business.sector].join(" ").toLowerCase().includes(q)) return false;
    if (filters.state && business.state !== normalizeNrsState(filters.state)) return false;
    if (filters.lga && business.lga !== filters.lga) return false;
    if (filters.sector && business.sector !== filters.sector) return false;
    if (filters.verification && business.verificationStatus !== filters.verification) return false;
    if (filters.tin && business.tinStatus !== filters.tin) return false;
    if (filters.stage && business.formalisationStage !== filters.stage) return false;
    if (filters.readiness && business.readinessStatus !== filters.readiness) return false;
    return true;
  });
}

export function paginateNrsItems<T>(items: T[], rawPage?: string, pageSize = 12) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const parsed = Number(rawPage);
  const page = Number.isFinite(parsed) ? Math.min(Math.max(1, Math.trunc(parsed)), pageCount) : 1;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageCount,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(items.length, start + pageSize),
  };
}

export async function getNrsFormalisationWorkspace(ctx: UserContext, filters: NrsFilters = {}): Promise<NrsFormalisationWorkspace> {
  if (!canAccessNrsWorkspace(ctx)) {
    return emptyWorkspace(filters);
  }
  const supabase = await createServerSupabaseClient();
  const [msmes, complianceProfiles, programmes] = await Promise.all([
    safeLoad(async () => {
      const { data, error } = await supabase
        .from("msmes")
        .select("id,msme_id,business_name,state,lga,sector,verification_status,tin,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as MsmeRow[];
    }, []),
    safeLoad(async () => {
      const { data, error } = await supabase
        .from("msme_compliance_profiles")
        .select("msme_id,overall_status,compliance_score,risk_level,next_deadline_at")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ComplianceProfileRow[];
    }, []),
    safeLoad(async () => {
      const { data, error } = await supabase
        .from("programmes")
        .select("id,name,status,target_sectors,target_states")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; status: string | null; target_sectors: string[] | null; target_states: string[] | null }>;
    }, []),
  ]);

  const complianceByMsme = new Map(complianceProfiles.map((row) => [row.msme_id, row]));
  const businesses = msmes.map((msme): NrsBusinessSummary => {
    const compliance = complianceByMsme.get(msme.id);
    const score = typeof compliance?.compliance_score === "number" ? compliance.compliance_score : null;
    const verified = msme.verification_status === "verified";
    const tinLinked = Boolean(msme.tin);
    const readiness = readinessStatus({ verified, tinLinked, complianceScore: score });
    const summary = {
      internalId: msme.id,
      bin: msme.msme_id ?? "Pending",
      businessName: msme.business_name ?? "Unnamed business",
      state: normalizeNrsState(msme.state),
      lga: msme.lga ?? UNAVAILABLE,
      sector: msme.sector ?? UNAVAILABLE,
      category: msme.sector ?? UNAVAILABLE,
      verificationStatus: msme.verification_status ?? "pending",
      tinStatus: tinLinked ? "linked" : "pending",
      activationStatus: msme.msme_id ? "activated" : "registered",
      formalisationStage: formalisationStage({ bin: msme.msme_id, verified, tinLinked, readiness }),
      readinessStatus: readiness,
      readinessScore: score,
      revenueGuideAssignment: msme.lga ? `${normalizeNrsState(msme.state)} / ${msme.lga}` : normalizeNrsState(msme.state),
      programmeParticipation: programmes.length ? "Available through programmes" : UNAVAILABLE,
      lastSupportActivity: latestDate([compliance?.next_deadline_at, msme.updated_at, msme.created_at]),
      nextAction: "Maintain partner-system readiness",
    } satisfies NrsBusinessSummary;
    return { ...summary, nextAction: nextAction(summary) };
  });

  const filteredBusinesses = filterBusinesses(businesses, filters);
  const formalised = businesses.filter((item) => item.tinStatus === "linked" && item.verificationStatus === "verified").length;
  const taxReady = businesses.filter((item) => item.readinessStatus === "Tax Ready").length;
  const requiringSupport = businesses.filter((item) => item.nextAction !== "Maintain partner-system readiness").length;
  const states = new Set(businesses.map((item) => item.state).filter((item) => item !== UNAVAILABLE));
  const lgas = new Set(businesses.map((item) => `${item.state}|${item.lga}`).filter((item) => !item.endsWith(`|${UNAVAILABLE}`)));
  const guideCoverage = countBy(businesses.map((item) => item.revenueGuideAssignment));
  const stateMetrics = Array.from(states).map((state) => {
    const stateRows = businesses.filter((item) => item.state === state);
    return {
      state,
      businesses: stateRows.length,
      activated: stateRows.filter((item) => item.activationStatus === "activated").length,
      verified: stateRows.filter((item) => item.verificationStatus === "verified").length,
      tinLinked: stateRows.filter((item) => item.tinStatus === "linked").length,
      formalised: stateRows.filter((item) => item.formalisationStage === "Tax Ready" || item.formalisationStage === "TIN Linked").length,
      ready: stateRows.filter((item) => item.readinessStatus === "Tax Ready" || item.readinessStatus === "Enablement Ready").length,
      revenueGuides: new Set(stateRows.map((item) => item.lga).filter((item) => item !== UNAVAILABLE)).size,
      sectors: [...new Set(stateRows.map((item) => item.sector).filter((item) => item !== UNAVAILABLE))].slice(0, 4),
    };
  }).sort((a, b) => b.businesses - a.businesses);

  return {
    businesses,
    filteredBusinesses,
    filters,
    stateMetrics,
    topStates: countBy(businesses.map((item) => item.state)),
    topSectors: countBy(businesses.map((item) => item.sector)),
    readinessDistribution: countBy(businesses.map((item) => item.readinessStatus)),
    guideCoverage,
    programmes: programmes.map((programme) => ({
      id: programme.id,
      name: programme.name,
      status: programme.status ?? "available",
      targetSectors: programme.target_sectors ?? [],
      targetStates: programme.target_states?.length ?? 0,
      enrolledBusinesses: businesses.length,
    })),
    reports: [
      { title: "National Formalisation Report", description: "Registered, activated, verified, formalised and tax-ready businesses.", scope: "National" },
      { title: "State Formalisation Report", description: "State-level formalisation progress, support gaps and guide coverage.", scope: "State" },
      { title: "Business Readiness Report", description: "Identity, documentation, digital adoption, tax education and partner-system readiness.", scope: "Readiness" },
      { title: "Revenue Guide Performance Report", description: "Guide coverage, assigned businesses, follow-up needs and support outcomes.", scope: "Guide operations" },
      { title: "Executive Formalisation Brief", description: "Leadership summary for formalisation growth, readiness progress and integration readiness.", scope: "Executive" },
    ],
    integrations: [
      { name: "NRS Taxpayer Services", status: "Integration Ready", purpose: "Taxpayer account activation and filing readiness referral.", consent: "Required for partner account linkage", categories: ["BIN", "TIN status", "business identity", "readiness status"] },
      { name: "Digitax / E-Invoicing Partner", status: "Available Through Partnership", purpose: "Partner-owned statutory invoice and e-invoicing workflows.", consent: "Required before data exchange", categories: ["connection status", "onboarding state", "supported purpose"] },
      { name: "CAC", status: "Configuration Required", purpose: "Business registration and company record verification.", consent: "Required for business record checks", categories: ["registration status", "business name", "RC/BN linkage"] },
      { name: "SMEDAN", status: "Integration Ready", purpose: "MSME formalisation and support programme referrals.", consent: "Required for referral", categories: ["business identity", "sector", "state", "support need"] },
      { name: "BOI", status: "Integration Ready", purpose: "Finance readiness and development-finance referral.", consent: "Required for finance referral", categories: ["readiness status", "verification status", "programme eligibility"] },
    ],
    kpis: [
      { label: "Businesses Registered", value: formatNumber(businesses.length), detail: "Business identity records visible to the NRS formalisation workspace" },
      { label: "Businesses Activated", value: formatNumber(businesses.filter((item) => item.activationStatus === "activated").length), detail: "Businesses with an issued BIN or active DBIN identity record" },
      { label: "Businesses Verified", value: formatNumber(businesses.filter((item) => item.verificationStatus === "verified").length), detail: "Identity-confirmed businesses" },
      { label: "Businesses Formalised", value: formatNumber(formalised), detail: "Businesses with verified identity and TIN linkage" },
      { label: "TIN-Linked Businesses", value: formatNumber(businesses.filter((item) => item.tinStatus === "linked").length), detail: "Businesses with a TIN linkage status recorded" },
      { label: "Businesses Tax Ready", value: formatNumber(taxReady), detail: "Readiness signal based on identity, TIN and support posture; not an official tax determination" },
      { label: "Businesses Requiring Support", value: formatNumber(requiringSupport), detail: "Businesses with identity, TIN or readiness support gaps" },
      { label: "Revenue Guides Active", value: formatNumber(guideCoverage.length), detail: "State/LGA enablement coverage inferred from business distribution" },
      { label: "States Covered", value: formatNumber(states.size), detail: "States represented in formalisation records" },
      { label: "LGAs Covered", value: formatNumber(lgas.size), detail: "LGA coverage across business records" },
      { label: "Sectors Represented", value: formatNumber(new Set(businesses.map((item) => item.sector).filter((item) => item !== UNAVAILABLE)).size), detail: "Sector spread across registered businesses" },
      { label: "Partner-System Readiness", value: formatNumber(businesses.filter((item) => item.tinStatus === "linked" && item.verificationStatus === "verified").length), detail: "Businesses ready for consented referral into partner systems" },
    ],
  };
}

function emptyWorkspace(filters: NrsFilters): NrsFormalisationWorkspace {
  return {
    businesses: [],
    filteredBusinesses: [],
    filters,
    kpis: [],
    stateMetrics: [],
    topStates: [],
    topSectors: [],
    readinessDistribution: [],
    guideCoverage: [],
    programmes: [],
    integrations: [],
    reports: [],
  };
}

export async function getNrsBusinessProfile(ctx: UserContext, businessId: string, filters: NrsFilters = {}) {
  const workspace = await getNrsFormalisationWorkspace(ctx, filters);
  const decoded = decodeURIComponent(businessId);
  const business = workspace.businesses.find((item) => item.bin === decoded || item.internalId === decoded) ?? null;
  return { workspace, business };
}
