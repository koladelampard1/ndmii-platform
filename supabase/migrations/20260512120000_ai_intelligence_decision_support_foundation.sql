-- DBIN AI Intelligence & Decision Support foundation
-- Deterministic-first operational intelligence records for BOI decision support.

create extension if not exists "pgcrypto";

create table if not exists public.impact_ai_insights (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  category text not null default 'operational',
  insight_type text not null default 'deterministic',
  priority text not null default 'medium',
  status text not null default 'open',
  title text not null,
  summary text not null,
  programme_id uuid references public.impact_programmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  assessment_id uuid references public.impact_assessments(id) on delete set null,
  report_id uuid references public.impact_reports(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete set null,
  generated_by text not null default 'deterministic_engine',
  generated_at timestamptz not null default now(),
  dismissed_by_user_id uuid references public.users(id) on delete set null,
  dismissed_at timestamptz,
  resolved_by_user_id uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_ai_insights_priority_check check (priority in ('low', 'medium', 'high', 'critical')),
  constraint impact_ai_insights_status_check check (status in ('open', 'dismissed', 'resolved', 'archived')),
  constraint impact_ai_insights_category_check check (category in ('risk', 'recommendation', 'anomaly', 'monitoring', 'intervention', 'compliance', 'readiness', 'portfolio', 'operational'))
);

create table if not exists public.impact_ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid references public.impact_ai_insights(id) on delete cascade,
  source_key text not null,
  recommendation_type text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  title text not null,
  recommendation text not null,
  programme_id uuid references public.impact_programmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  assessment_id uuid references public.impact_assessments(id) on delete set null,
  report_id uuid references public.impact_reports(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_ai_recommendations_priority_check check (priority in ('low', 'medium', 'high', 'critical')),
  constraint impact_ai_recommendations_status_check check (status in ('open', 'accepted', 'dismissed', 'resolved', 'archived'))
);

create table if not exists public.impact_risk_flags (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  risk_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  title text not null,
  description text not null,
  programme_id uuid references public.impact_programmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  assessment_id uuid references public.impact_assessments(id) on delete set null,
  report_id uuid references public.impact_reports(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete set null,
  detected_at timestamptz not null default now(),
  resolved_by_user_id uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_risk_flags_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint impact_risk_flags_status_check check (status in ('open', 'resolved', 'dismissed', 'archived'))
);

create table if not exists public.impact_anomaly_events (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  anomaly_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  title text not null,
  description text not null,
  programme_id uuid references public.impact_programmes(id) on delete set null,
  intervention_id uuid references public.impact_interventions(id) on delete set null,
  assessment_id uuid references public.impact_assessments(id) on delete set null,
  report_id uuid references public.impact_reports(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete set null,
  detected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_anomaly_events_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint impact_anomaly_events_status_check check (status in ('open', 'reviewed', 'dismissed', 'resolved', 'archived'))
);

create table if not exists public.impact_intelligence_summaries (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  summary_type text not null default 'programme_health',
  status text not null default 'current',
  title text not null,
  summary text not null,
  programme_id uuid references public.impact_programmes(id) on delete set null,
  report_id uuid references public.impact_reports(id) on delete set null,
  generated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_intelligence_summaries_status_check check (status in ('current', 'archived'))
);

create unique index if not exists idx_impact_ai_insights_source_key on public.impact_ai_insights(source_key);
create unique index if not exists idx_impact_ai_recommendations_source_key on public.impact_ai_recommendations(source_key);
create unique index if not exists idx_impact_risk_flags_source_key on public.impact_risk_flags(source_key);
create unique index if not exists idx_impact_anomaly_events_source_key on public.impact_anomaly_events(source_key);
create unique index if not exists idx_impact_intelligence_summaries_source_key on public.impact_intelligence_summaries(source_key);

create index if not exists idx_impact_ai_insights_programme_id on public.impact_ai_insights(programme_id);
create index if not exists idx_impact_ai_insights_msme_id on public.impact_ai_insights(msme_id);
create index if not exists idx_impact_ai_insights_status on public.impact_ai_insights(status);
create index if not exists idx_impact_ai_recommendations_status on public.impact_ai_recommendations(status);
create index if not exists idx_impact_risk_flags_status on public.impact_risk_flags(status);
create index if not exists idx_impact_risk_flags_msme_id on public.impact_risk_flags(msme_id);
create index if not exists idx_impact_anomaly_events_status on public.impact_anomaly_events(status);
create index if not exists idx_impact_intelligence_summaries_programme_id on public.impact_intelligence_summaries(programme_id);

drop trigger if exists set_impact_ai_recommendations_updated_at on public.impact_ai_recommendations;
create trigger set_impact_ai_recommendations_updated_at
before update on public.impact_ai_recommendations
for each row execute function public.set_impact_intelligence_updated_at();
