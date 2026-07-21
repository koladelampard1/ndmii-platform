import type { UserContext } from "@/lib/auth/authorization";
import {
  getExecutiveDashboardMetrics,
  getImpactAssessmentDetail,
  getImpactProgrammeDetail,
  listAssessmentTemplates,
  listFieldVisits,
  listImpactAssessments,
  listImpactCohortMemberOptions,
  listImpactCohorts,
  listImpactInterventions,
  listImpactProgrammes,
  listIntelligenceFeed,
  type ImpactAssessment,
  type ImpactAssessmentTemplate,
  type ImpactBeneficiaryCohort,
  type ImpactCohortMember,
  type ImpactFieldVisit,
  type ImpactIntervention,
  type ImpactProgramme,
} from "@/lib/data/impact-intelligence";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import { listInstitutionalReports, type InstitutionalReport } from "@/lib/data/impact-reports";

export type BoiSectionSlug =
  | "businesses"
  | "business-pipeline"
  | "funding-programmes"
  | "funding-pipeline"
  | "readiness"
  | "investment-readiness"
  | "documents"
  | "portfolio"
  | "portfolio-monitoring"
  | "monitoring"
  | "intelligence"
  | "portfolio-intelligence"
  | "reports"
  | "risk"
  | "risk-signals"
  | "executive";

export type BoiCanonicalSection =
  | "businesses"
  | "funding-programmes"
  | "funding-pipeline"
  | "readiness"
  | "documents"
  | "portfolio"
  | "monitoring"
  | "intelligence"
  | "reports"
  | "risk"
  | "executive";

