-- DBIN Assessment Engine foundation
-- Additive, idempotent schema for BOI MSME templates, responses, reviews, and scoring.

create extension if not exists "pgcrypto";

create table if not exists public.impact_assessment_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  assessment_type text not null default 'readiness',
  version integer not null default 1,
  status text not null default 'draft',
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_assessment_templates_version_check check (version > 0),
  constraint impact_assessment_templates_status_check check (status in ('draft', 'active', 'archived'))
);

create table if not exists public.impact_assessment_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.impact_assessment_templates(id) on delete cascade,
  title text not null,
  description text,
  display_order integer not null default 0,
  weight numeric(8,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.impact_assessment_questions
  add column if not exists template_id uuid references public.impact_assessment_templates(id) on delete cascade,
  add column if not exists section_id uuid references public.impact_assessment_sections(id) on delete cascade,
  add column if not exists help_text text,
  add column if not exists weight numeric(8,2) not null default 0,
  add column if not exists scoring_config jsonb not null default '{}'::jsonb,
  add column if not exists conditional_logic jsonb not null default '{}'::jsonb;

alter table public.impact_assessments
  add column if not exists template_id uuid references public.impact_assessment_templates(id) on delete set null,
  add column if not exists template_version integer,
  add column if not exists assigned_to_user_id uuid references public.users(id) on delete set null,
  add column if not exists completed_at timestamptz;

alter table public.impact_assessment_responses
  add column if not exists score numeric(10,2),
  add column if not exists max_score numeric(10,2),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.impact_assessment_reviews (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.impact_assessments(id) on delete cascade,
  reviewer_user_id uuid references public.users(id) on delete set null,
  review_status text not null default 'reviewed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_assessment_reviews_status_check check (review_status in ('reviewed', 'approved', 'returned'))
);

create table if not exists public.impact_assessment_scores (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.impact_assessments(id) on delete cascade,
  section_id uuid references public.impact_assessment_sections(id) on delete set null,
  section_title text,
  score numeric(10,2) not null default 0,
  max_score numeric(10,2) not null default 0,
  weighted_score numeric(10,2) not null default 0,
  readiness_category text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_assessment_scores_readiness_check check (readiness_category is null or readiness_category in ('low', 'moderate', 'strong'))
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'impact_assessments_status_check'
      and conrelid = 'public.impact_assessments'::regclass
  ) then
    alter table public.impact_assessments drop constraint impact_assessments_status_check;
  end if;

  alter table public.impact_assessments
    add constraint impact_assessments_status_check
    check (status in ('draft', 'scheduled', 'in_progress', 'submitted', 'completed', 'reviewed', 'approved', 'archived'));

  if exists (
    select 1 from pg_constraint
    where conname = 'impact_assessment_questions_type_check'
      and conrelid = 'public.impact_assessment_questions'::regclass
  ) then
    alter table public.impact_assessment_questions drop constraint impact_assessment_questions_type_check;
  end if;

  alter table public.impact_assessment_questions
    add constraint impact_assessment_questions_type_check
    check (question_type in ('text', 'textarea', 'number', 'select', 'multi-select', 'boolean', 'date', 'file_upload', 'single_choice', 'multi_choice', 'file'));
end $$;

create unique index if not exists idx_impact_assessment_templates_name_version
  on public.impact_assessment_templates(lower(name), version);
create index if not exists idx_impact_assessment_templates_status on public.impact_assessment_templates(status);
create index if not exists idx_impact_assessment_sections_template_id on public.impact_assessment_sections(template_id);
create index if not exists idx_impact_assessment_questions_template_id on public.impact_assessment_questions(template_id);
create index if not exists idx_impact_assessment_questions_section_id on public.impact_assessment_questions(section_id);
create index if not exists idx_impact_assessments_template_id on public.impact_assessments(template_id);
create index if not exists idx_impact_assessment_reviews_assessment_id on public.impact_assessment_reviews(assessment_id);
create index if not exists idx_impact_assessment_scores_assessment_id on public.impact_assessment_scores(assessment_id);
create index if not exists idx_impact_assessment_scores_section_id on public.impact_assessment_scores(section_id);
create unique index if not exists idx_impact_assessment_responses_assessment_question
  on public.impact_assessment_responses(assessment_id, question_id)
  where question_id is not null;

drop trigger if exists set_impact_assessment_templates_updated_at on public.impact_assessment_templates;
create trigger set_impact_assessment_templates_updated_at
before update on public.impact_assessment_templates
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_assessment_sections_updated_at on public.impact_assessment_sections;
create trigger set_impact_assessment_sections_updated_at
before update on public.impact_assessment_sections
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_assessment_reviews_updated_at on public.impact_assessment_reviews;
create trigger set_impact_assessment_reviews_updated_at
before update on public.impact_assessment_reviews
for each row execute function public.set_impact_intelligence_updated_at();
