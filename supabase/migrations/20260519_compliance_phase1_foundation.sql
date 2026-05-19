-- Compliance Phase 1 foundation: regulator catalog, requirement catalog,
-- MSME compliance items, aggregate profiles, immutable event ledger, RLS,
-- and conservative backfill from legacy KYC/tax snapshots.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_regulator_type') then
    create type public.compliance_regulator_type as enum (
      'cac',
      'firs',
      'vat',
      'son',
      'nafdac',
      'local_authority',
      'certification_body',
      'platform',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_requirement_category') then
    create type public.compliance_requirement_category as enum (
      'registration',
      'annual_return',
      'tax',
      'vat',
      'product_standard',
      'local_permit',
      'certification',
      'platform_kyc',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_frequency') then
    create type public.compliance_frequency as enum (
      'one_time',
      'monthly',
      'quarterly',
      'annual',
      'rolling_expiry',
      'event_based'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_item_status') then
    create type public.compliance_item_status as enum (
      'not_started',
      'draft',
      'submitted',
      'under_review',
      'changes_requested',
      'approved',
      'rejected',
      'expiring_soon',
      'expired',
      'suspended',
      'revoked',
      'waived',
      'archived'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_visibility') then
    create type public.compliance_visibility as enum (
      'private',
      'regulator_only',
      'public_summary',
      'public_document'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_event_type') then
    create type public.compliance_event_type as enum (
      'item_created',
      'item_submitted',
      'review_started',
      'approved',
      'rejected',
      'changes_requested',
      'suspended',
      'revoked',
      'reinstated',
      'expired',
      'expiring_soon',
      'renewed',
      'visibility_changed',
      'export_generated',
      'system_recalculated'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_actor_type') then
    create type public.compliance_actor_type as enum (
      'msme',
      'reviewer',
      'regulator',
      'admin',
      'system'
    );
  end if;
end $$;

create table if not exists public.compliance_regulators (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  regulator_type public.compliance_regulator_type not null,
  jurisdiction text not null default 'federal',
  state text,
  lga text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_requirement_definitions (
  id uuid primary key default gen_random_uuid(),
  regulator_id uuid not null references public.compliance_regulators(id) on delete restrict,
  code text not null unique,
  title text not null,
  description text,
  category public.compliance_requirement_category not null,
  frequency public.compliance_frequency not null default 'one_time',
  applies_to_sector text[],
  applies_to_state text[],
  applies_to_lga text[],
  applies_to_business_type text[],
  requires_document boolean not null default true,
  requires_reference_number boolean not null default false,
  requires_issue_date boolean not null default false,
  requires_expiry_date boolean not null default false,
  default_validity_months integer,
  renewal_window_days integer not null default 30,
  grace_period_days integer not null default 0,
  is_mandatory boolean not null default true,
  is_publicly_visible boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.msme_compliance_profiles (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null unique references public.msmes(id) on delete cascade,
  overall_status public.compliance_item_status not null default 'not_started',
  compliance_score integer check (compliance_score between 0 and 100),
  risk_level text check (risk_level in ('low', 'medium', 'high', 'critical')),
  total_required_count integer not null default 0,
  approved_count integer not null default 0,
  pending_count integer not null default 0,
  under_review_count integer not null default 0,
  changes_requested_count integer not null default 0,
  rejected_count integer not null default 0,
  expired_count integer not null default 0,
  expiring_soon_count integer not null default 0,
  suspended_count integer not null default 0,
  revoked_count integer not null default 0,
  last_submitted_at timestamptz,
  last_reviewed_at timestamptz,
  next_deadline_at timestamptz,
  last_recalculated_at timestamptz,
  visibility public.compliance_visibility not null default 'private',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.msme_compliance_items (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  requirement_id uuid not null references public.compliance_requirement_definitions(id) on delete restrict,
  regulator_id uuid not null references public.compliance_regulators(id) on delete restrict,
  status public.compliance_item_status not null default 'not_started',
  previous_status public.compliance_item_status,
  reference_number text,
  issued_at date,
  expires_at date,
  renewal_due_at date,
  grace_period_ends_at date,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  renewed_at timestamptz,
  reviewer_user_id uuid references public.users(id) on delete set null,
  reviewer_role text,
  latest_review_id uuid,
  decision_reason text,
  rejection_reason text,
  suspension_reason text,
  revocation_reason text,
  renewal_of uuid references public.msme_compliance_items(id) on delete set null,
  is_required boolean not null default true,
  visibility public.compliance_visibility not null default 'private',
  source text not null default 'manual',
  source_record_id uuid,
  created_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint msme_compliance_items_unique_active_requirement unique (msme_id, requirement_id, renewal_of)
);

create table if not exists public.compliance_events (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid references public.msmes(id) on delete cascade,
  compliance_item_id uuid references public.msme_compliance_items(id) on delete cascade,
  regulator_id uuid references public.compliance_regulators(id) on delete set null,
  event_type public.compliance_event_type not null,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type public.compliance_actor_type not null default 'system',
  actor_role text,
  from_status text,
  to_status text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists compliance_regulators_type_idx on public.compliance_regulators(regulator_type);
create index if not exists compliance_requirements_regulator_idx on public.compliance_requirement_definitions(regulator_id);
create index if not exists compliance_requirements_category_idx on public.compliance_requirement_definitions(category);
create index if not exists compliance_requirements_active_idx on public.compliance_requirement_definitions(is_active);
create index if not exists msme_compliance_profiles_msme_idx on public.msme_compliance_profiles(msme_id);
create index if not exists msme_compliance_items_msme_idx on public.msme_compliance_items(msme_id);
create index if not exists msme_compliance_items_requirement_idx on public.msme_compliance_items(requirement_id);
create index if not exists msme_compliance_items_regulator_idx on public.msme_compliance_items(regulator_id);
create index if not exists msme_compliance_items_status_idx on public.msme_compliance_items(status);
create index if not exists msme_compliance_items_expires_idx on public.msme_compliance_items(expires_at);
create index if not exists msme_compliance_items_msme_status_idx on public.msme_compliance_items(msme_id, status);
create unique index if not exists msme_compliance_items_unique_current_requirement_idx
  on public.msme_compliance_items(msme_id, requirement_id)
  where renewal_of is null;
create index if not exists compliance_events_msme_created_idx on public.compliance_events(msme_id, created_at desc);
create index if not exists compliance_events_item_created_idx on public.compliance_events(compliance_item_id, created_at desc);
create index if not exists compliance_events_type_idx on public.compliance_events(event_type);

insert into public.compliance_regulators (code, name, regulator_type, jurisdiction, metadata)
values
  ('CAC', 'Corporate Affairs Commission', 'cac', 'federal', '{"phase":"phase1"}'::jsonb),
  ('FIRS', 'Federal Inland Revenue Service', 'firs', 'federal', '{"phase":"phase1"}'::jsonb),
  ('VAT', 'Value Added Tax Administration', 'vat', 'federal', '{"phase":"phase1"}'::jsonb),
  ('SON', 'Standards Organisation of Nigeria', 'son', 'federal', '{"phase":"phase1"}'::jsonb),
  ('NAFDAC', 'National Agency for Food and Drug Administration and Control', 'nafdac', 'federal', '{"phase":"phase1"}'::jsonb),
  ('LOCAL_AUTHORITY', 'Local Authority Permits', 'local_authority', 'local', '{"phase":"phase1"}'::jsonb),
  ('PLATFORM_KYC', 'NDMII Platform KYC', 'platform', 'platform', '{"phase":"phase1"}'::jsonb)
on conflict (code) do update
set name = excluded.name,
    regulator_type = excluded.regulator_type,
    jurisdiction = excluded.jurisdiction,
    is_active = true,
    updated_at = now();

insert into public.compliance_requirement_definitions (
  regulator_id,
  code,
  title,
  description,
  category,
  frequency,
  requires_document,
  requires_reference_number,
  requires_issue_date,
  requires_expiry_date,
  default_validity_months,
  renewal_window_days,
  is_mandatory,
  sort_order,
  metadata
)
select r.id, v.code, v.title, v.description, v.category::public.compliance_requirement_category,
       v.frequency::public.compliance_frequency, v.requires_document, v.requires_reference_number,
       v.requires_issue_date, v.requires_expiry_date, v.default_validity_months,
       v.renewal_window_days, v.is_mandatory, v.sort_order, '{"phase":"phase1"}'::jsonb
from (
  values
    ('CAC', 'CAC_REGISTRATION', 'CAC registration', 'Business registration with CAC.', 'registration', 'one_time', true, true, false, false, null::integer, 30, true, 10),
    ('CAC', 'CAC_ANNUAL_RETURN', 'CAC annual return', 'Annual return filing status.', 'annual_return', 'annual', true, true, true, true, 12, 60, true, 20),
    ('FIRS', 'TIN_VALIDATION', 'TIN validation', 'Tax identification validation with FIRS.', 'tax', 'one_time', false, true, false, false, null::integer, 30, true, 30),
    ('VAT', 'VAT_REGISTRATION', 'VAT registration', 'VAT registration status.', 'vat', 'one_time', true, true, false, false, null::integer, 30, true, 40),
    ('VAT', 'VAT_FILING_STATUS', 'VAT filing status', 'Periodic VAT filing and remittance posture.', 'vat', 'monthly', true, false, false, false, null::integer, 30, true, 50),
    ('SON', 'SON_CERTIFICATION', 'SON certification', 'Standards certification where applicable.', 'product_standard', 'rolling_expiry', true, true, true, true, 12, 60, false, 60),
    ('NAFDAC', 'NAFDAC_REGISTRATION', 'NAFDAC registration', 'NAFDAC product or facility registration where applicable.', 'registration', 'rolling_expiry', true, true, true, true, 24, 90, false, 70),
    ('LOCAL_AUTHORITY', 'LOCAL_TRADE_PERMIT', 'Local trade permit', 'Local authority trade permit where applicable.', 'local_permit', 'annual', true, true, true, true, 12, 60, false, 80),
    ('LOCAL_AUTHORITY', 'BUSINESS_PREMISES_PERMIT', 'Business premises permit', 'Business premises permit where applicable.', 'local_permit', 'annual', true, true, true, true, 12, 60, false, 90),
    ('PLATFORM_KYC', 'GENERAL_CERTIFICATION', 'General certification', 'General business certification placeholder for future regulator-specific certificates.', 'certification', 'rolling_expiry', true, true, true, true, 12, 60, false, 100)
) as v(regulator_code, code, title, description, category, frequency, requires_document, requires_reference_number, requires_issue_date, requires_expiry_date, default_validity_months, renewal_window_days, is_mandatory, sort_order)
join public.compliance_regulators r on r.code = v.regulator_code
on conflict (code) do update
set title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    frequency = excluded.frequency,
    requires_document = excluded.requires_document,
    requires_reference_number = excluded.requires_reference_number,
    requires_issue_date = excluded.requires_issue_date,
    requires_expiry_date = excluded.requires_expiry_date,
    default_validity_months = excluded.default_validity_months,
    renewal_window_days = excluded.renewal_window_days,
    is_mandatory = excluded.is_mandatory,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

create or replace function public.compliance_legacy_status_to_item_status(value text)
returns public.compliance_item_status
language sql
immutable
as $$
  select case lower(coalesce(value, ''))
    when 'verified' then 'approved'::public.compliance_item_status
    when 'approved' then 'approved'::public.compliance_item_status
    when 'compliant' then 'approved'::public.compliance_item_status
    when 'active' then 'approved'::public.compliance_item_status
    when 'mismatch' then 'changes_requested'::public.compliance_item_status
    when 'changes_requested' then 'changes_requested'::public.compliance_item_status
    when 'failed' then 'rejected'::public.compliance_item_status
    when 'rejected' then 'rejected'::public.compliance_item_status
    when 'invalid' then 'rejected'::public.compliance_item_status
    else 'not_started'::public.compliance_item_status
  end;
$$;

do $$
declare
  has_id boolean;
  has_msme_id boolean;
  has_cac_status boolean;
  has_tin_status boolean;
  cac_checked_expr text;
  tin_checked_expr text;
  last_reviewed_expr text;
  score_expr text;
  risk_expr text;
  order_expr text;
begin
  if to_regclass('public.compliance_profiles') is not null then
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compliance_profiles' and column_name = 'id') into has_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compliance_profiles' and column_name = 'msme_id') into has_msme_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compliance_profiles' and column_name = 'cac_status') into has_cac_status;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compliance_profiles' and column_name = 'tin_status') into has_tin_status;

    if has_id and has_msme_id then
      cac_checked_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compliance_profiles' and column_name = 'cac_checked_at') then 'cp.cac_checked_at' else 'null::timestamptz' end;
      tin_checked_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compliance_profiles' and column_name = 'tin_checked_at') then 'cp.tin_checked_at' else 'null::timestamptz' end;
      last_reviewed_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compliance_profiles' and column_name = 'last_reviewed_at') then 'cp.last_reviewed_at' else 'null::timestamptz' end;
      score_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compliance_profiles' and column_name = 'score') then 'cp.score' else 'null::integer' end;
      risk_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compliance_profiles' and column_name = 'risk_level') then 'cp.risk_level' else 'null::text' end;
      order_expr := case when last_reviewed_expr = 'cp.last_reviewed_at' then 'cp.last_reviewed_at desc nulls last' else 'cp.id' end;

      if has_cac_status then
        execute format($backfill$
          insert into public.msme_compliance_items (
            msme_id, requirement_id, regulator_id, status, reference_number, approved_at, rejected_at,
            is_required, source, source_record_id, metadata, created_at, updated_at
          )
          select
            m.id,
            req.id,
            req.regulator_id,
            public.compliance_legacy_status_to_item_status(cp.cac_status),
            nullif(m.cac_number, ''),
            case when public.compliance_legacy_status_to_item_status(cp.cac_status) = 'approved' then coalesce(%1$s, %2$s, now()) else null end,
            case when public.compliance_legacy_status_to_item_status(cp.cac_status) = 'rejected' then coalesce(%1$s, %2$s, now()) else null end,
            true,
            'legacy_migration',
            cp.id,
            jsonb_build_object(
              'phase', 'phase1',
              'source', 'legacy_migration',
              'legacy_sources', jsonb_build_array('compliance_profiles'),
              'legacy_compliance_profile_id', cp.id,
              'legacy_status', cp.cac_status,
              'legacy_score_metadata_only', %3$s,
              'legacy_risk_level_metadata_only', %4$s,
              'demo_or_migration_derived', true,
              'certified_truth', false
            ),
            coalesce(%2$s, now()),
            now()
          from public.msmes m
          join public.compliance_requirement_definitions req on req.code = 'CAC_REGISTRATION'
          join lateral (
            select cp.*
            from public.compliance_profiles cp
            where cp.msme_id = m.id
            order by %5$s
            limit 1
          ) cp on true
          where not exists (
            select 1
            from public.msme_compliance_items existing
            where existing.msme_id = m.id
              and existing.requirement_id = req.id
              and existing.renewal_of is null
          );
        $backfill$, cac_checked_expr, last_reviewed_expr, score_expr, risk_expr, order_expr);
      end if;

      if has_tin_status then
        execute format($backfill$
          insert into public.msme_compliance_items (
            msme_id, requirement_id, regulator_id, status, reference_number, approved_at, rejected_at,
            is_required, source, source_record_id, metadata, created_at, updated_at
          )
          select
            m.id,
            req.id,
            req.regulator_id,
            public.compliance_legacy_status_to_item_status(cp.tin_status),
            nullif(m.tin, ''),
            case when public.compliance_legacy_status_to_item_status(cp.tin_status) = 'approved' then coalesce(%1$s, %2$s, now()) else null end,
            case when public.compliance_legacy_status_to_item_status(cp.tin_status) = 'rejected' then coalesce(%1$s, %2$s, now()) else null end,
            true,
            'legacy_migration',
            cp.id,
            jsonb_build_object(
              'phase', 'phase1',
              'source', 'legacy_migration',
              'legacy_sources', jsonb_build_array('compliance_profiles'),
              'legacy_compliance_profile_id', cp.id,
              'legacy_status', cp.tin_status,
              'legacy_score_metadata_only', %3$s,
              'legacy_risk_level_metadata_only', %4$s,
              'demo_or_migration_derived', true,
              'certified_truth', false
            ),
            coalesce(%2$s, now()),
            now()
          from public.msmes m
          join public.compliance_requirement_definitions req on req.code = 'TIN_VALIDATION'
          join lateral (
            select cp.*
            from public.compliance_profiles cp
            where cp.msme_id = m.id
            order by %5$s
            limit 1
          ) cp on true
          where not exists (
            select 1
            from public.msme_compliance_items existing
            where existing.msme_id = m.id
              and existing.requirement_id = req.id
              and existing.renewal_of is null
          );
        $backfill$, tin_checked_expr, last_reviewed_expr, score_expr, risk_expr, order_expr);
      end if;
    end if;
  end if;
end $$;

do $$
declare
  has_id boolean;
  has_msme_id boolean;
  has_cac_status boolean;
  has_tin_status boolean;
  validated_expr text;
  created_expr text;
  order_expr text;
begin
  if to_regclass('public.validation_results') is not null then
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'validation_results' and column_name = 'id') into has_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'validation_results' and column_name = 'msme_id') into has_msme_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'validation_results' and column_name = 'cac_status') into has_cac_status;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'validation_results' and column_name = 'tin_status') into has_tin_status;

    if has_id and has_msme_id then
      validated_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'validation_results' and column_name = 'validated_at') then 'vr.validated_at' else 'null::timestamptz' end;
      created_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'validation_results' and column_name = 'created_at') then 'vr.created_at' else 'null::timestamptz' end;
      order_expr := case when validated_expr = 'vr.validated_at' then 'vr.validated_at desc nulls last' else 'vr.id' end;

      if has_cac_status then
        execute format($backfill$
          insert into public.msme_compliance_items (
            msme_id, requirement_id, regulator_id, status, reference_number, approved_at, rejected_at,
            is_required, source, source_record_id, metadata, created_at, updated_at
          )
          select
            m.id,
            req.id,
            req.regulator_id,
            public.compliance_legacy_status_to_item_status(vr.cac_status),
            nullif(m.cac_number, ''),
            case when public.compliance_legacy_status_to_item_status(vr.cac_status) = 'approved' then coalesce(%1$s, now()) else null end,
            case when public.compliance_legacy_status_to_item_status(vr.cac_status) = 'rejected' then coalesce(%1$s, now()) else null end,
            true,
            'legacy_migration',
            vr.id,
            jsonb_build_object(
              'phase', 'phase1',
              'source', 'legacy_migration',
              'legacy_sources', jsonb_build_array('validation_results'),
              'legacy_validation_result_id', vr.id,
              'legacy_status', vr.cac_status,
              'demo_or_migration_derived', true,
              'certified_truth', false
            ),
            coalesce(%2$s, now()),
            now()
          from public.msmes m
          join public.compliance_requirement_definitions req on req.code = 'CAC_REGISTRATION'
          join lateral (
            select vr.*
            from public.validation_results vr
            where vr.msme_id = m.id
            order by %3$s
            limit 1
          ) vr on true
          where not exists (
            select 1
            from public.msme_compliance_items existing
            where existing.msme_id = m.id
              and existing.requirement_id = req.id
              and existing.renewal_of is null
          );
        $backfill$, validated_expr, created_expr, order_expr);
      end if;

      if has_tin_status then
        execute format($backfill$
          insert into public.msme_compliance_items (
            msme_id, requirement_id, regulator_id, status, reference_number, approved_at, rejected_at,
            is_required, source, source_record_id, metadata, created_at, updated_at
          )
          select
            m.id,
            req.id,
            req.regulator_id,
            public.compliance_legacy_status_to_item_status(vr.tin_status),
            nullif(m.tin, ''),
            case when public.compliance_legacy_status_to_item_status(vr.tin_status) = 'approved' then coalesce(%1$s, now()) else null end,
            case when public.compliance_legacy_status_to_item_status(vr.tin_status) = 'rejected' then coalesce(%1$s, now()) else null end,
            true,
            'legacy_migration',
            vr.id,
            jsonb_build_object(
              'phase', 'phase1',
              'source', 'legacy_migration',
              'legacy_sources', jsonb_build_array('validation_results'),
              'legacy_validation_result_id', vr.id,
              'legacy_status', vr.tin_status,
              'demo_or_migration_derived', true,
              'certified_truth', false
            ),
            coalesce(%2$s, now()),
            now()
          from public.msmes m
          join public.compliance_requirement_definitions req on req.code = 'TIN_VALIDATION'
          join lateral (
            select vr.*
            from public.validation_results vr
            where vr.msme_id = m.id
            order by %3$s
            limit 1
          ) vr on true
          where not exists (
            select 1
            from public.msme_compliance_items existing
            where existing.msme_id = m.id
              and existing.requirement_id = req.id
              and existing.renewal_of is null
          );
        $backfill$, validated_expr, created_expr, order_expr);
      end if;
    end if;
  end if;
end $$;

do $$
declare
  has_id boolean;
  has_msme_id boolean;
  has_compliance_status boolean;
  has_vat_applicable boolean;
  reviewed_expr text;
  created_expr text;
  outstanding_expr text;
  order_expr text;
begin
  if to_regclass('public.tax_profiles') is not null then
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tax_profiles' and column_name = 'id') into has_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tax_profiles' and column_name = 'msme_id') into has_msme_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tax_profiles' and column_name = 'compliance_status') into has_compliance_status;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tax_profiles' and column_name = 'vat_applicable') into has_vat_applicable;

    if has_id and has_msme_id then
      reviewed_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tax_profiles' and column_name = 'last_reviewed_at') then 'tp.last_reviewed_at' else 'null::timestamptz' end;
      created_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tax_profiles' and column_name = 'created_at') then 'tp.created_at' else 'null::timestamptz' end;
      outstanding_expr := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tax_profiles' and column_name = 'outstanding_amount') then 'tp.outstanding_amount' else 'null::numeric' end;
      order_expr := case when reviewed_expr = 'tp.last_reviewed_at' then 'tp.last_reviewed_at desc nulls last' else 'tp.id' end;

      if has_compliance_status then
        execute format($backfill$
          insert into public.msme_compliance_items (
            msme_id, requirement_id, regulator_id, status, reference_number, approved_at, rejected_at,
            is_required, source, source_record_id, metadata, created_at, updated_at
          )
          select
            m.id,
            req.id,
            req.regulator_id,
            public.compliance_legacy_status_to_item_status(tp.compliance_status),
            nullif(m.tin, ''),
            case when public.compliance_legacy_status_to_item_status(tp.compliance_status) = 'approved' then coalesce(%1$s, %2$s, now()) else null end,
            case when public.compliance_legacy_status_to_item_status(tp.compliance_status) = 'rejected' then coalesce(%1$s, %2$s, now()) else null end,
            true,
            'legacy_migration',
            tp.id,
            jsonb_build_object(
              'phase', 'phase1',
              'source', 'legacy_migration',
              'legacy_sources', jsonb_build_array('tax_profiles'),
              'legacy_tax_profile_id', tp.id,
              'legacy_status', tp.compliance_status,
              'legacy_outstanding_amount', %3$s,
              'demo_or_migration_derived', true,
              'certified_truth', false
            ),
            coalesce(%2$s, now()),
            now()
          from public.msmes m
          join public.compliance_requirement_definitions req on req.code = 'TIN_VALIDATION'
          join lateral (
            select tp.*
            from public.tax_profiles tp
            where tp.msme_id = m.id
            order by %4$s
            limit 1
          ) tp on true
          where not exists (
            select 1
            from public.msme_compliance_items existing
            where existing.msme_id = m.id
              and existing.requirement_id = req.id
              and existing.renewal_of is null
          );
        $backfill$, reviewed_expr, created_expr, outstanding_expr, order_expr);
      end if;

      if has_vat_applicable then
        execute format($backfill$
          insert into public.msme_compliance_items (
            msme_id, requirement_id, regulator_id, status, is_required, source, source_record_id,
            metadata, created_at, updated_at
          )
          select
            m.id,
            req.id,
            req.regulator_id,
            case when tp.vat_applicable is true then 'not_started'::public.compliance_item_status else 'waived'::public.compliance_item_status end,
            true,
            'legacy_migration',
            tp.id,
            jsonb_build_object(
              'phase', 'phase1',
              'source', 'legacy_migration',
              'legacy_sources', jsonb_build_array('tax_profiles'),
              'legacy_tax_profile_id', tp.id,
              'legacy_vat_applicable', tp.vat_applicable,
              'legacy_compliance_status', %1$s,
              'demo_or_migration_derived', true,
              'certified_truth', false
            ),
            coalesce(%2$s, now()),
            now()
          from public.msmes m
          join public.compliance_requirement_definitions req on req.code = 'VAT_REGISTRATION'
          join lateral (
            select tp.*
            from public.tax_profiles tp
            where tp.msme_id = m.id
            order by %3$s
            limit 1
          ) tp on true
          where not exists (
            select 1
            from public.msme_compliance_items existing
            where existing.msme_id = m.id
              and existing.requirement_id = req.id
              and existing.renewal_of is null
          );
        $backfill$, case when has_compliance_status then 'tp.compliance_status' else 'null::text' end, created_expr, order_expr);
      end if;

      if has_compliance_status then
        execute format($backfill$
          insert into public.msme_compliance_items (
            msme_id, requirement_id, regulator_id, status, is_required, source, source_record_id,
            metadata, created_at, updated_at
          )
          select
            m.id,
            req.id,
            req.regulator_id,
            case
              when lower(coalesce(tp.compliance_status, '')) = 'compliant' then 'approved'::public.compliance_item_status
              when lower(coalesce(tp.compliance_status, '')) in ('partially compliant', 'partial') then 'changes_requested'::public.compliance_item_status
              when lower(coalesce(tp.compliance_status, '')) in ('overdue', 'expired') then 'expired'::public.compliance_item_status
              else 'not_started'::public.compliance_item_status
            end,
            true,
            'legacy_migration',
            tp.id,
            jsonb_build_object(
              'phase', 'phase1',
              'source', 'legacy_migration',
              'legacy_sources', jsonb_build_array('tax_profiles'),
              'legacy_tax_profile_id', tp.id,
              'legacy_compliance_status', tp.compliance_status,
              'legacy_outstanding_amount', %1$s,
              'demo_or_migration_derived', true,
              'certified_truth', false
            ),
            coalesce(%2$s, now()),
            now()
          from public.msmes m
          join public.compliance_requirement_definitions req on req.code = 'VAT_FILING_STATUS'
          join lateral (
            select tp.*
            from public.tax_profiles tp
            where tp.msme_id = m.id
            order by %3$s
            limit 1
          ) tp on true
          where not exists (
            select 1
            from public.msme_compliance_items existing
            where existing.msme_id = m.id
              and existing.requirement_id = req.id
              and existing.renewal_of is null
          );
        $backfill$, outstanding_expr, created_expr, order_expr);
      end if;
    end if;
  end if;
