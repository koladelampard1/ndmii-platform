-- Impact Intelligence Reports Phase 1A.
-- Scope-correct institutional reports, immutable source snapshots, normalized
-- evidence/indicator references, governed lifecycle, and private exports.

create extension if not exists "pgcrypto";

alter table public.impact_reports
  add column if not exists cohort_id uuid references public.impact_beneficiary_cohorts(id) on delete set null,
  add column if not exists cohort_member_id uuid references public.impact_cohort_members(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists return_reason text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists latest_version_id uuid;

update public.impact_reports
set
  status = 'archived',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_unverified', true,
    'legacy_scope_warning', 'Scope may be unreliable and source references were not captured.',
    'legacy_original_status', status
  )
where coalesce(metadata->>'report_phase', '') <> 'phase1a';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'impact_reports_status_check'
      and conrelid = 'public.impact_reports'::regclass
  ) then
    alter table public.impact_reports drop constraint impact_reports_status_check;
  end if;

  alter table public.impact_reports
    add constraint impact_reports_status_check
    check (status in ('draft', 'in_review', 'returned', 'approved', 'archived'));
end $$;

alter table public.impact_report_versions
  add column if not exists generated_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists source_cutoff_at timestamptz not null default now(),
  add column if not exists report_scope jsonb not null default '{}'::jsonb,
  add column if not exists source_summary jsonb not null default '{}'::jsonb,
  add column if not exists assessment_ids uuid[] not null default '{}'::uuid[],
  add column if not exists score_run_ids uuid[] not null default '{}'::uuid[],
  add column if not exists field_visit_ids uuid[] not null default '{}'::uuid[],
  add column if not exists evidence_ids uuid[] not null default '{}'::uuid[],
  add column if not exists indicator_measurement_ids uuid[] not null default '{}'::uuid[],
  add column if not exists completeness_warnings jsonb not null default '[]'::jsonb;

update public.impact_report_versions
set
  generated_by_user_id = coalesce(generated_by_user_id, created_by_user_id),
  generated_at = created_at,
  source_cutoff_at = created_at,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('legacy_unverified', true)
where coalesce(metadata->>'report_phase', '') <> 'phase1a';

alter table public.impact_reports
  drop constraint if exists impact_reports_latest_version_id_fkey;
alter table public.impact_reports
  add constraint impact_reports_latest_version_id_fkey
  foreign key (latest_version_id) references public.impact_report_versions(id) on delete set null;

create table if not exists public.impact_report_version_evidence_references (
  id uuid primary key default gen_random_uuid(),
  report_version_id uuid not null references public.impact_report_versions(id) on delete cascade,
  evidence_id uuid not null references public.impact_evidence_files(id) on delete restrict,
  original_filename text not null,
  verification_status text not null,
  checksum_sha256 text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  assessment_id uuid references public.impact_assessments(id) on delete set null,
  field_visit_id uuid references public.impact_field_visits(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint impact_report_version_evidence_unique unique (report_version_id, evidence_id),
  constraint impact_report_version_evidence_verified_check check (verification_status = 'verified'),
  constraint impact_report_version_evidence_checksum_check check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  constraint impact_report_version_evidence_size_check check (file_size_bytes > 0)
);

create table if not exists public.impact_report_version_indicator_references (
  id uuid primary key default gen_random_uuid(),
  report_version_id uuid not null references public.impact_report_versions(id) on delete cascade,
  indicator_definition_id uuid not null references public.impact_indicator_definitions(id) on delete restrict,
  indicator_measurement_id uuid not null references public.impact_indicator_measurements(id) on delete restrict,
  indicator_name text not null,
  unit_of_measure text not null,
  baseline_value numeric(18,4),
  target_value numeric(18,4),
  measured_value numeric(18,4) not null,
  progress_percentage numeric(12,4),
  outcome_status text not null,
  measurement_date date not null,
  verification_status text not null,
  created_at timestamptz not null default now(),
  constraint impact_report_version_indicator_unique unique (report_version_id, indicator_measurement_id),
  constraint impact_report_version_indicator_verified_check check (verification_status = 'verified')
);

alter table public.impact_report_exports
  add column if not exists report_version_id uuid references public.impact_report_versions(id) on delete cascade,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists checksum_sha256 text,
  add column if not exists generated_at timestamptz,
  add column if not exists generated_by_user_id uuid references public.users(id) on delete set null;

update public.impact_report_exports
set
  export_status = 'failed',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_unverified', true,
    'legacy_export_warning', 'Previously marked generated without a verified private file.'
  )
