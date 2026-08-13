import type { UserRole } from "@/types/roles";
import type { PlatformModuleKey } from "@/types/platform";
import type { WorkspaceLanguage } from "@/lib/workspaces/workspace-language";

export type WorkspaceId =
  | "admin"
  | "association"
  | "boi"
  | "correspondence"
  | "fccpc"
  | "impact-intelligence"
  | "ekirs"
  | "lcdbo"
  | "msme"
  | "nrs"
  | "property";

export type WorkspaceCapability =
  | "operations"
  | "registry"
  | "intelligence"
  | "reports"
  | "executive"
  | "exports"
  | "governance"
  | "public-landing"
  | "case-management"
  | "participant-management";

export type WorkspaceDataClassification =
  | "operational"
  | "reference"
  | "estimate"
  | "target"
  | "aggregate"
  | "public"
  | "external"
  | "unavailable";

export type WorkspaceDataClassificationRule = {
  classification: WorkspaceDataClassification;
  label: string;
  description?: string;
  source?: string;
};

export type WorkspaceNavigationItem = {
  label: string;
  href: string;
  description?: string;
  legacyHref?: string;
  capabilities?: WorkspaceCapability[];
  allowedRoles?: UserRole[];
  dataClassification?: WorkspaceDataClassification;
};

export type WorkspaceNavigationSection = {
  label: string;
  description?: string;
  items: WorkspaceNavigationItem[];
};

export type WorkspaceScopedAccess = {
  baseRoles: UserRole[];
  roles: string[];
  scopeType: "programme" | "institution";
  programmeSlug?: string;
  institutionSlug?: string;
  moduleKey?: PlatformModuleKey;
};

export type WorkspacePalette = {
  shell: string;
  surface: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  text: string;
};

export type WorkspaceAccountContext = {
  label: string;
  switchAccountHref?: string;
  logoutHref?: string;
};

export type WorkspaceHostConfig = {
  canonicalHost?: string;
  hostEnvironmentKey?: string;
  futureHosts?: string[];
};

export type WorkspaceDefinition = {
  id: WorkspaceId;
  canonicalName: string;
  shortName: string;
  institutionalOwner: string;
  title: string;
  subtitle: string;
  purpose: string;
  logoLabel: string;
  icon: string;
  palette: WorkspacePalette;
  host?: WorkspaceHostConfig;
  publicLanding?: string;
  homepage: string;
  executiveDashboard?: string;
  reports?: string;
  allowedRoles: UserRole[];
  scopedAccess?: WorkspaceScopedAccess;
  navigation: WorkspaceNavigationItem[];
  navigationSections?: WorkspaceNavigationSection[];
  terminology: Partial<WorkspaceLanguage>;
  quickActions: WorkspaceNavigationItem[];
  dataClassification: WorkspaceDataClassificationRule[];
  accountContext: WorkspaceAccountContext;
  capabilities: WorkspaceCapability[];
  featureFlags?: Record<string, boolean>;
  legacyRouteAliases?: string[];
  mobileNavigation?: {
    primaryItems?: number;
    preferDrawer?: boolean;
  };
};
