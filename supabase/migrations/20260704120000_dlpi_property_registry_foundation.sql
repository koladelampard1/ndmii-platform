-- DBIN Property Platform Phase 1: Digital Land & Property Infrastructure foundation.
-- Additive registry-grade tables, NPIN strategy, geography extensions,
-- property-scoped RBAC, module seeds, consent purpose seeds, and audit helpers.

create extension if not exists "pgcrypto";

alter table public.role_assignments drop constraint if exists role_assignments_scope_type_check;
alter table public.role_assignments
  add constraint role_assignments_scope_type_check check (
    scope_type in (
      'global',
      'institution',
      'programme',
      'cluster',
      'association',
      'project',
      'property',
      'parcel',
      'survey_block',
      'state_registry',
      'lga_registry'
    )
  );

alter table public.platform_events drop constraint if exists platform_events_scope_type_check;
alter table public.platform_events
  add constraint platform_events_scope_type_check check (
    scope_type is null or scope_type in (
      'global',
      'institution',
      'programme',
      'cluster',
      'association',
      'project',
      'property',
      'parcel',
      'survey_block',
      'state_registry',
      'lga_registry'
    )
  );

create table if not exists public.property_wards (
  id uuid primary key default gen_random_uuid(),
  lga_id uuid not null references public.lgas(id) on delete cascade,
  name text not null,
  code text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_wards_status_check check (status in ('active', 'inactive', 'archived')),
  constraint property_wards_unique_name unique (lga_id, name),
  constraint property_wards_unique_code unique (lga_id, code)
);

create table if not exists public.property_districts (
  id uuid primary key default gen_random_uuid(),
  lga_id uuid not null references public.lgas(id) on delete cascade,
  ward_id uuid references public.property_wards(id) on delete set null,
  name text not null,
  code text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_districts_status_check check (status in ('active', 'inactive', 'archived')),
  constraint property_districts_unique_name unique (lga_id, name),
  constraint property_districts_unique_code unique (lga_id, code)
);

create table if not exists public.property_communities (
  id uuid primary key default gen_random_uuid(),
  lga_id uuid not null references public.lgas(id) on delete cascade,
  ward_id uuid references public.property_wards(id) on delete set null,
  district_id uuid references public.property_districts(id) on delete set null,
  name text not null,
  code text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_communities_status_check check (status in ('active', 'inactive', 'archived')),
  constraint property_communities_unique_name unique (lga_id, name),
  constraint property_communities_unique_code unique (lga_id, code)
);

create table if not exists public.property_villages (
  id uuid primary key default gen_random_uuid(),
  lga_id uuid not null references public.lgas(id) on delete cascade,
  ward_id uuid references public.property_wards(id) on delete set null,
  district_id uuid references public.property_districts(id) on delete set null,
  community_id uuid references public.property_communities(id) on delete set null,
  name text not null,
  code text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_villages_status_check check (status in ('active', 'inactive', 'archived')),
  constraint property_villages_unique_name unique (lga_id, name),
  constraint property_villages_unique_code unique (lga_id, code)
);

create table if not exists public.survey_blocks (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references public.countries(id) on delete set null,
  state_id uuid references public.states(id) on delete set null,
  lga_id uuid references public.lgas(id) on delete set null,
  ward_id uuid references public.property_wards(id) on delete set null,
  district_id uuid references public.property_districts(id) on delete set null,
  community_id uuid references public.property_communities(id) on delete set null,
  name text not null,
  code text not null,
  description text,
  geometry_placeholder jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint survey_blocks_status_check check (status in ('active', 'inactive', 'archived')),
  constraint survey_blocks_unique_code unique (state_id, lga_id, code)
);

create table if not exists public.property_categories (
  id uuid primary key default gen_random_uuid(),
  category_key text not null unique,
  name text not null,
  description text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_categories_status_check check (status in ('active', 'inactive', 'archived'))
);

create table if not exists public.property_document_types (
  id uuid primary key default gen_random_uuid(),
  document_type_key text not null unique,
  name text not null,
  description text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_document_types_status_check check (status in ('active', 'inactive', 'archived'))
);

