-- BOI Impact Intelligence foundation
-- Additive, idempotent tables for programme intelligence, assessments,
-- field monitoring, evidence, indicators, and reports.

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
        'auditor',
        'fccpc_officer',
        'firs_officer',
        'nrs_officer',
        'admin'
      )
    );
end $$;

create table if not exists public.impact_programmes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  programme_code text,
  sponsor_name text,
  description text,
  status text not null default 'draft',
  start_date date,
  end_date date,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_programmes_status_check check (status in ('draft', 'active', 'paused', 'completed', 'archived'))
);

create table if not exists public.impact_interventions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references public.impact_programmes(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete cascade,
  intervention_type text not null default 'support',
  title text not null,
  description text,
  status text not null default 'planned',
  approved_amount numeric(14,2),
  disbursed_amount numeric(14,2),
  start_date date,
  end_date date,
  assigned_to_user_id uuid references public.users(id) on delete set null,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_interventions_status_check check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled'))
);

create table if not exists public.impact_programme_msmes (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.impact_programmes(id) on delete cascade,
  msme_id uuid not null references public.msmes(id) on delete cascade,
  enrollment_status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  exited_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_programme_msmes_unique unique (programme_id, msme_id),
  constraint impact_programme_msmes_status_check check (enrollment_status in ('active', 'paused', 'completed', 'withdrawn'))
);

create table if not exists public.impact_intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.impact_interventions(id) on delete cascade,
  programme_id uuid references public.impact_programmes(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete set null,
  event_type text not null default 'note',
  from_status text,
  to_status text,
  from_stage text,
  to_stage text,
  title text not null,
  note text,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_intervention_events_type_check check (event_type in ('created', 'status_changed', 'stage_changed', 'note', 'documented', 'reviewed'))
);

create table if not exists public.impact_assessments (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references public.impact_programmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete cascade,
  assessment_type text not null default 'baseline',
  title text,
  status text not null default 'draft',
  score numeric(8,2),
  risk_level text,
  conducted_by_user_id uuid references public.users(id) on delete set null,
  conducted_at timestamptz,
  reviewed_by_user_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_assessments_type_check check (assessment_type in ('baseline', 'eligibility', 'monitoring', 'completion', 'impact')),
  constraint impact_assessments_status_check check (status in ('draft', 'scheduled', 'in_progress', 'submitted', 'reviewed', 'approved', 'archived'))
);

create table if not exists public.impact_assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.impact_assessments(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'text',
  category text,
  display_order integer not null default 0,
  is_required boolean not null default false,
  options_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint impact_assessment_questions_type_check check (question_type in ('text', 'number', 'boolean', 'single_choice', 'multi_choice', 'date', 'file'))
);

