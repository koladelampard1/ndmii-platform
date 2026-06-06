-- Impact Intelligence Evidence Phase 1.
-- Adds real private-file metadata, cohort/member anchoring, lifecycle review,
-- append-only events, and defensive integrity constraints.

create extension if not exists "pgcrypto";

alter table public.impact_evidence_files
  add column if not exists cohort_id uuid references public.impact_beneficiary_cohorts(id) on delete set null,
  add column if not exists cohort_member_id uuid references public.impact_cohort_members(id) on delete set null,
  add column if not exists status text not null default 'draft',
  add column if not exists original_filename text,
  add column if not exists stored_filename text,
  add column if not exists mime_type text,
  add column if not exists sha256_hash text,
  add column if not exists uploaded_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists review_decision text,
  add column if not exists review_note text,
  add column if not exists returned_at timestamptz,
  add column if not exists returned_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists return_reason text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references public.users(id) on delete set null;

update public.impact_evidence_files
set
  status = 'draft',
  metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'legacy_evidence_status',
      coalesce(verification_status, 'pending'),
      'legacy_placeholder',
      storage_path is null
    )
where metadata->>'legacy_evidence_status' is null;

update public.impact_evidence_files
set
  original_filename = coalesce(original_filename, file_name),
  uploaded_at = coalesce(uploaded_at, created_at)
