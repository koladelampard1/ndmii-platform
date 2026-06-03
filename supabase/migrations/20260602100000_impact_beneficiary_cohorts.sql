-- Impact Intelligence Phase 2: Beneficiary Cohort Management
-- Cohorts become the enrolment layer between programmes and MSMEs.

create extension if not exists "pgcrypto";

create table if not exists public.impact_beneficiary_cohorts (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.impact_programmes(id) on delete cascade,
  name text not null,
  description text,
  state text,
  lga text,
  sector text,
  target_beneficiaries integer not null default 0,
  current_beneficiaries integer not null default 0,
  status text not null default 'draft',
  start_date date,
  end_date date,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_beneficiary_cohorts_status_check check (status in ('draft', 'recruiting', 'active', 'completed', 'closed')),
  constraint impact_beneficiary_cohorts_target_check check (target_beneficiaries >= 0),
  constraint impact_beneficiary_cohorts_current_check check (current_beneficiaries >= 0)
);

create table if not exists public.impact_cohort_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.impact_beneficiary_cohorts(id) on delete cascade,
  programme_id uuid not null references public.impact_programmes(id) on delete cascade,
  msme_id uuid not null references public.msmes(id) on delete cascade,
  member_status text not null default 'enrolled',
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  exited_at timestamptz,
  assigned_to_user_id uuid references public.users(id) on delete set null,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint impact_cohort_members_unique unique (cohort_id, msme_id),
  constraint impact_cohort_members_status_check check (member_status in ('invited', 'enrolled', 'active', 'completed', 'dropped', 'exited'))
);

create index if not exists idx_impact_beneficiary_cohorts_programme_id on public.impact_beneficiary_cohorts(programme_id);
create index if not exists idx_impact_beneficiary_cohorts_status on public.impact_beneficiary_cohorts(status);
create index if not exists idx_impact_beneficiary_cohorts_state_sector on public.impact_beneficiary_cohorts(state, sector);
create index if not exists idx_impact_cohort_members_cohort_id on public.impact_cohort_members(cohort_id);
create index if not exists idx_impact_cohort_members_programme_id on public.impact_cohort_members(programme_id);
create index if not exists idx_impact_cohort_members_msme_id on public.impact_cohort_members(msme_id);
create index if not exists idx_impact_cohort_members_status on public.impact_cohort_members(member_status);
create index if not exists idx_impact_cohort_members_assigned_to_user_id on public.impact_cohort_members(assigned_to_user_id);

create or replace function public.sync_impact_cohort_member_programme_id()
returns trigger as $$
begin
  select programme_id into new.programme_id
  from public.impact_beneficiary_cohorts
  where id = new.cohort_id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists sync_impact_cohort_member_programme_id on public.impact_cohort_members;
create trigger sync_impact_cohort_member_programme_id
before insert or update of cohort_id on public.impact_cohort_members
for each row execute function public.sync_impact_cohort_member_programme_id();

create or replace function public.refresh_impact_cohort_current_beneficiaries()
returns trigger as $$
declare
  target_cohort_id uuid;
begin
  target_cohort_id := coalesce(new.cohort_id, old.cohort_id);

  update public.impact_beneficiary_cohorts
  set current_beneficiaries = (
    select count(*)::integer
    from public.impact_cohort_members
    where cohort_id = target_cohort_id
      and member_status in ('invited', 'enrolled', 'active', 'completed')
  ),
  updated_at = now()
  where id = target_cohort_id;

  return null;
end;
$$ language plpgsql;

drop trigger if exists refresh_impact_cohort_current_beneficiaries_insert on public.impact_cohort_members;
create trigger refresh_impact_cohort_current_beneficiaries_insert
after insert on public.impact_cohort_members
for each row execute function public.refresh_impact_cohort_current_beneficiaries();

drop trigger if exists refresh_impact_cohort_current_beneficiaries_update on public.impact_cohort_members;
create trigger refresh_impact_cohort_current_beneficiaries_update
after update of member_status, cohort_id on public.impact_cohort_members
for each row execute function public.refresh_impact_cohort_current_beneficiaries();

drop trigger if exists refresh_impact_cohort_current_beneficiaries_delete on public.impact_cohort_members;
create trigger refresh_impact_cohort_current_beneficiaries_delete
after delete on public.impact_cohort_members
for each row execute function public.refresh_impact_cohort_current_beneficiaries();

drop trigger if exists set_impact_beneficiary_cohorts_updated_at on public.impact_beneficiary_cohorts;
create trigger set_impact_beneficiary_cohorts_updated_at
before update on public.impact_beneficiary_cohorts
for each row execute function public.set_impact_intelligence_updated_at();

drop trigger if exists set_impact_cohort_members_updated_at on public.impact_cohort_members;
create trigger set_impact_cohort_members_updated_at
before update on public.impact_cohort_members
for each row execute function public.set_impact_intelligence_updated_at();
