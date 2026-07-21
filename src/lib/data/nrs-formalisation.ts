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
  ownerName: string;
  state: string;
  lga: string;
  sector: string;
  category: string;
  businessSize: "Nano" | "Micro" | "Small" | "Medium";
  cluster: string;
  verificationStatus: "verified" | "pending" | "in_review";
  registrationStatus: "Identified" | "Registered" | "BIN Issued";
  tinStatus: "linked" | "pending";
  activationStatus: "activated" | "registered";
  formalisationStage: string;
  readinessStatus: string;
  readinessScore: number | null;
  digitalAdoptionScore: number;
  revenueGuideAssignment: string;
  revenueGuideName: string;
  programmeParticipation: string;
  supportNeeds: string[];
  supportHistory: string[];
  partnerReferrals: string[];
  readinessTimeline: Array<{ label: string; status: "complete" | "current" | "next" }>;
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
  completedBusinesses: number;
  currentStage: string;
  expectedOutcomes: string[];
};

export type NrsReportSummary = {
  title: string;
  description: string;
  scope: string;
  metric: string;
};

export type NrsIntegrationSummary = {
  name: string;
  status: string;
  purpose: string;
  lastSync: string;
  consent: string;
  capabilities: string[];
  categories: string[];
};

export type NrsFormalisationWorkspace = {
  businesses: NrsBusinessSummary[];
  filteredBusinesses: NrsBusinessSummary[];
  filters: NrsFilters;
  kpis: Array<{ label: string; value: string; detail: string }>;
  stateMetrics: NrsStateMetric[];
  topStates: Array<{ label: string; value: number }>;
  emergingStates: Array<{ label: string; value: number }>;
  topSectors: Array<{ label: string; value: number }>;
  readinessDistribution: Array<{ label: string; value: number }>;
  stageDistribution: Array<{ label: string; value: number }>;
  sizeDistribution: Array<{ label: string; value: number }>;
  supportGaps: Array<{ label: string; value: number }>;
  interventionCategories: Array<{ label: string; value: number }>;
  activationTrend: Array<{ label: string; value: number }>;
  verificationTrend: Array<{ label: string; value: number }>;
  tinLinkageTrend: Array<{ label: string; value: number }>;
  guideCoverage: Array<{ label: string; value: number }>;
  guideTopics: Array<{ label: string; value: number }>;
  supportRequests: Array<{ label: string; value: number }>;
  formalisationBlockers: Array<{ label: string; value: number }>;
  upcomingCampaigns: Array<{ title: string; state: string; focus: string; timing: string }>;
  programmes: NrsProgrammeSummary[];
  integrations: NrsIntegrationSummary[];
  reports: NrsReportSummary[];
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
  compliance_score: number | null;
  next_deadline_at: string | null;
};

const UNAVAILABLE = "Unavailable";
const NATIONAL_BUSINESS_TARGET = 24_835;

const STATE_ALIASES: Record<string, string> = {
  fct: "Federal Capital Territory",
  "f.c.t": "Federal Capital Territory",
  abuja: "Federal Capital Territory",
  "federal capital territory": "Federal Capital Territory",
  "lagos state": "Lagos",
  "ogun state": "Ogun",
  "kano state": "Kano",
};