where export_status = 'generated'
  and (
    report_version_id is null
    or storage_bucket is null
    or storage_path is null
    or mime_type is null
    or coalesce(file_size_bytes, 0) <= 0
    or checksum_sha256 is null
    or generated_at is null
    or generated_by_user_id is null
  );

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'impact_report_exports_format_check'
      and conrelid = 'public.impact_report_exports'::regclass
  ) then
    alter table public.impact_report_exports drop constraint impact_report_exports_format_check;
  end if;

  alter table public.impact_report_exports
    add constraint impact_report_exports_format_check
    check (export_format in ('pdf', 'csv', 'xlsx', 'json'));

  if not exists (
    select 1 from pg_constraint
    where conname = 'impact_report_exports_generated_file_check'
      and conrelid = 'public.impact_report_exports'::regclass
  ) then
    alter table public.impact_report_exports
      add constraint impact_report_exports_generated_file_check check (
        export_status <> 'generated'
        or (
          report_version_id is not null
          and storage_bucket = 'impact-reports'
          and storage_path is not null
          and mime_type is not null
          and file_size_bytes > 0
          and checksum_sha256 ~ '^[a-f0-9]{64}$'
          and generated_at is not null
          and generated_by_user_id is not null
        )
      );
  end if;
end $$;

create index if not exists idx_impact_reports_programme_cohort
  on public.impact_reports(programme_id, cohort_id);
create index if not exists idx_impact_reports_cohort_member
  on public.impact_reports(cohort_member_id);
create index if not exists idx_impact_reports_latest_version
  on public.impact_reports(latest_version_id);
create index if not exists idx_report_version_evidence_version
  on public.impact_report_version_evidence_references(report_version_id);
create index if not exists idx_report_version_indicator_version
  on public.impact_report_version_indicator_references(report_version_id);
create index if not exists idx_impact_report_exports_version
  on public.impact_report_exports(report_version_id);

create or replace function public.validate_impact_report_scope()
returns trigger
language plpgsql
as $$
declare
  cohort_programme_id uuid;
  member_programme_id uuid;
  member_cohort_id uuid;
  member_msme_id uuid;
  intervention_programme_id uuid;
  intervention_cohort_id uuid;
  intervention_member_id uuid;
  intervention_msme_id uuid;
begin
  if coalesce(new.metadata->>'report_phase', '') = 'phase1a' and new.programme_id is null then
    raise exception 'Phase 1A reports require a programme.';
  end if;

  if new.cohort_id is not null then
    select programme_id into cohort_programme_id
    from public.impact_beneficiary_cohorts where id = new.cohort_id;
    if cohort_programme_id is null then raise exception 'Selected report cohort does not exist.'; end if;
    if cohort_programme_id is distinct from new.programme_id then
      raise exception 'Selected report cohort does not belong to the selected programme.';
    end if;
  end if;

  if new.cohort_member_id is not null then
    select programme_id, cohort_id, msme_id
      into member_programme_id, member_cohort_id, member_msme_id
    from public.impact_cohort_members where id = new.cohort_member_id;
    if member_programme_id is null then raise exception 'Selected report beneficiary does not exist.'; end if;
    if member_programme_id is distinct from new.programme_id
      or member_cohort_id is distinct from new.cohort_id then
      raise exception 'Selected report beneficiary does not match the programme and cohort.';
    end if;
    if new.msme_id is null then new.msme_id := member_msme_id; end if;
    if new.msme_id is distinct from member_msme_id then
      raise exception 'Selected report MSME does not match the beneficiary.';
    end if;
  end if;

  if new.intervention_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id
      into intervention_programme_id, intervention_cohort_id, intervention_member_id, intervention_msme_id
    from public.impact_interventions where id = new.intervention_id;
    if intervention_programme_id is null then raise exception 'Selected report intervention does not exist.'; end if;
    if intervention_programme_id is distinct from new.programme_id
      or (new.cohort_id is not null and intervention_cohort_id is distinct from new.cohort_id)
      or (new.cohort_member_id is not null and intervention_member_id is distinct from new.cohort_member_id)
      or (new.msme_id is not null and intervention_msme_id is distinct from new.msme_id) then
      raise exception 'Selected report intervention does not match the report scope.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_impact_report_scope on public.impact_reports;