export type BoiSectionConfig = {
  slug: BoiCanonicalSection;
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

export type BoiSearchParams = {
  q?: string;
  state?: string;
  sector?: string;
  status?: string;
  readiness?: string;
  stage?: string;
  risk?: string;
  page?: string;
};

export type BoiPipelineBusiness = {
  memberId: string;
  msmeId: string | null;
  businessName: string;
  bin: string;
  sector: string;
  state: string;
  verificationStatus: string;
  readinessStatus: string;
  readinessScore: number | null;
  fundingStage: string;
  fundingProgramme: string;
  outstandingRequirements: number;
  riskSignal: string;
  lastActivity: string | null;
  assignedOfficer: string;
};

export type BoiWorkspaceData = {
  programmes: ImpactProgramme[];
  cohorts: ImpactBeneficiaryCohort[];
  members: ImpactCohortMember[];
  interventions: ImpactIntervention[];
  assessments: ImpactAssessment[];
  templates: ImpactAssessmentTemplate[];
  evidence: ImpactEvidenceRecord[];
  visits: ImpactFieldVisit[];
  reports: InstitutionalReport[];
  intelligence: Awaited<ReturnType<typeof listIntelligenceFeed>>;
  metrics: Awaited<ReturnType<typeof getExecutiveDashboardMetrics>> | null;
};

export type BoiOverview = {
  data: BoiWorkspaceData;
  businesses: BoiPipelineBusiness[];
  kpis: Array<{ label: string; value: string; detail: string }>;
  topSectors: Array<{ label: string; value: number }>;
  topStates: Array<{ label: string; value: number }>;
};

export const BOI_SECTION_CONFIGS: Record<BoiCanonicalSection, BoiSectionConfig> = {
  businesses: {
    slug: "businesses",
    title: "Business Pipeline",
    eyebrow: "Enterprise pipeline",
    description: "Verified businesses, readiness signals, funding stage, documentation status, and review attention in one BOI view.",
    emptyTitle: "No businesses match the selected filters.",
    emptyDescription: "Business pipeline records will appear as verified enterprises enter BOI funding and readiness workflows.",
  },
  "funding-programmes": {
    slug: "funding-programmes",
    title: "Funding Programmes",
    eyebrow: "Funding windows",
    description: "Funding products, target sectors, geographic coverage, application pipeline, and programme performance.",
    emptyTitle: "No funding programmes are currently available.",
    emptyDescription: "Funding programme records will appear once they are configured in the governed portfolio engine.",
  },
  "funding-pipeline": {
    slug: "funding-pipeline",
    title: "Funding Pipeline",
    eyebrow: "Application lifecycle",
    description: "Funding records framed around screening, assessment, documentation, review, approval, monitoring, and closure.",
    emptyTitle: "No funding records require attention.",
    emptyDescription: "Funding applications and support records will appear here as businesses move through the portfolio workflow.",
  },
  readiness: {
    slug: "readiness",
    title: "Investment Readiness",
    eyebrow: "Credit and business readiness",
    description: "Investment readiness assessments, score signals, risk category, templates, and recommendations.",
    emptyTitle: "No readiness assessments are available.",
    emptyDescription: "Approved readiness assessments will appear here for BOI users as businesses are reviewed.",
  },
  documents: {
    slug: "documents",
    title: "Supporting Documents",
    eyebrow: "Evidence and verification",
    description: "Business documents, verification state, review history, and outstanding requirements for funding decisions.",
    emptyTitle: "No supporting documents are awaiting review.",
    emptyDescription: "Verified business evidence will appear here when documents are submitted through governed workflows.",
  },
  portfolio: {
    slug: "portfolio",
    title: "Portfolio",
    eyebrow: "Portfolio position",
    description: "Active funding support, business status, sector distribution, state distribution, and portfolio health.",
    emptyTitle: "No portfolio records are available.",
    emptyDescription: "Portfolio records will appear when funding support records are approved and monitored.",
  },
  monitoring: {
    slug: "monitoring",
    title: "Monitoring",
    eyebrow: "Portfolio monitoring",
    description: "Monitoring visits, follow-ups, milestones, and business support activity across the BOI portfolio.",
    emptyTitle: "No monitoring activities are currently scheduled.",
    emptyDescription: "Monitoring records will appear as field or portfolio review activities are assigned.",
  },
  intelligence: {
    slug: "intelligence",
    title: "Portfolio Intelligence",
    eyebrow: "Executive intelligence",
    description: "Pipeline trends, readiness distribution, sector opportunity, documentation gaps, and portfolio health signals.",
    emptyTitle: "Portfolio intelligence will appear as records are processed.",
    emptyDescription: "Insights, recommendations, summaries, and risk signals are generated from governed BOI-visible records.",
  },
  reports: {
    slug: "reports",
    title: "Institutional Reports",
    eyebrow: "Board and partner reporting",
    description: "Business pipeline, investment readiness, funding programme, document, portfolio, risk, and executive reporting.",
    emptyTitle: "No institutional reports are available.",
    emptyDescription: "Approved reports will appear here as the reporting engine produces BOI-ready records.",
  },
  risk: {
    slug: "risk",
    title: "Risk Signals",
    eyebrow: "Review indicators",
    description: "Documentation risk, verification risk, readiness risk, stale activity, and portfolio review indicators.",
    emptyTitle: "No risk signals require attention.",
    emptyDescription: "Risk signals are indicators for operational review and are not formal BOI credit decisions.",
  },
  executive: {
    slug: "executive",
    title: "Executive Dashboard",
    eyebrow: "Leadership view",
    description: "Pipeline overview, readiness conversion, programme performance, geographic distribution, and attention items.",
    emptyTitle: "Executive intelligence is not yet available.",
    emptyDescription: "Leadership indicators will appear as BOI-visible records are processed and reported.",
  },
};

export const BOI_SECTION_ALIASES: Record<string, BoiCanonicalSection> = {
  businesses: "businesses",
  "business-pipeline": "businesses",
  "funding-programmes": "funding-programmes",
  "funding-pipeline": "funding-pipeline",
  readiness: "readiness",
  "investment-readiness": "readiness",
  documents: "documents",
  portfolio: "portfolio",
  "portfolio-monitoring": "monitoring",
  monitoring: "monitoring",
  intelligence: "intelligence",
  "portfolio-intelligence": "intelligence",
  reports: "reports",
  risk: "risk",
  "risk-signals": "risk",
  executive: "executive",
};

const UNAVAILABLE = "Unavailable";

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("en-NG") : UNAVAILABLE;
}

function normaliseFilter(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function normalizeBoiSearchParams(searchParams?: Record<string, string | string[] | undefined>): BoiSearchParams {
  return {
    q: normaliseFilter(searchParams?.q),
    state: normaliseFilter(searchParams?.state),
    sector: normaliseFilter(searchParams?.sector),
    status: normaliseFilter(searchParams?.status),
    readiness: normaliseFilter(searchParams?.readiness),
    stage: normaliseFilter(searchParams?.stage),
    risk: normaliseFilter(searchParams?.risk),
    page: normaliseFilter(searchParams?.page),
  };
}

export function resolveBoiSection(slug: string | undefined): BoiCanonicalSection | null {
  return slug ? BOI_SECTION_ALIASES[slug] ?? null : null;
}

async function safeLoad<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

function latestDate(values: Array<string | null | undefined>) {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return sorted[0] ?? null;
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
    .slice(0, 5);
}

function getStage(intervention: ImpactIntervention | undefined) {
  const stage = intervention?.metadata?.stage;
  return typeof stage === "string" && stage.trim() ? stage.replaceAll("_", " ") : intervention?.status ?? UNAVAILABLE;
}

function getRiskForBusiness(msmeId: string | null, data: BoiWorkspaceData) {
  if (!msmeId) return "No signal";
  const risk = data.intelligence.riskFlags.find((item) => item.msme_id === msmeId);
  if (!risk) return "No signal";
  return `${risk.severity ?? "Review"} signal`;
}

function getReadinessForBusiness(msmeId: string | null, data: BoiWorkspaceData) {
  const assessments = data.assessments
    .filter((assessment) => assessment.msme_id === msmeId)
    .sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime());
  const latest = assessments[0];
  return {
    status: latest?.status ? latest.status.replaceAll("_", " ") : UNAVAILABLE,
    score: typeof latest?.score === "number" ? latest.score : null,
  };
}