where storage_path is not null
  and storage_bucket is not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_verification_status_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files
      drop constraint impact_evidence_files_verification_status_check;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_status_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files
      drop constraint impact_evidence_files_status_check;
  end if;

  alter table public.impact_evidence_files
    add constraint impact_evidence_files_verification_status_check
    check (verification_status in ('pending', 'verified', 'rejected', 'needs_review', 'returned', 'archived'));

  alter table public.impact_evidence_files
    add constraint impact_evidence_files_status_check
    check (status in ('draft', 'uploaded', 'submitted', 'under_review', 'verified', 'rejected', 'returned', 'archived'));

  if not exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_bucket_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files
      add constraint impact_evidence_files_bucket_check
      check (storage_bucket is null or storage_bucket = 'impact-evidence');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_size_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files
      add constraint impact_evidence_files_size_check
      check (file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 10485760));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_mime_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files
      add constraint impact_evidence_files_mime_check
      check (mime_type is null or mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_sha256_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files
      add constraint impact_evidence_files_sha256_check
      check (sha256_hash is null or sha256_hash ~ '^[a-f0-9]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_review_decision_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files
      add constraint impact_evidence_files_review_decision_check
      check (review_decision is null or review_decision in ('verified', 'rejected', 'returned'));
  end if;
end $$;

create table if not exists public.impact_evidence_events (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.impact_evidence_files(id) on delete cascade,
  programme_id uuid references public.impact_programmes(id) on delete set null,
  cohort_id uuid references public.impact_beneficiary_cohorts(id) on delete set null,
  cohort_member_id uuid references public.impact_cohort_members(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint impact_evidence_events_type_check
    check (event_type in ('uploaded', 'submitted', 'review_started', 'verified', 'rejected', 'returned', 'resubmitted', 'archived', 'previewed', 'downloaded'))
);

create index if not exists idx_impact_evidence_files_programme_cohort
  on public.impact_evidence_files(programme_id, cohort_id);
create index if not exists idx_impact_evidence_files_cohort_member
  on public.impact_evidence_files(cohort_member_id);
create index if not exists idx_impact_evidence_files_msme
  on public.impact_evidence_files(msme_id);
create index if not exists idx_impact_evidence_files_intervention
  on public.impact_evidence_files(intervention_id);
create index if not exists idx_impact_evidence_files_assessment
  on public.impact_evidence_files(assessment_id);
create index if not exists idx_impact_evidence_files_field_visit
  on public.impact_evidence_files(field_visit_id);
create index if not exists idx_impact_evidence_files_status
  on public.impact_evidence_files(status);
create index if not exists idx_impact_evidence_files_sha256
  on public.impact_evidence_files(sha256_hash);
create index if not exists idx_impact_evidence_files_uploaded_by
  on public.impact_evidence_files(uploaded_by_user_id);
create unique index if not exists idx_impact_evidence_files_storage_object
  on public.impact_evidence_files(storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;
create index if not exists idx_impact_evidence_events_evidence_created
  on public.impact_evidence_events(evidence_id, created_at desc);

create or replace function public.validate_impact_evidence_record()
returns trigger
language plpgsql
as $$
declare
  cohort_programme_id uuid;
  member_cohort_id uuid;
  member_programme_id uuid;
  member_msme_id uuid;
  intervention_programme_id uuid;
  intervention_cohort_id uuid;
  intervention_member_id uuid;
  intervention_msme_id uuid;
  assessment_programme_id uuid;
  assessment_cohort_id uuid;
  assessment_member_id uuid;
  assessment_msme_id uuid;
  visit_programme_id uuid;
  visit_cohort_id uuid;
  visit_member_id uuid;
  visit_msme_id uuid;
  visit_intervention_id uuid;
  visit_assessment_id uuid;
begin
  if new.cohort_id is not null then
    select programme_id into cohort_programme_id
    from public.impact_beneficiary_cohorts
    where id = new.cohort_id;
    if cohort_programme_id is null then raise exception 'Selected evidence cohort does not exist.'; end if;
    if new.programme_id is distinct from cohort_programme_id then
      raise exception 'Selected evidence cohort does not belong to the selected programme.';
    end if;
  end if;

  if new.cohort_member_id is not null then
    select cohort_id, programme_id, msme_id
      into member_cohort_id, member_programme_id, member_msme_id
    from public.impact_cohort_members
    where id = new.cohort_member_id;
    if member_cohort_id is null then raise exception 'Selected evidence cohort beneficiary does not exist.'; end if;
    if new.cohort_id is distinct from member_cohort_id then
      raise exception 'Selected evidence beneficiary does not belong to the selected cohort.';
    end if;
    if new.programme_id is distinct from member_programme_id then
      raise exception 'Selected evidence beneficiary does not belong to the selected programme.';
    end if;
    new.msme_id := member_msme_id;
  end if;

  if new.intervention_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id
      into intervention_programme_id, intervention_cohort_id, intervention_member_id, intervention_msme_id
    from public.impact_interventions where id = new.intervention_id;
    if intervention_programme_id is null and intervention_msme_id is null then raise exception 'Selected evidence intervention does not exist.'; end if;
    if intervention_programme_id is distinct from new.programme_id
      or intervention_cohort_id is distinct from new.cohort_id
      or intervention_member_id is distinct from new.cohort_member_id
      or intervention_msme_id is distinct from new.msme_id then
      raise exception 'Selected evidence intervention does not match the programme beneficiary context.';
    end if;
  end if;

  if new.assessment_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id
      into assessment_programme_id, assessment_cohort_id, assessment_member_id, assessment_msme_id
    from public.impact_assessments where id = new.assessment_id;
    if assessment_programme_id is null and assessment_msme_id is null then raise exception 'Selected evidence assessment does not exist.'; end if;
    if assessment_programme_id is distinct from new.programme_id
      or assessment_cohort_id is distinct from new.cohort_id
      or assessment_member_id is distinct from new.cohort_member_id
      or assessment_msme_id is distinct from new.msme_id then
      raise exception 'Selected evidence assessment does not match the programme beneficiary context.';
    end if;
  end if;

  if new.field_visit_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id, intervention_id, assessment_id
      into visit_programme_id, visit_cohort_id, visit_member_id, visit_msme_id, visit_intervention_id, visit_assessment_id
    from public.impact_field_visits where id = new.field_visit_id;
    if visit_programme_id is null and visit_msme_id is null then raise exception 'Selected evidence field visit does not exist.'; end if;
    if visit_programme_id is distinct from new.programme_id
      or visit_cohort_id is distinct from new.cohort_id
      or visit_member_id is distinct from new.cohort_member_id
      or visit_msme_id is distinct from new.msme_id then
      raise exception 'Selected evidence field visit does not match the programme beneficiary context.';
    end if;
    if new.intervention_id is not null and visit_intervention_id is distinct from new.intervention_id then
      raise exception 'Selected evidence field visit does not match the selected intervention.';
    end if;
    if new.assessment_id is not null and visit_assessment_id is distinct from new.assessment_id then
      raise exception 'Selected evidence field visit does not match the selected assessment.';
    end if;
  end if;

  if new.status in ('uploaded', 'submitted', 'under_review', 'verified', 'rejected', 'returned') then
    if new.programme_id is null or new.cohort_id is null or new.cohort_member_id is null or new.msme_id is null then
      raise exception 'Uploaded evidence requires programme, cohort, beneficiary, and MSME anchors.';
    end if;
    if new.storage_bucket is null
      or new.storage_path is null
      or new.original_filename is null
      or new.stored_filename is null
      or new.mime_type is null
      or new.file_size_bytes is null
      or new.sha256_hash is null
      or new.uploaded_at is null
      or new.uploaded_by_user_id is null then
      raise exception 'Uploaded evidence requires complete storage metadata.';
    end if;
  end if;

  if new.status = 'verified' and (new.reviewed_by_user_id is null or new.reviewed_at is null or new.review_decision <> 'verified') then
    raise exception 'Verified evidence requires reviewer identity and a verified decision.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_impact_evidence_record on public.impact_evidence_files;
create trigger validate_impact_evidence_record
before insert or update on public.impact_evidence_files
for each row execute function public.validate_impact_evidence_record();

create or replace function public.validate_impact_evidence_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status is not distinct from new.status then return new; end if;

  if not (
    (old.status = 'draft' and new.status = 'uploaded')
    or (old.status = 'uploaded' and new.status = 'submitted')
    or (old.status = 'submitted' and new.status = 'under_review')
    or (old.status = 'under_review' and new.status in ('verified', 'rejected', 'returned'))
    or (old.status = 'returned' and new.status = 'submitted')
    or (old.status in ('draft', 'uploaded', 'submitted', 'under_review', 'verified', 'rejected', 'returned') and new.status = 'archived')
  ) then
    raise exception 'Invalid evidence lifecycle transition from % to %.', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_impact_evidence_transition on public.impact_evidence_files;
create trigger validate_impact_evidence_transition
before update on public.impact_evidence_files
for each row execute function public.validate_impact_evidence_transition();

create or replace function public.prevent_impact_evidence_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Impact evidence events are append-only.';
end;
$$;

drop trigger if exists prevent_impact_evidence_event_update on public.impact_evidence_events;
create trigger prevent_impact_evidence_event_update
before update or delete on public.impact_evidence_events
for each row execute function public.prevent_impact_evidence_event_mutation();

alter table public.impact_evidence_files enable row level security;
alter table public.impact_evidence_links enable row level security;
alter table public.impact_evidence_events enable row level security;

-- Evidence access is mediated by server-side role and assignment checks.
-- The service-role client bypasses RLS only after those checks succeed.
revoke all on public.impact_evidence_files from anon;
revoke all on public.impact_evidence_links from anon;
revoke all on public.impact_evidence_events from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'impact-evidence',
  'impact-evidence',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
