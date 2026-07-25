-- LCDBO Programme Delivery Core Sprint 1.
-- Additive programme-planning and governance backbone for LCDBO workstreams,
-- milestones/deliverables, RAID items and decisions.

create table if not exists public.lcdbo_workstreams (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  reference text not null,
  name text not null,
  description text,
  accountable_owner_id uuid references public.users(id) on delete set null,
  delivery_lead_id uuid references public.users(id) on delete set null,
  accountable_institution_id uuid references public.institutions(id) on delete set null,
  supporting_institution_ids uuid[] not null default '{}'::uuid[],
  start_date date,
  target_date date,
  status text not null default 'not_started',
  progress_percentage integer not null default 0,
  health text not null default 'amber',
  priority text not null default 'medium',
  latest_update text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_workstreams_unique_reference unique (programme_id, reference),
  constraint lcdbo_workstreams_status_check check (status in ('not_started', 'planned', 'in_progress', 'at_risk', 'blocked', 'completed', 'paused', 'cancelled')),
  constraint lcdbo_workstreams_health_check check (health in ('green', 'amber', 'red', 'grey')),
  constraint lcdbo_workstreams_priority_check check (priority in ('low', 'medium', 'high', 'critical')),
  constraint lcdbo_workstreams_progress_check check (progress_percentage between 0 and 100),
  constraint lcdbo_workstreams_dates_check check (target_date is null or start_date is null or target_date >= start_date)
);

create table if not exists public.lcdbo_delivery_items (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  workstream_id uuid references public.lcdbo_workstreams(id) on delete set null,
  reference text not null,
  item_type text not null,
  title text not null,
  description text,
  owner_id uuid references public.users(id) on delete set null,
  supporting_institution_id uuid references public.institutions(id) on delete set null,
  state_id uuid references public.states(id) on delete set null,
  lga_id uuid references public.lgas(id) on delete set null,
  start_date date,
  due_date date,
  priority text not null default 'medium',
  status text not null default 'planned',
  progress_percentage integer not null default 0,
  evidence_requirement text,
  approval_required boolean not null default false,
  completed_at timestamptz,
  blocker_reason text,
  latest_update text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_delivery_items_unique_reference unique (programme_id, reference),
  constraint lcdbo_delivery_items_type_check check (item_type in ('milestone', 'deliverable')),
  constraint lcdbo_delivery_items_status_check check (status in ('not_started', 'planned', 'in_progress', 'at_risk', 'blocked', 'submitted', 'completed', 'cancelled')),
  constraint lcdbo_delivery_items_priority_check check (priority in ('low', 'medium', 'high', 'critical')),
  constraint lcdbo_delivery_items_progress_check check (progress_percentage between 0 and 100),
  constraint lcdbo_delivery_items_dates_check check (due_date is null or start_date is null or due_date >= start_date),
  constraint lcdbo_delivery_items_completed_check check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create table if not exists public.lcdbo_raid_items (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  workstream_id uuid references public.lcdbo_workstreams(id) on delete set null,
  delivery_item_id uuid references public.lcdbo_delivery_items(id) on delete set null,
  reference text not null,
  raid_type text not null,
  title text not null,
  description text not null,
  owner_id uuid references public.users(id) on delete set null,
  state_id uuid references public.states(id) on delete set null,
  lga_id uuid references public.lgas(id) on delete set null,
  probability text,
  impact text,
  severity text not null default 'medium',
  mitigation_plan text,
  target_resolution_date date,
  escalation_status text not null default 'none',
  status text not null default 'open',
  resolution_notes text,
  review_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_raid_items_unique_reference unique (programme_id, reference),
  constraint lcdbo_raid_items_type_check check (raid_type in ('risk', 'issue', 'assumption', 'dependency')),
  constraint lcdbo_raid_items_probability_check check (probability is null or probability in ('low', 'medium', 'high')),
  constraint lcdbo_raid_items_impact_check check (impact is null or impact in ('low', 'medium', 'high')),
  constraint lcdbo_raid_items_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint lcdbo_raid_items_escalation_check check (escalation_status in ('none', 'watch', 'escalated', 'leadership')),
  constraint lcdbo_raid_items_status_check check (status in ('open', 'monitoring', 'mitigating', 'blocked', 'resolved', 'closed', 'cancelled')),
  constraint lcdbo_raid_items_resolution_check check ((status in ('resolved', 'closed') and nullif(trim(coalesce(resolution_notes, '')), '') is not null) or status not in ('resolved', 'closed'))
);

create table if not exists public.lcdbo_decisions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  workstream_id uuid references public.lcdbo_workstreams(id) on delete set null,
  delivery_item_id uuid references public.lcdbo_delivery_items(id) on delete set null,
  reference text not null,
  decision_required text not null,
  context text,
  recommendation text,
  decision_owner_id uuid references public.users(id) on delete set null,
  due_date date,
  status text not null default 'draft',
  decision_outcome text,
  decision_date date,
  follow_up_action text,
  follow_up_owner_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_decisions_unique_reference unique (programme_id, reference),
  constraint lcdbo_decisions_status_check check (status in ('draft', 'pending', 'escalated', 'decided', 'deferred', 'cancelled')),
  constraint lcdbo_decisions_outcome_check check ((status = 'decided' and nullif(trim(coalesce(decision_outcome, '')), '') is not null and decision_date is not null) or status <> 'decided')
);

