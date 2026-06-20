import type { IndustrialCluster, Institution, PlatformModuleKey, Programme } from "@/types/platform";

export const LCDBO_PROGRAMME_SLUG = "local-content-development-beyond-oil";
export const LCDBO_MODULE_KEY: PlatformModuleKey = "lcdb_o_workspace";
export const LCDBO_REGISTER_HREF = "/register/msme?programme=lcdbo&source=lcdbo_public_site";
export const LCDBO_PARTNER_HREF = "/lcdbo/contact?intent=partner&programme=lcdbo&source=lcdbo_public_site";
export const LCDBO_INVESTOR_HREF = "/lcdbo/opportunities?audience=investor&programme=lcdbo&source=lcdbo_public_site";

export type LcdboClusterCard = {
  id: string;
  name: string;
  slug: string;
  clusterType: string;
  sector: string;
  state: string;
  lga: string;
  locationDescription: string;
  status: string;
  investmentRequired: number | null;
  jobsTarget: number | null;
  msmeTarget: number | null;
  description: string;
};

export type LcdboPartnerCard = {
  id: string;
  name: string;
  slug: string;
  category: string;
  institutionType: string;
  description: string;
  website: string | null;
};

export const lcdboStats = [
  { label: "774 LGAs", value: "774", detail: "Canonical subnational reach" },
  { label: "36 States + FCT", value: "37", detail: "National industrial footprint" },
  { label: "5,000 MSMEs Enabled Per LGA", value: "5,000", detail: "Local production density target" },
  { label: "$100B Investment Mobilisation Target", value: "$100B", detail: "Public-private pipeline ambition" },
  { label: "Pathway to $1 Trillion Economy", value: "$1T", detail: "Industrial growth trajectory" },
] as const;

export const lcdboPillars = [
  { title: "Industrial Clusters", detail: "Shared production infrastructure and value-chain concentration." },
  { title: "MSME Enablement", detail: "Business identity, readiness, onboarding, and operational support." },
  { title: "Funding & Investment", detail: "Bankable pipelines for DFIs, investors, states, and partners." },
  { title: "Market Access", detail: "Commercialisation pathways into procurement and export markets." },
  { title: "Skills & ADC Framework", detail: "Acquire, Demonstrate, Commercialise capability development." },
  { title: "Digital Business Identity", detail: "BIN-backed verification, compliance, and trust infrastructure." },
] as const;

export const ecosystemFlow = [
  "Stakeholders",
  "LCDBO",
  "Industrial Clusters",
  "Production",
  "Commercialisation",
  "Exports",
  "Jobs",
  "Growth",
] as const;

export const adcFramework = [
  { title: "Acquire", detail: "Mobilise MSMEs, assess capability, organise clusters, and define required infrastructure." },
  { title: "Demonstrate", detail: "Validate production capacity, standards readiness, technical support, and market evidence." },
  { title: "Commercialise", detail: "Move businesses into financing, procurement, exports, and measurable job creation." },
] as const;

export const modelSteps = [
  "Business registration",
  "BIN identity",
  "Cluster placement",
  "Readiness support",
  "Funding pipeline",
  "Market access",
] as const;

export const opportunityCards = [
  {
    title: "MSME Registration",
    description: "Join the LCDBO pipeline through DBIN business onboarding and identity readiness.",
    audience: "MSMEs, artisans, manufacturers, service providers",
    status: "Open foundation route",
    cta: "Register Your Business",
    href: LCDBO_REGISTER_HREF,
  },
  {
    title: "Cluster Participation",
    description: "Express interest in pilot industrial clusters and shared production infrastructure.",
    audience: "MSMEs, associations, cooperatives",
    status: "Pilot pipeline",
    cta: "Explore Clusters",
    href: "/lcdbo/clusters",
  },
  {
    title: "Funding Readiness",
    description: "Prepare business, compliance, finance, and identity records for funder review.",
    audience: "Growth-stage MSMEs",
    status: "Foundation stage",
    cta: "Start Readiness",
    href: LCDBO_REGISTER_HREF,
  },
  {
    title: "Investor Partnership",
    description: "Engage future investable cluster pipelines and programme-backed opportunity flows.",
    audience: "Investors, DFIs, funds, banks",
    status: "Coming in a future phase",
    cta: "View Investment Track",
    href: LCDBO_INVESTOR_HREF,
  },
  {
    title: "State Government Participation",
    description: "Align state industrial priorities with LCDBO clusters, MSME mobilisation, and investment readiness.",
    audience: "State governments and MDAs",
    status: "Partner intake",
    cta: "Partner With LCDBO",
    href: LCDBO_PARTNER_HREF,
  },
  {
    title: "Technical Partner Participation",
    description: "Contribute standards, engineering, skills, quality assurance, market access, or infrastructure support.",
    audience: "Technical partners and institutions",
    status: "Partner intake",
    cta: "Join as Partner",
    href: LCDBO_PARTNER_HREF,
  },
  {
    title: "Export and Market Access",
    description: "Prepare cluster value chains for AfCFTA-linked commercialisation and non-oil export growth.",
    audience: "Export-ready businesses and trade partners",
    status: "Structured pipeline",
    cta: "Explore Pathway",
    href: "/lcdbo/model",
  },
] as const;