export function buildBoiBusinesses(data: BoiWorkspaceData) {
  return data.members.map((member) => {
    const msme = member.msmes;
    const intervention = data.interventions.find((item) => item.cohort_member_id === member.id || item.msme_id === member.msme_id);
    const evidence = data.evidence.filter((item) => item.cohort_member_id === member.id || item.msme_id === member.msme_id);
    const readiness = getReadinessForBusiness(member.msme_id, data);
    return {
      memberId: member.id,
      msmeId: member.msme_id,
      businessName: msme?.business_name ?? "Unnamed business",
      bin: msme?.msme_id ?? UNAVAILABLE,
      sector: msme?.sector ?? UNAVAILABLE,
      state: msme?.state ?? UNAVAILABLE,
      verificationStatus: msme?.verification_status ?? UNAVAILABLE,
      readinessStatus: readiness.status,
      readinessScore: readiness.score,
      fundingStage: getStage(intervention),
      fundingProgramme: member.impact_beneficiary_cohorts?.name ?? intervention?.impact_programmes?.name ?? UNAVAILABLE,
      outstandingRequirements: evidence.filter((item) => !["verified", "accepted"].includes(item.verification_status ?? item.status ?? "")).length,
      riskSignal: getRiskForBusiness(member.msme_id, data),
      lastActivity: latestDate([member.updated_at, intervention?.updated_at, ...evidence.map((item) => item.reviewed_at ?? item.submitted_at ?? item.uploaded_at)]),
      assignedOfficer: member.assigned_to_user_id ? "Assigned" : UNAVAILABLE,
    } satisfies BoiPipelineBusiness;
  });
}

export function filterBoiBusinesses(businesses: BoiPipelineBusiness[], filters: BoiSearchParams) {
  const q = filters.q?.toLowerCase();
  return businesses.filter((business) => {
    if (q && ![business.businessName, business.bin, business.sector, business.state, business.fundingProgramme].join(" ").toLowerCase().includes(q)) return false;
    if (filters.state && business.state !== filters.state) return false;
    if (filters.sector && business.sector !== filters.sector) return false;
    if (filters.status && business.verificationStatus !== filters.status) return false;
    if (filters.readiness && business.readinessStatus !== filters.readiness) return false;
    if (filters.stage && business.fundingStage !== filters.stage) return false;
    if (filters.risk && business.riskSignal !== filters.risk) return false;
    return true;
  });
}