end $$;

insert into public.compliance_events (
  msme_id,
  compliance_item_id,
  regulator_id,
  event_type,
  actor_type,
  actor_role,
  from_status,
  to_status,
  summary,
  metadata,
  created_at
)
select
  item.msme_id,
  item.id,
  item.regulator_id,
  'item_created',
  'system',
  'migration',
  null,
  item.status::text,
  'Compliance item created from Phase 1 legacy migration.',
  jsonb_build_object(
    'phase', 'phase1',
    'source', item.source,
    'demo_or_migration_derived', true,
    'certified_truth', false
  ) || item.metadata,
  now()
from public.msme_compliance_items item
where item.source = 'legacy_migration'
  and not exists (
    select 1
    from public.compliance_events event
    where event.compliance_item_id = item.id
      and event.event_type = 'item_created'
      and event.metadata ->> 'phase' = 'phase1'
  );

insert into public.msme_compliance_profiles (
  msme_id,
  overall_status,
  compliance_score,
  risk_level,
  total_required_count,
  approved_count,
  pending_count,
  under_review_count,
  changes_requested_count,
  rejected_count,
  expired_count,
  expiring_soon_count,
  suspended_count,
  revoked_count,
  last_submitted_at,
  last_reviewed_at,
  next_deadline_at,
  last_recalculated_at,
  metadata,
  created_at,
  updated_at
)
select
  m.id,
  case
    when count(item.id) filter (where item.status in ('suspended', 'revoked')) > 0 then 'suspended'::public.compliance_item_status
    when count(item.id) filter (where item.status = 'expired') > 0 then 'expired'::public.compliance_item_status
    when count(item.id) filter (where item.status = 'rejected') > 0 then 'rejected'::public.compliance_item_status
    when count(item.id) filter (where item.status = 'changes_requested') > 0 then 'changes_requested'::public.compliance_item_status
    when count(item.id) filter (where item.status in ('submitted', 'under_review')) > 0 then 'under_review'::public.compliance_item_status
    when count(item.id) filter (where item.is_required) > 0
      and count(item.id) filter (where item.is_required and item.status = 'approved') = count(item.id) filter (where item.is_required)
      then 'approved'::public.compliance_item_status
    else 'not_started'::public.compliance_item_status
  end,
  case
    when count(item.id) filter (where item.is_required) = 0 then 0
    else greatest(
      0,
      least(
        100,
        round(
          ((count(item.id) filter (where item.is_required and item.status = 'approved'))::numeric
            / nullif(count(item.id) filter (where item.is_required), 0)::numeric) * 100
        )::integer
        - (count(item.id) filter (where item.is_required and item.status in ('expired', 'suspended', 'revoked')) * 20)::integer
        - (count(item.id) filter (where item.is_required and item.status = 'rejected') * 10)::integer
      )
    )
  end,
  case
    when count(item.id) filter (where item.status in ('suspended', 'revoked', 'expired')) > 0 then 'critical'
    when count(item.id) filter (where item.status in ('rejected', 'changes_requested')) > 0 then 'high'
    when count(item.id) filter (where item.status in ('not_started', 'draft', 'submitted', 'under_review')) > 0 then 'medium'
    when count(item.id) > 0 then 'low'
    else 'medium'
  end,
  count(item.id) filter (where item.is_required)::integer,
  count(item.id) filter (where item.status = 'approved')::integer,
  count(item.id) filter (where item.status in ('not_started', 'draft', 'submitted'))::integer,
  count(item.id) filter (where item.status = 'under_review')::integer,
  count(item.id) filter (where item.status = 'changes_requested')::integer,
  count(item.id) filter (where item.status = 'rejected')::integer,
  count(item.id) filter (where item.status = 'expired')::integer,
  count(item.id) filter (where item.status = 'expiring_soon')::integer,
  count(item.id) filter (where item.status = 'suspended')::integer,
  count(item.id) filter (where item.status = 'revoked')::integer,
  max(item.submitted_at),
  max(coalesce(item.approved_at, item.rejected_at, item.updated_at)),
  min(item.expires_at)::timestamptz,
  now(),
  jsonb_build_object(
    'phase', 'phase1',
    'source', case when count(item.id) filter (where item.source = 'legacy_migration') > 0 then 'legacy_migration_recalculation' else 'base_profile_creation' end,
    'demo_or_migration_derived', count(item.id) filter (where item.source = 'legacy_migration') > 0,
    'legacy_scores_not_trusted', count(item.id) filter (where item.source = 'legacy_migration') > 0
  ),
  now(),
  now()
