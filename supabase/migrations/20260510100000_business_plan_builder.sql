create table if not exists public.business_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid references public.msmes(id) on delete cascade,
  created_by uuid references public.users(id),
  purpose text not null default 'loan_application',
  status text not null default 'draft',
  business_name text,
  answers_json jsonb not null default '{}'::jsonb,
  generated_plan_json jsonb,
  generated_plan_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint business_plan_sessions_purpose_check check (
    purpose in ('loan_application', 'grant_application', 'investor_pitch', 'internal_planning')
  ),
  constraint business_plan_sessions_status_check check (
    status in ('draft', 'generated')
  )
);

create table if not exists public.business_plan_versions (
  id uuid primary key default gen_random_uuid(),
  business_plan_session_id uuid references public.business_plan_sessions(id) on delete cascade,
  version_number integer not null default 1,
  generated_plan_json jsonb,
  generated_plan_text text,
  created_at timestamptz default now()
);

create index if not exists business_plan_sessions_msme_id_idx
  on public.business_plan_sessions(msme_id);

create index if not exists business_plan_sessions_created_by_idx
  on public.business_plan_sessions(created_by);

create index if not exists business_plan_versions_session_id_idx
  on public.business_plan_versions(business_plan_session_id);

create or replace function public.set_business_plan_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_business_plan_sessions_updated_at on public.business_plan_sessions;
create trigger set_business_plan_sessions_updated_at
before update on public.business_plan_sessions
for each row
execute function public.set_business_plan_sessions_updated_at();
