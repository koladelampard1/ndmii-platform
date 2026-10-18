-- The core MSME identity is shared; the relationship with each institution is private.
-- No client-side Data API grants are given to these records. Server operations must
-- verify an authenticated actor and the institution relationship on every request.

alter table public.institutions drop constraint if exists institutions_type_check;
alter table public.institutions add constraint institutions_type_check check (institution_type in (
  'federal_agency', 'state_government', 'lga', 'association', 'private_company',
  'development_finance_institution', 'microfinance_bank', 'investor',
  'technical_partner', 'programme_secretariat', 'regulator'
));

create table if not exists public.institution_engagements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  msme_id uuid not null references public.msmes(id) on delete restrict,
  relationship_status text not null default 'prospective'
    check (relationship_status in ('prospective', 'active', 'paused', 'closed')),
  passport_access_status text not null default 'pending'
    check (passport_access_status in ('pending', 'granted', 'revoked')),
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_engagements_institution_msme_key unique (institution_id, msme_id),
  constraint institution_engagements_id_institution_key unique (id, institution_id)
);

create index if not exists institution_engagements_msme_idx
  on public.institution_engagements(msme_id);
create index if not exists institution_engagements_institution_status_idx
  on public.institution_engagements(institution_id, relationship_status, created_at desc);

create table if not exists public.institution_engagement_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  engagement_id uuid not null,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint institution_engagement_events_engagement_scope_fkey
    foreign key (engagement_id, institution_id)
    references public.institution_engagements(id, institution_id) on delete cascade
);

create index if not exists institution_engagement_events_scope_idx
  on public.institution_engagement_events(institution_id, engagement_id, created_at desc);

alter table public.institution_engagements enable row level security;
alter table public.institution_engagement_events enable row level security;
revoke all on public.institution_engagements, public.institution_engagement_events from public, anon, authenticated;
grant select, insert, update, delete on public.institution_engagements, public.institution_engagement_events to service_role;

-- There are intentionally no anon/authenticated policies. Future client-facing
-- operations need their own scoped policies and grants, reviewed together.
