import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";
import { lcdboPublicHref } from "@/lib/lcdbo/content";

export type LcdboMeasureClassification =
  | "Live operational data"
  | "Configured programme target"
  | "Long-term ambition"
  | "Governed estimate"
  | "Reference geography"
  | "Publicly verified result"
  | "Sample/demo data";

export type LcdboPublicationStatus = "published" | "reference" | "scheduled" | "internal";

export type LcdboPublicMeasure = {
  key: string;
  value: string;
  label: string;
  classification: LcdboMeasureClassification;
  timeframe: string;
  basis: string;
  note: string;
  publicDisplay: boolean;
};

export type LcdboProgrammeStatus = {
  key: string;
  label: string;
  classification: "Programme readiness information";
  detail: string;
  publicDisplay: boolean;
};

export type LcdboPublicResource = {
  key: string;
  title: string;
  category: string;
  description: string;
  href: string | null;
  status: LcdboPublicationStatus;
  sourceNote: string;
  lastReviewed: string;
  publicDisplay: boolean;
};

export const lcdboInstitutionalAttribution = {
  programmeName: "Local Content Development Beyond Oil",
  programmeShortName: "LCDBO",
  institutionalLead: "Raw Materials Research and Development Council",
  institutionalLeadShortName: "RMRDC",
  implementationPartner: "Roseate Forte Nigeria Limited",
  infrastructureProvider: "DBIN",
  publicContactEmail: "info@lcdbo.com",
  publicContactStatus: "Configuration dependency: verify mailbox routing before public launch.",
  lastReviewed: "2026-08-02",
  officialAssetStatus: {
    rmrdc: "Official RMRDC logo asset not found in repository; using text-only institutional lockup.",
    roseateForte: "Official Roseate Forte logo asset not found in repository; using text-only implementation attribution.",
    dbin: "Existing DBIN brand component available and used for infrastructure attribution.",
    lcdbo: "Official standalone LCDBO logo asset not found in repository; using programme text mark.",
  },
} as const;

export const lcdboMeasureDisclosure =
  "Figures shown include programme ambitions, configured targets and reference geography. They do not represent achieved results unless expressly identified as verified operational data.";

export const lcdboPublicMeasures: LcdboPublicMeasure[] = [
  {
    key: "national-design-scope",
    value: "36 States + FCT",
    label: "within national design scope",
    classification: "Reference geography",
    timeframe: "National programme design scope",
    basis: "Nigeria reference geography",
    note: "This describes geographic design scope, not verified active implementation in every state.",
    publicDisplay: true,
  },
  {
    key: "lga-reference",
    value: "774",
    label: "LGAs in reference geography",
    classification: "Reference geography",
    timeframe: "National programme design scope",
    basis: "Nigeria local-government reference geography",
    note: "Used to frame the long-term programme architecture and activation design.",
    publicDisplay: true,
  },
  {
    key: "msme-lga-ambition",
    value: "Up to 5,000",
    label: "MSMEs per LGA",
    classification: "Long-term ambition",
    timeframe: "Long-term enablement ambition",
    basis: "Configured programme ambition subject to institutional approval and phased activation.",
    note: "Not an achieved result; displayed as an enablement ambition only.",
    publicDisplay: true,
  },
  {
    key: "investment-mobilisation",
    value: "$100B",
    label: "long-term investment mobilisation ambition",
    classification: "Long-term ambition",
    timeframe: "Long-term industrial-finance horizon",
    basis: "Configured programme ambition subject to source validation, methodology and leadership approval.",
    note: "Not investment already mobilised.",
    publicDisplay: true,
  },
  {
    key: "one-trillion-economy",
    value: "$1T",
    label: "economy contribution pathway",
    classification: "Long-term ambition",
    timeframe: "Long-term national economic ambition",
    basis: "Contribution pathway toward Nigeria’s $1T economy ambition.",
    note: "LCDBO is positioned as a contribution pathway, not the sole driver or a verified result.",
    publicDisplay: true,
  },
];

