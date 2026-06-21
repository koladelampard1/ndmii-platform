-- LCDBO Sprint C: governed KPI registry and scheduled reporting snapshots.

create table if not exists public.lcdbo_kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null,
  category text not null,
  calculation_method text not null,
  unit text not null,
  owner text not null,
  reporting_frequency text not null default 'monthly',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_kpi_definitions_unique_code unique (programme_id, code),
  constraint lcdbo_kpi_definitions_frequency_check check (reporting_frequency in ('daily', 'weekly', 'monthly', 'quarterly')),
  constraint lcdbo_kpi_definitions_code_check check (code ~ '^[a-z0-9_]+$')
);

create table if not exists public.lcdbo_kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  kpi_definition_id uuid not null references public.lcdbo_kpi_definitions(id) on delete cascade,
  snapshot_date date not null,
  frequency text not null,
  value numeric(20,4) not null,
  dimensions jsonb not null default '{}'::jsonb,
  generated_by uuid references public.users(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_kpi_snapshots_frequency_check check (frequency in ('daily', 'weekly', 'monthly', 'quarterly')),
  constraint lcdbo_kpi_snapshots_unique unique (kpi_definition_id, snapshot_date, frequency)
);

create table if not exists public.lcdbo_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  snapshot_date date not null,
  report_type text not null,
  frequency text not null,
  metrics_payload jsonb not null default '{}'::jsonb,
  generated_by uuid references public.users(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_report_snapshots_frequency_check check (frequency in ('daily', 'weekly', 'monthly', 'quarterly')),
  constraint lcdbo_report_snapshots_type_check check (report_type in ('national', 'state', 'cluster', 'partner', 'readiness', 'participation', 'data_quality', 'programme_health', 'executive_briefing')),
  constraint lcdbo_report_snapshots_unique unique (programme_id, snapshot_date, report_type, frequency)
);

create index if not exists idx_lcdbo_kpi_snapshots_programme_date on public.lcdbo_kpi_snapshots(programme_id, snapshot_date desc);
create index if not exists idx_lcdbo_report_snapshots_programme_type_date on public.lcdbo_report_snapshots(programme_id, report_type, snapshot_date desc);

drop trigger if exists set_lcdbo_kpi_definitions_updated_at on public.lcdbo_kpi_definitions;
create trigger set_lcdbo_kpi_definitions_updated_at before update on public.lcdbo_kpi_definitions for each row execute function public.set_platform_foundation_updated_at();

create or replace function public.lcdbo_can_view_intelligence(target_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and (
        u.role in ('admin', 'super_admin', 'programme_officer', 'boi_executive', 'auditor', 'data_analyst')
        or exists (
          select 1 from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin', 'executive', 'observer', 'auditor', 'data_analyst')
            and (ra.scope_type = 'global' or (ra.scope_type = 'programme' and ra.scope_id = target_programme_id))
        )
      )
  )
$$;

revoke all on function public.lcdbo_can_view_intelligence(uuid) from public;
grant execute on function public.lcdbo_can_view_intelligence(uuid) to authenticated;

alter table public.lcdbo_kpi_definitions enable row level security;
alter table public.lcdbo_kpi_snapshots enable row level security;
alter table public.lcdbo_report_snapshots enable row level security;

drop policy if exists "LCDBO intelligence viewers can read KPI definitions" on public.lcdbo_kpi_definitions;
create policy "LCDBO intelligence viewers can read KPI definitions" on public.lcdbo_kpi_definitions for select using (public.lcdbo_can_view_intelligence(programme_id));
drop policy if exists "LCDBO reviewers can manage KPI definitions" on public.lcdbo_kpi_definitions;
create policy "LCDBO reviewers can manage KPI definitions" on public.lcdbo_kpi_definitions for all using (public.lcdbo_can_review_programme(programme_id)) with check (public.lcdbo_can_review_programme(programme_id));

drop policy if exists "LCDBO intelligence viewers can read KPI snapshots" on public.lcdbo_kpi_snapshots;
create policy "LCDBO intelligence viewers can read KPI snapshots" on public.lcdbo_kpi_snapshots for select using (public.lcdbo_can_view_intelligence(programme_id));
drop policy if exists "LCDBO reviewers can manage KPI snapshots" on public.lcdbo_kpi_snapshots;
create policy "LCDBO reviewers can manage KPI snapshots" on public.lcdbo_kpi_snapshots for all using (public.lcdbo_can_review_programme(programme_id)) with check (public.lcdbo_can_review_programme(programme_id));

