-- LCDBO Programme Delivery Core Sprint 2.
-- Additive state, LGA and cluster delivery planning, local activities,
-- append-only progress updates and geographic scope links for Sprint 1 records.

create table if not exists public.lcdbo_state_delivery_plans (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  state_id uuid not null references public.states(id) on delete restrict,
  plan_reference text not null,
  title text not null,
  implementation_phase text not null default 'baseline',
  activation_status text not null default 'planned',
  approval_status text not null default 'draft',
  state_coordinator_id uuid references public.users(id) on delete set null,
  accountable_institution_id uuid references public.institutions(id) on delete set null,
  participating_institution_ids uuid[] not null default '{}'::uuid[],
  priority_sectors text[] not null default '{}'::text[],
  priority_value_chains text[] not null default '{}'::text[],
  target_lga_ids uuid[] not null default '{}'::uuid[],
  target_cluster_ids uuid[] not null default '{}'::uuid[],
  msme_mobilisation_target integer,
  enrolment_target integer,
  cluster_placement_target integer,
  infrastructure_priorities text,
  start_date date,
  target_completion_date date,
  delivery_status text not null default 'planned',
  delivery_health text not null default 'grey',
  progress_percentage integer not null default 0,
  reporting_completeness integer not null default 0,
  latest_update text,
  metadata jsonb not null default '{}'::jsonb,
  submitted_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_state_delivery_plans_unique_state unique (programme_id, state_id),
  constraint lcdbo_state_delivery_plans_unique_reference unique (programme_id, plan_reference),
  constraint lcdbo_state_delivery_plans_activation_check check (activation_status in ('reference', 'planned', 'proposed', 'approved', 'mobilising', 'active', 'paused', 'completed', 'cancelled')),
  constraint lcdbo_state_delivery_plans_approval_check check (approval_status in ('draft', 'submitted', 'under_review', 'approved', 'changes_requested', 'rejected')),
  constraint lcdbo_state_delivery_plans_status_check check (delivery_status in ('not_started', 'planned', 'in_progress', 'at_risk', 'blocked', 'completed', 'paused', 'cancelled')),
  constraint lcdbo_state_delivery_plans_health_check check (delivery_health in ('green', 'amber', 'red', 'grey')),
  constraint lcdbo_state_delivery_plans_progress_check check (progress_percentage between 0 and 100 and reporting_completeness between 0 and 100),
  constraint lcdbo_state_delivery_plans_targets_check check (
    (msme_mobilisation_target is null or msme_mobilisation_target >= 0)
    and (enrolment_target is null or enrolment_target >= 0)
    and (cluster_placement_target is null or cluster_placement_target >= 0)
  ),
  constraint lcdbo_state_delivery_plans_dates_check check (target_completion_date is null or start_date is null or target_completion_date >= start_date),
  constraint lcdbo_state_delivery_plans_activation_approval_check check (activation_status not in ('approved', 'mobilising', 'active', 'completed') or approval_status = 'approved')
);

create table if not exists public.lcdbo_lga_delivery_plans (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  state_plan_id uuid not null references public.lcdbo_state_delivery_plans(id) on delete cascade,
  state_id uuid not null references public.states(id) on delete restrict,
  lga_id uuid not null references public.lgas(id) on delete restrict,
  plan_reference text not null,
  title text not null,
  activation_status text not null default 'planned',
  approval_status text not null default 'draft',
  lga_delivery_lead_id uuid references public.users(id) on delete set null,
  local_government_focal_point text,
  accountable_institution_id uuid references public.institutions(id) on delete set null,
  participating_institution_ids uuid[] not null default '{}'::uuid[],
  priority_sectors text[] not null default '{}'::text[],
  priority_value_chains text[] not null default '{}'::text[],
  target_communities text[] not null default '{}'::text[],
  msme_mobilisation_target integer,
  enrolment_target integer,
  cluster_target integer,
  start_date date,
  target_completion_date date,
  delivery_status text not null default 'planned',
  delivery_health text not null default 'grey',
  progress_percentage integer not null default 0,
  reporting_completeness integer not null default 0,
  latest_update text,
  metadata jsonb not null default '{}'::jsonb,
  submitted_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_lga_delivery_plans_unique_lga unique (programme_id, lga_id),
  constraint lcdbo_lga_delivery_plans_unique_reference unique (programme_id, plan_reference),
  constraint lcdbo_lga_delivery_plans_activation_check check (activation_status in ('reference', 'planned', 'proposed', 'approved', 'mobilising', 'active', 'paused', 'completed', 'cancelled')),
  constraint lcdbo_lga_delivery_plans_approval_check check (approval_status in ('draft', 'submitted', 'under_review', 'approved', 'changes_requested', 'rejected')),
  constraint lcdbo_lga_delivery_plans_status_check check (delivery_status in ('not_started', 'planned', 'in_progress', 'at_risk', 'blocked', 'completed', 'paused', 'cancelled')),
  constraint lcdbo_lga_delivery_plans_health_check check (delivery_health in ('green', 'amber', 'red', 'grey')),
  constraint lcdbo_lga_delivery_plans_progress_check check (progress_percentage between 0 and 100 and reporting_completeness between 0 and 100),
  constraint lcdbo_lga_delivery_plans_targets_check check (
    (msme_mobilisation_target is null or msme_mobilisation_target >= 0)
    and (enrolment_target is null or enrolment_target >= 0)
    and (cluster_target is null or cluster_target >= 0)
  ),
  constraint lcdbo_lga_delivery_plans_dates_check check (target_completion_date is null or start_date is null or target_completion_date >= start_date),
  constraint lcdbo_lga_delivery_plans_activation_approval_check check (activation_status not in ('approved', 'mobilising', 'active', 'completed') or approval_status = 'approved')
);

