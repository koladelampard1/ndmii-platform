-- State Revenue Service Workspace Framework Sprint 0: EKIRS foundation.
-- Additive only. This migration seeds workspace reference records and does not
-- create auth users, credentials, live revenue records, collections, liabilities
-- or taxpayer assessments.

insert into public.institutions (
  name,
  slug,
  institution_type,
  description,
  country,
  country_id,
  state,
  state_id,
  status,
  metadata
)
select
  'Ekiti State Internal Revenue Service',
  'ekiti-state-internal-revenue-service',
  'state_government',
  'State revenue service workspace owner for Ekiti business formalisation, eligibility review and revenue-readiness coordination.',
  'Nigeria',
  c.id,
  'Ekiti',
  s.id,
  'active',
  jsonb_build_object(
    'workspace_id', 'ekirs',
    'workspace_type', 'state_revenue_service',
    'state_code', 'EK',
    'host', 'ekirs.dbin.ng',
    'source', 'state_revenue_ekirs_sprint0',
    'live_revenue_data_enabled', false,
    'lcda_records_status', 'pending_authoritative_confirmation'
  )
from public.countries c
left join public.states s on s.country_id = c.id and s.name = 'Ekiti'
where c.iso2 = 'NG'
on conflict (slug) do update set
  name = excluded.name,
  institution_type = excluded.institution_type,
  description = excluded.description,
  country_id = excluded.country_id,
  state_id = excluded.state_id,
  state = excluded.state,
  status = excluded.status,
  metadata = public.institutions.metadata || excluded.metadata,
  updated_at = now();

insert into public.platform_modules (module_key, name, description, status, metadata)
values (
  'state_revenue_service_workspace',
  'State Revenue Service Workspace',
  'Reusable state revenue service workspace foundation for business formalisation, jurisdiction eligibility, readiness intelligence and integration planning.',
  'preview',
  jsonb_build_object(
    'workspace_id', 'ekirs',
    'workspace_type', 'state_revenue_service',
    'source', 'state_revenue_ekirs_sprint0',
    'live_revenue_data_enabled', false
  )
)
on conflict (module_key) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  metadata = public.platform_modules.metadata || excluded.metadata,
  updated_at = now();

with ekirs as (
  select id from public.institutions where slug = 'ekiti-state-internal-revenue-service'
),
module as (
  select id from public.platform_modules where module_key = 'state_revenue_service_workspace'
)
insert into public.institution_module_access (institution_id, module_id, status, settings)
select
  ekirs.id,
  module.id,
  'preview',
  jsonb_build_object(
    'workspace_id', 'ekirs',
    'jurisdiction_id', 'ekiti',
    'scope_type', 'institution',
    'source', 'state_revenue_ekirs_sprint0'
  )
from ekirs, module
on conflict (institution_id, module_id) do update set
  status = excluded.status,
  settings = public.institution_module_access.settings || excluded.settings,
  updated_at = now();
