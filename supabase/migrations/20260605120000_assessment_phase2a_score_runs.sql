-- Impact Intelligence Assessment Phase 2A: configurable scoring and score-run history.
-- Additive migration. Existing latest score rows remain usable by the current UI.

alter table public.impact_assessment_templates
  add column if not exists scoring_bands jsonb not null default '[
    {"label":"low","min":0,"max":49.9999},
    {"label":"moderate","min":50,"max":74.9999},
    {"label":"strong","min":75,"max":100}
  ]'::jsonb,
  add column if not exists scoring_model_version integer not null default 1;

create table if not exists public.impact_assessment_score_runs (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.impact_assessments(id) on delete cascade,
  template_id uuid references public.impact_assessment_templates(id) on delete set null,
  template_version integer,
  run_type text not null default 'calculation',
  score numeric(10,2) not null default 0,
  max_score numeric(10,2) not null default 0,
  weighted_score numeric(10,2) not null default 0,
  readiness_category text,
  calculated_by_user_id uuid references public.users(id) on delete set null,
  calculated_at timestamptz not null default now(),
  scoring_model_version integer not null default 1,
  scoring_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_assessment_score_runs_type_check check (run_type in ('calculation', 'submission', 'review', 'completion')),
  constraint impact_assessment_score_runs_readiness_check check (readiness_category is null or readiness_category in ('low', 'moderate', 'strong'))
);

alter table public.impact_assessment_scores
  add column if not exists score_run_id uuid references public.impact_assessment_score_runs(id) on delete cascade,
  add column if not exists is_latest boolean not null default true,
  add column if not exists scoring_model_version integer not null default 1;

create index if not exists idx_impact_assessment_score_runs_assessment_id
  on public.impact_assessment_score_runs(assessment_id);
create index if not exists idx_impact_assessment_score_runs_calculated_at
  on public.impact_assessment_score_runs(calculated_at desc);
create index if not exists idx_impact_assessment_scores_score_run_id
  on public.impact_assessment_scores(score_run_id);
create index if not exists idx_impact_assessment_scores_latest
  on public.impact_assessment_scores(assessment_id, is_latest);

create unique index if not exists idx_impact_assessment_scores_latest_section
  on public.impact_assessment_scores(assessment_id, coalesce(section_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_latest;
