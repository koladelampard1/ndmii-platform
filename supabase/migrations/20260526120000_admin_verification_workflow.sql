-- Admin verification workflow Phase 2.
-- Human reviewer workspace only: no OCR, AI, external sanctions/API calls,
-- automated approvals, enforcement actions, or public publishing.

create extension if not exists "pgcrypto";

create table if not exists public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  status text not null default 'pending_review',
  assigned_reviewer_id uuid references public.users(id) on delete set null,
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  escalation_reason text,
  rejection_reason text,
  requested_documents jsonb not null default '[]'::jsonb,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verification_reviews_status_check check (status in ('pending_review', 'under_review', 'awaiting_documents', 'escalated', 'verified', 'rejected')),
  constraint verification_reviews_requested_documents_array_check check (jsonb_typeof(requested_documents) = 'array'),
  constraint verification_reviews_rejection_reason_check check (status <> 'rejected' or nullif(trim(coalesce(rejection_reason, '')), '') is not null),
  constraint verification_reviews_escalation_reason_check check (status <> 'escalated' or nullif(trim(coalesce(escalation_reason, '')), '') is not null)
);

create table if not exists public.verification_review_events (
  id uuid primary key default gen_random_uuid(),
  verification_review_id uuid not null references public.verification_reviews(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.users(id) on delete set null,
  actor_role text,
  previous_status text,
  new_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint verification_review_events_previous_status_check check (previous_status is null or previous_status in ('pending_review', 'under_review', 'awaiting_documents', 'escalated', 'verified', 'rejected')),
  constraint verification_review_events_new_status_check check (new_status is null or new_status in ('pending_review', 'under_review', 'awaiting_documents', 'escalated', 'verified', 'rejected'))
);

create table if not exists public.verification_review_comments (
  id uuid primary key default gen_random_uuid(),
  verification_review_id uuid not null references public.verification_reviews(id) on delete cascade,
  visibility text not null default 'internal',
  comment text not null,
  actor_id uuid references public.users(id) on delete set null,
  actor_role text,
  created_at timestamptz not null default now(),
  constraint verification_review_comments_visibility_check check (visibility in ('internal')),
  constraint verification_review_comments_comment_check check (nullif(trim(comment), '') is not null)
);

create unique index if not exists verification_reviews_one_per_msme_idx
  on public.verification_reviews(msme_id);
create index if not exists verification_reviews_status_idx
  on public.verification_reviews(status, updated_at desc);
create index if not exists verification_reviews_assigned_idx
  on public.verification_reviews(assigned_reviewer_id, status);
create index if not exists verification_review_events_review_idx
  on public.verification_review_events(verification_review_id, created_at desc);
create index if not exists verification_review_comments_review_idx
  on public.verification_review_comments(verification_review_id, created_at desc);

create or replace function public.set_verification_review_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_verification_reviews_updated_at on public.verification_reviews;
create trigger trg_verification_reviews_updated_at
before update on public.verification_reviews
for each row
execute function public.set_verification_review_updated_at();

create or replace function public.verification_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (
      select u.role
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    ),
    'public'
  );
$$;

create or replace function public.verification_can_read_reviews()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.verification_current_role() in ('admin', 'reviewer', 'fccpc_officer', 'firs_officer'), false);
$$;

create or replace function public.verification_can_write_reviews()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.verification_current_role() in ('admin', 'reviewer'), false);
$$;

create or replace function public.verification_transition_allowed(from_status text, to_status text)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select
      regexp_replace(lower(trim(coalesce(from_status, ''))), '[^a-z0-9]+', '_', 'g') as from_status,
      regexp_replace(lower(trim(coalesce(to_status, ''))), '[^a-z0-9]+', '_', 'g') as to_status
  )
  select (from_status, to_status) in (
      ('pending_review', 'under_review'),
      ('under_review', 'awaiting_documents'),
      ('under_review', 'verified'),
      ('under_review', 'rejected'),
      ('under_review', 'escalated'),
      ('awaiting_documents', 'under_review'),
      ('rejected', 'under_review'),
      ('verified', 'under_review'),
      ('escalated', 'under_review')
    )
  from normalized;
$$;

create or replace function public.enforce_verification_review_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not public.verification_transition_allowed(old.status, new.status) then
      raise exception 'Invalid verification review transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'verified' and new.started_at is null then
    raise exception 'Verification must be under review before being marked verified'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_verification_review_transition on public.verification_reviews;
create trigger trg_enforce_verification_review_transition
before update on public.verification_reviews
for each row
execute function public.enforce_verification_review_transition();

alter table public.verification_reviews enable row level security;
alter table public.verification_review_events enable row level security;
alter table public.verification_review_comments enable row level security;

drop policy if exists "Verification reviewers can read reviews" on public.verification_reviews;
create policy "Verification reviewers can read reviews"
on public.verification_reviews
for select
using (public.verification_can_read_reviews());

drop policy if exists "Verification reviewers can insert reviews" on public.verification_reviews;
create policy "Verification reviewers can insert reviews"
on public.verification_reviews
for insert
with check (public.verification_can_write_reviews());

drop policy if exists "Verification reviewers can update reviews" on public.verification_reviews;
create policy "Verification reviewers can update reviews"
on public.verification_reviews
for update
using (public.verification_can_write_reviews())
with check (public.verification_can_write_reviews());

drop policy if exists "Verification reviewers can read review events" on public.verification_review_events;
create policy "Verification reviewers can read review events"
on public.verification_review_events
for select
using (public.verification_can_read_reviews());

drop policy if exists "Verification reviewers can insert review events" on public.verification_review_events;
create policy "Verification reviewers can insert review events"
on public.verification_review_events
for insert
with check (public.verification_can_write_reviews());

drop policy if exists "Verification reviewers can read review comments" on public.verification_review_comments;
create policy "Verification reviewers can read review comments"
on public.verification_review_comments
for select
using (public.verification_can_read_reviews());

drop policy if exists "Verification reviewers can insert review comments" on public.verification_review_comments;
create policy "Verification reviewers can insert review comments"
on public.verification_review_comments
for insert
with check (public.verification_can_write_reviews());