create table if not exists public.impact_assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.impact_assessments(id) on delete cascade,
  question_id uuid references public.impact_assessment_questions(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete cascade,
  response_text text,
  response_number numeric(14,2),
  response_boolean boolean,
  response_json jsonb not null default '{}'::jsonb,
  responded_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.impact_field_visits (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references public.impact_programmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  assessment_id uuid references public.impact_assessments(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete cascade,
  visit_date date,
  location_text text,
  status text not null default 'scheduled',
  findings text,
  recommendations text,
  assigned_to_user_id uuid references public.users(id) on delete set null,
  completed_by_user_id uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_field_visits_status_check check (status in ('scheduled', 'in_progress', 'completed', 'cancelled', 'requires_follow_up'))
);

create table if not exists public.impact_evidence_files (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references public.impact_programmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  assessment_id uuid references public.impact_assessments(id) on delete set null,
  field_visit_id uuid references public.impact_field_visits(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete cascade,
  file_name text not null,
  file_url text,
  file_type text,
  evidence_type text not null default 'document',
  description text,
  uploaded_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_evidence_files_type_check check (evidence_type in ('document', 'photo', 'video', 'receipt', 'field_note', 'other'))
);

create table if not exists public.impact_indicators (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references public.impact_programmes(id) on delete cascade,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete cascade,
  name text not null,
  description text,
  unit text,
  baseline_value numeric(14,2),
  target_value numeric(14,2),
  current_value numeric(14,2),
  measurement_frequency text,
  status text not null default 'active',
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_indicators_status_check check (status in ('active', 'paused', 'retired'))
);

create table if not exists public.impact_reports (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references public.impact_programmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete set null,
  title text not null,
  report_type text not null default 'programme_summary',
  status text not null default 'draft',
  summary text,
  generated_by_user_id uuid references public.users(id) on delete set null,
  reviewed_by_user_id uuid references public.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_reports_type_check check (report_type in ('programme_summary', 'assessment_summary', 'field_monitoring', 'evidence_pack', 'impact_report')),
  constraint impact_reports_status_check check (status in ('draft', 'in_review', 'approved', 'published', 'archived'))
);

create index if not exists idx_impact_programmes_status on public.impact_programmes(status);
create index if not exists idx_impact_programmes_code on public.impact_programmes(programme_code);
create index if not exists idx_impact_interventions_programme_id on public.impact_interventions(programme_id);
create index if not exists idx_impact_interventions_msme_id on public.impact_interventions(msme_id);
create index if not exists idx_impact_interventions_status on public.impact_interventions(status);
create index if not exists idx_impact_programme_msmes_programme_id on public.impact_programme_msmes(programme_id);
create index if not exists idx_impact_programme_msmes_msme_id on public.impact_programme_msmes(msme_id);
create index if not exists idx_impact_programme_msmes_status on public.impact_programme_msmes(enrollment_status);
create index if not exists idx_impact_intervention_events_intervention_id on public.impact_intervention_events(intervention_id);
create index if not exists idx_impact_intervention_events_programme_id on public.impact_intervention_events(programme_id);
create index if not exists idx_impact_intervention_events_msme_id on public.impact_intervention_events(msme_id);
create index if not exists idx_impact_intervention_events_created_at on public.impact_intervention_events(created_at);
create index if not exists idx_impact_assessments_programme_id on public.impact_assessments(programme_id);
create index if not exists idx_impact_assessments_intervention_id on public.impact_assessments(intervention_id);
create index if not exists idx_impact_assessments_msme_id on public.impact_assessments(msme_id);
create index if not exists idx_impact_assessments_status on public.impact_assessments(status);
create index if not exists idx_impact_assessment_questions_assessment_id on public.impact_assessment_questions(assessment_id);
create index if not exists idx_impact_assessment_responses_assessment_id on public.impact_assessment_responses(assessment_id);
create index if not exists idx_impact_assessment_responses_question_id on public.impact_assessment_responses(question_id);
create index if not exists idx_impact_assessment_responses_msme_id on public.impact_assessment_responses(msme_id);
create index if not exists idx_impact_field_visits_programme_id on public.impact_field_visits(programme_id);
create index if not exists idx_impact_field_visits_intervention_id on public.impact_field_visits(intervention_id);
create index if not exists idx_impact_field_visits_msme_id on public.impact_field_visits(msme_id);
create index if not exists idx_impact_field_visits_status on public.impact_field_visits(status);
create index if not exists idx_impact_field_visits_visit_date on public.impact_field_visits(visit_date);
create index if not exists idx_impact_evidence_files_programme_id on public.impact_evidence_files(programme_id);
create index if not exists idx_impact_evidence_files_intervention_id on public.impact_evidence_files(intervention_id);
create index if not exists idx_impact_evidence_files_assessment_id on public.impact_evidence_files(assessment_id);
create index if not exists idx_impact_evidence_files_field_visit_id on public.impact_evidence_files(field_visit_id);
create index if not exists idx_impact_evidence_files_msme_id on public.impact_evidence_files(msme_id);
create index if not exists idx_impact_indicators_programme_id on public.impact_indicators(programme_id);
create index if not exists idx_impact_indicators_intervention_id on public.impact_indicators(intervention_id);
create index if not exists idx_impact_indicators_msme_id on public.impact_indicators(msme_id);
create index if not exists idx_impact_reports_programme_id on public.impact_reports(programme_id);
create index if not exists idx_impact_reports_intervention_id on public.impact_reports(intervention_id);
create index if not exists idx_impact_reports_msme_id on public.impact_reports(msme_id);
create index if not exists idx_impact_reports_status on public.impact_reports(status);

create or replace function public.set_impact_intelligence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_impact_programmes_updated_at on public.impact_programmes;
create trigger set_impact_programmes_updated_at
before update on public.impact_programmes
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_interventions_updated_at on public.impact_interventions;
create trigger set_impact_interventions_updated_at
before update on public.impact_interventions
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_programme_msmes_updated_at on public.impact_programme_msmes;
create trigger set_impact_programme_msmes_updated_at
before update on public.impact_programme_msmes
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_assessments_updated_at on public.impact_assessments;
create trigger set_impact_assessments_updated_at
before update on public.impact_assessments
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_assessment_questions_updated_at on public.impact_assessment_questions;
create trigger set_impact_assessment_questions_updated_at
before update on public.impact_assessment_questions
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_assessment_responses_updated_at on public.impact_assessment_responses;
create trigger set_impact_assessment_responses_updated_at
before update on public.impact_assessment_responses
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_field_visits_updated_at on public.impact_field_visits;
create trigger set_impact_field_visits_updated_at
before update on public.impact_field_visits
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_evidence_files_updated_at on public.impact_evidence_files;
create trigger set_impact_evidence_files_updated_at
before update on public.impact_evidence_files
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_indicators_updated_at on public.impact_indicators;
create trigger set_impact_indicators_updated_at
before update on public.impact_indicators
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_reports_updated_at on public.impact_reports;
create trigger set_impact_reports_updated_at
before update on public.impact_reports
for each row execute function public.set_impact_intelligence_updated_at();