export function paginateBoiItems<T>(items: T[], rawPage?: string, pageSize = 10) {
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

export async function getBoiWorkspaceData(ctx: UserContext): Promise<BoiWorkspaceData> {
  const programmes = await safeLoad(() => listImpactProgrammes(ctx, { limit: 100 }), []);
  const cohorts = await safeLoad(() => listImpactCohorts(ctx, { limit: 100 }), []);
  const members = (
    await Promise.all(cohorts.slice(0, 40).map((cohort) => safeLoad(() => listImpactCohortMemberOptions(ctx, { cohortId: cohort.id, limit: 150 }), [])))
  ).flat();
  const [interventions, assessments, templates, evidence, visits, reports, intelligence, metrics] = await Promise.all([
    safeLoad(() => listImpactInterventions(ctx, { limit: 150 }), []),
    safeLoad(() => listImpactAssessments(ctx, { limit: 150 }), []),
    safeLoad(() => listAssessmentTemplates(ctx, { limit: 50 }), []),
    safeLoad(() => listImpactEvidence(ctx, { limit: 150 }), []),
    safeLoad(() => listFieldVisits(ctx, { limit: 100 }), []),
    safeLoad(() => listInstitutionalReports(ctx, 80), []),
    safeLoad(() => listIntelligenceFeed(ctx, { limit: 80 }), { insights: [], recommendations: [], riskFlags: [], anomalies: [], summaries: [] }),
    safeLoad(() => getExecutiveDashboardMetrics(ctx), null),
  ]);

  return { programmes, cohorts, members, interventions, assessments, templates, evidence, visits, reports, intelligence, metrics };
}

export async function getBoiOverview(ctx: UserContext): Promise<BoiOverview> {
  const data = await getBoiWorkspaceData(ctx);
  const businesses = buildBoiBusinesses(data);
  const investmentReady = businesses.filter((business) => {
    if (typeof business.readinessScore === "number") return business.readinessScore >= 70;
    return ["approved", "completed", "strong"].some((label) => business.readinessStatus.toLowerCase().includes(label));
  }).length;
  const fundingApplications = data.interventions.length;
  const outstandingDocuments = businesses.reduce((sum, business) => sum + business.outstandingRequirements, 0);
  const highRisk = businesses.filter((business) => business.riskSignal.toLowerCase().includes("high") || business.riskSignal.toLowerCase().includes("critical")).length;

  return {
    data,
    businesses,
    topSectors: countBy(businesses.map((business) => business.sector)),
    topStates: countBy(businesses.map((business) => business.state)),
    kpis: [
      { label: "Businesses in Pipeline", value: formatNumber(businesses.length || data.metrics?.totalMsmes), detail: "Verified businesses represented in BOI-visible portfolio records" },
      { label: "Verified Businesses", value: formatNumber(businesses.filter((item) => item.verificationStatus.toLowerCase().includes("verified")).length), detail: "Businesses with verified identity status in the pipeline" },
      { label: "Investment-Ready Businesses", value: formatNumber(investmentReady), detail: "Businesses with strong or approved readiness signals" },
      { label: "Funding Applications", value: formatNumber(fundingApplications), detail: "Funding support records visible to BOI" },
      { label: "Active Funding Programmes", value: formatNumber(data.programmes.filter((item) => item.status === "active").length || data.metrics?.activeProgrammes), detail: "Active funding windows and institutional programmes" },
      { label: "Applications Requiring Review", value: formatNumber(data.interventions.filter((item) => ["planned", "on_hold"].includes(item.status ?? "")).length), detail: "Records not yet progressing through funding lifecycle" },
      { label: "Supporting Documents Outstanding", value: formatNumber(outstandingDocuments), detail: "Documents requiring verification, acceptance, or follow-up" },
      { label: "High-Risk Businesses", value: formatNumber(highRisk), detail: "Businesses with high or critical review indicators" },
      { label: "States Represented", value: formatNumber(new Set(businesses.map((item) => item.state).filter((item) => item !== UNAVAILABLE)).size), detail: "Geographic footprint across visible businesses" },
      { label: "Sectors Represented", value: formatNumber(new Set(businesses.map((item) => item.sector).filter((item) => item !== UNAVAILABLE)).size), detail: "Sector spread across visible businesses" },
    ],
  };
}

export async function getBoiBusinessDetail(ctx: UserContext, businessId: string) {
  const overview = await getBoiOverview(ctx);
  const business = overview.businesses.find((item) => item.memberId === businessId || item.msmeId === businessId || item.bin === businessId) ?? null;
  if (!business) return { ...overview, business: null, assessments: [], evidence: [], interventions: [], visits: [], riskFlags: [] };
  return {
    ...overview,
    business,
    assessments: overview.data.assessments.filter((item) => item.msme_id === business.msmeId),
    evidence: overview.data.evidence.filter((item) => item.msme_id === business.msmeId || item.cohort_member_id === business.memberId),
    interventions: overview.data.interventions.filter((item) => item.msme_id === business.msmeId || item.cohort_member_id === business.memberId),
    visits: overview.data.visits.filter((item) => item.msme_id === business.msmeId || item.cohort_member_id === business.memberId),
    riskFlags: overview.data.intelligence.riskFlags.filter((item) => item.msme_id === business.msmeId),
  };
}

export async function getBoiProgrammeDetail(ctx: UserContext, programmeId: string) {
  return safeLoad(() => getImpactProgrammeDetail(ctx, programmeId), { programme: null, interventions: [], unanchoredInterventions: [], enrolments: [], cohorts: [] });
}

export async function getBoiAssessmentDetail(ctx: UserContext, assessmentId: string) {
  return safeLoad(() => getImpactAssessmentDetail(assessmentId, ctx), { assessment: null, template: null, sections: [], questions: [], responses: [], scores: [], scoreRuns: [], reviews: [], visits: [] });
}