create index if not exists idx_lcdbo_workstreams_programme_status
  on public.lcdbo_workstreams(programme_id, status, health, priority);
create index if not exists idx_lcdbo_workstreams_owner
  on public.lcdbo_workstreams(accountable_owner_id, delivery_lead_id);
create index if not exists idx_lcdbo_delivery_items_programme_status_due
  on public.lcdbo_delivery_items(programme_id, status, due_date);
create index if not exists idx_lcdbo_delivery_items_workstream
  on public.lcdbo_delivery_items(workstream_id, status, due_date);
create index if not exists idx_lcdbo_delivery_items_owner
  on public.lcdbo_delivery_items(owner_id, status);
create index if not exists idx_lcdbo_raid_items_programme_status
  on public.lcdbo_raid_items(programme_id, raid_type, status, severity);
create index if not exists idx_lcdbo_raid_items_review
  on public.lcdbo_raid_items(programme_id, review_date, target_resolution_date);
create index if not exists idx_lcdbo_decisions_programme_status_due
  on public.lcdbo_decisions(programme_id, status, due_date);

drop trigger if exists set_lcdbo_workstreams_updated_at on public.lcdbo_workstreams;
create trigger set_lcdbo_workstreams_updated_at before update on public.lcdbo_workstreams
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_delivery_items_updated_at on public.lcdbo_delivery_items;
create trigger set_lcdbo_delivery_items_updated_at before update on public.lcdbo_delivery_items
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_raid_items_updated_at on public.lcdbo_raid_items;
create trigger set_lcdbo_raid_items_updated_at before update on public.lcdbo_raid_items
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_decisions_updated_at on public.lcdbo_decisions;
create trigger set_lcdbo_decisions_updated_at before update on public.lcdbo_decisions
  for each row execute function public.set_platform_foundation_updated_at();

alter table public.lcdbo_workstreams enable row level security;
alter table public.lcdbo_delivery_items enable row level security;
alter table public.lcdbo_raid_items enable row level security;
alter table public.lcdbo_decisions enable row level security;

create or replace function public.lcdbo_can_view_delivery_programme(target_programme_id uuid)
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
        u.role in ('admin', 'super_admin', 'programme_officer', 'assessment_officer', 'field_officer', 'data_analyst', 'auditor')
        or exists (
          select 1
          from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin', 'assessment_officer', 'field_officer', 'data_analyst', 'auditor')
            and (
              ra.scope_type = 'global'
              or (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
            )
        )
      )
  )
$$;

revoke all on function public.lcdbo_can_view_delivery_programme(uuid) from public;
grant execute on function public.lcdbo_can_view_delivery_programme(uuid) to authenticated;

drop policy if exists "LCDBO reviewers can read workstreams" on public.lcdbo_workstreams;
create policy "LCDBO reviewers can read workstreams" on public.lcdbo_workstreams
  for select using (public.lcdbo_can_view_delivery_programme(programme_id));
drop policy if exists "LCDBO reviewers can manage workstreams" on public.lcdbo_workstreams;
create policy "LCDBO reviewers can manage workstreams" on public.lcdbo_workstreams
  for all using (public.lcdbo_can_review_programme(programme_id))
  with check (public.lcdbo_can_review_programme(programme_id));

drop policy if exists "LCDBO reviewers can read delivery items" on public.lcdbo_delivery_items;
create policy "LCDBO reviewers can read delivery items" on public.lcdbo_delivery_items
  for select using (public.lcdbo_can_view_delivery_programme(programme_id));
