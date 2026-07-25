import type {
  WorkspaceCapability,
  WorkspaceDataClassificationRule,
  WorkspaceDefinition,
  WorkspaceId,
  WorkspaceNavigationItem,
  WorkspaceNavigationSection,
  WorkspacePalette,
} from "@/lib/workspaces/workspace-types";

export type {
  WorkspaceCapability,
  WorkspaceDataClassification,
  WorkspaceDataClassificationRule,
  WorkspaceDefinition,
  WorkspaceId,
  WorkspaceNavigationItem,
  WorkspaceNavigationSection,
  WorkspacePalette,
} from "@/lib/workspaces/workspace-types";

type WorkspaceInput = Omit<
  WorkspaceDefinition,
  | "canonicalName"
  | "shortName"
  | "institutionalOwner"
  | "purpose"
  | "dataClassification"
  | "accountContext"
  | "capabilities"
  | "navigationSections"
> &
  Partial<
    Pick<
      WorkspaceDefinition,
      | "canonicalName"
      | "shortName"
      | "institutionalOwner"
      | "purpose"
      | "dataClassification"
      | "accountContext"
      | "capabilities"
      | "navigationSections"
    >
  >;

const DEFAULT_CLASSIFICATION_RULES: WorkspaceDataClassificationRule[] = [
  {
    classification: "operational",
    label: "Operational Data",
    description: "Records created through authenticated workspace activity.",
  },
  {
    classification: "aggregate",
    label: "Aggregate Intelligence",
    description: "Summarised workspace metrics derived from operational records.",
  },
  {
    classification: "reference",
    label: "Reference Dataset",
    description: "Configured or deterministic data used to support interpretation.",
  },
];

function withPaletteDefaults(palette: Partial<WorkspacePalette>): WorkspacePalette {
  return {
    shell: palette.shell ?? "bg-slate-950",
    surface: palette.surface ?? "bg-white",
    accent: palette.accent ?? "text-emerald-300",
    accentSoft: palette.accentSoft ?? "bg-emerald-300/10",
    accentBorder: palette.accentBorder ?? "border-emerald-200",
    text: palette.text ?? "text-slate-100",
  };
}

function defaultCapabilities(input: Pick<WorkspaceInput, "navigation" | "executiveDashboard" | "reports">): WorkspaceCapability[] {
  const capabilities = new Set<WorkspaceCapability>(["operations"]);
  if (input.executiveDashboard) capabilities.add("executive");
  if (input.reports) capabilities.add("reports");
  if (input.navigation.some((item) => /intelligence|analytics/i.test(item.label))) capabilities.add("intelligence");
  if (input.navigation.some((item) => /export|report/i.test(item.label))) capabilities.add("exports");
  return [...capabilities];
}

function defaultNavigationSections(navigation: WorkspaceNavigationItem[]): WorkspaceNavigationSection[] {
  return [{ label: "Workspace", items: navigation }];
}

function defineWorkspace(input: WorkspaceInput): WorkspaceDefinition {
  return {
    ...input,
    canonicalName: input.canonicalName ?? input.title,
    shortName: input.shortName ?? input.logoLabel,
    institutionalOwner: input.institutionalOwner ?? input.title,
    purpose: input.purpose ?? input.subtitle,
    palette: withPaletteDefaults(input.palette),
    navigationSections: input.navigationSections ?? defaultNavigationSections(input.navigation),
    dataClassification: input.dataClassification ?? DEFAULT_CLASSIFICATION_RULES,
    accountContext: input.accountContext ?? { label: `${input.logoLabel} account`, switchAccountHref: "/login", logoutHref: "/logout" },
    capabilities: input.capabilities ?? defaultCapabilities(input),
  };
}