create table if not exists public.property_consent_purposes (
  id uuid primary key default gen_random_uuid(),
  purpose_key text not null unique,
  name text not null,
  description text,
  data_categories text[] not null default '{}'::text[],
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_consent_purposes_status_check check (status in ('active', 'inactive', 'archived'))
);

create table if not exists public.property_npin_sequences (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states(id) on delete cascade,
  state_code text not null,
  last_value bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_npin_sequences_unique_state unique (state_id),
  constraint property_npin_sequences_value_check check (last_value >= 0)
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  npin text unique,
  parcel_reference text,
  property_category_id uuid references public.property_categories(id) on delete set null,
  property_type text not null,
  title text,
  description text,
  country_id uuid references public.countries(id) on delete set null,
  state_id uuid references public.states(id) on delete set null,
  lga_id uuid references public.lgas(id) on delete set null,
  ward_id uuid references public.property_wards(id) on delete set null,
  district_id uuid references public.property_districts(id) on delete set null,
  community_id uuid references public.property_communities(id) on delete set null,
  village_id uuid references public.property_villages(id) on delete set null,
  survey_block_id uuid references public.survey_blocks(id) on delete set null,
  status text not null default 'draft',
  registry_status text not null default 'draft',
  area_size numeric(18,4),
  area_unit text,
  geometry_placeholder jsonb not null default '{}'::jsonb,
  registered_by uuid references public.users(id) on delete set null,
  registry_institution_id uuid references public.institutions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_type_check check (property_type in (
    'residential',
    'commercial',
    'industrial',
    'agricultural',
    'mining',
    'institutional',
    'mixed_use',
    'government',
    'infrastructure',
    'protected'
  )),
  constraint properties_status_check check (status in (
    'draft',
    'submitted',
    'under_review',
    'verified',
    'active',
    'transferred',
    'suspended',
    'disputed',
    'archived',
    'cancelled'
  )),
  constraint properties_registry_status_check check (registry_status in (
    'draft',
    'submitted',
    'under_review',
    'verified',
    'active',
    'transferred',
    'suspended',
    'disputed',
    'archived',
    'cancelled'
  )),
  constraint properties_area_check check (area_size is null or area_size >= 0)
);

create unique index if not exists idx_properties_parcel_reference
  on public.properties(parcel_reference)
  where parcel_reference is not null;

create table if not exists public.property_addresses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  country_id uuid references public.countries(id) on delete set null,
  state_id uuid references public.states(id) on delete set null,
  lga_id uuid references public.lgas(id) on delete set null,
  ward_id uuid references public.property_wards(id) on delete set null,
  district_id uuid references public.property_districts(id) on delete set null,
  community_id uuid references public.property_communities(id) on delete set null,
  village_id uuid references public.property_villages(id) on delete set null,
  street text,
  building text,
  plot text,
  block text,
  parcel_reference text,
  centroid_latitude numeric(10,7),
  centroid_longitude numeric(10,7),
  traditional_description text,
  is_primary boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_addresses_latitude_check check (centroid_latitude is null or centroid_latitude between -90 and 90),
  constraint property_addresses_longitude_check check (centroid_longitude is null or centroid_longitude between -180 and 180)
);

create table if not exists public.property_claims (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  claim_reference text not null unique,
  claimant_type text not null,
  claimant_user_id uuid references public.users(id) on delete set null,
  claimant_institution_id uuid references public.institutions(id) on delete set null,
  claimant_msme_id uuid references public.msmes(id) on delete set null,
  claimant_name text,
  claim_type text not null default 'registration',
  status text not null default 'draft',
  submitted_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_claims_claimant_type_check check (claimant_type in ('individual', 'joint', 'corporate', 'government', 'institution', 'community', 'cooperative', 'trust', 'family_estate')),
  constraint property_claims_type_check check (claim_type in ('registration', 'ownership', 'transfer', 'correction', 'dispute', 'verification')),
  constraint property_claims_status_check check (status in ('draft', 'submitted', 'under_review', 'verified', 'approved', 'rejected', 'withdrawn', 'cancelled')),
  constraint property_claims_claimant_check check (claimant_user_id is not null or claimant_institution_id is not null or claimant_msme_id is not null or nullif(trim(coalesce(claimant_name, '')), '') is not null)
);