drop policy if exists "LCDBO intelligence viewers can read report snapshots" on public.lcdbo_report_snapshots;
create policy "LCDBO intelligence viewers can read report snapshots" on public.lcdbo_report_snapshots for select using (public.lcdbo_can_view_intelligence(programme_id));
drop policy if exists "LCDBO reviewers can manage report snapshots" on public.lcdbo_report_snapshots;
create policy "LCDBO reviewers can manage report snapshots" on public.lcdbo_report_snapshots for all using (public.lcdbo_can_review_programme(programme_id)) with check (public.lcdbo_can_review_programme(programme_id));

with lcdbo as (
  select id from public.programmes where slug = 'local-content-development-beyond-oil' limit 1
)
insert into public.lcdbo_kpi_definitions (programme_id, code, name, description, category, calculation_method, unit, owner, reporting_frequency, metadata)
select lcdbo.id, definition.code, definition.name, definition.description, definition.category, definition.calculation_method, definition.unit, definition.owner, definition.frequency, '{"source":"lcdbo_governance_sprint_c"}'::jsonb
from lcdbo
cross join (values
  ('total_msmes', 'Total MSMEs', 'MSMEs enrolled in LCDBO.', 'participation', 'Count distinct MSMEs with LCDBO programme enrolments.', 'MSMEs', 'LCDBO Programme Office', 'daily'),
  ('active_participants', 'Active Participants', 'MSMEs actively participating in clusters.', 'participation', 'Count cluster memberships with active or placed status.', 'MSMEs', 'Cluster Operations', 'weekly'),
  ('cluster_interests', 'Cluster Interests', 'MSME expressions of interest across LCDBO clusters.', 'participation', 'Count LCDBO cluster membership records.', 'requests', 'Cluster Operations', 'weekly'),
  ('active_clusters', 'Active Clusters', 'LCDBO clusters currently active.', 'clusters', 'Count industrial clusters with active status.', 'clusters', 'LCDBO Programme Office', 'monthly'),
  ('readiness_completed', 'Readiness Completed', 'Latest completed MSME readiness assessments.', 'readiness', 'Count latest readiness assessments per cluster member.', 'assessments', 'Assessment Lead', 'weekly'),
  ('ready_for_investment', 'Ready For Investment', 'MSMEs assessed as ready for investment.', 'readiness', 'Count latest readiness assessments classified ready_for_investment.', 'MSMEs', 'Assessment Lead', 'monthly'),
  ('ready_for_export', 'Ready For Export', 'MSMEs assessed as ready for export.', 'readiness', 'Count latest readiness assessments classified ready_for_export.', 'MSMEs', 'Market Access Lead', 'monthly'),
  ('documents_reviewed', 'Documents Reviewed', 'Participation document requests with completed review decisions.', 'documents', 'Count document requests accepted, rejected, or waived.', 'documents', 'Cluster Operations', 'weekly'),
  ('states_covered', 'States Covered', 'Distinct states represented by LCDBO MSMEs.', 'geography', 'Count distinct non-empty MSME states.', 'states', 'Monitoring and Evaluation', 'monthly'),
  ('lgas_covered', 'LGAs Covered', 'Distinct LGAs represented by LCDBO MSMEs.', 'geography', 'Count distinct non-empty MSME LGAs.', 'LGAs', 'Monitoring and Evaluation', 'monthly'),
  ('officers_assigned', 'Officers Assigned', 'Distinct officers assigned to cluster participants.', 'operations', 'Count distinct assigned officer IDs.', 'officers', 'Programme Secretariat', 'weekly')
) as definition(code, name, description, category, calculation_method, unit, owner, frequency)
on conflict (programme_id, code) do update set
  name = excluded.name, description = excluded.description, category = excluded.category,
  calculation_method = excluded.calculation_method, unit = excluded.unit, owner = excluded.owner,
  reporting_frequency = excluded.reporting_frequency, active = true,
  metadata = public.lcdbo_kpi_definitions.metadata || excluded.metadata,
  updated_at = now();