create trigger validate_impact_report_scope
before insert or update on public.impact_reports
for each row execute function public.validate_impact_report_scope();

create or replace function public.validate_impact_report_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not (
      (old.status = 'draft' and new.status in ('in_review', 'archived'))
      or (old.status = 'in_review' and new.status in ('returned', 'approved'))
      or (old.status = 'returned' and new.status in ('in_review', 'archived'))
      or (old.status = 'approved' and new.status = 'archived')
    ) then
      raise exception 'Invalid report lifecycle transition from % to %.', old.status, new.status;
    end if;
  end if;

  if new.status = 'in_review'
    and (new.latest_version_id is null or new.submitted_at is null or new.submitted_by_user_id is null) then
    raise exception 'Submitted reports require a generated version and submitter metadata.';
  end if;

  if new.status = 'returned'
    and (new.reviewed_at is null or new.reviewed_by_user_id is null or nullif(trim(new.return_reason), '') is null) then
    raise exception 'Returned reports require reviewer metadata and a return reason.';
  end if;

  if new.status = 'approved'
    and (new.latest_version_id is null or new.approved_at is null or new.approved_by_user_id is null or new.reviewed_at is null or new.reviewed_by_user_id is null) then
    raise exception 'Approved reports require a generated version, reviewer metadata, and approval metadata.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and (
    old.programme_id is distinct from new.programme_id
    or old.cohort_id is distinct from new.cohort_id
    or old.cohort_member_id is distinct from new.cohort_member_id
    or old.msme_id is distinct from new.msme_id
    or old.intervention_id is distinct from new.intervention_id
    or old.title is distinct from new.title
    or old.summary is distinct from new.summary
    or old.report_type is distinct from new.report_type
    or old.latest_version_id is distinct from new.latest_version_id
    or old.report_json is distinct from new.report_json
    or old.evidence_references is distinct from new.evidence_references
  ) then
    raise exception 'Approved report content and scope are immutable.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_impact_report_lifecycle on public.impact_reports;
create trigger validate_impact_report_lifecycle
before insert or update on public.impact_reports
for each row execute function public.validate_impact_report_lifecycle();

create or replace function public.prevent_impact_report_version_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Generated report versions are immutable.';
end;
$$;

drop trigger if exists prevent_impact_report_version_update on public.impact_report_versions;
create trigger prevent_impact_report_version_update
before update or delete on public.impact_report_versions
for each row execute function public.prevent_impact_report_version_mutation();

drop trigger if exists prevent_impact_report_evidence_reference_update on public.impact_report_version_evidence_references;
create trigger prevent_impact_report_evidence_reference_update
before update or delete on public.impact_report_version_evidence_references
for each row execute function public.prevent_impact_report_version_mutation();

drop trigger if exists prevent_impact_report_indicator_reference_update on public.impact_report_version_indicator_references;
create trigger prevent_impact_report_indicator_reference_update
before update or delete on public.impact_report_version_indicator_references
for each row execute function public.prevent_impact_report_version_mutation();

drop trigger if exists prevent_generated_impact_report_export_update on public.impact_report_exports;
create trigger prevent_generated_impact_report_export_update
before update or delete on public.impact_report_exports
for each row
when (old.export_status = 'generated')
execute function public.prevent_impact_report_version_mutation();

