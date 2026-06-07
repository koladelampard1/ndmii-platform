-- Impact Intelligence RBAC Phase 1:
-- recognized data analyst role and programme assignment foundation.

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
    check (role in (
      'public',
      'msme',
      'association_officer',
      'reviewer',
      'boi_executive',
      'programme_officer',
      'assessment_officer',
      'field_officer',
      'data_analyst',
      'auditor',
      'fccpc_officer',
      'nrs_officer',
      'firs_officer',
      'admin',
      'super_admin'
    ));
end $$;

create table if not exists public.impact_user_programme_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  programme_id uuid not null references public.impact_programmes(id) on delete cascade,
  assignment_role text not null,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by_user_id uuid references public.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint impact_user_programme_assignments_status_check
    check (status in ('active', 'inactive', 'revoked')),
  constraint impact_user_programme_assignments_role_check
    check (assignment_role in (
      'programme_officer',
      'assessment_officer',
      'data_analyst',
      'auditor'
    )),
  constraint impact_user_programme_assignments_dates_check
    check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_impact_user_programme_assignments_user_id
  on public.impact_user_programme_assignments(user_id);
create index if not exists idx_impact_user_programme_assignments_programme_id
  on public.impact_user_programme_assignments(programme_id);
create index if not exists idx_impact_user_programme_assignments_assignment_role
  on public.impact_user_programme_assignments(assignment_role);
create index if not exists idx_impact_user_programme_assignments_status
  on public.impact_user_programme_assignments(status);
create index if not exists idx_impact_user_programme_assignments_active_lookup
  on public.impact_user_programme_assignments(user_id, programme_id, assignment_role)
  where status = 'active';
create unique index if not exists idx_impact_user_programme_assignments_unique_active
  on public.impact_user_programme_assignments(user_id, programme_id, assignment_role)
  where status = 'active';

drop trigger if exists set_impact_user_programme_assignments_updated_at
  on public.impact_user_programme_assignments;
create trigger set_impact_user_programme_assignments_updated_at
before update on public.impact_user_programme_assignments
for each row execute function public.set_impact_intelligence_updated_at();

alter table public.impact_user_programme_assignments enable row level security;
revoke all on public.impact_user_programme_assignments from anon, authenticated;