export const lcdboProgrammeStatuses: LcdboProgrammeStatus[] = [
  {
    key: "architecture-established",
    label: "Programme architecture established",
    classification: "Programme readiness information",
    detail: "The public programme model, participation pathways and delivery architecture are defined for institutional review and controlled activation.",
    publicDisplay: true,
  },
  {
    key: "digital-infrastructure-operational",
    label: "Digital delivery infrastructure operational",
    classification: "Programme readiness information",
    detail: "DBIN provides the enabling identity, onboarding, workspace and reporting infrastructure used to support governed programme operations.",
    publicDisplay: true,
  },
  {
    key: "partner-engagement-underway",
    label: "Institutional and partner engagement underway",
    classification: "Programme readiness information",
    detail: "Engagement pathways are available for MSMEs, institutions, technical partners, investors and market-access stakeholders.",
    publicDisplay: true,
  },
  {
    key: "controlled-pilot-planning",
    label: "Controlled pilot planning in progress",
    classification: "Programme readiness information",
    detail: "Geographic activation, cluster onboarding and national scaling are governed by phased implementation and institutional approval.",
    publicDisplay: true,
  },
];

export const lcdboPublicResources: LcdboPublicResource[] = [
  {
    key: "programme-overview",
    title: "Programme overview",
    category: "Reference material",
    description: "A public overview of LCDBO’s purpose, institutional model and national industrial-development rationale.",
    href: lcdboPublicHref("/about"),
    status: "published",
    sourceNote: "Public LCDBO about page.",
    lastReviewed: "2026-08-02",
    publicDisplay: true,
  },
  {
    key: "institutional-delivery-model",
    title: "Institutional and delivery model",
    category: "Reference material",
    description: "How RMRDC leadership, Roseate Forte implementation and DBIN infrastructure support the programme model.",
    href: lcdboPublicHref("/model"),
    status: "published",
    sourceNote: "Public LCDBO model page.",
    lastReviewed: "2026-08-02",
    publicDisplay: true,
  },
  {
    key: "msme-participation",
    title: "MSME participation guide",
    category: "Participation pathway",
    description: "Entry routes for businesses seeking registration, cluster participation and readiness support.",
    href: lcdboPublicHref("/opportunities"),
    status: "published",
    sourceNote: "Public opportunities page; no downloadable guide is currently attached.",
    lastReviewed: "2026-08-02",
    publicDisplay: true,
  },
  {
    key: "cluster-framework",
    title: "Industrial cluster framework",
    category: "Reference material",
    description: "The public cluster network and value-chain opportunity view.",
    href: lcdboPublicHref("/clusters"),
    status: "published",
    sourceNote: "Public clusters page.",
    lastReviewed: "2026-08-02",
    publicDisplay: true,
  },
  {
    key: "partnership-information",
    title: "Partnership information",
    category: "Engagement pathway",
    description: "How public institutions, finance providers, technical partners and markets can engage.",
    href: lcdboPublicHref("/partners"),
    status: "published",
    sourceNote: "Public partners page.",
    lastReviewed: "2026-08-02",
    publicDisplay: true,
  },
  {
    key: "governance-implementation-approach",
    title: "Governance and implementation approach",
    category: "Publication scheduled",
    description: "A formal public briefing note should be published after institutional content approval.",
    href: null,
    status: "scheduled",
    sourceNote: "No public download is attached in this release.",
    lastReviewed: "2026-08-02",
    publicDisplay: true,
  },
];

export const lcdboStructuredData = {
  "@context": "https://schema.org",
  "@type": "GovernmentService",
  name: "Local Content Development Beyond Oil",
  alternateName: "LCDBO",
  url: LCDBO_CANONICAL_ORIGIN,
  description:
    "An RMRDC-led national industrial transformation programme connecting Nigerian raw materials, MSMEs, industrial clusters, investors and markets.",
  provider: {
    "@type": "GovernmentOrganization",
    name: "Raw Materials Research and Development Council",
    alternateName: "RMRDC",
  },
  serviceOperator: {
    "@type": "Organization",
    name: "Roseate Forte Nigeria Limited",
  },
  areaServed: {
    "@type": "Country",
    name: "Nigeria",
  },
} as const;

export function safePublicResources() {
  return lcdboPublicResources.filter((resource) => resource.publicDisplay);
}

export function safePublicMeasures() {
  return lcdboPublicMeasures.filter((measure) => measure.publicDisplay && measure.classification !== "Sample/demo data");
}

export function safeProgrammeStatuses() {
  return lcdboProgrammeStatuses.filter((status) => status.publicDisplay);
}