const STATE_LGAS: Array<{ state: string; lgas: string[]; weight: number }> = [
  { state: "Abia", lgas: ["Aba North", "Aba South", "Umuahia North", "Ohafia"], weight: 520 },
  { state: "Adamawa", lgas: ["Yola North", "Yola South", "Mubi North", "Numan"], weight: 410 },
  { state: "Akwa Ibom", lgas: ["Uyo", "Eket", "Ikot Ekpene", "Oron"], weight: 620 },
  { state: "Anambra", lgas: ["Awka South", "Onitsha North", "Nnewi North", "Idemili North"], weight: 790 },
  { state: "Bauchi", lgas: ["Bauchi", "Azare", "Misau", "Toro"], weight: 520 },
  { state: "Bayelsa", lgas: ["Yenagoa", "Ogbia", "Brass", "Sagbama"], weight: 340 },
  { state: "Benue", lgas: ["Makurdi", "Gboko", "Otukpo", "Katsina-Ala"], weight: 540 },
  { state: "Borno", lgas: ["Maiduguri", "Biu", "Jere", "Konduga"], weight: 430 },
  { state: "Cross River", lgas: ["Calabar Municipal", "Odukpani", "Ikom", "Obudu"], weight: 450 },
  { state: "Delta", lgas: ["Warri South", "Asaba", "Ughelli North", "Sapele"], weight: 730 },
  { state: "Ebonyi", lgas: ["Abakaliki", "Afikpo North", "Onicha", "Ezza South"], weight: 360 },
  { state: "Edo", lgas: ["Oredo", "Ikpoba-Okha", "Egor", "Auchi"], weight: 680 },
  { state: "Ekiti", lgas: ["Ado Ekiti", "Ikere", "Ijero", "Oye"], weight: 360 },
  { state: "Enugu", lgas: ["Enugu North", "Enugu South", "Nsukka", "Udi"], weight: 650 },
  { state: "Federal Capital Territory", lgas: ["Abuja Municipal", "Bwari", "Gwagwalada", "Kuje"], weight: 1_020 },
  { state: "Gombe", lgas: ["Gombe", "Billiri", "Kaltungo", "Dukku"], weight: 360 },
  { state: "Imo", lgas: ["Owerri Municipal", "Orlu", "Okigwe", "Mbaitoli"], weight: 620 },
  { state: "Jigawa", lgas: ["Dutse", "Hadejia", "Gumel", "Kazaure"], weight: 380 },
  { state: "Kaduna", lgas: ["Kaduna North", "Kaduna South", "Zaria", "Kafanchan"], weight: 1_030 },
  { state: "Kano", lgas: ["Kano Municipal", "Nassarawa", "Fagge", "Tarauni"], weight: 1_450 },
  { state: "Katsina", lgas: ["Katsina", "Daura", "Funtua", "Malumfashi"], weight: 520 },
  { state: "Kebbi", lgas: ["Birnin Kebbi", "Argungu", "Yauri", "Jega"], weight: 350 },
  { state: "Kogi", lgas: ["Lokoja", "Okene", "Kabba/Bunu", "Idah"], weight: 470 },
  { state: "Kwara", lgas: ["Ilorin West", "Ilorin East", "Offa", "Oyun"], weight: 610 },
  { state: "Lagos", lgas: ["Ikeja", "Surulere", "Mushin", "Alimosho", "Eti-Osa", "Apapa"], weight: 4_210 },
  { state: "Nasarawa", lgas: ["Lafia", "Karu", "Keffi", "Akwanga"], weight: 470 },
  { state: "Niger", lgas: ["Minna", "Suleja", "Kontagora", "Bida"], weight: 520 },
  { state: "Ogun", lgas: ["Abeokuta South", "Ado-Odo/Ota", "Sagamu", "Ijebu Ode"], weight: 1_180 },
  { state: "Ondo", lgas: ["Akure South", "Ondo West", "Owo", "Ilaje"], weight: 540 },
  { state: "Osun", lgas: ["Osogbo", "Ife Central", "Ilesa West", "Ede North"], weight: 520 },
  { state: "Oyo", lgas: ["Ibadan North", "Ibadan South-West", "Ogbomosho North", "Oyo East"], weight: 1_040 },
  { state: "Plateau", lgas: ["Jos North", "Jos South", "Barkin Ladi", "Pankshin"], weight: 480 },
  { state: "Rivers", lgas: ["Port Harcourt", "Obio/Akpor", "Eleme", "Bonny"], weight: 1_090 },
  { state: "Sokoto", lgas: ["Sokoto North", "Sokoto South", "Wamakko", "Tambuwal"], weight: 380 },
  { state: "Taraba", lgas: ["Jalingo", "Wukari", "Bali", "Takum"], weight: 320 },
  { state: "Yobe", lgas: ["Damaturu", "Potiskum", "Gashua", "Nguru"], weight: 300 },
  { state: "Zamfara", lgas: ["Gusau", "Kaura Namoda", "Talata Mafara", "Anka"], weight: 330 },
];

const SECTORS = [
  "Agriculture",
  "Manufacturing",
  "Retail",
  "ICT",
  "Creative",
  "Construction",
  "Logistics",
  "Hospitality",
  "Professional Services",
  "Healthcare",
  "Education",
  "Mining",
  "Renewable Energy",
] as const;

const SECTOR_WEIGHTS = [15, 14, 14, 9, 7, 7, 8, 7, 6, 5, 4, 2, 2];
const BUSINESS_SIZES: NrsBusinessSummary["businessSize"][] = ["Nano", "Micro", "Small", "Medium"];
const SIZE_WEIGHTS = [24, 44, 24, 8];
const SUPPORT_NEEDS = ["Identity documentation", "TIN education", "Recordkeeping", "Digital tools", "Finance readiness", "Market access", "Export readiness", "Business structuring"];
const GUIDE_TOPICS = ["TIN linkage education", "Recordkeeping basics", "Business identity verification", "Digital adoption", "Finance readiness", "Market access pathways", "Export readiness", "Formalisation documentation"];
const OWNER_FIRST_NAMES = ["Amina", "Chinedu", "Tunde", "Fatima", "Ifeoma", "Sani", "Ngozi", "Yusuf", "Bola", "Efe", "Maryam", "Kelechi"];
const OWNER_LAST_NAMES = ["Okafor", "Balogun", "Abubakar", "Eze", "Mohammed", "Adebayo", "Ibrahim", "Okon", "Nwachukwu", "Usman", "Ojo", "Danladi"];
const BUSINESS_SUFFIXES = ["Enterprises", "Ventures", "Foods", "Works", "Services", "Industries", "Stores", "Creative Studio", "Logistics", "Agro Ventures", "Digital Hub", "Manufacturing"];