create table if not exists public.lcdbo_cluster_delivery_plans (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  state_plan_id uuid not null references public.lcdbo_state_delivery_plans(id) on delete cascade,
  lga_plan_id uuid references public.lcdbo_lga_delivery_plans(id) on delete set null,
  state_id uuid not null references public.states(id) on delete restrict,
  lga_id uuid references public.lgas(id) on delete restrict,
  cluster_id uuid not null references public.industrial_clusters(id) on delete restrict,
  plan_reference text not null,
  title text not null,
  cluster_development_phase text not null default 'baseline',
  activation_status text not null default 'planned',
  approval_status text not null default 'draft',
  cluster_manager_id uuid references public.users(id) on delete set null,
  accountable_institution_id uuid references public.institutions(id) on delete set null,
  target_operational_date date,
  target_business_capacity integer,
  priority_value_chains text[] not null default '{}'::text[],
  facilities_requirements text,
  infrastructure_requirements text,
  readiness_gaps text,
  onboarding_milestones text,
  production_targets text,
  capacity_utilisation_target integer,
  employment_target integer,
  dependencies text,
  delivery_status text not null default 'planned',
  delivery_health text not null default 'grey',
  progress_percentage integer not null default 0,
  reporting_completeness integer not null default 0,
  latest_update text,
  metadata jsonb not null default '{}'::jsonb,
  submitted_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_cluster_delivery_plans_unique_cluster unique (programme_id, cluster_id),
  constraint lcdbo_cluster_delivery_plans_unique_reference unique (programme_id, plan_reference),
  constraint lcdbo_cluster_delivery_plans_activation_check check (activation_status in ('reference', 'planned', 'proposed', 'approved', 'mobilising', 'active', 'paused', 'completed', 'cancelled')),
  constraint lcdbo_cluster_delivery_plans_approval_check check (approval_status in ('draft', 'submitted', 'under_review', 'approved', 'changes_requested', 'rejected')),
  constraint lcdbo_cluster_delivery_plans_status_check check (delivery_status in ('not_started', 'planned', 'in_progress', 'at_risk', 'blocked', 'completed', 'paused', 'cancelled')),
  constraint lcdbo_cluster_delivery_plans_health_check check (delivery_health in ('green', 'amber', 'red', 'grey')),
  constraint lcdbo_cluster_delivery_plans_progress_check check (progress_percentage between 0 and 100 and reporting_completeness between 0 and 100),
  constraint lcdbo_cluster_delivery_plans_targets_check check (
    (target_business_capacity is null or target_business_capacity >= 0)
    and (capacity_utilisation_target is null or capacity_utilisation_target between 0 and 100)
    and (employment_target is null or employment_target >= 0)
  ),
  constraint lcdbo_cluster_delivery_plans_activation_approval_check check (activation_status not in ('approved', 'mobilising', 'active', 'completed') or approval_status = 'approved')
);

alter table public.lcdbo_delivery_items
  add column if not exists parent_delivery_item_id uuid references public.lcdbo_delivery_items(id) on delete set null,
  add column if not exists delivery_scope_type text not null default 'national',
  add column if not exists state_plan_id uuid references public.lcdbo_state_delivery_plans(id) on delete set null,
  add column if not exists lga_plan_id uuid references public.lcdbo_lga_delivery_plans(id) on delete set null,
  add column if not exists cluster_plan_id uuid references public.lcdbo_cluster_delivery_plans(id) on delete set null;

alter table public.lcdbo_delivery_items drop constraint if exists lcdbo_delivery_items_scope_type_check;
alter table public.lcdbo_delivery_items
  add constraint lcdbo_delivery_items_scope_type_check check (delivery_scope_type in ('national', 'workstream', 'state', 'lga', 'cluster', 'partner'));

alter table public.lcdbo_raid_items
  add column if not exists delivery_scope_type text not null default 'national',
  add column if not exists state_plan_id uuid references public.lcdbo_state_delivery_plans(id) on delete set null,
  add column if not exists lga_plan_id uuid references public.lcdbo_lga_delivery_plans(id) on delete set null,
  add column if not exists cluster_plan_id uuid references public.lcdbo_cluster_delivery_plans(id) on delete set null;

alter table public.lcdbo_raid_items drop constraint if exists lcdbo_raid_items_scope_type_check;
alter table public.lcdbo_raid_items
  add constraint lcdbo_raid_items_scope_type_check check (delivery_scope_type in ('national', 'workstream', 'state', 'lga', 'cluster', 'partner'));

create table if not exists public.lcdbo_delivery_activities (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  state_plan_id uuid references public.lcdbo_state_delivery_plans(id) on delete cascade,
  lga_plan_id uuid references public.lcdbo_lga_delivery_plans(id) on delete cascade,
  cluster_plan_id uuid references public.lcdbo_cluster_delivery_plans(id) on delete cascade,
  delivery_item_id uuid references public.lcdbo_delivery_items(id) on delete set null,
  reference text not null,
  title text not null,
  description text,
  activity_type text not null default 'coordination',
  owner_id uuid references public.users(id) on delete set null,
  participating_institution_id uuid references public.institutions(id) on delete set null,
  planned_start_date date,
  planned_end_date date,
  actual_completion_date date,
  status text not null default 'planned',
  priority text not null default 'medium',
  progress_percentage integer not null default 0,
  location_reference text,
  expected_output text,
  completion_notes text,
  evidence_requirement text,
  latest_update text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_delivery_activities_unique_reference unique (programme_id, reference),
  constraint lcdbo_delivery_activities_scope_check check (num_nonnulls(state_plan_id, lga_plan_id, cluster_plan_id) >= 1),
  constraint lcdbo_delivery_activities_type_check check (activity_type in ('mobilisation', 'coordination', 'assessment', 'site_readiness', 'stakeholder_engagement', 'training', 'infrastructure_planning', 'reporting', 'other')),
  constraint lcdbo_delivery_activities_status_check check (status in ('not_started', 'planned', 'in_progress', 'at_risk', 'blocked', 'completed', 'cancelled')),
  constraint lcdbo_delivery_activities_priority_check check (priority in ('low', 'medium', 'high', 'critical')),
  constraint lcdbo_delivery_activities_progress_check check (progress_percentage between 0 and 100),
  constraint lcdbo_delivery_activities_dates_check check (planned_end_date is null or planned_start_date is null or planned_end_date >= planned_start_date),
  constraint lcdbo_delivery_activities_completed_check check ((status = 'completed' and actual_completion_date is not null) or status <> 'completed')
);