from public.msmes m
left join public.msme_compliance_items item on item.msme_id = m.id
group by m.id
on conflict (msme_id) do update
set overall_status = excluded.overall_status,
    compliance_score = excluded.compliance_score,
    risk_level = excluded.risk_level,
    total_required_count = excluded.total_required_count,
    approved_count = excluded.approved_count,
    pending_count = excluded.pending_count,
    under_review_count = excluded.under_review_count,
    changes_requested_count = excluded.changes_requested_count,
    rejected_count = excluded.rejected_count,
    expired_count = excluded.expired_count,
    expiring_soon_count = excluded.expiring_soon_count,
    suspended_count = excluded.suspended_count,
    revoked_count = excluded.revoked_count,
    last_submitted_at = excluded.last_submitted_at,
    last_reviewed_at = excluded.last_reviewed_at,
    next_deadline_at = excluded.next_deadline_at,
    last_recalculated_at = excluded.last_recalculated_at,
    metadata = coalesce(public.msme_compliance_profiles.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

insert into public.compliance_events (
  msme_id,
  event_type,
  actor_type,
  actor_role,
  to_status,
  summary,
  metadata,
  created_at
)
select
  profile.msme_id,
  'system_recalculated',
  'system',
  'migration',
  profile.overall_status::text,
  'Compliance profile recalculated during Phase 1 migration.',
  jsonb_build_object(
    'phase', 'phase1',
    'compliance_score', profile.compliance_score,
    'risk_level', profile.risk_level,
    'source', profile.metadata ->> 'source',
    'demo_or_migration_derived', coalesce((profile.metadata ->> 'demo_or_migration_derived')::boolean, false),
    'legacy_scores_not_trusted', coalesce((profile.metadata ->> 'legacy_scores_not_trusted')::boolean, false)
  ),
  now()
from public.msme_compliance_profiles profile
where profile.metadata ->> 'phase' = 'phase1'
  and not exists (
    select 1
    from public.compliance_events event
    where event.msme_id = profile.msme_id
      and event.event_type = 'system_recalculated'
      and event.metadata ->> 'phase' = 'phase1'
  );

alter table public.compliance_regulators enable row level security;
alter table public.compliance_requirement_definitions enable row level security;
alter table public.msme_compliance_profiles enable row level security;
alter table public.msme_compliance_items enable row level security;
alter table public.compliance_events enable row level security;

create or replace function public.compliance_current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.compliance_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.compliance_can_read_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.compliance_current_role() in ('admin', 'reviewer', 'fccpc_officer'), false);
$$;

