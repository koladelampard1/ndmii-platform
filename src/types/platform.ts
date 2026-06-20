import type { UserRole } from "@/types/roles";

export type InstitutionType =
  | "federal_agency"
  | "state_government"
  | "lga"
  | "association"
  | "private_company"
  | "development_finance_institution"
  | "investor"
  | "technical_partner"
  | "programme_secretariat"
  | "regulator";

export type InstitutionStatus = "active" | "inactive" | "suspended" | "archived";

export type ScopeType = "global" | "institution" | "programme" | "cluster" | "association" | "project";

export type RoleAssignmentStatus = "active" | "inactive" | "revoked" | "expired";

export type ProgrammeType =
  | "industrial_development"
  | "investment_mobilisation"
  | "funding"
  | "training"
  | "export"
  | "compliance"
  | "association_support"
  | "impact_intervention";

export type ProgrammeStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type ClusterType =
  | "industrial_zone"
  | "processing_hub"
  | "technology_park"
  | "agro_processing_zone"
  | "leather_hub"
  | "automotive_cluster"
  | "creative_hub"
  | "solid_mineral_cluster"
  | "energy_hub"
  | "pharmaceutical_cluster";

export type ClusterStatus = "planned" | "active" | "paused" | "completed" | "archived";

export type ConsentDataCategory =
  | "business_profile"
  | "identity_status"
  | "compliance_status"
  | "finance_readiness"
  | "marketplace_profile"
  | "impact_data"
  | "documents"
  | "contact_information";

export type PlatformModuleKey =
  | "core_identity"
  | "msme_registry"
  | "public_verification"
  | "compliance"
  | "marketplace"
  | "complaints"
  | "impact_intelligence"
  | "association_management"
  | "lcdb_o_workspace"
  | "sicip_workspace"
  | "cluster_registry"
  | "investor_portal"
  | "funding_hub"
  | "partner_portal"
  | "export_hub";

export type PlatformModuleStatus = "active" | "inactive" | "preview" | "archived";
export type ModuleAccessStatus = "enabled" | "disabled" | "preview" | "suspended";

export type JsonRecord = Record<string, unknown>;

export type Country = {
  id: string;
  iso2: string;
  iso3: string;
  name: string;
  phone_code: string | null;
  currency_code: string | null;
  status: "active" | "inactive";
};

export type GeopoliticalZone = {
  id: string;
  country_id: string;
  name: string;
  code: string;
  description: string | null;
};

export type State = {
  id: string;
  country_id: string;
  geopolitical_zone_id: string | null;
  name: string;
  code: string;
  capital: string | null;
  status: "active" | "inactive";
};

export type Lga = {
  id: string;
  state_id: string;
  name: string;
  code: string | null;
  status: "active" | "inactive";
};

export type Institution = {
  id: string;
  name: string;
  slug: string;
  institution_type: InstitutionType;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string;
  country_id: string | null;
  state: string | null;
  state_id: string | null;
  lga: string | null;
  lga_id: string | null;
  status: InstitutionStatus;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type RoleAssignment = {
  id: string;
  user_id: string;
  role: UserRole | string;
  scope_type: ScopeType;
  scope_id: string | null;
  institution_id: string | null;
  status: RoleAssignmentStatus;
  assigned_by: string | null;
  assigned_at: string;
  expires_at: string | null;
  metadata: JsonRecord;
};

export type Programme = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  programme_type: ProgrammeType;
  owning_institution_id: string | null;
  status: ProgrammeStatus;
  start_date: string | null;
  end_date: string | null;
  target_sectors: string[];
  target_states: string[];
  target_lgas: string[];
  goals: unknown[];
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type IndustrialCluster = {
  id: string;
  name: string;
  slug: string;
  cluster_type: ClusterType;
  sector: string;
  state_id: string | null;
  lga_id: string | null;
  location_description: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ClusterStatus;
  owning_institution_id: string | null;
  programme_id: string | null;
  anchor_partner_id: string | null;
  description: string | null;
  infrastructure_status: string | null;
  investment_required: number | null;
  jobs_target: number | null;
  msme_target: number | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type ConsentRecord = {
  id: string;
  subject_type: "msme" | "business" | "user" | "institution";
  subject_id: string;
  grantee_type: "institution" | "investor" | "programme" | "partner" | "government_agency";
  grantee_id: string;
  data_categories: ConsentDataCategory[];
  purpose: string;
  status: "granted" | "revoked" | "expired" | "denied";
  granted_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  agreement_id: string | null;
  granted_by_user_id: string | null;
  revoked_by_user_id: string | null;
  metadata: JsonRecord;
};

export type PlatformEvent = {
  id: string;
  actor_user_id: string | null;
  actor_institution_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  scope_type: ScopeType | null;
  scope_id: string | null;
  metadata: JsonRecord;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type PlatformModule = {
  id: string;
  module_key: PlatformModuleKey;
  name: string;
  description: string | null;
  status: PlatformModuleStatus;
  metadata: JsonRecord;
};

export type EffectiveRoleResolution = {
  globalRole: UserRole;
  scopedRoles: RoleAssignment[];
  roles: string[];
  isPlatformAdmin: boolean;
};