create table if not exists public.lcdbo_delivery_progress_updates (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  workstream_id uuid references public.lcdbo_workstreams(id) on delete cascade,
  state_plan_id uuid references public.lcdbo_state_delivery_plans(id) on delete cascade,
  lga_plan_id uuid references public.lcdbo_lga_delivery_plans(id) on delete cascade,
  cluster_plan_id uuid references public.lcdbo_cluster_delivery_plans(id) on delete cascade,
  delivery_item_id uuid references public.lcdbo_delivery_items(id) on delete cascade,
  activity_id uuid references public.lcdbo_delivery_activities(id) on delete cascade,
  reporting_period_start date not null,
  reporting_period_end date not null,
  progress_summary text not null,
  progress_percentage integer not null,
  updated_delivery_status text not null,
  updated_health text not null,
  achievements text,
  challenges text,
  support_required text,
  next_steps text,
  evidence_references text[] not null default '{}'::text[],
  review_status text not null default 'submitted',
  submitted_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_delivery_progress_updates_scope_check check (num_nonnulls(workstream_id, state_plan_id, lga_plan_id, cluster_plan_id, delivery_item_id, activity_id) = 1),
  constraint lcdbo_delivery_progress_updates_period_check check (reporting_period_end >= reporting_period_start),
  constraint lcdbo_delivery_progress_updates_progress_check check (progress_percentage between 0 and 100),
  constraint lcdbo_delivery_progress_updates_status_check check (updated_delivery_status in ('not_started', 'planned', 'in_progress', 'at_risk', 'blocked', 'completed', 'paused', 'cancelled')),
  constraint lcdbo_delivery_progress_updates_health_check check (updated_health in ('green', 'amber', 'red', 'grey')),
  constraint lcdbo_delivery_progress_updates_review_check check (review_status in ('submitted', 'under_review', 'approved', 'rejected')),
  constraint lcdbo_delivery_progress_updates_self_approval_check check (reviewed_by is null or reviewed_by <> submitted_by or review_status <> 'approved')
);

create index if not exists idx_lcdbo_state_delivery_programme_status on public.lcdbo_state_delivery_plans(programme_id, activation_status, approval_status, delivery_health);
create index if not exists idx_lcdbo_state_delivery_state on public.lcdbo_state_delivery_plans(state_id, activation_status);
create index if not exists idx_lcdbo_state_delivery_owner on public.lcdbo_state_delivery_plans(state_coordinator_id, delivery_status);
create index if not exists idx_lcdbo_lga_delivery_programme_status on public.lcdbo_lga_delivery_plans(programme_id, activation_status, approval_status, delivery_health);
create index if not exists idx_lcdbo_lga_delivery_state_lga on public.lcdbo_lga_delivery_plans(state_id, lga_id, activation_status);
create index if not exists idx_lcdbo_lga_delivery_owner on public.lcdbo_lga_delivery_plans(lga_delivery_lead_id, delivery_status);
create index if not exists idx_lcdbo_cluster_delivery_programme_status on public.lcdbo_cluster_delivery_plans(programme_id, activation_status, approval_status, delivery_health);
create index if not exists idx_lcdbo_cluster_delivery_cluster on public.lcdbo_cluster_delivery_plans(cluster_id, activation_status);
create index if not exists idx_lcdbo_cluster_delivery_owner on public.lcdbo_cluster_delivery_plans(cluster_manager_id, delivery_status);
create index if not exists idx_lcdbo_delivery_items_geo_scope on public.lcdbo_delivery_items(programme_id, delivery_scope_type, state_plan_id, lga_plan_id, cluster_plan_id);
create index if not exists idx_lcdbo_raid_items_geo_scope on public.lcdbo_raid_items(programme_id, delivery_scope_type, state_plan_id, lga_plan_id, cluster_plan_id);
create index if not exists idx_lcdbo_delivery_activities_programme_status on public.lcdbo_delivery_activities(programme_id, status, priority);
create index if not exists idx_lcdbo_delivery_activities_scope on public.lcdbo_delivery_activities(state_plan_id, lga_plan_id, cluster_plan_id);
create index if not exists idx_lcdbo_delivery_activities_owner on public.lcdbo_delivery_activities(owner_id, status);
create index if not exists idx_lcdbo_delivery_progress_updates_programme on public.lcdbo_delivery_progress_updates(programme_id, review_status, submitted_at desc);
create index if not exists idx_lcdbo_delivery_progress_updates_scope on public.lcdbo_delivery_progress_updates(workstream_id, state_plan_id, lga_plan_id, cluster_plan_id, delivery_item_id, activity_id);

