-- DBIN Impact Dashboards & Reporting Engine foundation
-- Additive, idempotent reporting schema for executive metrics, report
-- versioning, dashboard snapshots, and export audit tracking.

create extension if not exists "pgcrypto";

alter table public.impact_reports
  add column if not exists assessment_id uuid references public.impact_assessments(id) on delete set null,
  add column if not exists field_visit_id uuid references public.impact_field_visits(id) on delete set null,
  add column if not exists approved_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists generated_at timestamptz,
  add column if not exists evidence_references jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'impact_reports_type_check'
      and conrelid = 'public.impact_reports'::regclass
  ) then
    alter table public.impact_reports drop constraint impact_reports_type_check;
  end if;

  alter table public.impact_reports
    add constraint impact_reports_type_check
    check (report_type in (
      'executive_summary',
      'programme_performance',
      'assessment_summary',
      'monitoring_report',
      'intervention_report',
      'impact_intelligence',
      'programme_summary',
      'field_monitoring',
      'evidence_pack',
      'impact_report'
    ));

  if exists (
    select 1 from pg_constraint
    where conname = 'impact_reports_status_check'
      and conrelid = 'public.impact_reports'::regclass
  ) then
    alter table public.impact_reports drop constraint impact_reports_status_check;
  end if;

  alter table public.impact_reports
    add constraint impact_reports_status_check
    check (status in ('draft', 'generated', 'approved', 'archived', 'in_review', 'published'));
end $$;

create table if not exists public.impact_report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.impact_reports(id) on delete cascade,
  version_number integer not null default 1,
  title text not null,
  summary text,
  report_json jsonb not null default '{}'::jsonb,
  evidence_references jsonb not null default '[]'::jsonb,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_report_versions_version_check check (version_number > 0)
);

create table if not exists public.impact_dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_type text not null default 'executive',
  programme_id uuid references public.impact_programmes(id) on delete set null,
  generated_by_user_id uuid references public.users(id) on delete set null,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_dashboard_snapshots_type_check check (snapshot_type in ('executive', 'programme', 'assessment', 'monitoring'))
);

create table if not exists public.impact_kpi_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  metric_label text not null,
  metric_value numeric(18,4) not null default 0,
  metric_unit text,
  programme_id uuid references public.impact_programmes(id) on delete set null,
  period_start date,
  period_end date,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.impact_report_exports (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.impact_reports(id) on delete cascade,
  export_format text not null default 'pdf',
  export_status text not null default 'queued',
  export_url text,
  requested_by_user_id uuid references public.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_report_exports_format_check check (export_format in ('pdf', 'csv', 'xlsx', 'json')),
  constraint impact_report_exports_status_check check (export_status in ('queued', 'generated', 'failed'))
);

create index if not exists idx_impact_reports_assessment_id on public.impact_reports(assessment_id);
create index if not exists idx_impact_reports_field_visit_id on public.impact_reports(field_visit_id);
create index if not exists idx_impact_report_versions_report_id on public.impact_report_versions(report_id);
create unique index if not exists idx_impact_report_versions_report_version on public.impact_report_versions(report_id, version_number);
create index if not exists idx_impact_dashboard_snapshots_type on public.impact_dashboard_snapshots(snapshot_type);
create index if not exists idx_impact_dashboard_snapshots_programme_id on public.impact_dashboard_snapshots(programme_id);
create index if not exists idx_impact_kpi_metrics_key on public.impact_kpi_metrics(metric_key);
create index if not exists idx_impact_kpi_metrics_programme_id on public.impact_kpi_metrics(programme_id);
create index if not exists idx_impact_report_exports_report_id on public.impact_report_exports(report_id);
create index if not exists idx_impact_report_exports_status on public.impact_report_exports(export_status);