create or replace function public.compliance_owns_msme(target_msme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.msmes m
    where m.id = target_msme_id
      and m.created_by = public.compliance_current_app_user_id()
  );
$$;

drop policy if exists "Compliance regulators readable by authenticated users" on public.compliance_regulators;
create policy "Compliance regulators readable by authenticated users"
on public.compliance_regulators
for select
using (auth.uid() is not null);

drop policy if exists "Compliance requirements readable by authenticated users" on public.compliance_requirement_definitions;
create policy "Compliance requirements readable by authenticated users"
on public.compliance_requirement_definitions
for select
using (auth.uid() is not null);

drop policy if exists "MSME owners and reviewers can read compliance profiles" on public.msme_compliance_profiles;
create policy "MSME owners and reviewers can read compliance profiles"
on public.msme_compliance_profiles
for select
using (
  public.compliance_can_read_all()
  or public.compliance_owns_msme(msme_id)
);

drop policy if exists "MSME owners and reviewers can read compliance items" on public.msme_compliance_items;
create policy "MSME owners and reviewers can read compliance items"
on public.msme_compliance_items
for select
using (
  public.compliance_can_read_all()
  or public.compliance_owns_msme(msme_id)
);

drop policy if exists "MSME owners and reviewers can read compliance events" on public.compliance_events;
create policy "MSME owners and reviewers can read compliance events"
on public.compliance_events
for select
using (
  public.compliance_can_read_all()
  or (msme_id is not null and public.compliance_owns_msme(msme_id))
);

drop policy if exists "Server authenticated workflows can insert compliance events" on public.compliance_events;
create policy "Server authenticated workflows can insert compliance events"
on public.compliance_events
for insert
with check (auth.uid() is not null);