drop trigger if exists set_lcdbo_state_delivery_plans_updated_at on public.lcdbo_state_delivery_plans;
create trigger set_lcdbo_state_delivery_plans_updated_at before update on public.lcdbo_state_delivery_plans for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_lga_delivery_plans_updated_at on public.lcdbo_lga_delivery_plans;
create trigger set_lcdbo_lga_delivery_plans_updated_at before update on public.lcdbo_lga_delivery_plans for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_cluster_delivery_plans_updated_at on public.lcdbo_cluster_delivery_plans;
create trigger set_lcdbo_cluster_delivery_plans_updated_at before update on public.lcdbo_cluster_delivery_plans for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_delivery_activities_updated_at on public.lcdbo_delivery_activities;
create trigger set_lcdbo_delivery_activities_updated_at before update on public.lcdbo_delivery_activities for each row execute function public.set_platform_foundation_updated_at();

create or replace function public.lcdbo_validate_lga_delivery_plan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_plan record;
  lga_state uuid;
begin
  select programme_id, state_id into parent_plan from public.lcdbo_state_delivery_plans where id = new.state_plan_id;
  if parent_plan.programme_id is null then
    raise exception 'State delivery plan is required for an LGA plan.';
  end if;
  if parent_plan.programme_id <> new.programme_id or parent_plan.state_id <> new.state_id then
    raise exception 'LGA delivery plan must match its parent state plan.';
  end if;
  select state_id into lga_state from public.lgas where id = new.lga_id;
  if lga_state is null or lga_state <> new.state_id then
    raise exception 'Selected LGA does not belong to the selected state.';
  end if;
  return new;
end;
$$;

create or replace function public.lcdbo_validate_cluster_delivery_plan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_state record;
  parent_lga record;
  cluster_row record;
begin
  select programme_id, state_id into parent_state from public.lcdbo_state_delivery_plans where id = new.state_plan_id;
  if parent_state.programme_id is null then
    raise exception 'State delivery plan is required for a cluster plan.';
  end if;
  if parent_state.programme_id <> new.programme_id or parent_state.state_id <> new.state_id then
    raise exception 'Cluster delivery plan must match its parent state plan.';
  end if;
  select programme_id, state_id, lga_id into cluster_row from public.industrial_clusters where id = new.cluster_id;
  if cluster_row.programme_id is not null and cluster_row.programme_id <> new.programme_id then
    raise exception 'Industrial cluster belongs to a different programme.';
  end if;
  if cluster_row.state_id is not null and cluster_row.state_id <> new.state_id then
    raise exception 'Industrial cluster belongs to a different state.';
  end if;
  if new.lga_id is not null then
    if cluster_row.lga_id is not null and cluster_row.lga_id <> new.lga_id then
      raise exception 'Industrial cluster belongs to a different LGA.';
    end if;
  end if;
  if new.lga_plan_id is not null then
    select programme_id, state_plan_id, state_id, lga_id into parent_lga from public.lcdbo_lga_delivery_plans where id = new.lga_plan_id;
    if parent_lga.programme_id is null or parent_lga.programme_id <> new.programme_id or parent_lga.state_plan_id <> new.state_plan_id or parent_lga.state_id <> new.state_id then
      raise exception 'Cluster LGA plan must match its state delivery plan.';
    end if;
    if new.lga_id is not null and parent_lga.lga_id <> new.lga_id then
      raise exception 'Cluster LGA scope does not match the selected LGA plan.';
    end if;
    new.lga_id := parent_lga.lga_id;
  end if;
  return new;
end;
$$;

create or replace function public.lcdbo_validate_delivery_activity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  state_row record;
  lga_row record;
  cluster_row record;
begin
  if new.state_plan_id is not null then
    select programme_id into state_row from public.lcdbo_state_delivery_plans where id = new.state_plan_id;
    if state_row.programme_id is null or state_row.programme_id <> new.programme_id then
      raise exception 'Activity state plan does not match programme.';
    end if;
  end if;
  if new.lga_plan_id is not null then
    select programme_id, state_plan_id into lga_row from public.lcdbo_lga_delivery_plans where id = new.lga_plan_id;
    if lga_row.programme_id is null or lga_row.programme_id <> new.programme_id then
      raise exception 'Activity LGA plan does not match programme.';
    end if;
    if new.state_plan_id is not null and lga_row.state_plan_id <> new.state_plan_id then
      raise exception 'Activity LGA plan does not belong to selected state plan.';
    end if;
  end if;
  if new.cluster_plan_id is not null then
    select programme_id, state_plan_id, lga_plan_id into cluster_row from public.lcdbo_cluster_delivery_plans where id = new.cluster_plan_id;
    if cluster_row.programme_id is null or cluster_row.programme_id <> new.programme_id then
      raise exception 'Activity cluster plan does not match programme.';
    end if;
    if new.state_plan_id is not null and cluster_row.state_plan_id <> new.state_plan_id then
      raise exception 'Activity cluster plan does not belong to selected state plan.';
    end if;
    if new.lga_plan_id is not null and cluster_row.lga_plan_id is not null and cluster_row.lga_plan_id <> new.lga_plan_id then
      raise exception 'Activity cluster plan does not belong to selected LGA plan.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.lcdbo_validate_progress_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_programme uuid;
begin
  target_programme := null;
  if new.workstream_id is not null then select programme_id into target_programme from public.lcdbo_workstreams where id = new.workstream_id; end if;
  if new.state_plan_id is not null then select programme_id into target_programme from public.lcdbo_state_delivery_plans where id = new.state_plan_id; end if;
  if new.lga_plan_id is not null then select programme_id into target_programme from public.lcdbo_lga_delivery_plans where id = new.lga_plan_id; end if;
  if new.cluster_plan_id is not null then select programme_id into target_programme from public.lcdbo_cluster_delivery_plans where id = new.cluster_plan_id; end if;
  if new.delivery_item_id is not null then select programme_id into target_programme from public.lcdbo_delivery_items where id = new.delivery_item_id; end if;
  if new.activity_id is not null then select programme_id into target_programme from public.lcdbo_delivery_activities where id = new.activity_id; end if;
  if target_programme is null or target_programme <> new.programme_id then
    raise exception 'Progress update target must belong to the LCDBO programme.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_lcdbo_lga_delivery_plan on public.lcdbo_lga_delivery_plans;
