-- DBIN Platform Workspace Foundation Phase 1
-- Additive infrastructure for institutions, scoped roles, geography,
-- general programmes, industrial clusters, consent, audit events, and modules.

create extension if not exists "pgcrypto";

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 text not null unique,
  iso3 text not null unique,
  name text not null,
  phone_code text,
  currency_code text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countries_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.geopolitical_zones (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geopolitical_zones_unique_code unique (country_id, code),
  constraint geopolitical_zones_unique_name unique (country_id, name)
);

create table if not exists public.states (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  geopolitical_zone_id uuid references public.geopolitical_zones(id) on delete set null,
  name text not null,
  code text not null,
  capital text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint states_status_check check (status in ('active', 'inactive')),
  constraint states_unique_code unique (country_id, code),
  constraint states_unique_name unique (country_id, name)
);

create table if not exists public.lgas (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states(id) on delete cascade,
  name text not null,
  code text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lgas_status_check check (status in ('active', 'inactive')),
  constraint lgas_unique_name unique (state_id, name)
);

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  institution_type text not null,
  description text,
  logo_url text,
  website text,
  email text,
  phone text,
  address text,
  country text not null default 'Nigeria',
  country_id uuid references public.countries(id) on delete set null,
  state text,
  state_id uuid references public.states(id) on delete set null,
  lga text,
  lga_id uuid references public.lgas(id) on delete set null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institutions_type_check check (institution_type in (
    'federal_agency',
    'state_government',
    'lga',
    'association',
    'private_company',
    'development_finance_institution',
    'investor',
    'technical_partner',
    'programme_secretariat',
    'regulator'
  )),
  constraint institutions_status_check check (status in ('active', 'inactive', 'suspended', 'archived'))
);

create table if not exists public.institution_roles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  role_key text not null,
  name text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_roles_unique_key unique (institution_id, role_key),
  constraint institution_roles_status_check check (status in ('active', 'inactive', 'archived'))
);

create table if not exists public.institution_members (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  institution_role_id uuid references public.institution_roles(id) on delete set null,
  role text not null,
  title text,
  status text not null default 'active',
  invited_by uuid references public.users(id) on delete set null,
  joined_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_members_status_check check (status in ('invited', 'active', 'inactive', 'suspended', 'revoked')),
  constraint institution_members_dates_check check (expires_at is null or joined_at is null or expires_at >= joined_at)
);

create unique index if not exists idx_institution_members_unique_active
  on public.institution_members(institution_id, user_id, role)
  where status in ('invited', 'active');

create table if not exists public.institution_settings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  is_sensitive boolean not null default false,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_settings_unique_key unique (institution_id, setting_key)
);

create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  programme_type text not null,
  owning_institution_id uuid references public.institutions(id) on delete set null,
  status text not null default 'draft',
  start_date date,
  end_date date,
  target_sectors text[] not null default '{}'::text[],
  target_states uuid[] not null default '{}'::uuid[],
  target_lgas uuid[] not null default '{}'::uuid[],
  goals jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programmes_type_check check (programme_type in (
    'industrial_development',
    'investment_mobilisation',
    'funding',
    'training',
    'export',
    'compliance',
    'association_support',
    'impact_intervention'
  )),
  constraint programmes_status_check check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  constraint programmes_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.programme_partners (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  partner_role text not null default 'partner',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_partners_unique unique (programme_id, institution_id, partner_role),
  constraint programme_partners_status_check check (status in ('active', 'inactive', 'suspended', 'archived'))
);

create table if not exists public.programme_members (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  role text not null,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_members_status_check check (status in ('active', 'inactive', 'suspended', 'revoked')),
  constraint programme_members_dates_check check (expires_at is null or expires_at >= joined_at)
);

create unique index if not exists idx_programme_members_unique_active
  on public.programme_members(programme_id, user_id, role)
  where status = 'active';

