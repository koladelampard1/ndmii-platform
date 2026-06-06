-- Impact Intelligence Indicator Phase 1.
-- Adds secure indicator definitions, immutable measurements, verification
-- events, defensive integrity checks, and legacy indicator preservation.

create extension if not exists "pgcrypto";

alter table public.impact_indicators enable row level security;
alter table public.impact_kpi_metrics enable row level security;
alter table public.impact_dashboard_snapshots enable row level security;

revoke all on public.impact_indicators from anon;
revoke all on public.impact_kpi_metrics from anon;
revoke all on public.impact_dashboard_snapshots from anon;
revoke all on public.impact_indicators from authenticated;
revoke all on public.impact_kpi_metrics from authenticated;
revoke all on public.impact_dashboard_snapshots from authenticated;

create table if not exists public.impact_indicator_definitions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references public.impact_programmes(id) on delete cascade,
  cohort_id uuid references public.impact_beneficiary_cohorts(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  name text not null,
  description text,
  unit_of_measure text not null,
  indicator_type text not null default 'outcome',
  direction_of_improvement text not null default 'increase',
  calculation_method text not null default 'manual',
  measurement_frequency text,
  baseline_required boolean not null default true,
  target_required boolean not null default true,
  owner_user_id uuid references public.users(id) on delete set null,
  status text not null default 'draft',
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_indicator_definitions_direction_check
    check (direction_of_improvement in ('increase', 'decrease', 'maintain')),
  constraint impact_indicator_definitions_calculation_check
    check (calculation_method in ('manual', 'assessment_score', 'field_observation', 'evidence_count', 'derived')),
  constraint impact_indicator_definitions_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint impact_indicator_definitions_name_check
    check (length(trim(name)) > 0),
  constraint impact_indicator_definitions_unit_check
    check (length(trim(unit_of_measure)) > 0)
);

