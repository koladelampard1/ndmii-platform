import type { UserRole } from "@/types/roles";
import type { WorkspaceLanguage } from "./workspace-language";

export type WorkspaceId =
  | "admin"
  | "association"
  | "boi"
  | "fccpc"
  | "impact-intelligence"
  | "lcdbo"
  | "msme"
  | "nrs"
  | "property";

export type WorkspaceNavigationItem = {
  label: string;
  href: string;
  description?: string;
  legacyHref?: string;
};

export type WorkspacePalette = {
  shell: string;
  accent: string;
  accentSoft: string;
  text: string;
};

export type WorkspaceDefinition = {
  id: WorkspaceId;
  title: string;
  subtitle: string;
  logoLabel: string;
  icon: string;
  palette: WorkspacePalette;
  homepage: string;
  executiveDashboard?: string;
  reports?: string;
  allowedRoles: UserRole[];
  navigation: WorkspaceNavigationItem[];
  terminology: Partial<WorkspaceLanguage>;
  quickActions: WorkspaceNavigationItem[];
};

export const WORKSPACE_REGISTRY: Record<WorkspaceId, WorkspaceDefinition> = {
  boi: {
    id: "boi",
    title: "BOI Institutional Workspace",
    subtitle: "Investment readiness, business pipeline, credit signals, portfolio monitoring, and institutional reports.",
    logoLabel: "BOI",
    icon: "Building2",
    palette: {
      shell: "bg-[#07162f]",
      accent: "text-amber-300",
      accentSoft: "bg-amber-300/10",
      text: "text-slate-100",
    },
    homepage: "/dashboard/boi",
    executiveDashboard: "/dashboard/boi/executive",
    reports: "/dashboard/boi/reports",
    allowedRoles: ["admin", "super_admin", "boi_executive"],
    navigation: [
      { label: "BOI Overview", href: "/dashboard/boi", legacyHref: "/dashboard/impact-intelligence" },
      { label: "Business Pipeline", href: "/dashboard/boi/businesses", legacyHref: "/dashboard/impact-intelligence/cohorts" },
      { label: "Funding Programmes", href: "/dashboard/boi/funding-programmes", legacyHref: "/dashboard/impact-intelligence/programmes" },
      { label: "Funding Pipeline", href: "/dashboard/boi/funding-pipeline", legacyHref: "/dashboard/impact-intelligence/interventions" },
      { label: "Investment Readiness", href: "/dashboard/boi/readiness", legacyHref: "/dashboard/impact-intelligence/assessments" },
      { label: "Supporting Documents", href: "/dashboard/boi/documents", legacyHref: "/dashboard/impact-intelligence/evidence" },
      { label: "Portfolio", href: "/dashboard/boi/portfolio", legacyHref: "/dashboard/impact-intelligence/interventions" },
      { label: "Monitoring", href: "/dashboard/boi/monitoring", legacyHref: "/dashboard/impact-intelligence/monitoring" },
      { label: "Portfolio Intelligence", href: "/dashboard/boi/intelligence", legacyHref: "/dashboard/impact-intelligence/analytics" },
      { label: "Institutional Reports", href: "/dashboard/boi/reports", legacyHref: "/dashboard/impact-intelligence/reports" },
      { label: "Risk Signals", href: "/dashboard/boi/risk", legacyHref: "/dashboard/impact-intelligence/risk-flags" },
      { label: "Executive Dashboard", href: "/dashboard/boi/executive", legacyHref: "/dashboard/impact-intelligence/executive" },
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
  },
  nrs: {
    id: "nrs",
    title: "NRS Formalisation Workspace",
    subtitle: "Business formalisation, readiness, Revenue Guides, verification, integrations, and aggregate intelligence.",
    logoLabel: "NRS",
    icon: "ReceiptText",
    palette: { shell: "bg-[#13233f]", accent: "text-sky-300", accentSoft: "bg-sky-300/10", text: "text-slate-100" },
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
  },
  fccpc: {
    id: "fccpc",
    title: "FCCPC Consumer Protection Workspace",
    subtitle: "Complaints, compliance reviews, enforcement signals, and business accountability.",
    logoLabel: "FCCPC",
    icon: "ShieldCheck",
    palette: { shell: "bg-[#2b173b]", accent: "text-fuchsia-200", accentSoft: "bg-fuchsia-200/10", text: "text-slate-100" },
    homepage: "/dashboard/fccpc",
    allowedRoles: ["admin", "super_admin", "fccpc_officer"],
    navigation: [
      { label: "FCCPC Workspace", href: "/dashboard/fccpc" },
      { label: "Compliance Reviews", href: "/dashboard/reviews/compliance" },
      { label: "Public Verification", href: "/verify" },
    ],
    terminology: { risk: "Enforcement Signals", reports: "Consumer Protection Reports" },
    quickActions: [{ label: "Open complaints desk", href: "/dashboard/fccpc" }],
  },
  lcdbo: {
    id: "lcdbo",
    title: "LCDBO Industrialisation Workspace",
    subtitle: "Manufacturing clusters, MSME participation, readiness, geography, and programme governance.",
    logoLabel: "LCDBO",
    icon: "Factory",
    palette: { shell: "bg-[#092f2d]", accent: "text-emerald-300", accentSoft: "bg-emerald-300/10", text: "text-slate-100" },
    homepage: "/dashboard/lcdbo",
    executiveDashboard: "/dashboard/lcdbo/executive",
    reports: "/dashboard/lcdbo/reports",
    allowedRoles: ["admin", "super_admin", "programme_officer", "data_analyst", "auditor"],
    navigation: [
      { label: "Operations", href: "/dashboard/lcdbo" },
      { label: "Intelligence", href: "/dashboard/lcdbo/intelligence" },
      { label: "Reports", href: "/dashboard/lcdbo/reports" },
      { label: "Geography", href: "/dashboard/lcdbo/geography" },
      { label: "Data Quality", href: "/dashboard/lcdbo/data-quality" },
      { label: "Briefings", href: "/dashboard/lcdbo/briefings" },
    ],
    terminology: { programme: "Industrialisation Programme", cohort: "Cluster Pipeline", intervention: "Cluster Support" },
    quickActions: [{ label: "Review enrolments", href: "/dashboard/lcdbo" }],
  },
  "impact-intelligence": {
    id: "impact-intelligence",
    title: "Impact Intelligence Workspace",
    subtitle: "Outcomes, monitoring, indicators, evidence, reports, and institutional insight.",
    logoLabel: "Impact",
    icon: "ChartNoAxesCombined",
    palette: { shell: "bg-[#08162f]", accent: "text-emerald-300", accentSoft: "bg-emerald-300/10", text: "text-slate-100" },
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
  },
  property: {
    id: "property",
    title: "DLPI Property Registry Workspace",
    subtitle: "NPIN, registry cases, verification, certificates, and land intelligence.",
    logoLabel: "DLPI",
    icon: "MapPinned",
    palette: { shell: "bg-[#102018]", accent: "text-lime-300", accentSoft: "bg-lime-300/10", text: "text-slate-100" },
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
  },
  msme: {
    id: "msme",
    title: "MSME Business Workspace",
    subtitle: "Business identity, compliance, finance readiness, invoices, services, and growth tools.",
    logoLabel: "MSME",
    icon: "Store",
    palette: { shell: "bg-[#0f2d2b]", accent: "text-emerald-300", accentSoft: "bg-emerald-300/10", text: "text-slate-100" },
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
  },
  association: {
    id: "association",
    title: "Association Workspace",
    subtitle: "Member onboarding, association operations, complaints, and exports.",
    logoLabel: "Assoc.",
    icon: "UsersRound",
    palette: { shell: "bg-[#1b2642]", accent: "text-cyan-300", accentSoft: "bg-cyan-300/10", text: "text-slate-100" },
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
  },
  admin: {
    id: "admin",
    title: "DBIN Administration Workspace",
    subtitle: "Platform operations, registries, verification, governance, and institutional control.",
    logoLabel: "Admin",
    icon: "Settings",
    palette: { shell: "bg-[#111827]", accent: "text-slate-200", accentSoft: "bg-white/10", text: "text-slate-100" },
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
  },
};

export function getWorkspaceDefinition(id: WorkspaceId) {
  return WORKSPACE_REGISTRY[id];
}

export function listWorkspaceDefinitions() {
  return Object.values(WORKSPACE_REGISTRY);
}