export const fallbackPartners: LcdboPartnerCard[] = [
  { id: "roseate", name: "Roseate Forte Nigeria Limited", slug: "roseate-forte-nigeria-limited", category: "Programme Convener", institutionType: "Private Company", description: "Private-sector programme convener and platform delivery institution.", website: "https://roseateforte.com" },
  { id: "rmrdc", name: "RMRDC", slug: "rmrdc", category: "Government/Technical Partner", institutionType: "Federal Agency", description: "Federal raw materials and industrial value-chain development partner.", website: "https://rmrdc.gov.ng" },
  { id: "nassi", name: "NASSI", slug: "nassi", category: "Industrial Association", institutionType: "Association", description: "National small-scale industrialist mobilisation and cluster participation partner.", website: "https://nassi.org.ng" },
  { id: "nse", name: "NSE", slug: "nse", category: "Engineering/Technical Partner", institutionType: "Technical Partner", description: "Engineering, standards, and technical capability partner.", website: "https://www.nse.org.ng" },
  { id: "boi", name: "BOI", slug: "boi", category: "Funding/Investment Partner", institutionType: "Development Finance Institution", description: "Industrial finance and MSME growth funding partner.", website: "https://www.boi.ng" },
  { id: "afcfta", name: "AfCFTA", slug: "afcfta", category: "Trade/Market Access Partner", institutionType: "Programme Secretariat", description: "Continental trade and non-oil export market access stakeholder.", website: "https://au-afcfta.org" },
];

export const fallbackClusters: LcdboClusterCard[] = [
  {
    id: "southwest-leather",
    name: "Southwest Leather Industrial Processing Hub",
    slug: "southwest-leather-industrial-processing-hub",
    clusterType: "Leather hub",
    sector: "Leather and light manufacturing",
    state: "Lagos",
    lga: "Mushin",
    locationDescription: "Southwest pilot leather processing and finishing hub.",
    status: "planned",
    investmentRequired: 2500000000,
    jobsTarget: 5000,
    msmeTarget: 750,
    description: "Shared processing, finishing, quality improvement, and export-readiness support for leather MSMEs.",
  },
  {
    id: "agro-processing",
    name: "Agro Processing Pilot Hub",
    slug: "agro-processing-pilot-hub",
    clusterType: "Agro processing zone",
    sector: "Agro-processing",
    state: "Ogun",
    lga: "Abeokuta South",
    locationDescription: "Pilot agro-processing hub for shared facilities and value-chain aggregation.",
    status: "planned",
    investmentRequired: 4200000000,
    jobsTarget: 8000,
    msmeTarget: 1200,
    description: "Agricultural raw materials processing, packaging, storage, and market access infrastructure.",
  },
  {
    id: "technology-park",
    name: "Technology and Innovation Pilot Park",
    slug: "technology-and-innovation-pilot-park",
    clusterType: "Technology park",
    sector: "Technology and innovation",
    state: "FCT",
    lga: "Abuja Municipal",
    locationDescription: "Innovation pilot park for industrial technology services and digital MSME enablement.",
    status: "planned",
    investmentRequired: 3600000000,
    jobsTarget: 6500,
    msmeTarget: 900,
    description: "Technology-enabled MSMEs, engineering services, industrial support, and innovation partnerships.",
  },
];

export function toPartnerCards(institutions: Institution[]): LcdboPartnerCard[] {
  const categoryBySlug: Record<string, string> = {
    "roseate-forte-nigeria-limited": "Programme Convener",
    rmrdc: "Government/Technical Partner",
    nassi: "Industrial Association",
    nse: "Engineering/Technical Partner",
    boi: "Funding/Investment Partner",
    afcfta: "Trade/Market Access Partner",
  };
  const cards = institutions
    .filter((institution) => categoryBySlug[institution.slug])
    .map((institution) => ({
      id: institution.id,
      name: institution.slug === "rmrdc" ? "RMRDC" : institution.slug === "nse" ? "NSE" : institution.slug === "boi" ? "BOI" : institution.slug === "afcfta" ? "AfCFTA" : institution.name,
      slug: institution.slug,
      category: categoryBySlug[institution.slug],
      institutionType: institution.institution_type.replaceAll("_", " "),
      description: institution.description ?? "Strategic LCDBO ecosystem partner.",
      website: institution.website,
    }));
  return cards.length ? cards : fallbackPartners;
}

export function toClusterCards(input: {
  clusters: IndustrialCluster[];
  states: Array<{ id: string; name: string }>;
  lgas: Array<{ id: string; name: string }>;
}): LcdboClusterCard[] {
  const stateById = new Map(input.states.map((state) => [state.id, state.name]));
  const lgaById = new Map(input.lgas.map((lga) => [lga.id, lga.name]));
  const cards = input.clusters
    .filter((cluster) => cluster.programme_id || cluster.metadata?.source === "platform_foundation_phase1")
    .map((cluster) => ({
      id: cluster.id,
      name: cluster.name,
      slug: cluster.slug,
      clusterType: cluster.cluster_type.replaceAll("_", " "),
      sector: cluster.sector,
      state: cluster.state_id ? stateById.get(cluster.state_id) ?? "National" : "National",
      lga: cluster.lga_id ? lgaById.get(cluster.lga_id) ?? "TBC" : "TBC",
      locationDescription: cluster.location_description ?? "Location definition in progress.",
      status: cluster.status,
      investmentRequired: cluster.investment_required,
      jobsTarget: cluster.jobs_target,
      msmeTarget: cluster.msme_target,
      description: cluster.description ?? "Cluster development profile is being prepared.",
    }));
  return cards.length ? cards : fallbackClusters;
}

export function formatNairaCompact(value: number | null) {
  if (!value) return "TBC";
  if (value >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  return `₦${value.toLocaleString("en-NG")}`;
}

export function programmeLabel(programme: Programme | null) {
  return programme?.name ?? "Local Content Development Beyond Oil";
}