create trigger validate_lcdbo_lga_delivery_plan before insert or update on public.lcdbo_lga_delivery_plans for each row execute function public.lcdbo_validate_lga_delivery_plan();
drop trigger if exists validate_lcdbo_cluster_delivery_plan on public.lcdbo_cluster_delivery_plans;
create trigger validate_lcdbo_cluster_delivery_plan before insert or update on public.lcdbo_cluster_delivery_plans for each row execute function public.lcdbo_validate_cluster_delivery_plan();
drop trigger if exists validate_lcdbo_delivery_activity on public.lcdbo_delivery_activities;
create trigger validate_lcdbo_delivery_activity before insert or update on public.lcdbo_delivery_activities for each row execute function public.lcdbo_validate_delivery_activity();
drop trigger if exists validate_lcdbo_progress_update on public.lcdbo_delivery_progress_updates;
create trigger validate_lcdbo_progress_update before insert or update on public.lcdbo_delivery_progress_updates for each row execute function public.lcdbo_validate_progress_update();

create or replace function public.lcdbo_can_view_delivery_programme(target_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.lcdbo_can_review_programme(target_programme_id)
    or exists (
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
              and ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin', 'assessment_officer', 'field_officer', 'data_analyst', 'auditor', 'observer', 'state_coordinator', 'lga_coordinator', 'cluster_manager')
              and (
                (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
                or ra.scope_type = 'global'
              )
          )
        )
    )
$$;

create or replace function public.lcdbo_can_view_all_delivery_programme(target_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.lcdbo_can_review_programme(target_programme_id)
    or exists (
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
              and ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin', 'assessment_officer', 'field_officer', 'data_analyst', 'auditor', 'observer')
              and (
                (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
                or ra.scope_type = 'global'
              )
          )
        )
    )
$$;

create or replace function public.lcdbo_has_active_programme_role(target_programme_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = public.lcdbo_current_app_user_id()
      and ra.status = 'active'
      and (ra.expires_at is null or ra.expires_at > now())
      and ra.role = any(allowed_roles)
      and (
        (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
        or ra.scope_type = 'global'
      )
  )
$$;

create or replace function public.lcdbo_can_save_state_delivery_plan(target_programme_id uuid, target_state_coordinator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.lcdbo_can_review_programme(target_programme_id)
    or (
      target_state_coordinator_id = public.lcdbo_current_app_user_id()
      and public.lcdbo_has_active_programme_role(target_programme_id, array['state_coordinator'])
    )
$$;

create or replace function public.lcdbo_can_manage_state_delivery_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_state_delivery_plans sp
    where sp.id = target_plan_id
      and public.lcdbo_can_save_state_delivery_plan(sp.programme_id, sp.state_coordinator_id)
  )
$$;

create or replace function public.lcdbo_can_save_lga_delivery_plan(target_programme_id uuid, target_lga_delivery_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.lcdbo_can_review_programme(target_programme_id)
    or (
      target_lga_delivery_lead_id = public.lcdbo_current_app_user_id()
      and public.lcdbo_has_active_programme_role(target_programme_id, array['lga_coordinator'])
    )
$$;

create or replace function public.lcdbo_can_manage_lga_delivery_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_lga_delivery_plans lp
    where lp.id = target_plan_id
      and public.lcdbo_can_save_lga_delivery_plan(lp.programme_id, lp.lga_delivery_lead_id)
  )
$$;

create or replace function public.lcdbo_can_save_cluster_delivery_plan(target_programme_id uuid, target_cluster_manager_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.lcdbo_can_review_programme(target_programme_id)
    or (
      target_cluster_manager_id = public.lcdbo_current_app_user_id()
      and public.lcdbo_has_active_programme_role(target_programme_id, array['cluster_manager'])
    )
$$;

create or replace function public.lcdbo_can_manage_cluster_delivery_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_cluster_delivery_plans cp
    where cp.id = target_plan_id
      and public.lcdbo_can_save_cluster_delivery_plan(cp.programme_id, cp.cluster_manager_id)
  )
$$;

create or replace function public.lcdbo_can_view_state_delivery_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_state_delivery_plans sp
    where sp.id = target_plan_id
      and (
        public.lcdbo_can_view_all_delivery_programme(sp.programme_id)
        or public.lcdbo_can_manage_state_delivery_plan(sp.id)
        or exists (
          select 1
          from public.lcdbo_lga_delivery_plans lp
          where lp.state_plan_id = sp.id
            and public.lcdbo_can_manage_lga_delivery_plan(lp.id)
        )
        or exists (
          select 1
          from public.lcdbo_cluster_delivery_plans cp
          where cp.state_plan_id = sp.id
            and public.lcdbo_can_manage_cluster_delivery_plan(cp.id)
        )
      )
  )
$$;

create or replace function public.lcdbo_can_view_lga_delivery_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_lga_delivery_plans lp
    where lp.id = target_plan_id
      and (
        public.lcdbo_can_view_all_delivery_programme(lp.programme_id)
        or public.lcdbo_can_manage_lga_delivery_plan(lp.id)
        or public.lcdbo_can_manage_state_delivery_plan(lp.state_plan_id)
        or exists (
          select 1
          from public.lcdbo_cluster_delivery_plans cp
          where cp.lga_plan_id = lp.id
            and public.lcdbo_can_manage_cluster_delivery_plan(cp.id)
        )
      )
  )
$$;