export const WORKSPACE_REGISTRY: Record<WorkspaceId, WorkspaceDefinition> = {
  boi: defineWorkspace({
    id: "boi",
    title: "BOI Institutional Workspace",
    subtitle: "Investment readiness, business pipeline, credit signals, portfolio monitoring, and institutional reports.",
    logoLabel: "BOI",
    icon: "Building2",
    shortName: "BOI",
    institutionalOwner: "Bank of Industry",
    purpose: "A banking-grade workspace for investment readiness, funding pipeline review, portfolio monitoring, risk signals and institutional reports.",
    publicLanding: "/boi",
    host: { canonicalHost: "boi.dbin.ng", hostEnvironmentKey: "DBIN_BOI_HOSTS" },
    palette: {
      shell: "bg-[#07162f]",
      surface: "bg-white",
      accent: "text-amber-300",
      accentSoft: "bg-amber-300/10",
      accentBorder: "border-amber-200",
      text: "text-slate-100",
    },
    homepage: "/dashboard/boi",
    executiveDashboard: "/dashboard/boi/executive",
    reports: "/dashboard/boi/reports",
    allowedRoles: ["admin", "super_admin", "boi_executive"],
    navigation: [
      { label: "BOI Overview", href: "/dashboard/boi", legacyHref: "/dashboard/impact-intelligence", capabilities: ["operations"] },
      { label: "Business Pipeline", href: "/dashboard/boi/businesses", legacyHref: "/dashboard/impact-intelligence/cohorts", capabilities: ["participant-management"] },
      { label: "Funding Programmes", href: "/dashboard/boi/funding-programmes", legacyHref: "/dashboard/impact-intelligence/programmes", capabilities: ["registry"] },
      { label: "Funding Pipeline", href: "/dashboard/boi/funding-pipeline", legacyHref: "/dashboard/impact-intelligence/interventions", capabilities: ["operations"] },
      { label: "Investment Readiness", href: "/dashboard/boi/readiness", legacyHref: "/dashboard/impact-intelligence/assessments", capabilities: ["participant-management"] },
      { label: "Supporting Documents", href: "/dashboard/boi/documents", legacyHref: "/dashboard/impact-intelligence/evidence", capabilities: ["case-management"] },
      { label: "Portfolio", href: "/dashboard/boi/portfolio", legacyHref: "/dashboard/impact-intelligence/interventions", capabilities: ["operations"] },
      { label: "Monitoring", href: "/dashboard/boi/monitoring", legacyHref: "/dashboard/impact-intelligence/monitoring", capabilities: ["operations"] },
      { label: "Portfolio Intelligence", href: "/dashboard/boi/intelligence", legacyHref: "/dashboard/impact-intelligence/analytics", capabilities: ["intelligence"] },
      { label: "Institutional Reports", href: "/dashboard/boi/reports", legacyHref: "/dashboard/impact-intelligence/reports", capabilities: ["reports", "exports"] },
      { label: "Risk Signals", href: "/dashboard/boi/risk", legacyHref: "/dashboard/impact-intelligence/risk-flags", capabilities: ["intelligence"] },
      { label: "Executive Dashboard", href: "/dashboard/boi/executive", legacyHref: "/dashboard/impact-intelligence/executive", capabilities: ["executive"] },
    ],
    navigationSections: [
      { label: "Banking Operations", items: [
        { label: "BOI Overview", href: "/dashboard/boi" },
        { label: "Business Pipeline", href: "/dashboard/boi/businesses" },
        { label: "Funding Programmes", href: "/dashboard/boi/funding-programmes" },
        { label: "Funding Pipeline", href: "/dashboard/boi/funding-pipeline" },
      ] },
      { label: "Portfolio Intelligence", items: [
        { label: "Investment Readiness", href: "/dashboard/boi/readiness" },
        { label: "Supporting Documents", href: "/dashboard/boi/documents" },
        { label: "Portfolio", href: "/dashboard/boi/portfolio" },
        { label: "Monitoring", href: "/dashboard/boi/monitoring" },
        { label: "Portfolio Intelligence", href: "/dashboard/boi/intelligence" },
        { label: "Institutional Reports", href: "/dashboard/boi/reports" },
        { label: "Risk Signals", href: "/dashboard/boi/risk" },
        { label: "Executive Dashboard", href: "/dashboard/boi/executive" },
      ] },
    ],
    terminology: {
      programme: "Funding Programme",
      programmes: "Funding Programmes",
      cohort: "Business Pipeline",
      cohorts: "Business Pipeline",
      intervention: "Funding Record",
      interventions: "Funding Pipeline",
      assessment: "Investment Readiness Review",
      assessments: "Investment Readiness",
      evidence: "Supporting Documents",
      analytics: "Portfolio Intelligence",
      reports: "Institutional Reports",
      risk: "Risk Signals",
    },
    quickActions: [
      { label: "Review business pipeline", href: "/dashboard/boi/businesses" },
      { label: "Open readiness reviews", href: "/dashboard/boi/readiness" },
      { label: "View institutional reports", href: "/dashboard/boi/reports" },
    ],
    capabilities: ["operations", "registry", "participant-management", "intelligence", "reports", "executive", "exports"],
  }),
  nrs: defineWorkspace({
    id: "nrs",
    title: "NRS Formalisation Workspace",
    subtitle: "Business formalisation, readiness, Revenue Guides, verification, integrations, and aggregate intelligence.",
    logoLabel: "NRS",
    icon: "ReceiptText",
    institutionalOwner: "Nigeria Revenue Service",
    purpose: "A formalisation and readiness workspace for business registry intelligence, Revenue Guides, verification, integrations and aggregate reporting.",
    publicLanding: "/nrs",
    host: { canonicalHost: "nrs.dbin.ng", hostEnvironmentKey: "DBIN_NRS_HOSTS" },
    palette: { shell: "bg-[#13233f]", surface: "bg-white", accent: "text-sky-300", accentSoft: "bg-sky-300/10", accentBorder: "border-sky-200", text: "text-slate-100" },
    homepage: "/dashboard/nrs",
    reports: "/dashboard/nrs/reports",
    allowedRoles: ["admin", "super_admin", "nrs_officer", "firs_officer"],
    navigation: [
      { label: "Executive Dashboard", href: "/dashboard/nrs" },
      { label: "Business Registry", href: "/dashboard/nrs/businesses" },
      { label: "Formalisation & Readiness", href: "/dashboard/nrs/readiness" },
      { label: "National Intelligence", href: "/dashboard/nrs/intelligence" },
      { label: "Revenue Guides", href: "/dashboard/nrs/revenue-guides" },
      { label: "Programmes & Enablement", href: "/dashboard/nrs/programmes" },
      { label: "Reports", href: "/dashboard/nrs/reports" },
      { label: "Verification", href: "/dashboard/nrs/verification" },
      { label: "Integrations", href: "/dashboard/nrs/integrations" },
    ],
    terminology: { programme: "Enablement Programme", programmes: "Enablement Programmes", analytics: "National Intelligence", reports: "Formalisation Reports" },
    quickActions: [
      { label: "Review business registry", href: "/dashboard/nrs/businesses" },
      { label: "Open readiness workspace", href: "/dashboard/nrs/readiness" },
      { label: "View integrations", href: "/dashboard/nrs/integrations" },
    ],
    capabilities: ["operations", "registry", "intelligence", "reports", "executive"],
  }),
  fccpc: defineWorkspace({
    id: "fccpc",
    title: "FCCPC Consumer Protection Workspace",
    subtitle: "Complaints, compliance reviews, enforcement signals, and business accountability.",
    logoLabel: "FCCPC",
    icon: "ShieldCheck",
    institutionalOwner: "FCCPC",
    purpose: "A consumer protection workspace for complaint handling, compliance review and public accountability.",
    palette: { shell: "bg-[#2b173b]", surface: "bg-white", accent: "text-fuchsia-200", accentSoft: "bg-fuchsia-200/10", accentBorder: "border-fuchsia-200", text: "text-slate-100" },
    homepage: "/dashboard/fccpc",
    allowedRoles: ["admin", "super_admin", "fccpc_officer"],
    navigation: [
      { label: "FCCPC Workspace", href: "/dashboard/fccpc" },
      { label: "Compliance Reviews", href: "/dashboard/reviews/compliance" },
      { label: "Public Verification", href: "/verify" },
    ],
    terminology: { risk: "Enforcement Signals", reports: "Consumer Protection Reports" },
    quickActions: [{ label: "Open complaints desk", href: "/dashboard/fccpc" }],
  }),
  lcdbo: defineWorkspace({
    id: "lcdbo",
    title: "LCDBO Industrialisation Workspace",
    subtitle: "Manufacturing clusters, MSME participation, readiness, geography, and programme governance.",
    logoLabel: "LCDBO",
    icon: "Factory",
    institutionalOwner: "LCDBO Programme Secretariat",
    purpose: "A programme operating workspace for enrolment review, cluster participation, readiness, documents, geographic intelligence, governance and executive reporting.",
    publicLanding: "/lcdbo",
    host: { futureHosts: ["lcdbo.dbin.ng"] },
    palette: { shell: "bg-[#092f2d]", surface: "bg-white", accent: "text-emerald-300", accentSoft: "bg-emerald-300/10", accentBorder: "border-emerald-200", text: "text-slate-100" },
    homepage: "/dashboard/lcdbo",
    executiveDashboard: "/dashboard/lcdbo/executive",
    reports: "/dashboard/lcdbo/reports",
    allowedRoles: ["admin", "super_admin", "programme_officer", "assessment_officer", "field_officer", "data_analyst", "auditor"],
    navigation: [
      { label: "Operations", href: "/dashboard/lcdbo" },
      { label: "Programme Overview", href: "/dashboard/lcdbo/delivery" },
      { label: "Workstreams", href: "/dashboard/lcdbo/workstreams" },
      { label: "Milestones", href: "/dashboard/lcdbo/milestones" },
      { label: "Risks & Issues", href: "/dashboard/lcdbo/raid" },
      { label: "Delivery Calendar", href: "/dashboard/lcdbo/calendar" },
      { label: "Intelligence", href: "/dashboard/lcdbo/intelligence" },
      { label: "Reports", href: "/dashboard/lcdbo/reports" },
      { label: "Geography", href: "/dashboard/lcdbo/geography" },
      { label: "Data Quality", href: "/dashboard/lcdbo/data-quality" },
      { label: "Briefings", href: "/dashboard/lcdbo/briefings" },
    ],
    navigationSections: [
      { label: "Programme Operations", items: [
        { label: "Operations", href: "/dashboard/lcdbo" },
        { label: "Intelligence", href: "/dashboard/lcdbo/intelligence" },
        { label: "Geography", href: "/dashboard/lcdbo/geography" },
      ] },
      { label: "Programme Delivery", items: [
        { label: "Programme Overview", href: "/dashboard/lcdbo/delivery" },
        { label: "Workstreams", href: "/dashboard/lcdbo/workstreams" },
        { label: "Milestones", href: "/dashboard/lcdbo/milestones" },
        { label: "Risks & Issues", href: "/dashboard/lcdbo/raid" },
        { label: "Decisions", href: "/dashboard/lcdbo/decisions" },
        { label: "Delivery Calendar", href: "/dashboard/lcdbo/calendar" },
      ] },
      { label: "Governance & Reporting", items: [
        { label: "Reports", href: "/dashboard/lcdbo/reports" },
        { label: "Data Quality", href: "/dashboard/lcdbo/data-quality" },
        { label: "Briefings", href: "/dashboard/lcdbo/briefings" },
      ] },
    ],
    terminology: { programme: "Industrialisation Programme", programmes: "Industrialisation Programmes", cohort: "Cluster Pipeline", cohorts: "Cluster Pipelines", intervention: "Business Intervention", interventions: "Business Interventions", assessment: "Cluster Readiness", assessments: "Cluster Readiness", evidence: "Programme Evidence", analytics: "Programme Intelligence", reports: "Executive Reports" },
    quickActions: [
      { label: "Review enrolments", href: "/dashboard/lcdbo" },
      { label: "Open delivery overview", href: "/dashboard/lcdbo/delivery" },
      { label: "Open reports", href: "/dashboard/lcdbo/reports" },
      { label: "View executive briefings", href: "/dashboard/lcdbo/briefings" },
    ],
    dataClassification: [
      { classification: "operational", label: "Programme Records", description: "LCDBO enrolments, cluster interests, assignments, assessments, documents, workstreams, milestones, RAID and decision records." },
      { classification: "aggregate", label: "Aggregate Intelligence", description: "Summarised metrics derived from current LCDBO programme records." },
      { classification: "estimate", label: "Governed Estimate", description: "Programme estimates derived from configured cluster targets and current records." },
      { classification: "target", label: "Configured Target", description: "Programme targets requiring formal source validation before external publication." },
      { classification: "reference", label: "Reference Dataset", description: "State, sector or resource data used for opportunity interpretation." },
    ],
    capabilities: ["operations", "participant-management", "case-management", "intelligence", "reports", "executive", "exports", "governance", "public-landing"],
  }),
  "impact-intelligence": defineWorkspace({
    id: "impact-intelligence",
    title: "Impact Intelligence Workspace",
    subtitle: "Outcomes, monitoring, indicators, evidence, reports, and institutional insight.",
    logoLabel: "Impact",
    icon: "ChartNoAxesCombined",
    institutionalOwner: "DBIN Impact Intelligence",
    purpose: "A monitoring and evidence workspace for programme outcomes, indicators, reports and institutional insight.",
    palette: { shell: "bg-[#08162f]", surface: "bg-white", accent: "text-emerald-300", accentSoft: "bg-emerald-300/10", accentBorder: "border-emerald-200", text: "text-slate-100" },
    homepage: "/dashboard/impact-intelligence",
    executiveDashboard: "/dashboard/impact-intelligence/executive",
    reports: "/dashboard/impact-intelligence/reports",
    allowedRoles: ["admin", "super_admin", "programme_officer", "assessment_officer", "field_officer", "data_analyst", "auditor"],
    navigation: [
      { label: "Overview", href: "/dashboard/impact-intelligence" },
      { label: "Programmes", href: "/dashboard/impact-intelligence/programmes" },
      { label: "Cohorts", href: "/dashboard/impact-intelligence/cohorts" },
      { label: "Interventions", href: "/dashboard/impact-intelligence/interventions" },
      { label: "Assessments", href: "/dashboard/impact-intelligence/assessments" },
      { label: "Monitoring", href: "/dashboard/impact-intelligence/monitoring" },
      { label: "Evidence", href: "/dashboard/impact-intelligence/evidence" },
      { label: "Reports", href: "/dashboard/impact-intelligence/reports" },
    ],
    terminology: {},
    quickActions: [{ label: "Open reports", href: "/dashboard/impact-intelligence/reports" }],
  }),
  property: defineWorkspace({
    id: "property",
    title: "DLPI Property Registry Workspace",
    subtitle: "NPIN, registry cases, verification, certificates, and land intelligence.",
    logoLabel: "DLPI",
    icon: "MapPinned",
    institutionalOwner: "DLPI",
    purpose: "A registry workspace for property applications, registry cases, verification, NPIN credentials and certificates.",
    publicLanding: "/property",
    host: { canonicalHost: "lands.dbin.ng", hostEnvironmentKey: "DBIN_LANDS_HOSTS" },
    palette: { shell: "bg-[#102018]", surface: "bg-white", accent: "text-lime-300", accentSoft: "bg-lime-300/10", accentBorder: "border-lime-200", text: "text-slate-100" },
    homepage: "/dashboard/property",
    reports: "/dashboard/property/certificates",
    allowedRoles: ["admin", "super_admin", "msme"],
    navigation: [
      { label: "Property Workspace", href: "/dashboard/property" },
      { label: "Register Property", href: "/dashboard/property/register" },
      { label: "Registry Operations", href: "/dashboard/property/operations" },
      { label: "Certificates", href: "/dashboard/property/certificates" },
    ],
    terminology: { programme: "Registry Programme", evidence: "Property Documents", reports: "Registry Records" },
    quickActions: [{ label: "Register property", href: "/dashboard/property/register" }],
  }),
  msme: defineWorkspace({
    id: "msme",
    title: "MSME Business Workspace",
    subtitle: "Business identity, compliance, finance readiness, invoices, services, and growth tools.",
    logoLabel: "MSME",
    icon: "Store",
    institutionalOwner: "DBIN",
    purpose: "A business workspace for identity, compliance, finance readiness, invoices, services and growth tools.",
    palette: { shell: "bg-[#0f2d2b]", surface: "bg-white", accent: "text-emerald-300", accentSoft: "bg-emerald-300/10", accentBorder: "border-emerald-200", text: "text-slate-100" },
    homepage: "/dashboard/msme",
    allowedRoles: ["msme", "admin", "super_admin"],
    navigation: [
      { label: "Business Workspace", href: "/dashboard/msme" },
      { label: "Business Identity", href: "/dashboard/msme/id-card" },
      { label: "Compliance", href: "/dashboard/msme/compliance" },
      { label: "Finance Readiness", href: "/dashboard/msme/finance-readiness" },
    ],
    terminology: { assessment: "Readiness Check", reports: "Business Reports" },
    quickActions: [{ label: "Open business identity", href: "/dashboard/msme/id-card" }],
  }),
  association: defineWorkspace({
    id: "association",
    title: "Association Workspace",
    subtitle: "Member onboarding, association operations, complaints, and exports.",
    logoLabel: "Assoc.",
    icon: "UsersRound",
    institutionalOwner: "DBIN Association Network",
    purpose: "A member operations workspace for association onboarding, complaints, exports and member visibility.",
    palette: { shell: "bg-[#1b2642]", surface: "bg-white", accent: "text-cyan-300", accentSoft: "bg-cyan-300/10", accentBorder: "border-cyan-200", text: "text-slate-100" },
    homepage: "/dashboard/associations",
    reports: "/dashboard/reports",
    allowedRoles: ["association_officer", "admin", "super_admin"],
    navigation: [
      { label: "Association Workspace", href: "/dashboard/associations" },
      { label: "Bulk Member Onboarding", href: "/dashboard/associations/bulk-upload" },
      { label: "Complaints Desk", href: "/dashboard/associations/complaints" },
    ],
    terminology: { cohort: "Member Segment", cohorts: "Member Segments", reports: "Association Exports" },
    quickActions: [{ label: "Upload members", href: "/dashboard/associations/bulk-upload" }],
  }),
  admin: defineWorkspace({
    id: "admin",
    title: "DBIN Administration Workspace",
    subtitle: "Platform operations, registries, verification, governance, and institutional control.",
    logoLabel: "Admin",
    icon: "Settings",
    institutionalOwner: "DBIN Platform Administration",
    purpose: "A platform control workspace for registry operations, verification, governance and institutional administration.",
    palette: { shell: "bg-[#111827]", surface: "bg-white", accent: "text-slate-200", accentSoft: "bg-white/10", accentBorder: "border-slate-200", text: "text-slate-100" },
    homepage: "/dashboard/admin",
    allowedRoles: ["admin", "super_admin"],
    navigation: [
      { label: "Admin Dashboard", href: "/dashboard/admin" },
      { label: "MSME Registry", href: "/dashboard/admin/msmes" },
      { label: "Verifications", href: "/dashboard/admin/verifications" },
      { label: "Digital IDs", href: "/dashboard/admin/digital-ids" },
    ],
    terminology: { reports: "Platform Reports" },
    quickActions: [{ label: "Open MSME registry", href: "/dashboard/admin/msmes" }],
  }),
};

export function getWorkspaceDefinition(id: WorkspaceId) {
  return WORKSPACE_REGISTRY[id];
}

export function listWorkspaceDefinitions() {
  return Object.values(WORKSPACE_REGISTRY);
}
