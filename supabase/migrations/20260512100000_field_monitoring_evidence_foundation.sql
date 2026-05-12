-- DBIN Field Monitoring & Evidence Management foundation
-- Additive, idempotent schema for BOI monitoring assignments, notes,
-- checklist tracking, evidence records, and entity links.

create extension if not exists "pgcrypto";

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'users'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.users drop constraint %I', constraint_record.conname);
  end loop;

  alter table public.users
    add constraint users_role_check
    check (
      role in (
        'public',
        'msme',
        'association_officer',
        'reviewer',
        'boi_executive',
        'programme_officer',
        'assessment_officer',
        'field_officer',
        'auditor',
        'fccpc_officer',
        'firs_officer',
        'nrs_officer',
        'admin'
      )
    );
end $$;

alter table public.impact_field_visits
  add column if not exists title text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists assigned_at timestamptz,
  add column if not exists reviewed_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists follow_up_visit_id uuid references public.impact_field_visits(id) on delete set null,
  add column if not exists priority text not null default 'normal';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'impact_field_visits_status_check'
      and conrelid = 'public.impact_field_visits'::regclass
  ) then
    alter table public.impact_field_visits drop constraint impact_field_visits_status_check;
  end if;

  alter table public.impact_field_visits
    add constraint impact_field_visits_status_check
    check (status in ('pending', 'assigned', 'in_progress', 'completed', 'reviewed', 'scheduled', 'cancelled', 'requires_follow_up'));
end $$;

create table if not exists public.impact_field_visit_assignments (
  id uuid primary key default gen_random_uuid(),
  field_visit_id uuid not null references public.impact_field_visits(id) on delete cascade,
  assigned_to_user_id uuid not null references public.users(id) on delete cascade,
  assigned_by_user_id uuid references public.users(id) on delete set null,
  assignment_status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_field_visit_assignments_status_check check (assignment_status in ('assigned', 'accepted', 'completed', 'reassigned', 'cancelled'))
);

create table if not exists public.impact_monitoring_checklists (
  id uuid primary key default gen_random_uuid(),
  field_visit_id uuid not null references public.impact_field_visits(id) on delete cascade,
  checklist_item text not null,
  item_category text,
  is_required boolean not null default false,
  is_completed boolean not null default false,
  completed_by_user_id uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.impact_monitoring_notes (
  id uuid primary key default gen_random_uuid(),
  field_visit_id uuid not null references public.impact_field_visits(id) on delete cascade,
  programme_id uuid references public.impact_programmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  assessment_id uuid references public.impact_assessments(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete cascade,
  note_type text not null default 'field_note',
  title text,
  note text not null,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_monitoring_notes_type_check check (note_type in ('field_note', 'risk', 'follow_up', 'review', 'verification'))
);

alter table public.impact_evidence_files
  add column if not exists evidence_category text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verified_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists file_size_bytes bigint,
  add column if not exists captured_at timestamptz;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_type_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files drop constraint impact_evidence_files_type_check;
  end if;

  alter table public.impact_evidence_files
    add constraint impact_evidence_files_type_check
    check (evidence_type in ('document', 'photo', 'video', 'receipt', 'field_note', 'other', 'image', 'pdf'));

  if not exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_category_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files
      add constraint impact_evidence_files_category_check
      check (evidence_category is null or evidence_category in ('business_photo', 'facility_photo', 'cac_document', 'invoice', 'monitoring_photo', 'beneficiary_document', 'signed_form', 'compliance_document', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'impact_evidence_files_verification_status_check'
      and conrelid = 'public.impact_evidence_files'::regclass
  ) then
    alter table public.impact_evidence_files
      add constraint impact_evidence_files_verification_status_check
      check (verification_status in ('pending', 'verified', 'rejected', 'needs_review'));
  end if;
end $$;

create table if not exists public.impact_evidence_links (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.impact_evidence_files(id) on delete cascade,
  programme_id uuid references public.impact_programmes(id) on delete cascade,
  intervention_id uuid references public.impact_interventions(id) on delete cascade,
  assessment_id uuid references public.impact_assessments(id) on delete cascade,
  field_visit_id uuid references public.impact_field_visits(id) on delete cascade,
  msme_id uuid references public.msmes(id) on delete cascade,
  link_type text not null default 'supporting_evidence',
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_impact_field_visits_assigned_to_user_id on public.impact_field_visits(assigned_to_user_id);
create index if not exists idx_impact_field_visits_follow_up_visit_id on public.impact_field_visits(follow_up_visit_id);
create index if not exists idx_impact_field_visit_assignments_visit_id on public.impact_field_visit_assignments(field_visit_id);
create index if not exists idx_impact_field_visit_assignments_user_id on public.impact_field_visit_assignments(assigned_to_user_id);
create index if not exists idx_impact_monitoring_checklists_visit_id on public.impact_monitoring_checklists(field_visit_id);
create index if not exists idx_impact_monitoring_notes_visit_id on public.impact_monitoring_notes(field_visit_id);
create index if not exists idx_impact_monitoring_notes_msme_id on public.impact_monitoring_notes(msme_id);
create index if not exists idx_impact_evidence_files_category on public.impact_evidence_files(evidence_category);
create index if not exists idx_impact_evidence_files_verification_status on public.impact_evidence_files(verification_status);
create index if not exists idx_impact_evidence_links_evidence_id on public.impact_evidence_links(evidence_id);
create index if not exists idx_impact_evidence_links_programme_id on public.impact_evidence_links(programme_id);
create index if not exists idx_impact_evidence_links_intervention_id on public.impact_evidence_links(intervention_id);
create index if not exists idx_impact_evidence_links_assessment_id on public.impact_evidence_links(assessment_id);
create index if not exists idx_impact_evidence_links_field_visit_id on public.impact_evidence_links(field_visit_id);
create index if not exists idx_impact_evidence_links_msme_id on public.impact_evidence_links(msme_id);

drop trigger if exists set_impact_field_visit_assignments_updated_at on public.impact_field_visit_assignments;
create trigger set_impact_field_visit_assignments_updated_at
before update on public.impact_field_visit_assignments
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_monitoring_checklists_updated_at on public.impact_monitoring_checklists;
create trigger set_impact_monitoring_checklists_updated_at
before update on public.impact_monitoring_checklists
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_monitoring_notes_updated_at on public.impact_monitoring_notes;
create trigger set_impact_monitoring_notes_updated_at
before update on public.impact_monitoring_notes
for each row execute function public.set_impact_intelligence_updated_at();