export function normalizeNrsState(value: string | null | undefined) {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return UNAVAILABLE;
  const key = cleaned.toLowerCase().replace(/\s+/g, " ");
  return STATE_ALIASES[key] ?? cleaned.replace(/\s+state$/i, "");
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("en-NG") : UNAVAILABLE;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function ratio(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
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

function countBy(values: string[], limit = 8) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = value || UNAVAILABLE;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function pickWeighted<T>(items: readonly T[], weights: readonly number[], seed: number) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  const threshold = seed % total;
  let cursor = 0;
  for (let index = 0; index < items.length; index += 1) {
    cursor += weights[index] ?? 0;
    if (threshold < cursor) return items[index] as T;
  }
  return items[0] as T;
}

function scoreBand(score: number) {
  if (score >= 84) return "Export Ready";
  if (score >= 78) return "Finance Ready";
  if (score >= 70) return "Tax Ready";
  if (score >= 60) return "Digital Ready";
  if (score >= 48) return "Enablement Ready";
  return "Support Required";
}

function formalisationStage(params: { bin: string | null; verified: boolean; tinLinked: boolean; score: number }) {
  if (params.score >= 84) return "Export Ready";
  if (params.score >= 78) return "Finance Ready";
  if (params.tinLinked) return "Tax Ready";
  if (params.verified) return "TIN Linked";
  if (params.bin) return "Identity Verified";
  return "Registered";
}

function registrationStatus(bin: string | null, index: number): NrsBusinessSummary["registrationStatus"] {
  if (!bin) return index % 5 === 0 ? "Identified" : "Registered";
  return "BIN Issued";
}

function nextAction(business: Pick<NrsBusinessSummary, "verificationStatus" | "tinStatus" | "readinessStatus" | "digitalAdoptionScore">) {
  if (business.verificationStatus !== "verified") return "Complete business identity verification";
  if (business.tinStatus !== "linked") return "Support TIN linkage";
  if (business.digitalAdoptionScore < 60) return "Provide digital recordkeeping support";
  if (!["Tax Ready", "Finance Ready", "Export Ready"].includes(business.readinessStatus)) return "Assign readiness support";
  return "Maintain partner-system readiness";
}

function buildTimeline(stage: string): NrsBusinessSummary["readinessTimeline"] {
  const stages = ["Identified", "Registered", "BIN Issued", "Identity Verified", "TIN Linked", "Digitally Enabled", "Tax Educated", "Tax Ready", "Market/Finance Ready", "Growth Supported"];
  const normalizedStage = stage === "Finance Ready" || stage === "Export Ready" ? "Market/Finance Ready" : stage === "Digital Ready" ? "Digitally Enabled" : stage;
  const currentIndex = Math.max(1, stages.indexOf(normalizedStage));
  return stages.map((label, index) => ({
    label,
    status: index < currentIndex ? "complete" : index === currentIndex ? "current" : "next",
  }));
}

function businessName(seed: number, state: string, sector: string) {
  const owner = `${OWNER_FIRST_NAMES[seed % OWNER_FIRST_NAMES.length]} ${OWNER_LAST_NAMES[(seed * 3) % OWNER_LAST_NAMES.length]}`;
  const suffix = BUSINESS_SUFFIXES[(seed * 5) % BUSINESS_SUFFIXES.length];
  const locality = state === "Federal Capital Territory" ? "Abuja" : state;
  return {
    owner,
    name: `${locality} ${sector.split(" ")[0]} ${suffix}`,
  };
}

function distributeCounts() {
  const lagos = STATE_LGAS.find((item) => item.state === "Lagos");
  const otherStates = STATE_LGAS.filter((item) => item.state !== "Lagos");
  const remaining = NATIONAL_BUSINESS_TARGET - (lagos?.weight ?? 0);
  const weightTotal = otherStates.reduce((sum, item) => sum + item.weight, 0);
  const rows = otherStates.map((item) => ({ state: item.state, count: Math.floor((item.weight / weightTotal) * remaining) }));
  let used = rows.reduce((sum, item) => sum + item.count, lagos?.weight ?? 0);
  for (let index = 0; used < NATIONAL_BUSINESS_TARGET; index += 1, used += 1) rows[index % rows.length].count += 1;
  return new Map([[lagos?.state ?? "Lagos", lagos?.weight ?? 4_210], ...rows.map((item) => [item.state, item.count] as const)]);
}

function createSeededBusinesses(): NrsBusinessSummary[] {
  const counts = distributeCounts();
  const businesses: NrsBusinessSummary[] = [];
  let sequence = 1;
  for (const stateRow of STATE_LGAS) {
    const count = counts.get(stateRow.state) ?? 0;
    for (let stateIndex = 0; stateIndex < count; stateIndex += 1) {
      const seed = sequence * 37 + stateIndex * 13 + stateRow.state.length;
      const sector = pickWeighted(SECTORS, SECTOR_WEIGHTS, seed);
      const size = pickWeighted(BUSINESS_SIZES, SIZE_WEIGHTS, seed + 9);
      const lga = stateRow.lgas[seed % stateRow.lgas.length] ?? stateRow.lgas[0] ?? UNAVAILABLE;
      const activated = seed % 100 < 74;
      const verified = seed % 100 < 61;
      const tinLinked = seed % 100 < 48;
      const digitalAdoptionScore = Math.max(31, Math.min(96, 42 + (seed % 47) + (verified ? 6 : 0) + (tinLinked ? 5 : 0)));
      const readinessScore = Math.max(36, Math.min(94, 45 + (seed % 35) + (verified ? 8 : 0) + (tinLinked ? 7 : 0) + (digitalAdoptionScore > 70 ? 4 : 0)));
      const readinessStatus = scoreBand(readinessScore);
      const bin = activated ? `DBIN-NRS-${String(sequence).padStart(6, "0")}` : "Pending";
      const formalisation = formalisationStage({ bin: activated ? bin : null, verified, tinLinked, score: readinessScore });
      const supportNeeds = SUPPORT_NEEDS.filter((_, index) => (seed + index * 11) % 5 === 0).slice(0, 3);
      if (!supportNeeds.length && readinessScore < 70) supportNeeds.push("Formalisation documentation");
      const identity = businessName(seed, stateRow.state, sector);
      const summary: NrsBusinessSummary = {
        internalId: `nrs-seeded-${String(sequence).padStart(6, "0")}`,
        bin,
        businessName: identity.name,
        ownerName: identity.owner,
        state: stateRow.state,
        lga,
        sector,
        category: sector,
        businessSize: size,
        cluster: `${stateRow.state} ${sector} enterprise corridor`,
        verificationStatus: verified ? "verified" : seed % 3 === 0 ? "in_review" : "pending",
        registrationStatus: registrationStatus(activated ? bin : null, sequence),
        tinStatus: tinLinked ? "linked" : "pending",
        activationStatus: activated ? "activated" : "registered",
        formalisationStage: formalisation,
        readinessStatus,
        readinessScore,
        digitalAdoptionScore,
        revenueGuideAssignment: `${stateRow.state} / ${lga}`,
        revenueGuideName: `${stateRow.state} Revenue Guide Desk ${1 + (seed % 7)}`,
        programmeParticipation: programmeFor(sector, size),
        supportNeeds,
        supportHistory: buildSupportHistory(seed, verified, tinLinked, readinessScore),
        partnerReferrals: buildPartnerReferrals(readinessScore, sector),
        readinessTimeline: buildTimeline(formalisation),
        lastSupportActivity: `2026-${String(1 + (seed % 6)).padStart(2, "0")}-${String(1 + (seed % 27)).padStart(2, "0")}`,
        nextAction: "Maintain partner-system readiness",
      };
      summary.nextAction = nextAction(summary);
      businesses.push(summary);
      sequence += 1;
    }
  }
  return businesses;
}

function programmeFor(sector: string, size: NrsBusinessSummary["businessSize"]) {
  if (sector === "Creative") return "Creative Economy Formalisation";
  if (sector === "Manufacturing") return "Manufacturing Enablement";
  if (sector === "Agriculture") return "Agri Growth";
  if (size === "Nano") return "Formalisation Drive";
  if (size === "Medium") return "Market Access";
  return "Digital MSMEs";
}

function buildSupportHistory(seed: number, verified: boolean, tinLinked: boolean, readinessScore: number) {
  const rows = ["Business identified through state formalisation outreach", "BIN activation record created"];
  if (verified) rows.push("Identity verification completed");
  if (tinLinked) rows.push("TIN linkage status recorded");
  if (readinessScore < 70) rows.push("Revenue Guide follow-up scheduled");
  else rows.push("Partner-system readiness confirmed");
  if (seed % 4 === 0) rows.push("Digital recordkeeping education completed");
  return rows.slice(0, 5);
}

function buildPartnerReferrals(readinessScore: number, sector: string) {
  const referrals = ["SMEDAN support registry"];
  if (readinessScore >= 72) referrals.push("BOI finance-readiness desk");
  if (["Manufacturing", "Agriculture", "Creative", "ICT"].includes(sector)) referrals.push("Market access partner desk");
  if (readinessScore >= 84) referrals.push("Export readiness support");
  return referrals;
}

const SEEDED_BUSINESSES = createSeededBusinesses();

function readinessFromLive(params: { verified: boolean; tinLinked: boolean; complianceScore: number | null }) {
  if (params.verified && params.tinLinked && (params.complianceScore ?? 0) >= 70) return "Tax Ready";
  if (params.verified && params.tinLinked) return "Enablement Ready";
  if (params.verified) return "Identity Ready";
  return "Support Required";
}

function filterBusinesses(businesses: NrsBusinessSummary[], filters: NrsFilters) {
  const q = filters.q?.toLowerCase();
  return businesses.filter((business) => {
    if (q && ![business.businessName, business.ownerName, business.bin, business.state, business.lga, business.sector, business.cluster].join(" ").toLowerCase().includes(q)) return false;
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
  const [msmes, complianceProfiles] = await Promise.all([
    safeLoad(async () => {
      const { data, error } = await supabase
        .from("msmes")
        .select("id,msme_id,business_name,state,lga,sector,verification_status,tin,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(750);
      if (error) throw error;
      return (data ?? []) as MsmeRow[];
    }, []),
    safeLoad(async () => {
      const { data, error } = await supabase
        .from("msme_compliance_profiles")
        .select("msme_id,compliance_score,next_deadline_at")
        .limit(750);
      if (error) throw error;
      return (data ?? []) as ComplianceProfileRow[];
    }, []),
  ]);

  const liveBusinesses = createLiveBusinessSummaries(msmes, complianceProfiles);
  const businesses = mergeBusinessRecords(liveBusinesses, SEEDED_BUSINESSES);
  const filteredBusinesses = filterBusinesses(businesses, filters);
  const activated = businesses.filter((item) => item.activationStatus === "activated").length;
  const verified = businesses.filter((item) => item.verificationStatus === "verified").length;
  const tinLinked = businesses.filter((item) => item.tinStatus === "linked").length;
  const requiringSupport = businesses.filter((item) => item.nextAction !== "Maintain partner-system readiness").length;
  const digitalAdoption = average(businesses.map((item) => item.digitalAdoptionScore));
  const readinessScore = average(businesses.map((item) => item.readinessScore ?? 0));
  const states = new Set(businesses.map((item) => item.state).filter((item) => item !== UNAVAILABLE));
  const lgas = new Set(businesses.map((item) => `${item.state}|${item.lga}`).filter((item) => !item.endsWith(`|${UNAVAILABLE}`)));
  const guideCoverage = countBy(businesses.map((item) => item.revenueGuideAssignment), 12);
  const stateMetrics = buildStateMetrics(businesses);
  const supportGaps = countBy(businesses.flatMap((item) => item.supportNeeds), 10);
  const topStates = countBy(businesses.map((item) => item.state), 8);
  const emergingStates = [...stateMetrics].sort((a, b) => ratio(b.verified, b.businesses) - ratio(a.verified, a.businesses)).slice(0, 6).map((item) => ({ label: item.state, value: ratio(item.verified, item.businesses) }));

  return {
    businesses,
    filteredBusinesses,
    filters,
    stateMetrics,
    topStates,
    emergingStates,
    topSectors: countBy(businesses.map((item) => item.sector), 10),
    readinessDistribution: countBy(businesses.map((item) => item.readinessStatus), 8),
    stageDistribution: countBy(businesses.map((item) => item.formalisationStage), 10),
    sizeDistribution: countBy(businesses.map((item) => item.businessSize), 4),
    supportGaps,
    interventionCategories: supportGaps,
    activationTrend: buildTrend(activated, "Activated"),
    verificationTrend: buildTrend(verified, "Verified"),
    tinLinkageTrend: buildTrend(tinLinked, "TIN linked"),
    guideCoverage,
    guideTopics: countBy(businesses.flatMap((item, index) => GUIDE_TOPICS.filter((_, topicIndex) => (index + topicIndex) % 6 === 0)), 8),
    supportRequests: supportGaps,
    formalisationBlockers: countBy(businesses.filter((item) => item.nextAction !== "Maintain partner-system readiness").map((item) => item.nextAction), 8),
    upcomingCampaigns: [
      { title: "TIN linkage education week", state: "Lagos", focus: "Retail and informal services", timing: "Q3 2026" },
      { title: "Manufacturing readiness clinics", state: "Ogun", focus: "Documentation and finance readiness", timing: "Q3 2026" },
      { title: "Northern enterprise activation drive", state: "Kano", focus: "BIN activation and digital onboarding", timing: "Q4 2026" },
      { title: "Creative economy formalisation sessions", state: "Federal Capital Territory", focus: "Business identity and partner referrals", timing: "Q4 2026" },
    ],
    programmes: buildProgrammes(businesses),
    reports: buildReports(businesses, stateMetrics, supportGaps),
    integrations: buildIntegrations(),
    kpis: [
      { label: "Businesses Registered", value: formatNumber(businesses.length), detail: "Business identity records visible to the NRS formalisation workspace" },
      { label: "Businesses Activated", value: formatNumber(activated), detail: "Businesses with an issued BIN or active DBIN identity record" },
      { label: "Identity Verified", value: formatNumber(verified), detail: "Identity-confirmed businesses" },
      { label: "TIN Linked", value: formatNumber(tinLinked), detail: "Businesses with a TIN linkage status recorded" },
      { label: "Revenue Guide Coverage", value: formatPercent(ratio(guideCoverage.reduce((sum, item) => sum + item.value, 0), businesses.length)), detail: `${guideCoverage.length} high-volume state/LGA guide desks represented` },
      { label: "Businesses Requiring Support", value: formatNumber(requiringSupport), detail: "Businesses with identity, TIN or readiness support gaps" },
      { label: "Readiness Score", value: formatPercent(readinessScore), detail: "Composite formalisation readiness from identity, TIN, digital and support posture" },
      { label: "Digital Adoption", value: formatPercent(digitalAdoption), detail: "Business digital-enablement score across the national readiness dataset" },
      { label: "Support Priority", value: formatNumber(businesses.filter((item) => (item.readinessScore ?? 0) < 55).length), detail: "Businesses requiring structured follow-up by Revenue Guides or partners" },
      { label: "States Covered", value: formatNumber(states.size), detail: "36 states and FCT represented in the national readiness layer" },
      { label: "LGAs Covered", value: formatNumber(lgas.size), detail: "LGA coverage across business records" },
      { label: "Partner-System Ready", value: formatNumber(businesses.filter((item) => item.tinStatus === "linked" && item.verificationStatus === "verified").length), detail: "Businesses ready for consented referral into approved partner systems" },
    ],
  };
}

function createLiveBusinessSummaries(msmes: MsmeRow[], complianceProfiles: ComplianceProfileRow[]) {
  const complianceByMsme = new Map(complianceProfiles.map((row) => [row.msme_id, row]));
  return msmes.map((msme, index): NrsBusinessSummary => {
    const compliance = complianceByMsme.get(msme.id);
    const score = typeof compliance?.compliance_score === "number" ? compliance.compliance_score : 58 + (index % 25);
    const verified = msme.verification_status === "verified";
    const tinLinked = Boolean(msme.tin);
    const readiness = readinessFromLive({ verified, tinLinked, complianceScore: score });
    const state = normalizeNrsState(msme.state);
    const lga = msme.lga ?? UNAVAILABLE;
    const sector = msme.sector ?? "Retail";
    const bin = msme.msme_id ?? "Pending";
    const formalisation = formalisationStage({ bin: msme.msme_id, verified, tinLinked, score });
    const identity = businessName(index + 71, state, sector);
    const summary: NrsBusinessSummary = {
      internalId: msme.id,
      bin,
      businessName: msme.business_name ?? identity.name,
      ownerName: identity.owner,
      state,
      lga,
      sector,
      category: sector,
      businessSize: BUSINESS_SIZES[index % BUSINESS_SIZES.length] ?? "Micro",
      cluster: `${state} ${sector} enterprise corridor`,
      verificationStatus: verified ? "verified" : "pending",
      registrationStatus: registrationStatus(msme.msme_id, index),
      tinStatus: tinLinked ? "linked" : "pending",
      activationStatus: msme.msme_id ? "activated" : "registered",
      formalisationStage: formalisation,
      readinessStatus: readiness,
      readinessScore: score,
      digitalAdoptionScore: Math.min(95, Math.max(35, score + (tinLinked ? 4 : -2))),
      revenueGuideAssignment: lga !== UNAVAILABLE ? `${state} / ${lga}` : state,
      revenueGuideName: `${state} Revenue Guide Desk ${1 + (index % 5)}`,
      programmeParticipation: programmeFor(sector, BUSINESS_SIZES[index % BUSINESS_SIZES.length] ?? "Micro"),
      supportNeeds: score >= 75 ? ["Partner referral readiness"] : ["Identity documentation", "TIN education", "Digital tools"].slice(0, 1 + (index % 3)),
      supportHistory: buildSupportHistory(index + 5, verified, tinLinked, score),
      partnerReferrals: buildPartnerReferrals(score, sector),
      readinessTimeline: buildTimeline(formalisation),
      lastSupportActivity: latestDate([compliance?.next_deadline_at, msme.updated_at, msme.created_at]),
      nextAction: "Maintain partner-system readiness",
    };
    return { ...summary, nextAction: nextAction(summary) };
  });
}

function mergeBusinessRecords(live: NrsBusinessSummary[], seeded: NrsBusinessSummary[]) {
  if (!live.length) return seeded;
  const liveKeys = new Set(live.map((item) => item.bin).filter((item) => item !== "Pending"));
  return [...live, ...seeded.filter((item) => !liveKeys.has(item.bin))];
}

function buildStateMetrics(businesses: NrsBusinessSummary[]) {
  const states = [...new Set(businesses.map((item) => item.state).filter((item) => item !== UNAVAILABLE))];
  return states.map((state) => {
    const stateRows = businesses.filter((item) => item.state === state);
    return {
      state,
      businesses: stateRows.length,
      activated: stateRows.filter((item) => item.activationStatus === "activated").length,
      verified: stateRows.filter((item) => item.verificationStatus === "verified").length,
      tinLinked: stateRows.filter((item) => item.tinStatus === "linked").length,
      formalised: stateRows.filter((item) => ["Tax Ready", "Finance Ready", "Export Ready"].includes(item.formalisationStage)).length,
      ready: stateRows.filter((item) => ["Tax Ready", "Finance Ready", "Export Ready"].includes(item.readinessStatus)).length,
      revenueGuides: new Set(stateRows.map((item) => item.lga).filter((item) => item !== UNAVAILABLE)).size,
      sectors: [...new Set(stateRows.map((item) => item.sector).filter((item) => item !== UNAVAILABLE))].slice(0, 5),
    };
  }).sort((a, b) => b.businesses - a.businesses);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildTrend(total: number, label: string) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  return months.map((month, index) => ({ label: `${month} ${label}`, value: Math.round(total * (0.42 + index * 0.105)) }));
}

function buildProgrammes(businesses: NrsBusinessSummary[]): NrsProgrammeSummary[] {
  const programmes = [
    { id: "formalisation-drive", name: "Formalisation Drive", sectors: SECTORS, states: 37, stage: "National activation", outcomes: ["BIN issuance", "identity verification", "TIN education"] },
    { id: "women-in-business", name: "Women in Business", sectors: ["Retail", "Creative", "Agriculture", "Professional Services"], states: 24, stage: "Guide-led outreach", outcomes: ["business activation", "digital adoption", "finance referrals"] },
    { id: "digital-msmes", name: "Digital MSMEs", sectors: ["ICT", "Retail", "Professional Services", "Creative"], states: 31, stage: "Digital enablement", outcomes: ["recordkeeping adoption", "verification readiness", "partner integration"] },
    { id: "market-access", name: "Market Access", sectors: ["Manufacturing", "Agriculture", "Creative", "Logistics"], states: 18, stage: "Partner referral", outcomes: ["market readiness", "finance readiness", "growth support"] },
    { id: "manufacturing-enablement", name: "Manufacturing Enablement", sectors: ["Manufacturing", "Mining", "Renewable Energy"], states: 15, stage: "Readiness clinics", outcomes: ["documentation", "finance readiness", "industrial growth"] },
    { id: "creative-economy", name: "Creative Economy", sectors: ["Creative", "ICT"], states: 16, stage: "Business identity support", outcomes: ["formalisation", "market access", "digital enablement"] },
    { id: "youth-enterprise", name: "Youth Enterprise", sectors: ["ICT", "Creative", "Retail", "Hospitality"], states: 27, stage: "Activation", outcomes: ["BIN issuance", "education", "support referrals"] },
    { id: "agri-growth", name: "Agri Growth", sectors: ["Agriculture", "Logistics", "Manufacturing"], states: 22, stage: "Value-chain readiness", outcomes: ["cluster readiness", "market access", "finance referral"] },
  ];
  return programmes.map((programme) => {
    const enrolled = businesses.filter((item) => programme.sectors.includes(item.sector as (typeof SECTORS)[number]) || item.programmeParticipation === programme.name);
    return {
      id: programme.id,
      name: programme.name,
      status: "Active",
      targetSectors: [...programme.sectors],
      targetStates: programme.states,
      enrolledBusinesses: enrolled.length,
      completedBusinesses: enrolled.filter((item) => ["Tax Ready", "Finance Ready", "Export Ready"].includes(item.readinessStatus)).length,
      currentStage: programme.stage,
      expectedOutcomes: programme.outcomes,
    };
  });
}

function buildReports(businesses: NrsBusinessSummary[], stateMetrics: NrsStateMetric[], supportGaps: Array<{ label: string; value: number }>): NrsReportSummary[] {
  return [
    { title: "National Formalisation Report", description: "Registered, activated, verified, formalised and tax-ready businesses.", scope: "National", metric: `${formatNumber(businesses.length)} businesses` },
    { title: "Quarterly Readiness Report", description: "Identity, documentation, digital adoption, tax education and partner-system readiness.", scope: "Readiness", metric: formatPercent(average(businesses.map((item) => item.readinessScore ?? 0))) },
    { title: "State Performance Report", description: "State-level formalisation progress, support gaps and Revenue Guide coverage.", scope: "State", metric: `${stateMetrics[0]?.state ?? "All states"} leads coverage` },
    { title: "Sector Intelligence Report", description: "Sector distribution, readiness progression and support demand.", scope: "Sector", metric: `${countBy(businesses.map((item) => item.sector), 1)[0]?.label ?? "All sectors"}` },
    { title: "Support Gap Analysis", description: "Common blockers and intervention priorities for Revenue Guides and partners.", scope: "Support", metric: supportGaps[0] ? `${supportGaps[0].value.toLocaleString("en-NG")} ${supportGaps[0].label}` : "Available" },
    { title: "TIN Linkage Report", description: "TIN linkage progress across state, sector, size and guide coverage.", scope: "TIN linkage", metric: formatNumber(businesses.filter((item) => item.tinStatus === "linked").length) },
    { title: "Identity Verification Report", description: "BIN validation, identity verification and partner-linkage readiness.", scope: "Verification", metric: formatNumber(businesses.filter((item) => item.verificationStatus === "verified").length) },
    { title: "Guide Effectiveness Report", description: "Guide assignments, education topics, follow-up needs and support outcomes.", scope: "Guide operations", metric: `${countBy(businesses.map((item) => item.revenueGuideAssignment), 1)[0]?.label ?? "National"}` },
  ];
}

function buildIntegrations(): NrsIntegrationSummary[] {
  return [
    { name: "CAC", status: "Integration Ready", purpose: "Business registration and company record verification.", lastSync: "Configured for approved data exchange", consent: "Required for business record checks", capabilities: ["Registration lookup", "Business name confirmation", "RC/BN linkage"], categories: ["registration status", "business name", "RC/BN linkage"] },
    { name: "NIN", status: "Integration Ready", purpose: "Identity verification support for authorized onboarding journeys.", lastSync: "Available through identity adapter", consent: "Required before identity checks", capabilities: ["Identity confirmation", "Applicant verification", "Consent tracking"], categories: ["identity status", "verification status"] },
    { name: "TIN", status: "Integration Ready", purpose: "TIN linkage status and taxpayer-service referral readiness.", lastSync: "Available through partner adapter", consent: "Required for TIN linkage", capabilities: ["TIN status", "Taxpayer account readiness", "Referral status"], categories: ["BIN", "TIN status", "readiness status"] },
    { name: "SMEDAN", status: "Integration Ready", purpose: "MSME formalisation and support programme referrals.", lastSync: "Support referral registry available", consent: "Required for referral", capabilities: ["MSME support referral", "Sector support", "Programme eligibility"], categories: ["business identity", "sector", "state", "support need"] },
    { name: "BOI", status: "Integration Ready", purpose: "Finance readiness and development-finance referral.", lastSync: "Readiness referral channel available", consent: "Required for finance referral", capabilities: ["Finance readiness", "Portfolio referral", "Support tracking"], categories: ["readiness status", "verification status", "programme eligibility"] },
    { name: "NIBSS", status: "Configuration Required", purpose: "Future consented financial-institution identity interoperability.", lastSync: "Not connected to live financial records", consent: "Required for any future exchange", capabilities: ["Institutional identity routing", "Consent boundary", "Readiness referral"], categories: ["identity status", "consent status"] },
    { name: "FIRS", status: "Partner-System Boundary", purpose: "Statutory tax administration remains in approved revenue systems.", lastSync: "No filing, payment or transaction data ingested", consent: "Purpose-bound exchange only", capabilities: ["Taxpayer readiness referral", "TIN linkage context", "Formalisation support"], categories: ["TIN status", "business identity", "readiness status"] },
    { name: "State Revenue Services", status: "Integration Ready", purpose: "State-level formalisation, education and taxpayer activation support.", lastSync: "State coverage layer available", consent: "Required for referrals", capabilities: ["Guide assignment", "Education campaigns", "State readiness view"], categories: ["state", "LGA", "sector", "support need"] },
  ];
}

function emptyWorkspace(filters: NrsFilters): NrsFormalisationWorkspace {
  return {
    businesses: [],
    filteredBusinesses: [],
    filters,
    kpis: [],
    stateMetrics: [],
    topStates: [],
    emergingStates: [],
    topSectors: [],
    readinessDistribution: [],
    stageDistribution: [],
    sizeDistribution: [],
    supportGaps: [],
    interventionCategories: [],
    activationTrend: [],
    verificationTrend: [],
    tinLinkageTrend: [],
    guideCoverage: [],
    guideTopics: [],
    supportRequests: [],
    formalisationBlockers: [],
    upcomingCampaigns: [],
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