create table if not exists public.property_owners (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_type text not null,
  owner_user_id uuid references public.users(id) on delete set null,
  owner_institution_id uuid references public.institutions(id) on delete set null,
  owner_msme_id uuid references public.msmes(id) on delete set null,
  owner_name text,
  owner_identifier text,
  ownership_percentage numeric(6,3),
  is_primary boolean not null default false,
  verification_status text not null default 'unverified',
  effective_from date,
  effective_to date,
  source_claim_id uuid references public.property_claims(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_owners_type_check check (owner_type in ('individual', 'joint', 'corporate', 'government', 'institution', 'community', 'cooperative', 'trust', 'family_estate')),
  constraint property_owners_verification_status_check check (verification_status in ('unverified', 'pending_review', 'verified', 'rejected', 'superseded')),
  constraint property_owners_subject_check check (owner_user_id is not null or owner_institution_id is not null or owner_msme_id is not null or nullif(trim(coalesce(owner_name, '')), '') is not null),
  constraint property_owners_percentage_check check (ownership_percentage is null or (ownership_percentage > 0 and ownership_percentage <= 100)),
  constraint property_owners_effective_dates_check check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create unique index if not exists idx_property_owners_single_primary
  on public.property_owners(property_id)
  where is_primary and effective_to is null;

create table if not exists public.property_owner_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  property_owner_id uuid references public.property_owners(id) on delete set null,
  change_type text not null,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  changed_by uuid references public.users(id) on delete set null,
  change_note text,
  effective_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint property_owner_history_change_type_check check (change_type in ('added', 'updated', 'verified', 'transferred', 'removed', 'superseded'))
);

create table if not exists public.property_identity_credentials (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  npin text not null,
  credential_reference text not null unique,
  status text not null default 'issued',
  issued_by uuid references public.users(id) on delete set null,
  issued_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  superseded_by uuid references public.property_identity_credentials(id) on delete set null,
  suspended_at timestamptz,
  token_expires_at timestamptz,
  public_token text,
  public_token_hash text,
  qr_code_ref text,
  verification_url text,
  verification_snapshot jsonb not null default '{}'::jsonb,
  signature_version text,
  public_signature text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_identity_credentials_status_check check (status in ('issued', 'revoked', 'superseded', 'suspended')),
  constraint property_identity_credentials_npin_check check (npin ~ '^NPIN-[A-Z]{2,3}-[0-9]{9}$')
);

create unique index if not exists idx_property_identity_credentials_active_property
  on public.property_identity_credentials(property_id)
  where status = 'issued';
create unique index if not exists idx_property_identity_credentials_token_hash
  on public.property_identity_credentials(public_token_hash)
  where public_token_hash is not null;

create table if not exists public.property_identity_events (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid references public.property_identity_credentials(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  claim_id uuid references public.property_claims(id) on delete set null,
  document_type_id uuid references public.property_document_types(id) on delete set null,
  document_type text not null,
  title text not null,
  description text,
  document_reference text,
  issuer text,
  issued_at date,
  status text not null default 'pending_review',
  file_name text,
  file_url text,
  storage_bucket text,
  storage_path text,
  file_size_bytes bigint,
  mime_type text,
  checksum_sha256 text,
  uploaded_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_documents_status_check check (status in ('pending_review', 'accepted', 'rejected', 'expired', 'superseded', 'archived')),
  constraint property_documents_title_check check (nullif(trim(title), '') is not null),
  constraint property_documents_type_check check (document_type in (
    'survey_plan',
    'certificate_of_occupancy',
    'deed_of_assignment',
    'allocation_letter',
    'gazette',
    'governors_consent',
    'power_of_attorney',
    'valuation_report',
    'court_order',
    'tax_clearance',
    'building_approval',
    'photographs',
    'supporting_evidence'
  )),
  constraint property_documents_checksum_check check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$')
);

create table if not exists public.property_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.property_documents(id) on delete set null,
  property_id uuid references public.properties(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.property_status_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references public.users(id) on delete set null,
  change_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint property_status_history_new_status_check check (new_status in (
    'draft',
    'submitted',
    'under_review',
    'verified',
    'active',
    'transferred',
    'suspended',
    'disputed',
    'archived',
    'cancelled'
  ))
);

create table if not exists public.property_relationships (
  id uuid primary key default gen_random_uuid(),
  source_property_id uuid not null references public.properties(id) on delete cascade,
  target_property_id uuid not null references public.properties(id) on delete cascade,
  relationship_type text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_relationships_type_check check (relationship_type in ('subdivision_of', 'merged_into', 'adjacent_to', 'access_easement', 'leasehold_of', 'replacement_for', 'related')),
  constraint property_relationships_status_check check (status in ('active', 'inactive', 'archived')),
  constraint property_relationships_no_self_check check (source_property_id <> target_property_id),
  constraint property_relationships_unique unique (source_property_id, target_property_id, relationship_type)
);

create table if not exists public.property_tags (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  tag_key text not null,
  tag_value text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_tags_status_check check (status in ('active', 'inactive', 'archived')),
  constraint property_tags_unique unique (property_id, tag_key, tag_value)
);

create table if not exists public.property_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  event_type text not null,
  entity_type text not null default 'property',
  entity_id uuid,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_institution_id uuid references public.institutions(id) on delete set null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_property_wards_lga on public.property_wards(lga_id, status);
create index if not exists idx_property_districts_lga on public.property_districts(lga_id, status);
create index if not exists idx_property_communities_lga on public.property_communities(lga_id, status);
create index if not exists idx_property_villages_lga on public.property_villages(lga_id, status);
create index if not exists idx_survey_blocks_state_lga on public.survey_blocks(state_id, lga_id, status);
create index if not exists idx_properties_location on public.properties(country_id, state_id, lga_id, status);
create index if not exists idx_properties_survey_block on public.properties(survey_block_id);
create index if not exists idx_properties_registry_institution on public.properties(registry_institution_id, status);
create index if not exists idx_property_claims_property_status on public.property_claims(property_id, status);
create index if not exists idx_property_claims_claimant_user on public.property_claims(claimant_user_id, status);
create index if not exists idx_property_owners_property on public.property_owners(property_id, verification_status);
create index if not exists idx_property_owners_user on public.property_owners(owner_user_id, verification_status);
create index if not exists idx_property_owners_institution on public.property_owners(owner_institution_id, verification_status);
create index if not exists idx_property_owner_history_property on public.property_owner_history(property_id, created_at desc);
create index if not exists idx_property_identity_credentials_property_status on public.property_identity_credentials(property_id, status);
create index if not exists idx_property_identity_events_property on public.property_identity_events(property_id, created_at desc);
create index if not exists idx_property_documents_property on public.property_documents(property_id, status);
create index if not exists idx_property_documents_claim on public.property_documents(claim_id, status);
create index if not exists idx_property_document_events_property on public.property_document_events(property_id, created_at desc);
create index if not exists idx_property_status_history_property on public.property_status_history(property_id, created_at desc);
create index if not exists idx_property_tags_property on public.property_tags(property_id, status);
create index if not exists idx_property_events_property on public.property_events(property_id, created_at desc);
create index if not exists idx_property_events_type on public.property_events(event_type, created_at desc);

create or replace function public.generate_property_npin(target_state_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  state_code text;
  npin_state_code text;
  next_value bigint;
begin
  select code into state_code
  from public.states
  where id = target_state_id;

  if state_code is null then
    raise exception 'A valid state is required to generate an NPIN.';
  end if;

  npin_state_code := case when upper(state_code) = 'FC' then 'FCT' else upper(state_code) end;

  insert into public.property_npin_sequences (state_id, state_code, last_value)
  values (target_state_id, npin_state_code, 0)
  on conflict (state_id) do nothing;

  update public.property_npin_sequences
  set last_value = last_value + 1,
      state_code = npin_state_code,
      updated_at = now()
  where state_id = target_state_id
  returning last_value into next_value;

  return 'NPIN-' || npin_state_code || '-' || lpad(next_value::text, 9, '0');
end;
$$;

create or replace function public.property_current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.property_can_manage_registry(
  target_state_id uuid default null,
  target_lga_id uuid default null,
  target_institution_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and (
        u.role in ('admin', 'super_admin')
        or exists (
          select 1
          from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role in (
              'property_admin',
              'land_registry_officer',
              'survey_officer',
              'gis_officer',
              'property_reviewer',
              'valuation_officer',
              'document_verifier',
              'title_issuer',
              'property_data_analyst',
              'property_auditor',
              'executive_observer'
            )
            and (
              ra.scope_type = 'global'
              or (target_institution_id is not null and ra.institution_id = target_institution_id)
              or (target_state_id is not null and ra.scope_type = 'state_registry' and ra.scope_id = target_state_id)
              or (target_lga_id is not null and ra.scope_type = 'lga_registry' and ra.scope_id = target_lga_id)
            )
        )
      )
  )
$$;

revoke all on function public.generate_property_npin(uuid) from public;
grant execute on function public.generate_property_npin(uuid) to authenticated;
revoke all on function public.property_current_app_user_id() from public;
grant execute on function public.property_current_app_user_id() to authenticated;
revoke all on function public.property_can_manage_registry(uuid, uuid, uuid) from public;
grant execute on function public.property_can_manage_registry(uuid, uuid, uuid) to authenticated;

drop trigger if exists set_property_wards_updated_at on public.property_wards;
create trigger set_property_wards_updated_at before update on public.property_wards for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_districts_updated_at on public.property_districts;
create trigger set_property_districts_updated_at before update on public.property_districts for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_communities_updated_at on public.property_communities;
create trigger set_property_communities_updated_at before update on public.property_communities for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_villages_updated_at on public.property_villages;
create trigger set_property_villages_updated_at before update on public.property_villages for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_survey_blocks_updated_at on public.survey_blocks;
create trigger set_survey_blocks_updated_at before update on public.survey_blocks for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_categories_updated_at on public.property_categories;
create trigger set_property_categories_updated_at before update on public.property_categories for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_document_types_updated_at on public.property_document_types;
create trigger set_property_document_types_updated_at before update on public.property_document_types for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_consent_purposes_updated_at on public.property_consent_purposes;
create trigger set_property_consent_purposes_updated_at before update on public.property_consent_purposes for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_npin_sequences_updated_at on public.property_npin_sequences;
create trigger set_property_npin_sequences_updated_at before update on public.property_npin_sequences for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_properties_updated_at on public.properties;
create trigger set_properties_updated_at before update on public.properties for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_addresses_updated_at on public.property_addresses;
create trigger set_property_addresses_updated_at before update on public.property_addresses for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_claims_updated_at on public.property_claims;
create trigger set_property_claims_updated_at before update on public.property_claims for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_owners_updated_at on public.property_owners;
create trigger set_property_owners_updated_at before update on public.property_owners for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_identity_credentials_updated_at on public.property_identity_credentials;
create trigger set_property_identity_credentials_updated_at before update on public.property_identity_credentials for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_documents_updated_at on public.property_documents;
create trigger set_property_documents_updated_at before update on public.property_documents for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_relationships_updated_at on public.property_relationships;
create trigger set_property_relationships_updated_at before update on public.property_relationships for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_tags_updated_at on public.property_tags;
create trigger set_property_tags_updated_at before update on public.property_tags for each row execute function public.set_platform_foundation_updated_at();

alter table public.property_wards enable row level security;
alter table public.property_districts enable row level security;
alter table public.property_communities enable row level security;
alter table public.property_villages enable row level security;
alter table public.survey_blocks enable row level security;
alter table public.property_categories enable row level security;
alter table public.property_document_types enable row level security;
alter table public.property_consent_purposes enable row level security;
alter table public.property_npin_sequences enable row level security;
alter table public.properties enable row level security;
alter table public.property_addresses enable row level security;
alter table public.property_claims enable row level security;
alter table public.property_owners enable row level security;
alter table public.property_owner_history enable row level security;
alter table public.property_identity_credentials enable row level security;
alter table public.property_identity_events enable row level security;
alter table public.property_documents enable row level security;
alter table public.property_document_events enable row level security;
alter table public.property_status_history enable row level security;
alter table public.property_relationships enable row level security;
alter table public.property_tags enable row level security;
alter table public.property_events enable row level security;

drop policy if exists "Public can read property geography" on public.property_wards;
create policy "Public can read property geography" on public.property_wards for select using (status = 'active');
drop policy if exists "Public can read property districts" on public.property_districts;
create policy "Public can read property districts" on public.property_districts for select using (status = 'active');
drop policy if exists "Public can read property communities" on public.property_communities;
create policy "Public can read property communities" on public.property_communities for select using (status = 'active');
drop policy if exists "Public can read property villages" on public.property_villages;
create policy "Public can read property villages" on public.property_villages for select using (status = 'active');
drop policy if exists "Public can read active survey blocks" on public.survey_blocks;
create policy "Public can read active survey blocks" on public.survey_blocks for select using (status = 'active');
drop policy if exists "Public can read active property categories" on public.property_categories;
create policy "Public can read active property categories" on public.property_categories for select using (status = 'active');
drop policy if exists "Public can read active property document types" on public.property_document_types;
create policy "Public can read active property document types" on public.property_document_types for select using (status = 'active');
drop policy if exists "Public can read active property consent purposes" on public.property_consent_purposes;
create policy "Public can read active property consent purposes" on public.property_consent_purposes for select using (status = 'active');

drop policy if exists "Property registry operators can manage properties" on public.properties;
create policy "Property registry operators can manage properties" on public.properties
  for all using (public.property_can_manage_registry(state_id, lga_id, registry_institution_id))
  with check (public.property_can_manage_registry(state_id, lga_id, registry_institution_id));
drop policy if exists "Property registry operators can manage addresses" on public.property_addresses;
create policy "Property registry operators can manage addresses" on public.property_addresses
  for all using (public.property_can_manage_registry(state_id, lga_id, null))
  with check (public.property_can_manage_registry(state_id, lga_id, null));
drop policy if exists "Property registry operators can manage claims" on public.property_claims;
create policy "Property registry operators can manage claims" on public.property_claims
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_claims.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
    or claimant_user_id = public.property_current_app_user_id()
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_claims.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
    or claimant_user_id = public.property_current_app_user_id()
  );

drop policy if exists "Property registry operators can manage owners" on public.property_owners;
create policy "Property registry operators can manage owners" on public.property_owners
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_owners.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_owners.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Property registry operators can read owner history" on public.property_owner_history;
create policy "Property registry operators can read owner history" on public.property_owner_history
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_owner_history.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );
drop policy if exists "Property registry operators can insert owner history" on public.property_owner_history;
create policy "Property registry operators can insert owner history" on public.property_owner_history
  for insert with check (
    exists (
      select 1 from public.properties p
      where p.id = property_owner_history.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Property registry operators can manage credentials" on public.property_identity_credentials;
create policy "Property registry operators can manage credentials" on public.property_identity_credentials
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_identity_credentials.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_identity_credentials.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Property registry operators can manage documents" on public.property_documents;
create policy "Property registry operators can manage documents" on public.property_documents
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_documents.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_documents.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Property registry operators can read property events" on public.property_events;
create policy "Property registry operators can read property events" on public.property_events
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_events.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );
drop policy if exists "Property registry operators can insert property events" on public.property_events;
create policy "Property registry operators can insert property events" on public.property_events
  for insert with check (
    property_id is null
    or exists (
      select 1 from public.properties p
      where p.id = property_events.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

insert into public.platform_modules (module_key, name, description, status, metadata)
values
  ('property_registry', 'Property Registry', 'Digital Land & Property Infrastructure property registry foundation.', 'preview', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('property_verification', 'Property Verification', 'NPIN, property credential, QR and public verification foundation.', 'preview', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('property_documents', 'Property Documents', 'Property document metadata, evidence and review foundation.', 'preview', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('property_intelligence', 'Property Intelligence', 'Property registry intelligence, reporting and executive insight foundation.', 'preview', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('property_public_explorer', 'Property Public Explorer', 'Public property lookup and explorer foundation.', 'preview', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('property_registry_operations', 'Property Registry Operations', 'Land registry operations, review queues and issuance foundation.', 'preview', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('property_gis', 'Property GIS', 'GIS metadata and future spatial intelligence foundation.', 'preview', '{"phase":"dlpi_property_registry_phase1"}'::jsonb)
on conflict (module_key) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  metadata = public.platform_modules.metadata || excluded.metadata,
  updated_at = now();

insert into public.property_categories (category_key, name, description, metadata)
values
  ('residential', 'Residential', 'Residential land and built property.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('commercial', 'Commercial', 'Commercial property and business premises.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('industrial', 'Industrial', 'Factories, industrial estates and production facilities.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('agricultural', 'Agricultural', 'Agricultural land, farms and agro-allied property.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('mining', 'Mining', 'Mining-related land and mineral development property.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('institutional', 'Institutional', 'Institutional property including schools, hospitals and civic facilities.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('mixed_use', 'Mixed Use', 'Property with multiple lawful uses.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('government', 'Government', 'Government-owned or government-administered property.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('infrastructure', 'Infrastructure', 'Infrastructure corridors and public utility property.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('protected', 'Protected', 'Protected, conservation or restricted-use property.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb)
on conflict (category_key) do update set
  name = excluded.name,
  description = excluded.description,
  status = 'active',
  metadata = public.property_categories.metadata || excluded.metadata,
  updated_at = now();

insert into public.property_document_types (document_type_key, name, description, metadata)
values
  ('survey_plan', 'Survey Plan', 'Survey plan or cadastral evidence metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('certificate_of_occupancy', 'Certificate of Occupancy', 'Certificate of Occupancy metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('deed_of_assignment', 'Deed of Assignment', 'Deed of Assignment metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('allocation_letter', 'Allocation Letter', 'Allocation letter metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('gazette', 'Gazette', 'Government gazette metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('governors_consent', 'Governor''s Consent', 'Governor consent metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('power_of_attorney', 'Power of Attorney', 'Power of Attorney metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('valuation_report', 'Valuation Report', 'Valuation report metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('court_order', 'Court Order', 'Court order metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('tax_clearance', 'Tax Clearance', 'Tax clearance metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('building_approval', 'Building Approval', 'Building approval metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('photographs', 'Photographs', 'Photographic evidence metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('supporting_evidence', 'Supporting Evidence', 'Additional supporting evidence metadata.', '{"phase":"dlpi_property_registry_phase1"}'::jsonb)
on conflict (document_type_key) do update set
  name = excluded.name,
  description = excluded.description,
  status = 'active',
  metadata = public.property_document_types.metadata || excluded.metadata,
  updated_at = now();

insert into public.property_consent_purposes (purpose_key, name, description, data_categories, metadata)
values
  ('ownership_verification', 'Ownership Verification', 'Consent to verify property ownership or interest claims.', array['property_profile', 'ownership_records', 'identity_status'], '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('institution_sharing', 'Institution Sharing', 'Consent to share property registry data with authorised institutions.', array['property_profile', 'ownership_records', 'documents'], '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('government_sharing', 'Government Sharing', 'Consent or statutory basis for sharing with government agencies.', array['property_profile', 'ownership_records', 'registry_status'], '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('investor_sharing', 'Investor Sharing', 'Consent to share property opportunity or registry data with investors.', array['property_profile', 'registry_status', 'valuation_summary'], '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('bank_sharing', 'Bank Sharing', 'Consent to share property data with banks or credit institutions.', array['property_profile', 'ownership_records', 'documents', 'valuation_summary'], '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('legal_review', 'Legal Review', 'Consent to share property records for legal review and diligence.', array['property_profile', 'ownership_records', 'documents', 'status_history'], '{"phase":"dlpi_property_registry_phase1"}'::jsonb),
  ('survey_review', 'Survey Review', 'Consent to share survey and parcel metadata for survey review.', array['property_profile', 'survey_metadata', 'documents'], '{"phase":"dlpi_property_registry_phase1"}'::jsonb)
on conflict (purpose_key) do update set
  name = excluded.name,
  description = excluded.description,
  data_categories = excluded.data_categories,
  status = 'active',
  metadata = public.property_consent_purposes.metadata || excluded.metadata,
  updated_at = now();