create or replace function public.create_impact_report_version(
  p_report_id uuid,
  p_title text,
  p_summary text,
  p_report_json jsonb,
  p_report_scope jsonb,
  p_source_summary jsonb,
  p_assessment_ids uuid[],
  p_score_run_ids uuid[],
  p_field_visit_ids uuid[],
  p_evidence_ids uuid[],
  p_indicator_measurement_ids uuid[],
  p_completeness_warnings jsonb,
  p_generated_by_user_id uuid,
  p_source_cutoff_at timestamptz,
  p_evidence_references jsonb,
  p_indicator_references jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report_row public.impact_reports%rowtype;
  next_version integer;
  new_version_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_report_id::text, 0));

  select * into report_row
  from public.impact_reports
  where id = p_report_id
  for update;

  if report_row.id is null then raise exception 'Report not found.'; end if;
  if report_row.status not in ('draft', 'returned') then
    raise exception 'Only draft or returned reports can generate a version.';
  end if;
  if coalesce(report_row.metadata->>'report_phase', '') <> 'phase1a' then
    raise exception 'Legacy reports cannot generate Phase 1A versions.';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.impact_report_versions
  where report_id = p_report_id;

  insert into public.impact_report_versions (
    report_id, version_number, title, summary, report_json, evidence_references,
    created_by_user_id, generated_by_user_id, generated_at, source_cutoff_at,
    report_scope, source_summary, assessment_ids, score_run_ids, field_visit_ids,
    evidence_ids, indicator_measurement_ids, completeness_warnings, metadata
  )
  values (
    p_report_id, next_version, p_title, p_summary, p_report_json, p_evidence_references,
    p_generated_by_user_id, p_generated_by_user_id, now(), p_source_cutoff_at,
    p_report_scope, p_source_summary, p_assessment_ids, p_score_run_ids, p_field_visit_ids,
    p_evidence_ids, p_indicator_measurement_ids, p_completeness_warnings,
    jsonb_build_object('report_phase', 'phase1a', 'immutable', true)
  )
  returning id into new_version_id;

  insert into public.impact_report_version_evidence_references (
    report_version_id, evidence_id, original_filename, verification_status,
    checksum_sha256, mime_type, file_size_bytes, intervention_id, assessment_id, field_visit_id
  )
  select
    new_version_id,
    (item->>'evidence_id')::uuid,
    item->>'original_filename',
    item->>'verification_status',
    item->>'checksum_sha256',
    item->>'mime_type',
    (item->>'file_size_bytes')::bigint,
    nullif(item->>'intervention_id', '')::uuid,
    nullif(item->>'assessment_id', '')::uuid,
    nullif(item->>'field_visit_id', '')::uuid
  from jsonb_array_elements(coalesce(p_evidence_references, '[]'::jsonb)) item;

  insert into public.impact_report_version_indicator_references (
    report_version_id, indicator_definition_id, indicator_measurement_id,
    indicator_name, unit_of_measure, baseline_value, target_value, measured_value,
    progress_percentage, outcome_status, measurement_date, verification_status
  )
  select
    new_version_id,
    (item->>'indicator_definition_id')::uuid,
    (item->>'indicator_measurement_id')::uuid,
    item->>'indicator_name',
    item->>'unit_of_measure',
    nullif(item->>'baseline_value', '')::numeric,
    nullif(item->>'target_value', '')::numeric,
    (item->>'measured_value')::numeric,
    nullif(item->>'progress_percentage', '')::numeric,
    item->>'outcome_status',
    (item->>'measurement_date')::date,
    item->>'verification_status'
  from jsonb_array_elements(coalesce(p_indicator_references, '[]'::jsonb)) item;

  update public.impact_reports
  set
    latest_version_id = new_version_id,
    report_json = p_report_json,
    evidence_references = p_evidence_references,
    generated_at = now(),
    return_reason = null,
    updated_at = now()
  where id = p_report_id;

  return new_version_id;
end;
$$;

revoke all on function public.create_impact_report_version(
  uuid, text, text, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[], uuid[], uuid[],
  jsonb, uuid, timestamptz, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_impact_report_version(
  uuid, text, text, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[], uuid[], uuid[],
  jsonb, uuid, timestamptz, jsonb, jsonb
) to service_role;

alter table public.impact_reports enable row level security;
alter table public.impact_report_versions enable row level security;
alter table public.impact_report_version_evidence_references enable row level security;
alter table public.impact_report_version_indicator_references enable row level security;
alter table public.impact_report_exports enable row level security;

revoke all on public.impact_reports from anon, authenticated;
revoke all on public.impact_report_versions from anon, authenticated;
revoke all on public.impact_report_version_evidence_references from anon, authenticated;
revoke all on public.impact_report_version_indicator_references from anon, authenticated;
revoke all on public.impact_report_exports from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'impact-reports',
  'impact-reports',
  false,
  10485760,
  array['application/pdf', 'application/json']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'application/json'];