create or replace function public.lcdbo_can_view_cluster_delivery_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_cluster_delivery_plans cp
    where cp.id = target_plan_id
      and (
        public.lcdbo_can_view_all_delivery_programme(cp.programme_id)
        or public.lcdbo_can_manage_cluster_delivery_plan(cp.id)
        or public.lcdbo_can_manage_state_delivery_plan(cp.state_plan_id)
        or (cp.lga_plan_id is not null and public.lcdbo_can_manage_lga_delivery_plan(cp.lga_plan_id))
      )
  )
$$;

create or replace function public.lcdbo_can_save_delivery_activity(
  target_programme_id uuid,
  target_state_plan_id uuid,
  target_lga_plan_id uuid,
  target_cluster_plan_id uuid,
  target_owner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.lcdbo_can_review_programme(target_programme_id)
    or target_owner_id = public.lcdbo_current_app_user_id()
    or (target_state_plan_id is not null and public.lcdbo_can_manage_state_delivery_plan(target_state_plan_id))
    or (target_lga_plan_id is not null and public.lcdbo_can_manage_lga_delivery_plan(target_lga_plan_id))
    or (target_cluster_plan_id is not null and public.lcdbo_can_manage_cluster_delivery_plan(target_cluster_plan_id))
$$;

create or replace function public.lcdbo_can_manage_delivery_activity(target_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_delivery_activities a
    where a.id = target_activity_id
      and public.lcdbo_can_save_delivery_activity(a.programme_id, a.state_plan_id, a.lga_plan_id, a.cluster_plan_id, a.owner_id)
  )
$$;

create or replace function public.lcdbo_can_view_delivery_activity(target_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_delivery_activities a
    where a.id = target_activity_id
      and (
        public.lcdbo_can_view_all_delivery_programme(a.programme_id)
        or public.lcdbo_can_save_delivery_activity(a.programme_id, a.state_plan_id, a.lga_plan_id, a.cluster_plan_id, a.owner_id)
        or (a.state_plan_id is not null and public.lcdbo_can_view_state_delivery_plan(a.state_plan_id))
        or (a.lga_plan_id is not null and public.lcdbo_can_view_lga_delivery_plan(a.lga_plan_id))
        or (a.cluster_plan_id is not null and public.lcdbo_can_view_cluster_delivery_plan(a.cluster_plan_id))
      )
  )
$$;

create or replace function public.lcdbo_can_submit_delivery_progress_update(
  target_programme_id uuid,
  target_submitted_by uuid,
  target_workstream_id uuid,
  target_state_plan_id uuid,
  target_lga_plan_id uuid,
  target_cluster_plan_id uuid,
  target_delivery_item_id uuid,
  target_activity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_submitted_by = public.lcdbo_current_app_user_id()
    and (
      public.lcdbo_can_review_programme(target_programme_id)
      or (
        target_workstream_id is null
        and target_delivery_item_id is null
        and (
          (target_state_plan_id is not null and public.lcdbo_can_manage_state_delivery_plan(target_state_plan_id))
          or (target_lga_plan_id is not null and public.lcdbo_can_manage_lga_delivery_plan(target_lga_plan_id))
          or (target_cluster_plan_id is not null and public.lcdbo_can_manage_cluster_delivery_plan(target_cluster_plan_id))
          or (target_activity_id is not null and public.lcdbo_can_manage_delivery_activity(target_activity_id))
        )
      )
    )
$$;

create or replace function public.lcdbo_can_view_delivery_progress_update(target_update_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_delivery_progress_updates pu
    where pu.id = target_update_id
      and (
        public.lcdbo_can_view_all_delivery_programme(pu.programme_id)
        or pu.submitted_by = public.lcdbo_current_app_user_id()
        or (pu.state_plan_id is not null and public.lcdbo_can_view_state_delivery_plan(pu.state_plan_id))
        or (pu.lga_plan_id is not null and public.lcdbo_can_view_lga_delivery_plan(pu.lga_plan_id))
        or (pu.cluster_plan_id is not null and public.lcdbo_can_view_cluster_delivery_plan(pu.cluster_plan_id))
        or (pu.activity_id is not null and public.lcdbo_can_view_delivery_activity(pu.activity_id))
      )
  )
$$;

revoke all on function public.lcdbo_can_view_delivery_programme(uuid) from public;
grant execute on function public.lcdbo_can_view_delivery_programme(uuid) to authenticated;
revoke all on function public.lcdbo_can_view_all_delivery_programme(uuid) from public;
grant execute on function public.lcdbo_can_view_all_delivery_programme(uuid) to authenticated;
revoke all on function public.lcdbo_has_active_programme_role(uuid, text[]) from public;
grant execute on function public.lcdbo_has_active_programme_role(uuid, text[]) to authenticated;
revoke all on function public.lcdbo_can_save_state_delivery_plan(uuid, uuid) from public;
grant execute on function public.lcdbo_can_save_state_delivery_plan(uuid, uuid) to authenticated;
revoke all on function public.lcdbo_can_manage_state_delivery_plan(uuid) from public;
grant execute on function public.lcdbo_can_manage_state_delivery_plan(uuid) to authenticated;
revoke all on function public.lcdbo_can_view_state_delivery_plan(uuid) from public;
grant execute on function public.lcdbo_can_view_state_delivery_plan(uuid) to authenticated;
revoke all on function public.lcdbo_can_save_lga_delivery_plan(uuid, uuid) from public;
grant execute on function public.lcdbo_can_save_lga_delivery_plan(uuid, uuid) to authenticated;
revoke all on function public.lcdbo_can_manage_lga_delivery_plan(uuid) from public;
grant execute on function public.lcdbo_can_manage_lga_delivery_plan(uuid) to authenticated;
revoke all on function public.lcdbo_can_view_lga_delivery_plan(uuid) from public;
grant execute on function public.lcdbo_can_view_lga_delivery_plan(uuid) to authenticated;
revoke all on function public.lcdbo_can_save_cluster_delivery_plan(uuid, uuid) from public;
grant execute on function public.lcdbo_can_save_cluster_delivery_plan(uuid, uuid) to authenticated;
revoke all on function public.lcdbo_can_manage_cluster_delivery_plan(uuid) from public;
grant execute on function public.lcdbo_can_manage_cluster_delivery_plan(uuid) to authenticated;
revoke all on function public.lcdbo_can_view_cluster_delivery_plan(uuid) from public;
grant execute on function public.lcdbo_can_view_cluster_delivery_plan(uuid) to authenticated;
revoke all on function public.lcdbo_can_save_delivery_activity(uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function public.lcdbo_can_save_delivery_activity(uuid, uuid, uuid, uuid, uuid) to authenticated;
revoke all on function public.lcdbo_can_manage_delivery_activity(uuid) from public;
grant execute on function public.lcdbo_can_manage_delivery_activity(uuid) to authenticated;
revoke all on function public.lcdbo_can_view_delivery_activity(uuid) from public;
grant execute on function public.lcdbo_can_view_delivery_activity(uuid) to authenticated;
revoke all on function public.lcdbo_can_submit_delivery_progress_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function public.lcdbo_can_submit_delivery_progress_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;
revoke all on function public.lcdbo_can_view_delivery_progress_update(uuid) from public;
grant execute on function public.lcdbo_can_view_delivery_progress_update(uuid) to authenticated;

alter table public.lcdbo_state_delivery_plans enable row level security;
alter table public.lcdbo_lga_delivery_plans enable row level security;
alter table public.lcdbo_cluster_delivery_plans enable row level security;
alter table public.lcdbo_delivery_activities enable row level security;
alter table public.lcdbo_delivery_progress_updates enable row level security;

drop policy if exists "LCDBO delivery readers can read state plans" on public.lcdbo_state_delivery_plans;
create policy "LCDBO delivery readers can read state plans" on public.lcdbo_state_delivery_plans for select using (public.lcdbo_can_view_state_delivery_plan(id));
drop policy if exists "LCDBO delivery managers can manage state plans" on public.lcdbo_state_delivery_plans;
create policy "LCDBO delivery managers can manage state plans" on public.lcdbo_state_delivery_plans for all using (public.lcdbo_can_manage_state_delivery_plan(id)) with check (public.lcdbo_can_save_state_delivery_plan(programme_id, state_coordinator_id));

drop policy if exists "LCDBO delivery readers can read LGA plans" on public.lcdbo_lga_delivery_plans;
create policy "LCDBO delivery readers can read LGA plans" on public.lcdbo_lga_delivery_plans for select using (public.lcdbo_can_view_lga_delivery_plan(id));
drop policy if exists "LCDBO delivery managers can manage LGA plans" on public.lcdbo_lga_delivery_plans;
create policy "LCDBO delivery managers can manage LGA plans" on public.lcdbo_lga_delivery_plans for all using (public.lcdbo_can_manage_lga_delivery_plan(id)) with check (public.lcdbo_can_save_lga_delivery_plan(programme_id, lga_delivery_lead_id));

drop policy if exists "LCDBO delivery readers can read cluster plans" on public.lcdbo_cluster_delivery_plans;
create policy "LCDBO delivery readers can read cluster plans" on public.lcdbo_cluster_delivery_plans for select using (public.lcdbo_can_view_cluster_delivery_plan(id));
drop policy if exists "LCDBO delivery managers can manage cluster plans" on public.lcdbo_cluster_delivery_plans;
create policy "LCDBO delivery managers can manage cluster plans" on public.lcdbo_cluster_delivery_plans for all using (public.lcdbo_can_manage_cluster_delivery_plan(id)) with check (public.lcdbo_can_save_cluster_delivery_plan(programme_id, cluster_manager_id));

drop policy if exists "LCDBO delivery readers can read activities" on public.lcdbo_delivery_activities;
create policy "LCDBO delivery readers can read activities" on public.lcdbo_delivery_activities for select using (public.lcdbo_can_view_delivery_activity(id));
drop policy if exists "LCDBO delivery managers can manage activities" on public.lcdbo_delivery_activities;
create policy "LCDBO delivery managers can manage activities" on public.lcdbo_delivery_activities for all using (public.lcdbo_can_manage_delivery_activity(id)) with check (public.lcdbo_can_save_delivery_activity(programme_id, state_plan_id, lga_plan_id, cluster_plan_id, owner_id));

drop policy if exists "LCDBO delivery readers can read progress updates" on public.lcdbo_delivery_progress_updates;
create policy "LCDBO delivery readers can read progress updates" on public.lcdbo_delivery_progress_updates for select using (public.lcdbo_can_view_delivery_progress_update(id));
drop policy if exists "LCDBO delivery managers can create progress updates" on public.lcdbo_delivery_progress_updates;
create policy "LCDBO delivery managers can create progress updates" on public.lcdbo_delivery_progress_updates for insert with check (public.lcdbo_can_submit_delivery_progress_update(programme_id, submitted_by, workstream_id, state_plan_id, lga_plan_id, cluster_plan_id, delivery_item_id, activity_id));
drop policy if exists "LCDBO delivery managers can review progress updates" on public.lcdbo_delivery_progress_updates;
create policy "LCDBO delivery managers can review progress updates" on public.lcdbo_delivery_progress_updates for update using (public.lcdbo_can_review_programme(programme_id)) with check (public.lcdbo_can_review_programme(programme_id));

with lcdb_o as (
  select id as programme_id from public.programmes where slug = 'local-content-development-beyond-oil' limit 1
),
state_seed as (
  select
    lcdb_o.programme_id,
    s.id as state_id,
    s.name as state_name,
    row_number() over (order by s.name) as seq
  from lcdb_o
  join public.states s on s.name in ('Lagos', 'Ogun', 'Oyo')
)
insert into public.lcdbo_state_delivery_plans (
  programme_id, state_id, plan_reference, title, implementation_phase,
  activation_status, approval_status, priority_sectors, priority_value_chains,
  msme_mobilisation_target, enrolment_target, cluster_placement_target,
  delivery_status, delivery_health, progress_percentage, reporting_completeness,
  latest_update, metadata
)
select
  programme_id,
  state_id,
  'LCDBO-ST-' || lpad(seq::text, 3, '0'),
  state_name || ' state delivery plan',
  'baseline_planning',
  'planned',
  'draft',
  array['Leather', 'Agro-processing', 'Manufacturing'],
  array['Input aggregation', 'Shared production', 'Quality assurance'],
  0,
  0,
  0,
  'planned',
  'grey',
  0,
  0,
  'Configured planning shell only. This does not represent active implementation.',
  jsonb_build_object('source', 'lcdbo_delivery_core_sprint2', 'record_classification', 'configured_target')
from state_seed
on conflict (programme_id, state_id) do update set
  title = excluded.title,
  metadata = public.lcdbo_state_delivery_plans.metadata || excluded.metadata,
  updated_at = now();

with lcdb_o as (
  select id as programme_id from public.programmes where slug = 'local-content-development-beyond-oil' limit 1
),
lga_seed as (
  select
    sp.programme_id,
    sp.id as state_plan_id,
    s.id as state_id,
    s.name as state_name,
    l.id as lga_id,
    l.name as lga_name,
    row_number() over (order by s.name, l.name) as seq
  from lcdb_o
  join public.lcdbo_state_delivery_plans sp on sp.programme_id = lcdb_o.programme_id
  join public.states s on s.id = sp.state_id
  join public.lgas l on l.state_id = s.id
  where (s.name = 'Lagos' and l.name in ('Mushin', 'Ikeja'))
     or (s.name = 'Ogun' and l.name = 'Abeokuta South')
     or (s.name = 'Oyo' and l.name = 'Ibadan North')
)
insert into public.lcdbo_lga_delivery_plans (
  programme_id, state_plan_id, state_id, lga_id, plan_reference, title,
  activation_status, approval_status, priority_sectors, priority_value_chains,
  msme_mobilisation_target, enrolment_target, cluster_target,
  delivery_status, delivery_health, progress_percentage, reporting_completeness,
  latest_update, metadata
)
select
  programme_id,
  state_plan_id,
  state_id,
  lga_id,
  'LCDBO-LGA-' || lpad(seq::text, 3, '0'),
  lga_name || ' LGA delivery plan',
  'planned',
  'draft',
  array['Leather', 'Agro-processing', 'Manufacturing'],
  array['MSME mobilisation', 'Cluster readiness'],
  0,
  0,
  0,
  'planned',
  'grey',
  0,
  0,
  'Configured planning shell only. This does not represent active implementation.',
  jsonb_build_object('source', 'lcdbo_delivery_core_sprint2', 'record_classification', 'configured_target')
from lga_seed
on conflict (programme_id, lga_id) do update set
  title = excluded.title,
  state_plan_id = excluded.state_plan_id,
  metadata = public.lcdbo_lga_delivery_plans.metadata || excluded.metadata,
  updated_at = now();

with lcdb_o as (
  select id as programme_id from public.programmes where slug = 'local-content-development-beyond-oil' limit 1
),
cluster_seed as (
  select
    c.programme_id,
    sp.id as state_plan_id,
    lp.id as lga_plan_id,
    c.state_id,
    c.lga_id,
    c.id as cluster_id,
    c.name as cluster_name,
    c.sector,
    row_number() over (order by c.name) as seq
  from public.industrial_clusters c
  join lcdb_o on lcdb_o.programme_id = c.programme_id
  join public.lcdbo_state_delivery_plans sp on sp.programme_id = c.programme_id and sp.state_id = c.state_id
  left join public.lcdbo_lga_delivery_plans lp on lp.programme_id = c.programme_id and lp.lga_id = c.lga_id
)
insert into public.lcdbo_cluster_delivery_plans (
  programme_id, state_plan_id, lga_plan_id, state_id, lga_id, cluster_id,
  plan_reference, title, cluster_development_phase, activation_status, approval_status,
  target_business_capacity, priority_value_chains, facilities_requirements,
  infrastructure_requirements, readiness_gaps, delivery_status, delivery_health,
  progress_percentage, reporting_completeness, latest_update, metadata
)
select
  programme_id,
  state_plan_id,
  lga_plan_id,
  state_id,
  lga_id,
  cluster_id,
  'LCDBO-CL-' || lpad(seq::text, 3, '0'),
  cluster_name || ' delivery plan',
  'baseline_planning',
  'planned',
  'draft',
  0,
  array[coalesce(sector, 'Industrial production')],
  'To be confirmed through governed facility assessment.',
  'To be confirmed through governed infrastructure assessment.',
  'Readiness gaps will be derived from approved cluster assessments.',
  'planned',
  'grey',
  0,
  0,
  'Configured planning shell only. Live membership and readiness remain derived from cluster records.',
  jsonb_build_object('source', 'lcdbo_delivery_core_sprint2', 'record_classification', 'configured_target')
from cluster_seed
on conflict (programme_id, cluster_id) do update set
  title = excluded.title,
  state_plan_id = excluded.state_plan_id,
  lga_plan_id = excluded.lga_plan_id,
  metadata = public.lcdbo_cluster_delivery_plans.metadata || excluded.metadata,
  updated_at = now();