create table if not exists public.impact_indicator_measurements (
  id uuid primary key default gen_random_uuid(),
  indicator_definition_id uuid not null references public.impact_indicator_definitions(id) on delete cascade,
  programme_id uuid not null references public.impact_programmes(id) on delete cascade,
  cohort_id uuid references public.impact_beneficiary_cohorts(id) on delete set null,
  cohort_member_id uuid references public.impact_cohort_members(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  assessment_id uuid references public.impact_assessments(id) on delete set null,
  assessment_score_run_id uuid references public.impact_assessment_score_runs(id) on delete set null,
  field_visit_id uuid references public.impact_field_visits(id) on delete set null,
  evidence_id uuid references public.impact_evidence_files(id) on delete set null,
  reporting_period_start date,
  reporting_period_end date,
  measurement_date date not null default current_date,
  baseline_value numeric(18,4),
  target_value numeric(18,4),
  measured_value numeric(18,4) not null,
  progress_percentage numeric(12,4),
  outcome_status text not null default 'no_baseline',
  source_type text not null default 'manual',
  verification_status text not null default 'draft',
  submitted_by_user_id uuid references public.users(id) on delete set null,
  submitted_at timestamptz,
  verified_by_user_id uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  review_note text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_indicator_measurements_period_check
    check (reporting_period_start is null or reporting_period_end is null or reporting_period_end >= reporting_period_start),
  constraint impact_indicator_measurements_outcome_check
    check (outcome_status in ('no_baseline', 'below_target', 'on_track', 'achieved', 'exceeded', 'regressed')),
  constraint impact_indicator_measurements_source_check
    check (source_type in ('manual', 'assessment_score', 'field_visit', 'evidence', 'imported')),
  constraint impact_indicator_measurements_verification_check
    check (verification_status in ('draft', 'submitted', 'verified', 'rejected', 'returned')),
  constraint impact_indicator_measurements_submission_identity_check
    check (verification_status = 'draft' or (submitted_by_user_id is not null and submitted_at is not null)),
  constraint impact_indicator_measurements_verifier_check
    check (verification_status <> 'verified' or (verified_by_user_id is not null and verified_at is not null))
);

create table if not exists public.impact_indicator_measurement_events (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.impact_indicator_measurements(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint impact_indicator_measurement_events_type_check
    check (event_type in ('created', 'submitted', 'verified', 'rejected', 'returned'))
);

create index if not exists idx_impact_indicator_definitions_programme_cohort
  on public.impact_indicator_definitions(programme_id, cohort_id);
create index if not exists idx_impact_indicator_definitions_intervention
  on public.impact_indicator_definitions(intervention_id);
create index if not exists idx_impact_indicator_definitions_status
  on public.impact_indicator_definitions(status);
create unique index if not exists idx_impact_indicator_definitions_scope_name
  on public.impact_indicator_definitions(
    coalesce(programme_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(intervention_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  )
  where status <> 'archived';

create index if not exists idx_impact_indicator_measurements_programme_cohort
  on public.impact_indicator_measurements(programme_id, cohort_id);
create index if not exists idx_impact_indicator_measurements_cohort_member
  on public.impact_indicator_measurements(cohort_member_id);
create index if not exists idx_impact_indicator_measurements_msme
  on public.impact_indicator_measurements(msme_id);
create index if not exists idx_impact_indicator_measurements_intervention
  on public.impact_indicator_measurements(intervention_id);
create index if not exists idx_impact_indicator_measurements_assessment
  on public.impact_indicator_measurements(assessment_id);
create index if not exists idx_impact_indicator_measurements_score_run
  on public.impact_indicator_measurements(assessment_score_run_id);
create index if not exists idx_impact_indicator_measurements_field_visit
  on public.impact_indicator_measurements(field_visit_id);
create index if not exists idx_impact_indicator_measurements_evidence
  on public.impact_indicator_measurements(evidence_id);
create index if not exists idx_impact_indicator_measurements_verification
  on public.impact_indicator_measurements(verification_status);
create index if not exists idx_impact_indicator_measurements_date
  on public.impact_indicator_measurements(measurement_date desc);
create index if not exists idx_impact_indicator_measurements_period
  on public.impact_indicator_measurements(reporting_period_start, reporting_period_end);
create index if not exists idx_impact_indicator_measurements_definition
  on public.impact_indicator_measurements(indicator_definition_id);
create index if not exists idx_impact_indicator_measurement_events_measurement
  on public.impact_indicator_measurement_events(measurement_id, created_at desc);

create or replace function public.validate_impact_indicator_definition()
returns trigger
language plpgsql
as $$
declare
  cohort_programme_id uuid;
  intervention_programme_id uuid;
  intervention_cohort_id uuid;
begin
  if new.cohort_id is not null then
    select programme_id into cohort_programme_id
    from public.impact_beneficiary_cohorts
    where id = new.cohort_id;
    if cohort_programme_id is null then raise exception 'Selected indicator cohort does not exist.'; end if;
    if new.programme_id is null or new.programme_id <> cohort_programme_id then
      raise exception 'Selected indicator cohort does not belong to the selected programme.';
    end if;
  end if;

  if new.intervention_id is not null then
    select programme_id, cohort_id
      into intervention_programme_id, intervention_cohort_id
    from public.impact_interventions
    where id = new.intervention_id;
    if intervention_programme_id is null then raise exception 'Selected indicator intervention does not exist.'; end if;
    if new.programme_id is null or new.programme_id <> intervention_programme_id then
      raise exception 'Selected indicator intervention does not belong to the selected programme.';
    end if;
    if new.cohort_id is not null and intervention_cohort_id is distinct from new.cohort_id then
      raise exception 'Selected indicator intervention does not belong to the selected cohort.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_impact_indicator_definition on public.impact_indicator_definitions;
create trigger validate_impact_indicator_definition
before insert or update on public.impact_indicator_definitions
for each row execute function public.validate_impact_indicator_definition();

create or replace function public.validate_impact_indicator_measurement()
returns trigger
language plpgsql
as $$
declare
  definition_row public.impact_indicator_definitions%rowtype;
  cohort_programme_id uuid;
  member_programme_id uuid;
  member_cohort_id uuid;
  member_msme_id uuid;
  intervention_programme_id uuid;
  intervention_cohort_id uuid;
  intervention_member_id uuid;
  intervention_msme_id uuid;
  assessment_programme_id uuid;
  assessment_cohort_id uuid;
  assessment_member_id uuid;
  assessment_msme_id uuid;
  score_run_assessment_id uuid;
  visit_programme_id uuid;
  visit_cohort_id uuid;
  visit_member_id uuid;
  visit_msme_id uuid;
  visit_intervention_id uuid;
  visit_assessment_id uuid;
  evidence_programme_id uuid;
  evidence_cohort_id uuid;
  evidence_member_id uuid;
  evidence_msme_id uuid;
begin
  select * into definition_row
  from public.impact_indicator_definitions
  where id = new.indicator_definition_id;

  if definition_row.id is null then raise exception 'Selected indicator definition does not exist.'; end if;
  if definition_row.status <> 'active'
    and (tg_op = 'INSERT' or new.indicator_definition_id is distinct from old.indicator_definition_id)
  then
    raise exception 'Measurements require an active indicator definition.';
  end if;
  if definition_row.programme_id is not null and definition_row.programme_id <> new.programme_id then
    raise exception 'Measurement programme does not match the indicator definition.';
  end if;
  if definition_row.cohort_id is not null and definition_row.cohort_id is distinct from new.cohort_id then
    raise exception 'Measurement cohort does not match the indicator definition.';
  end if;
  if definition_row.intervention_id is not null and definition_row.intervention_id is distinct from new.intervention_id then
    raise exception 'Measurement intervention does not match the indicator definition.';
  end if;
  if definition_row.baseline_required and new.baseline_value is null then
    raise exception 'This indicator requires a baseline value.';
  end if;
  if definition_row.target_required and new.target_value is null then
    raise exception 'This indicator requires a target value.';
  end if;

  if new.cohort_id is not null then
    select programme_id into cohort_programme_id from public.impact_beneficiary_cohorts where id = new.cohort_id;
    if cohort_programme_id is null or cohort_programme_id <> new.programme_id then
      raise exception 'Measurement cohort does not belong to the selected programme.';
    end if;
  end if;

  if new.cohort_member_id is not null then
    select programme_id, cohort_id, msme_id
      into member_programme_id, member_cohort_id, member_msme_id
    from public.impact_cohort_members where id = new.cohort_member_id;
    if member_programme_id is null then raise exception 'Selected measurement beneficiary does not exist.'; end if;
    if member_programme_id <> new.programme_id or member_cohort_id is distinct from new.cohort_id then
      raise exception 'Measurement beneficiary does not match the programme and cohort.';
    end if;
    if new.msme_id is null then new.msme_id := member_msme_id; end if;
    if new.msme_id <> member_msme_id then raise exception 'Measurement MSME does not match the selected beneficiary.'; end if;
  end if;

  if new.intervention_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id
      into intervention_programme_id, intervention_cohort_id, intervention_member_id, intervention_msme_id
    from public.impact_interventions where id = new.intervention_id;
    if intervention_programme_id is null then raise exception 'Selected measurement intervention does not exist.'; end if;
    if intervention_programme_id <> new.programme_id
      or (new.cohort_id is not null and intervention_cohort_id is distinct from new.cohort_id)
      or (new.cohort_member_id is not null and intervention_member_id is distinct from new.cohort_member_id)
      or (new.msme_id is not null and intervention_msme_id is distinct from new.msme_id) then
      raise exception 'Measurement intervention does not match the beneficiary context.';
    end if;
  end if;

  if new.assessment_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id
      into assessment_programme_id, assessment_cohort_id, assessment_member_id, assessment_msme_id
    from public.impact_assessments where id = new.assessment_id;
    if assessment_programme_id is null then raise exception 'Selected measurement assessment does not exist.'; end if;
    if assessment_programme_id <> new.programme_id
      or (new.cohort_id is not null and assessment_cohort_id is distinct from new.cohort_id)
      or (new.cohort_member_id is not null and assessment_member_id is distinct from new.cohort_member_id)
      or (new.msme_id is not null and assessment_msme_id is distinct from new.msme_id) then
      raise exception 'Measurement assessment does not match the beneficiary context.';
    end if;
  end if;

  if new.assessment_score_run_id is not null then
    select assessment_id into score_run_assessment_id
    from public.impact_assessment_score_runs where id = new.assessment_score_run_id;
    if score_run_assessment_id is null then raise exception 'Selected assessment score run does not exist.'; end if;
    if new.assessment_id is null or score_run_assessment_id <> new.assessment_id then
      raise exception 'Assessment score run does not match the selected assessment.';
    end if;
  end if;

  if new.field_visit_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id, intervention_id, assessment_id
      into visit_programme_id, visit_cohort_id, visit_member_id, visit_msme_id, visit_intervention_id, visit_assessment_id
    from public.impact_field_visits where id = new.field_visit_id;
    if visit_programme_id is null then raise exception 'Selected measurement field visit does not exist.'; end if;
    if visit_programme_id <> new.programme_id
      or (new.cohort_id is not null and visit_cohort_id is distinct from new.cohort_id)
      or (new.cohort_member_id is not null and visit_member_id is distinct from new.cohort_member_id)
      or (new.msme_id is not null and visit_msme_id is distinct from new.msme_id)
      or (new.intervention_id is not null and visit_intervention_id is distinct from new.intervention_id)
      or (new.assessment_id is not null and visit_assessment_id is distinct from new.assessment_id) then
      raise exception 'Measurement field visit does not match the beneficiary context.';
    end if;
  end if;

  if new.evidence_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id
      into evidence_programme_id, evidence_cohort_id, evidence_member_id, evidence_msme_id
    from public.impact_evidence_files where id = new.evidence_id;
    if evidence_programme_id is null then raise exception 'Selected measurement evidence does not exist.'; end if;
    if evidence_programme_id <> new.programme_id
      or (new.cohort_id is not null and evidence_cohort_id is distinct from new.cohort_id)
      or (new.cohort_member_id is not null and evidence_member_id is distinct from new.cohort_member_id)
      or (new.msme_id is not null and evidence_msme_id is distinct from new.msme_id) then
      raise exception 'Measurement evidence does not match the beneficiary context.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_impact_indicator_measurement on public.impact_indicator_measurements;
create trigger validate_impact_indicator_measurement
before insert or update on public.impact_indicator_measurements
for each row execute function public.validate_impact_indicator_measurement();

drop trigger if exists set_impact_indicator_definitions_updated_at on public.impact_indicator_definitions;
create trigger set_impact_indicator_definitions_updated_at
before update on public.impact_indicator_definitions
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_indicator_measurements_updated_at on public.impact_indicator_measurements;
create trigger set_impact_indicator_measurements_updated_at
before update on public.impact_indicator_measurements
for each row execute function public.set_impact_intelligence_updated_at();

create or replace function public.prevent_impact_indicator_measurement_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Indicator measurement events are append-only.';
end;
$$;

drop trigger if exists prevent_impact_indicator_measurement_event_update on public.impact_indicator_measurement_events;
create trigger prevent_impact_indicator_measurement_event_update
before update or delete on public.impact_indicator_measurement_events
for each row execute function public.prevent_impact_indicator_measurement_event_mutation();

alter table public.impact_indicator_definitions enable row level security;
alter table public.impact_indicator_measurements enable row level security;
alter table public.impact_indicator_measurement_events enable row level security;

revoke all on public.impact_indicator_definitions from anon;
revoke all on public.impact_indicator_measurements from anon;
revoke all on public.impact_indicator_measurement_events from anon;
revoke all on public.impact_indicator_definitions from authenticated;
revoke all on public.impact_indicator_measurements from authenticated;
revoke all on public.impact_indicator_measurement_events from authenticated;

-- Preserve legacy impact_indicators as imported, unverified records.
insert into public.impact_indicator_definitions (
  id,
  programme_id,
  intervention_id,
  name,
  description,
  unit_of_measure,
  indicator_type,
  direction_of_improvement,
  calculation_method,
  measurement_frequency,
  baseline_required,
  target_required,
  status,
  created_by_user_id,
  created_at,
  updated_at,
  metadata
)
select
  id,
  programme_id,
  intervention_id,
  name,
  description,
  coalesce(nullif(trim(unit), ''), 'unspecified'),
  'legacy',
  'increase',
  'manual',
  measurement_frequency,
  baseline_value is not null,
  target_value is not null,
  case when status = 'active' then 'active' when status = 'retired' then 'archived' else 'draft' end,
  created_by_user_id,
  created_at,
  updated_at,
  coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_indicator_status', status,
    'legacy_source_table', 'impact_indicators'
  )
from public.impact_indicators
on conflict do nothing;

insert into public.impact_indicator_measurements (
  indicator_definition_id,
  programme_id,
  msme_id,
  intervention_id,
  measurement_date,
  baseline_value,
  target_value,
  measured_value,
  progress_percentage,
  outcome_status,
  source_type,
  verification_status,
  created_by_user_id,
  created_at,
  updated_at,
  metadata
)
select
  id,
  programme_id,
  msme_id,
  intervention_id,
  coalesce(updated_at::date, created_at::date, current_date),
  baseline_value,
  target_value,
  current_value,
  null,
  case when baseline_value is null then 'no_baseline' else 'below_target' end,
  'imported',
  'draft',
  created_by_user_id,
  created_at,
  updated_at,
  coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_indicator_status', status,
    'legacy_source_table', 'impact_indicators'
  )
from public.impact_indicators
where programme_id is not null
  and status = 'active'
  and current_value is not null
  and not exists (
    select 1
    from public.impact_indicator_measurements measurement
    where measurement.indicator_definition_id = impact_indicators.id
      and measurement.metadata->>'legacy_source_table' = 'impact_indicators'
  );