drop policy if exists "LCDBO reviewers can manage delivery items" on public.lcdbo_delivery_items;
create policy "LCDBO reviewers can manage delivery items" on public.lcdbo_delivery_items
  for all using (public.lcdbo_can_review_programme(programme_id))
  with check (public.lcdbo_can_review_programme(programme_id));

drop policy if exists "LCDBO reviewers can read RAID items" on public.lcdbo_raid_items;
create policy "LCDBO reviewers can read RAID items" on public.lcdbo_raid_items
  for select using (public.lcdbo_can_view_delivery_programme(programme_id));
drop policy if exists "LCDBO reviewers can manage RAID items" on public.lcdbo_raid_items;
create policy "LCDBO reviewers can manage RAID items" on public.lcdbo_raid_items
  for all using (public.lcdbo_can_review_programme(programme_id))
  with check (public.lcdbo_can_review_programme(programme_id));

drop policy if exists "LCDBO reviewers can read decisions" on public.lcdbo_decisions;
create policy "LCDBO reviewers can read decisions" on public.lcdbo_decisions
  for select using (public.lcdbo_can_view_delivery_programme(programme_id));
drop policy if exists "LCDBO reviewers can manage decisions" on public.lcdbo_decisions;
create policy "LCDBO reviewers can manage decisions" on public.lcdbo_decisions
  for all using (public.lcdbo_can_review_programme(programme_id))
  with check (public.lcdbo_can_review_programme(programme_id));

with lcdb_o as (
  select id, start_date from public.programmes where slug = 'local-content-development-beyond-oil' limit 1
)
insert into public.lcdbo_workstreams (
  programme_id, reference, name, description, status, health, priority,
  start_date, target_date, progress_percentage, latest_update, metadata
)
select
  lcdb_o.id,
  seed.reference,
  seed.name,
  seed.description,
  'planned',
  'amber',
  seed.priority,
  coalesce(lcdb_o.start_date, date '2026-01-01'),
  seed.target_date,
  seed.progress,
  'Initial governed workstream configured for Sprint 1 programme planning.',
  jsonb_build_object('source', 'lcdbo_delivery_core_sprint1', 'record_classification', 'configured_target')
from lcdb_o
cross join (values
  ('LCDBO-WS-001', 'Governance and institutional coordination', 'Programme governance cadence, accountable forums, secretariat coordination and institutional alignment.', 'critical', date '2026-03-31', 10),
  ('LCDBO-WS-002', 'MSME mobilisation and onboarding', 'MSME registration, eligibility review, enrolment governance and onboarding operations.', 'high', date '2026-04-30', 15),
  ('LCDBO-WS-003', 'Industrial cluster development', 'Cluster readiness, facility planning, participation placement and operational coordination.', 'critical', date '2026-06-30', 10),
  ('LCDBO-WS-004', 'Business diagnostics and readiness', 'Diagnostic assessment, readiness scoring, evidence requests and support prioritisation.', 'high', date '2026-05-31', 10),
  ('LCDBO-WS-005', 'Infrastructure and equipment', 'Shared infrastructure, equipment needs and production-support coordination.', 'high', date '2026-09-30', 5),
  ('LCDBO-WS-006', 'Skills and technical assistance', 'Training pathways, technical assistance planning and capability support.', 'medium', date '2026-08-31', 5),
  ('LCDBO-WS-007', 'Funding and investment readiness', 'Finance-readiness pathways, investable pipeline preparation and DFI coordination.', 'high', date '2026-09-30', 5),
  ('LCDBO-WS-008', 'Market access and exports', 'Market-linkage planning, export readiness and offtake pathway coordination.', 'medium', date '2026-10-31', 5),
  ('LCDBO-WS-009', 'Data, MEL and programme intelligence', 'KPI governance, reporting snapshots, data quality and programme intelligence cadence.', 'critical', date '2026-04-30', 20),
  ('LCDBO-WS-010', 'Communications and stakeholder engagement', 'Stakeholder briefings, communications cadence and engagement governance.', 'medium', date '2026-05-31', 10)
) as seed(reference, name, description, priority, target_date, progress)
on conflict (programme_id, reference) do update set
  name = excluded.name,
  description = excluded.description,
  priority = excluded.priority,
  target_date = excluded.target_date,
  metadata = public.lcdbo_workstreams.metadata || excluded.metadata,
  updated_at = now();