create table if not exists public.programme_enrolments (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  msme_id uuid references public.msmes(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  enrolment_type text not null default 'msme',
  status text not null default 'active',
  enrolled_by uuid references public.users(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  exited_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_enrolments_subject_check check (msme_id is not null or institution_id is not null),
  constraint programme_enrolments_type_check check (enrolment_type in ('msme', 'institution', 'cluster', 'project')),
  constraint programme_enrolments_status_check check (status in ('invited', 'active', 'paused', 'completed', 'withdrawn', 'rejected')),
  constraint programme_enrolments_dates_check check (exited_at is null or exited_at >= enrolled_at)
);

create table if not exists public.programme_events (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_institution_id uuid references public.institutions(id) on delete set null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null,
  scope_type text not null,
  scope_id uuid,
  institution_id uuid references public.institutions(id) on delete cascade,
  status text not null default 'active',
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_assignments_scope_type_check check (scope_type in ('global', 'institution', 'programme', 'cluster', 'association', 'project')),
  constraint role_assignments_status_check check (status in ('active', 'inactive', 'revoked', 'expired')),
  constraint role_assignments_scope_check check (scope_type = 'global' or scope_id is not null or institution_id is not null),
  constraint role_assignments_dates_check check (expires_at is null or expires_at >= assigned_at)
);

create unique index if not exists idx_role_assignments_unique_active
  on public.role_assignments(user_id, role, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'active';

create table if not exists public.industrial_clusters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  cluster_type text not null,
  sector text not null,
  state_id uuid references public.states(id) on delete set null,
  lga_id uuid references public.lgas(id) on delete set null,
  location_description text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  status text not null default 'planned',
  owning_institution_id uuid references public.institutions(id) on delete set null,
  programme_id uuid references public.programmes(id) on delete set null,
  anchor_partner_id uuid references public.institutions(id) on delete set null,
  description text,
  infrastructure_status text,
  investment_required numeric(18,2),
  jobs_target integer,
  msme_target integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint industrial_clusters_type_check check (cluster_type in (
    'industrial_zone',
    'processing_hub',
    'technology_park',
    'agro_processing_zone',
    'leather_hub',
    'automotive_cluster',
    'creative_hub',
    'solid_mineral_cluster',
    'energy_hub',
    'pharmaceutical_cluster'
  )),
  constraint industrial_clusters_status_check check (status in ('planned', 'active', 'paused', 'completed', 'archived'))
);

create table if not exists public.cluster_members (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.industrial_clusters(id) on delete cascade,
  msme_id uuid references public.msmes(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete cascade,
  member_type text not null default 'msme',
  role text,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  exited_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cluster_members_subject_check check (msme_id is not null or institution_id is not null),
  constraint cluster_members_status_check check (status in ('invited', 'active', 'paused', 'exited', 'removed'))
);

create table if not exists public.cluster_facilities (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.industrial_clusters(id) on delete cascade,
  name text not null,
  facility_type text not null,
  description text,
  status text not null default 'planned',
  capacity text,
  operator_institution_id uuid references public.institutions(id) on delete set null,
  investment_required numeric(18,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cluster_projects (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.industrial_clusters(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete set null,
  name text not null,
  project_type text not null default 'infrastructure',
  description text,
  status text not null default 'planned',
  start_date date,
  end_date date,
  budget_amount numeric(18,2),
  lead_institution_id uuid references public.institutions(id) on delete set null,
  state_id uuid references public.states(id) on delete set null,
  lga_id uuid references public.lgas(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cluster_value_chains (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.industrial_clusters(id) on delete cascade,
  name text not null,
  sector text,
  stage text,
  description text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cluster_value_chains_unique unique (cluster_id, name)
);

create table if not exists public.data_sharing_agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_reference text not null unique,
  provider_institution_id uuid references public.institutions(id) on delete set null,
  grantee_institution_id uuid references public.institutions(id) on delete set null,
  title text not null,
  purpose text not null,
  data_categories text[] not null default '{}'::text[],
  status text not null default 'draft',
  starts_at timestamptz,
  expires_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_sharing_agreements_status_check check (status in ('draft', 'active', 'paused', 'expired', 'revoked', 'archived')),
  constraint data_sharing_agreements_dates_check check (expires_at is null or starts_at is null or expires_at >= starts_at)
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  grantee_type text not null,
  grantee_id uuid not null,
  data_categories text[] not null default '{}'::text[],
  purpose text not null,
  status text not null default 'granted',
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  agreement_id uuid references public.data_sharing_agreements(id) on delete set null,
  granted_by_user_id uuid references public.users(id) on delete set null,
  revoked_by_user_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consent_records_subject_type_check check (subject_type in ('msme', 'business', 'user', 'institution')),
  constraint consent_records_grantee_type_check check (grantee_type in ('institution', 'investor', 'programme', 'partner', 'government_agency')),
  constraint consent_records_status_check check (status in ('granted', 'revoked', 'expired', 'denied')),
  constraint consent_records_dates_check check (expires_at is null or granted_at is null or expires_at >= granted_at)
);

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_institution_id uuid references public.institutions(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  scope_type text,
  scope_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint platform_events_scope_type_check check (scope_type is null or scope_type in ('global', 'institution', 'programme', 'cluster', 'association', 'project'))
);

create table if not exists public.platform_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  name text not null,
  description text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_modules_status_check check (status in ('active', 'inactive', 'preview', 'archived'))
);

create table if not exists public.institution_module_access (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  module_id uuid not null references public.platform_modules(id) on delete cascade,
  status text not null default 'enabled',
  settings jsonb not null default '{}'::jsonb,
  enabled_by uuid references public.users(id) on delete set null,
  enabled_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_module_access_unique unique (institution_id, module_id),
  constraint institution_module_access_status_check check (status in ('enabled', 'disabled', 'preview', 'suspended'))
);

create table if not exists public.programme_module_access (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  module_id uuid not null references public.platform_modules(id) on delete cascade,
  status text not null default 'enabled',
  settings jsonb not null default '{}'::jsonb,
  enabled_by uuid references public.users(id) on delete set null,
  enabled_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_module_access_unique unique (programme_id, module_id),
  constraint programme_module_access_status_check check (status in ('enabled', 'disabled', 'preview', 'suspended'))
);

alter table if exists public.msmes
  add column if not exists country_id uuid references public.countries(id) on delete set null,
  add column if not exists state_id uuid references public.states(id) on delete set null,
  add column if not exists lga_id uuid references public.lgas(id) on delete set null;

alter table if exists public.associations
  add column if not exists institution_id uuid references public.institutions(id) on delete set null,
  add column if not exists country_id uuid references public.countries(id) on delete set null,
  add column if not exists state_id uuid references public.states(id) on delete set null,
  add column if not exists lga_id uuid references public.lgas(id) on delete set null;

create index if not exists idx_geopolitical_zones_country on public.geopolitical_zones(country_id);
create index if not exists idx_states_country on public.states(country_id);
create index if not exists idx_states_zone on public.states(geopolitical_zone_id);
create index if not exists idx_lgas_state on public.lgas(state_id);
create index if not exists idx_institutions_type_status on public.institutions(institution_type, status);
create index if not exists idx_institutions_state on public.institutions(state_id);
create index if not exists idx_institution_members_user on public.institution_members(user_id, status);
create index if not exists idx_role_assignments_user_scope on public.role_assignments(user_id, scope_type, scope_id, status);
create index if not exists idx_role_assignments_institution on public.role_assignments(institution_id, status);
create index if not exists idx_programmes_owner_status on public.programmes(owning_institution_id, status);
create index if not exists idx_programme_partners_programme on public.programme_partners(programme_id);
create index if not exists idx_programme_members_user on public.programme_members(user_id, status);
create index if not exists idx_programme_enrolments_programme on public.programme_enrolments(programme_id, status);
create index if not exists idx_programme_enrolments_msme on public.programme_enrolments(msme_id, status);
create index if not exists idx_programme_events_programme_created on public.programme_events(programme_id, created_at desc);
create index if not exists idx_industrial_clusters_type_status on public.industrial_clusters(cluster_type, status);
create index if not exists idx_industrial_clusters_state_lga on public.industrial_clusters(state_id, lga_id);
create index if not exists idx_industrial_clusters_programme on public.industrial_clusters(programme_id);
create index if not exists idx_cluster_members_cluster on public.cluster_members(cluster_id, status);
create index if not exists idx_cluster_members_msme on public.cluster_members(msme_id, status);
create index if not exists idx_cluster_facilities_cluster on public.cluster_facilities(cluster_id);
create index if not exists idx_cluster_projects_cluster on public.cluster_projects(cluster_id);
create index if not exists idx_cluster_value_chains_cluster on public.cluster_value_chains(cluster_id);
create index if not exists idx_consent_records_subject on public.consent_records(subject_type, subject_id, status);
create index if not exists idx_consent_records_grantee on public.consent_records(grantee_type, grantee_id, status);
create index if not exists idx_data_sharing_agreements_grantee on public.data_sharing_agreements(grantee_institution_id, status);
create index if not exists idx_platform_events_entity on public.platform_events(entity_type, entity_id, created_at desc);
create index if not exists idx_platform_events_actor on public.platform_events(actor_user_id, created_at desc);
create index if not exists idx_platform_events_scope on public.platform_events(scope_type, scope_id, created_at desc);
create index if not exists idx_institution_module_access_institution on public.institution_module_access(institution_id, status);
create index if not exists idx_programme_module_access_programme on public.programme_module_access(programme_id, status);
create index if not exists idx_msmes_geography on public.msmes(country_id, state_id, lga_id);
create index if not exists idx_associations_institution on public.associations(institution_id);

create or replace function public.set_platform_foundation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_countries_updated_at on public.countries;
create trigger set_countries_updated_at before update on public.countries for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_geopolitical_zones_updated_at on public.geopolitical_zones;
create trigger set_geopolitical_zones_updated_at before update on public.geopolitical_zones for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_states_updated_at on public.states;
create trigger set_states_updated_at before update on public.states for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lgas_updated_at on public.lgas;
create trigger set_lgas_updated_at before update on public.lgas for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_institutions_updated_at on public.institutions;
create trigger set_institutions_updated_at before update on public.institutions for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_institution_roles_updated_at on public.institution_roles;
create trigger set_institution_roles_updated_at before update on public.institution_roles for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_institution_members_updated_at on public.institution_members;
create trigger set_institution_members_updated_at before update on public.institution_members for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_institution_settings_updated_at on public.institution_settings;
create trigger set_institution_settings_updated_at before update on public.institution_settings for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_programmes_updated_at on public.programmes;
create trigger set_programmes_updated_at before update on public.programmes for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_programme_partners_updated_at on public.programme_partners;
create trigger set_programme_partners_updated_at before update on public.programme_partners for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_programme_members_updated_at on public.programme_members;
create trigger set_programme_members_updated_at before update on public.programme_members for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_programme_enrolments_updated_at on public.programme_enrolments;
create trigger set_programme_enrolments_updated_at before update on public.programme_enrolments for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_role_assignments_updated_at on public.role_assignments;
create trigger set_role_assignments_updated_at before update on public.role_assignments for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_industrial_clusters_updated_at on public.industrial_clusters;
create trigger set_industrial_clusters_updated_at before update on public.industrial_clusters for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_cluster_members_updated_at on public.cluster_members;
create trigger set_cluster_members_updated_at before update on public.cluster_members for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_cluster_facilities_updated_at on public.cluster_facilities;
create trigger set_cluster_facilities_updated_at before update on public.cluster_facilities for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_cluster_projects_updated_at on public.cluster_projects;
create trigger set_cluster_projects_updated_at before update on public.cluster_projects for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_cluster_value_chains_updated_at on public.cluster_value_chains;
create trigger set_cluster_value_chains_updated_at before update on public.cluster_value_chains for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_data_sharing_agreements_updated_at on public.data_sharing_agreements;
create trigger set_data_sharing_agreements_updated_at before update on public.data_sharing_agreements for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_consent_records_updated_at on public.consent_records;
create trigger set_consent_records_updated_at before update on public.consent_records for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_platform_modules_updated_at on public.platform_modules;
create trigger set_platform_modules_updated_at before update on public.platform_modules for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_institution_module_access_updated_at on public.institution_module_access;
create trigger set_institution_module_access_updated_at before update on public.institution_module_access for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_programme_module_access_updated_at on public.programme_module_access;
create trigger set_programme_module_access_updated_at before update on public.programme_module_access for each row execute function public.set_platform_foundation_updated_at();

alter table public.countries enable row level security;
alter table public.geopolitical_zones enable row level security;
alter table public.states enable row level security;
alter table public.lgas enable row level security;
alter table public.institutions enable row level security;
alter table public.institution_roles enable row level security;
alter table public.institution_members enable row level security;
alter table public.institution_settings enable row level security;
alter table public.role_assignments enable row level security;
alter table public.programmes enable row level security;
alter table public.programme_partners enable row level security;
alter table public.programme_members enable row level security;
alter table public.programme_enrolments enable row level security;
alter table public.programme_events enable row level security;
alter table public.industrial_clusters enable row level security;
alter table public.cluster_members enable row level security;
alter table public.cluster_facilities enable row level security;
alter table public.cluster_projects enable row level security;
alter table public.cluster_value_chains enable row level security;
alter table public.data_sharing_agreements enable row level security;
alter table public.consent_records enable row level security;
alter table public.platform_events enable row level security;
alter table public.platform_modules enable row level security;
alter table public.institution_module_access enable row level security;
alter table public.programme_module_access enable row level security;

drop policy if exists "Public can read canonical geography" on public.countries;
create policy "Public can read canonical geography" on public.countries for select using (true);
drop policy if exists "Public can read geopolitical zones" on public.geopolitical_zones;
create policy "Public can read geopolitical zones" on public.geopolitical_zones for select using (true);
drop policy if exists "Public can read states" on public.states;
create policy "Public can read states" on public.states for select using (true);
drop policy if exists "Public can read lgas" on public.lgas;
create policy "Public can read lgas" on public.lgas for select using (true);
drop policy if exists "Public can read active institutions" on public.institutions;
create policy "Public can read active institutions" on public.institutions for select using (status = 'active');
drop policy if exists "Public can read active platform modules" on public.platform_modules;
create policy "Public can read active platform modules" on public.platform_modules for select using (status in ('active', 'preview'));

insert into public.countries (iso2, iso3, name, phone_code, currency_code, status)
values ('NG', 'NGA', 'Nigeria', '+234', 'NGN', 'active')
on conflict (iso2) do update set
  iso3 = excluded.iso3,
  name = excluded.name,
  phone_code = excluded.phone_code,
  currency_code = excluded.currency_code,
  status = excluded.status,
  updated_at = now();

with nigeria as (
  select id from public.countries where iso2 = 'NG'
)
insert into public.geopolitical_zones (country_id, name, code, description)
select nigeria.id, zone.name, zone.code, zone.description
from nigeria
cross join (values
  ('North Central', 'NC', 'Benue, Kogi, Kwara, Nasarawa, Niger, Plateau, and FCT'),
  ('North East', 'NE', 'Adamawa, Bauchi, Borno, Gombe, Taraba, and Yobe'),
  ('North West', 'NW', 'Jigawa, Kaduna, Kano, Katsina, Kebbi, Sokoto, and Zamfara'),
  ('South East', 'SE', 'Abia, Anambra, Ebonyi, Enugu, and Imo'),
  ('South South', 'SS', 'Akwa Ibom, Bayelsa, Cross River, Delta, Edo, and Rivers'),
  ('South West', 'SW', 'Ekiti, Lagos, Ogun, Ondo, Osun, and Oyo')
) as zone(name, code, description)
on conflict (country_id, code) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

with nigeria as (
  select id from public.countries where iso2 = 'NG'
),
zones as (
  select code, id from public.geopolitical_zones where country_id = (select id from nigeria)
)
insert into public.states (country_id, geopolitical_zone_id, name, code, capital)
select nigeria.id, zones.id, state.name, state.code, state.capital
from nigeria
join (values
  ('Abia', 'AB', 'Umuahia', 'SE'),
  ('Adamawa', 'AD', 'Yola', 'NE'),
  ('Akwa Ibom', 'AK', 'Uyo', 'SS'),
  ('Anambra', 'AN', 'Awka', 'SE'),
  ('Bauchi', 'BA', 'Bauchi', 'NE'),
  ('Bayelsa', 'BY', 'Yenagoa', 'SS'),
  ('Benue', 'BE', 'Makurdi', 'NC'),
  ('Borno', 'BO', 'Maiduguri', 'NE'),
  ('Cross River', 'CR', 'Calabar', 'SS'),
  ('Delta', 'DE', 'Asaba', 'SS'),
  ('Ebonyi', 'EB', 'Abakaliki', 'SE'),
  ('Edo', 'ED', 'Benin City', 'SS'),
  ('Ekiti', 'EK', 'Ado Ekiti', 'SW'),
  ('Enugu', 'EN', 'Enugu', 'SE'),
  ('Federal Capital Territory', 'FC', 'Abuja', 'NC'),
  ('Gombe', 'GO', 'Gombe', 'NE'),
  ('Imo', 'IM', 'Owerri', 'SE'),
  ('Jigawa', 'JI', 'Dutse', 'NW'),
  ('Kaduna', 'KD', 'Kaduna', 'NW'),
  ('Kano', 'KN', 'Kano', 'NW'),
  ('Katsina', 'KT', 'Katsina', 'NW'),
  ('Kebbi', 'KB', 'Birnin Kebbi', 'NW'),
  ('Kogi', 'KG', 'Lokoja', 'NC'),
  ('Kwara', 'KW', 'Ilorin', 'NC'),
  ('Lagos', 'LA', 'Ikeja', 'SW'),
  ('Nasarawa', 'NA', 'Lafia', 'NC'),
  ('Niger', 'NI', 'Minna', 'NC'),
  ('Ogun', 'OG', 'Abeokuta', 'SW'),
  ('Ondo', 'ON', 'Akure', 'SW'),
  ('Osun', 'OS', 'Oshogbo', 'SW'),
  ('Oyo', 'OY', 'Ibadan', 'SW'),
  ('Plateau', 'PL', 'Jos', 'NC'),
  ('Rivers', 'RI', 'Port Harcourt', 'SS'),
  ('Sokoto', 'SO', 'Sokoto', 'NW'),
  ('Taraba', 'TA', 'Jalingo', 'NE'),
  ('Yobe', 'YO', 'Damaturu', 'NE'),
  ('Zamfara', 'ZA', 'Gusau', 'NW')
) as state(name, code, capital, zone_code) on true
join zones on zones.code = state.zone_code
on conflict (country_id, code) do update set
  geopolitical_zone_id = excluded.geopolitical_zone_id,
  name = excluded.name,
  capital = excluded.capital,
  status = 'active',
  updated_at = now();

with state_rows as (
  select id, name from public.states where country_id = (select id from public.countries where iso2 = 'NG')
)
insert into public.lgas (state_id, name, code)
select state_rows.id, lga.name, lga.code
from state_rows
join (values
  ('Lagos', 'Ikeja', 'LA-IKE'),
  ('Lagos', 'Surulere', 'LA-SUR'),
  ('Lagos', 'Mushin', 'LA-MUS'),
  ('Ogun', 'Abeokuta South', 'OG-ABS'),
  ('Oyo', 'Ibadan North', 'OY-IBN'),
  ('Kano', 'Kano Municipal', 'KN-KMC'),
  ('Kano', 'Nassarawa', 'KN-NAS'),
  ('Federal Capital Territory', 'Abuja Municipal', 'FC-AMAC'),
  ('Abia', 'Aba North', 'AB-ABN'),
  ('Abia', 'Aba South', 'AB-ABS'),
  ('Rivers', 'Port Harcourt', 'RI-PHC')
) as lga(state_name, name, code) on lga.state_name = state_rows.name
on conflict (state_id, name) do update set
  code = excluded.code,
  status = 'active',
  updated_at = now();

with geo as (
  select
    c.id as country_id,
    lagos.id as lagos_id,
    fct.id as fct_id
  from public.countries c
  left join public.states lagos on lagos.country_id = c.id and lagos.name = 'Lagos'
  left join public.states fct on fct.country_id = c.id and fct.name = 'Federal Capital Territory'
  where c.iso2 = 'NG'
)
insert into public.institutions (
  name, slug, institution_type, description, website, email, country_id, state_id, state, status, metadata
)
select institution.name, institution.slug, institution.institution_type, institution.description, institution.website, institution.email,
  geo.country_id,
  case when institution.state_name = 'Lagos' then geo.lagos_id when institution.state_name = 'Federal Capital Territory' then geo.fct_id else null end,
  institution.state_name,
  'active',
  jsonb_build_object('seed_key', institution.slug, 'source', 'platform_foundation_phase1')
from geo
cross join (values
  ('Roseate Forte Nigeria Limited', 'roseate-forte-nigeria-limited', 'private_company', 'Private-sector programme partner and platform delivery institution.', 'https://roseateforte.com', 'info@roseateforte.com', 'Lagos'),
  ('Raw Materials Research and Development Council', 'rmrdc', 'federal_agency', 'Federal agency supporting raw materials development and industrial value chains.', 'https://rmrdc.gov.ng', 'info@rmrdc.gov.ng', 'Federal Capital Territory'),
  ('Nigerian Association of Small Scale Industrialists', 'nassi', 'association', 'National association for small-scale industrialists and MSME cluster mobilisation.', 'https://nassi.org.ng', 'info@nassi.org.ng', 'Lagos'),
  ('Nigerian Society of Engineers', 'nse', 'technical_partner', 'Technical partner for engineering, standards, and industrial capability support.', 'https://www.nse.org.ng', 'info@nse.org.ng', 'Lagos'),
  ('Bank of Industry', 'boi', 'development_finance_institution', 'Development finance institution for industrial finance and MSME growth.', 'https://www.boi.ng', 'info@boi.ng', 'Federal Capital Territory'),
  ('African Continental Free Trade Area Secretariat', 'afcfta', 'programme_secretariat', 'Continental trade and export-market access programme stakeholder.', 'https://au-afcfta.org', 'info@au-afcfta.org', 'Federal Capital Territory')
) as institution(name, slug, institution_type, description, website, email, state_name)
on conflict (slug) do update set
  name = excluded.name,
  institution_type = excluded.institution_type,
  description = excluded.description,
  website = excluded.website,
  email = excluded.email,
  country_id = excluded.country_id,
  state_id = excluded.state_id,
  state = excluded.state,
  status = excluded.status,
  metadata = public.institutions.metadata || excluded.metadata,
  updated_at = now();

insert into public.platform_modules (module_key, name, description, status, metadata)
values
  ('core_identity', 'Core Identity', 'Business identity, credential issuance, and identity lifecycle infrastructure.', 'active', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('msme_registry', 'MSME Registry', 'Canonical MSME registry and registry operations.', 'active', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('public_verification', 'Public Verification', 'Public credential and business verification flows.', 'active', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('compliance', 'Compliance', 'Compliance requirements, evidence, reviews, and reminders.', 'active', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('marketplace', 'Marketplace', 'Provider profiles, services, quotes, reviews, and marketplace workflows.', 'active', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('complaints', 'Complaints', 'Complaint intake, routing, handling, and regulator escalation.', 'active', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('impact_intelligence', 'Impact Intelligence', 'Programme monitoring, assessment, evidence, analytics, and reports.', 'active', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('association_management', 'Association Management', 'Association onboarding, member upload, invitations, and reviews.', 'active', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('lcdb_o_workspace', 'LCDBO Workspace', 'Local Content Development Beyond Oil programme workspace foundation.', 'preview', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('sicip_workspace', 'SICIP Workspace', 'Special Industrial Clusters Investment Programme workspace foundation.', 'preview', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('cluster_registry', 'Cluster Registry', 'Industrial cluster registry, facilities, value chains, and cluster projects.', 'preview', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('investor_portal', 'Investor Portal', 'Investor access, consented diligence, and opportunity discovery foundation.', 'preview', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('funding_hub', 'Funding Hub', 'Funding programme and finance mobilisation workspace foundation.', 'preview', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('partner_portal', 'Partner Portal', 'Institution and partner workspace access foundation.', 'preview', '{"phase":"platform_foundation_phase1"}'::jsonb),
  ('export_hub', 'Export Hub', 'Export readiness, market access, and trade programme foundation.', 'preview', '{"phase":"platform_foundation_phase1"}'::jsonb)
on conflict (module_key) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  metadata = public.platform_modules.metadata || excluded.metadata,
  updated_at = now();

with owners as (
  select
    (select id from public.institutions where slug = 'roseate-forte-nigeria-limited' limit 1) as roseate_id,
    (select id from public.institutions where slug = 'rmrdc' limit 1) as rmrdc_id,
    (select id from public.institutions where slug = 'nassi' limit 1) as nassi_id,
    (select id from public.institutions where slug = 'nse' limit 1) as nse_id,
    (select id from public.institutions where slug = 'boi' limit 1) as boi_id,
    (select id from public.institutions where slug = 'afcfta' limit 1) as afcfta_id
),
states_ref as (
  select
    (select id from public.states where name = 'Lagos' limit 1) as lagos_id,
    (select id from public.states where name = 'Ogun' limit 1) as ogun_id,
    (select id from public.states where name = 'Oyo' limit 1) as oyo_id,
    (select id from public.states where name = 'Kano' limit 1) as kano_id,
    (select id from public.states where name = 'Federal Capital Territory' limit 1) as fct_id
)
insert into public.programmes (
  name, slug, description, programme_type, owning_institution_id, status, start_date,
  target_sectors, target_states, goals, metadata
)
select programme.name, programme.slug, programme.description, programme.programme_type, programme.owner_id, 'active', programme.start_date,
  programme.target_sectors, programme.target_states, programme.goals, programme.metadata
from owners, states_ref
cross join lateral (values
  (
    'Local Content Development Beyond Oil',
    'local-content-development-beyond-oil',
    'Flagship industrial diversification programme for non-oil local content, MSME capability, and value-chain development.',
    'industrial_development',
    owners.roseate_id,
    date '2026-01-01',
    array['Leather', 'Agro-processing', 'Manufacturing', 'Technology'],
    array[states_ref.lagos_id, states_ref.ogun_id, states_ref.oyo_id],
    '[{"label":"Strengthen non-oil industrial clusters"},{"label":"Increase MSME participation in local value chains"},{"label":"Prepare bankable cluster investment pipelines"}]'::jsonb,
    '{"programme_code":"LCDBO","seed_key":"lcdb_o","source":"platform_foundation_phase1"}'::jsonb
  ),
  (
    'Special Industrial Clusters Investment Programme',
    'special-industrial-clusters-investment-programme',
    'Flagship cluster investment programme for industrial parks, processing hubs, and investable shared infrastructure.',
    'investment_mobilisation',
    owners.rmrdc_id,
    date '2026-01-01',
    array['Leather', 'Agro-processing', 'Technology', 'Solid minerals'],
    array[states_ref.lagos_id, states_ref.kano_id, states_ref.fct_id],
    '[{"label":"Create investor-ready industrial cluster pipelines"},{"label":"Coordinate public-private cluster infrastructure"},{"label":"Track jobs, MSME participation, and investment mobilisation"}]'::jsonb,
    '{"programme_code":"SICIP","seed_key":"sicip","source":"platform_foundation_phase1"}'::jsonb
  )
) as programme(name, slug, description, programme_type, owner_id, start_date, target_sectors, target_states, goals, metadata)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  programme_type = excluded.programme_type,
  owning_institution_id = excluded.owning_institution_id,
  status = excluded.status,
  start_date = excluded.start_date,
  target_sectors = excluded.target_sectors,
  target_states = excluded.target_states,
  goals = excluded.goals,
  metadata = public.programmes.metadata || excluded.metadata,
  updated_at = now();

with p as (
  select id, slug from public.programmes where slug in ('local-content-development-beyond-oil', 'special-industrial-clusters-investment-programme')
),
i as (
  select id, slug from public.institutions where slug in ('roseate-forte-nigeria-limited', 'rmrdc', 'nassi', 'nse', 'boi', 'afcfta')
)
insert into public.programme_partners (programme_id, institution_id, partner_role, status, metadata)
select p.id, i.id, partner.partner_role, 'active', jsonb_build_object('source', 'platform_foundation_phase1')
from (values
  ('local-content-development-beyond-oil', 'roseate-forte-nigeria-limited', 'lead_secretariat'),
  ('local-content-development-beyond-oil', 'nassi', 'association_mobilisation'),
  ('local-content-development-beyond-oil', 'rmrdc', 'technical_agency'),
  ('local-content-development-beyond-oil', 'afcfta', 'export_market_access'),
  ('special-industrial-clusters-investment-programme', 'rmrdc', 'lead_agency'),
  ('special-industrial-clusters-investment-programme', 'boi', 'finance_partner'),
  ('special-industrial-clusters-investment-programme', 'nse', 'technical_partner'),
  ('special-industrial-clusters-investment-programme', 'roseate-forte-nigeria-limited', 'delivery_partner')
) as partner(programme_slug, institution_slug, partner_role)
join p on p.slug = partner.programme_slug
join i on i.slug = partner.institution_slug
on conflict (programme_id, institution_id, partner_role) do update set
  status = 'active',
  metadata = public.programme_partners.metadata || excluded.metadata,
  updated_at = now();

with programme_ref as (
  select
    (select id from public.programmes where slug = 'local-content-development-beyond-oil' limit 1) as lcdb_o_id,
    (select id from public.programmes where slug = 'special-industrial-clusters-investment-programme' limit 1) as sicip_id
),
institution_ref as (
  select
    (select id from public.institutions where slug = 'roseate-forte-nigeria-limited' limit 1) as roseate_id,
    (select id from public.institutions where slug = 'rmrdc' limit 1) as rmrdc_id,
    (select id from public.institutions where slug = 'nassi' limit 1) as nassi_id,
    (select id from public.institutions where slug = 'nse' limit 1) as nse_id
),
state_ref as (
  select
    (select id from public.states where name = 'Lagos' limit 1) as lagos_id,
    (select id from public.states where name = 'Ogun' limit 1) as ogun_id,
    (select id from public.states where name = 'Federal Capital Territory' limit 1) as fct_id
),
lga_ref as (
  select
    (
      select l.id
      from public.lgas l
      join public.states s on s.id = l.state_id
      where s.name = 'Lagos' and l.name = 'Mushin'
      limit 1
    ) as mushin_id,
    (
      select l.id
      from public.lgas l
      join public.states s on s.id = l.state_id
      where s.name = 'Ogun' and l.name = 'Abeokuta South'
      limit 1
    ) as abeokuta_south_id,
    (
      select l.id
      from public.lgas l
      join public.states s on s.id = l.state_id
      where s.name = 'Federal Capital Territory' and l.name = 'Abuja Municipal'
      limit 1
    ) as amac_id
)
insert into public.industrial_clusters (
  name, slug, cluster_type, sector, state_id, lga_id, location_description, latitude, longitude,
  status, owning_institution_id, programme_id, anchor_partner_id, description, infrastructure_status,
  investment_required, jobs_target, msme_target, metadata
)
select cluster.name, cluster.slug, cluster.cluster_type, cluster.sector, cluster.state_id, cluster.lga_id, cluster.location_description,
  cluster.latitude, cluster.longitude, 'planned', cluster.owner_id, cluster.programme_id, cluster.anchor_partner_id,
  cluster.description, cluster.infrastructure_status, cluster.investment_required, cluster.jobs_target, cluster.msme_target,
  cluster.metadata
from programme_ref, institution_ref, state_ref, lga_ref
cross join lateral (values
  (
    'Southwest Leather Industrial Processing Hub',
    'southwest-leather-industrial-processing-hub',
    'leather_hub',
    'Leather and light manufacturing',
    state_ref.lagos_id,
    lga_ref.mushin_id,
    'Southwest pilot leather processing and finishing hub.',
    6.5244::numeric,
    3.3792::numeric,
    institution_ref.roseate_id,
    programme_ref.lcdb_o_id,
    institution_ref.nassi_id,
    'Cluster foundation for leather MSMEs, shared processing facilities, quality improvement, and export-readiness support.',
    'baseline_mapping',
    2500000000::numeric,
    5000,
    750,
    '{"seed_key":"southwest_leather_hub","source":"platform_foundation_phase1"}'::jsonb
  ),
  (
    'Agro Processing Pilot Hub',
    'agro-processing-pilot-hub',
    'agro_processing_zone',
    'Agro-processing',
    state_ref.ogun_id,
    lga_ref.abeokuta_south_id,
    'Pilot agro-processing hub for shared facilities and value-chain aggregation.',
    7.1475::numeric,
    3.3619::numeric,
    institution_ref.rmrdc_id,
    programme_ref.sicip_id,
    institution_ref.rmrdc_id,
    'Cluster foundation for agricultural raw materials processing, packaging, and market access infrastructure.',
    'concept',
    4200000000::numeric,
    8000,
    1200,
    '{"seed_key":"agro_processing_pilot_hub","source":"platform_foundation_phase1"}'::jsonb
  ),
  (
    'Technology and Innovation Pilot Park',
    'technology-and-innovation-pilot-park',
    'technology_park',
    'Technology and innovation',
    state_ref.fct_id,
    lga_ref.amac_id,
    'Innovation pilot park for industrial technology services, engineering support, and digital MSME enablement.',
    9.0765::numeric,
    7.3986::numeric,
    institution_ref.roseate_id,
    programme_ref.sicip_id,
    institution_ref.nse_id,
    'Cluster foundation for technology-enabled MSMEs, industrial engineering services, and innovation partnerships.',
    'concept',
    3600000000::numeric,
    6500,
    900,
    '{"seed_key":"technology_innovation_pilot_park","source":"platform_foundation_phase1"}'::jsonb
  )
) as cluster(name, slug, cluster_type, sector, state_id, lga_id, location_description, latitude, longitude, owner_id, programme_id, anchor_partner_id, description, infrastructure_status, investment_required, jobs_target, msme_target, metadata)
on conflict (slug) do update set
  name = excluded.name,
  cluster_type = excluded.cluster_type,
  sector = excluded.sector,
  state_id = excluded.state_id,
  lga_id = excluded.lga_id,
  location_description = excluded.location_description,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  status = excluded.status,
  owning_institution_id = excluded.owning_institution_id,
  programme_id = excluded.programme_id,
  anchor_partner_id = excluded.anchor_partner_id,
  description = excluded.description,
  infrastructure_status = excluded.infrastructure_status,
  investment_required = excluded.investment_required,
  jobs_target = excluded.jobs_target,
  msme_target = excluded.msme_target,
  metadata = public.industrial_clusters.metadata || excluded.metadata,
  updated_at = now();

with modules as (
  select id, module_key from public.platform_modules
),
institutions as (
  select id, slug from public.institutions
),
programmes as (
  select id, slug from public.programmes
)
insert into public.institution_module_access (institution_id, module_id, status, settings)
select institutions.id, modules.id, 'enabled', jsonb_build_object('source', 'platform_foundation_phase1')
from institutions
join modules on modules.module_key in ('core_identity', 'msme_registry', 'public_verification', 'compliance', 'impact_intelligence', 'cluster_registry', 'partner_portal')
where institutions.slug in ('roseate-forte-nigeria-limited', 'rmrdc', 'nassi', 'nse', 'boi', 'afcfta')
on conflict (institution_id, module_id) do update set
  status = excluded.status,
  settings = public.institution_module_access.settings || excluded.settings,
  updated_at = now();

with modules as (
  select id, module_key from public.platform_modules
),
programmes as (
  select id, slug from public.programmes
)
insert into public.programme_module_access (programme_id, module_id, status, settings)
select programmes.id, modules.id, 'enabled', jsonb_build_object('source', 'platform_foundation_phase1')
from programmes
join modules on (
  (programmes.slug = 'local-content-development-beyond-oil' and modules.module_key in ('lcdb_o_workspace', 'cluster_registry', 'msme_registry', 'compliance', 'marketplace', 'export_hub', 'partner_portal'))
  or
  (programmes.slug = 'special-industrial-clusters-investment-programme' and modules.module_key in ('sicip_workspace', 'cluster_registry', 'investor_portal', 'funding_hub', 'impact_intelligence', 'partner_portal'))
)
on conflict (programme_id, module_id) do update set
  status = excluded.status,
  settings = public.programme_module_access.settings || excluded.settings,
  updated_at = now();

with nigeria as (
  select id from public.countries where iso2 = 'NG'
)
update public.msmes m
set
  country_id = coalesce(m.country_id, nigeria.id),
  state_id = coalesce(
    m.state_id,
    (
      select s.id
      from public.states s
      where s.country_id = nigeria.id
        and lower(s.name) = lower(m.state)
      limit 1
    )
  ),
  lga_id = coalesce(
    m.lga_id,
    (
      select l.id
      from public.lgas l
      join public.states s on s.id = l.state_id
      where s.country_id = nigeria.id
        and lower(s.name) = lower(m.state)
        and lower(l.name) = lower(m.lga)
      limit 1
    )
  )
from nigeria
where m.country_id is null or m.state_id is null or (m.lga_id is null and m.lga is not null);

with nigeria as (
  select id from public.countries where iso2 = 'NG'
)
update public.associations a
set
  country_id = coalesce(a.country_id, nigeria.id),
  state_id = coalesce(
    a.state_id,
    (
      select s.id
      from public.states s
      where s.country_id = nigeria.id
        and lower(s.name) = lower(coalesce(a.state, a.location))
      limit 1
    )
  ),
  lga_id = coalesce(
    a.lga_id,
    (
      select l.id
      from public.lgas l
      join public.states s on s.id = l.state_id
      where s.country_id = nigeria.id
        and lower(s.name) = lower(coalesce(a.state, a.location))
        and lower(l.name) = lower(coalesce(a.lga_coverage, ''))
      limit 1
    )
  )
from nigeria
where a.country_id is null or a.state_id is null or (a.lga_id is null and coalesce(a.lga_coverage, '') <> '');
