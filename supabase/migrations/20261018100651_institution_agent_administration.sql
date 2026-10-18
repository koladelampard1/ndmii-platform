-- Institution-specific BDSP rosters and agent assignments.
-- Agent membership uses public.institution_members with role institution_agent.
-- The canonical business stays in public.msmes; its institution engagement is private.

alter table public.institution_members
  add constraint institution_members_id_institution_key unique (id, institution_id);

create table public.institution_bdsp_organisations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 160),
  registration_number text,
  service_states text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  unique (institution_id, name)
);
create index institution_bdsp_organisations_scope_idx
  on public.institution_bdsp_organisations(institution_id, status, name);

create table public.institution_agent_profiles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  member_id uuid not null,
  bdsp_organisation_id uuid,
  service_states text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id),
  unique (id, institution_id),
  foreign key (member_id, institution_id)
    references public.institution_members(id, institution_id) on delete restrict,
  foreign key (bdsp_organisation_id, institution_id)
    references public.institution_bdsp_organisations(id, institution_id) on delete restrict
);
create index institution_agent_profiles_scope_idx
  on public.institution_agent_profiles(institution_id, bdsp_organisation_id);

create table public.institution_business_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  engagement_id uuid not null,
  agent_member_id uuid not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  assigned_by_user_id uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, engagement_id),
  foreign key (engagement_id, institution_id)
    references public.institution_engagements(id, institution_id) on delete restrict,
  foreign key (agent_member_id, institution_id)
    references public.institution_members(id, institution_id) on delete restrict
);
create index institution_business_assignments_agent_idx
  on public.institution_business_assignments(institution_id, agent_member_id, status);

alter table public.institution_bdsp_organisations enable row level security;
alter table public.institution_agent_profiles enable row level security;
alter table public.institution_business_assignments enable row level security;
revoke all on public.institution_bdsp_organisations,
  public.institution_agent_profiles,
  public.institution_business_assignments from public, anon, authenticated;
grant select, insert, update, delete on public.institution_bdsp_organisations,
  public.institution_agent_profiles,
  public.institution_business_assignments to service_role;

-- No client policies: server routes verify actor identity and institution membership.
