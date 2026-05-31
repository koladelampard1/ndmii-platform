-- Associations Phase 3: controlled membership review and activation preparation.
-- This workflow never creates MSMEs, issues credentials, or activates members automatically.

alter table if exists public.association_members
  add column if not exists assigned_reviewer_id uuid references public.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists correction_reason text,
  add column if not exists internal_notes text,
  add column if not exists latest_review_reason text;

update public.association_members
set member_status = 'imported',
    updated_at = now()
where lower(coalesce(member_status, '')) = 'pending_activation';

alter table if exists public.association_members
  drop constraint if exists association_members_member_status_check;

alter table if exists public.association_members
  add constraint association_members_member_status_check
  check (member_status in (
    'imported', 'pending_review', 'approved', 'rejected', 'correction_requested',
    'duplicate_review', 'pending_activation', 'active', 'orphaned'
  ));

create index if not exists idx_association_members_assigned_reviewer
  on public.association_members(assigned_reviewer_id, member_status);
create index if not exists idx_association_members_imported_at
  on public.association_members(created_at desc);
create index if not exists idx_association_members_trade_lga
  on public.association_members(lower(trade_type), lower(lga));

create or replace function public.association_member_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.role
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    ),
    'public'
  );
$$;

create or replace function public.association_member_can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.association_member_current_role() in ('admin', 'reviewer', 'fccpc_officer', 'firs_officer');
$$;

create or replace function public.association_member_can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.association_member_current_role() in ('admin', 'reviewer');
$$;

create or replace function public.association_member_transition_allowed(from_status text, to_status text)
returns boolean
language sql
immutable
as $$
  select (lower(trim(coalesce(from_status, ''))), lower(trim(coalesce(to_status, '')))) in (
    ('imported', 'pending_review'),
    ('pending_review', 'approved'),
    ('pending_review', 'rejected'),
    ('pending_review', 'correction_requested'),
    ('pending_review', 'duplicate_review'),
    ('correction_requested', 'pending_review'),
    ('duplicate_review', 'approved'),
    ('duplicate_review', 'rejected'),
    ('approved', 'pending_activation')
  );
$$;

create or replace function public.enforce_association_member_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.member_status is distinct from old.member_status then
    if not public.association_member_transition_allowed(old.member_status, new.member_status) then
      raise exception 'Invalid association member transition from % to %', old.member_status, new.member_status
        using errcode = '23514';
    end if;
  end if;

  if new.member_status = 'rejected' and nullif(trim(coalesce(new.rejection_reason, '')), '') is null then
    raise exception 'Rejection reason is required' using errcode = '23514';
  end if;

  if new.member_status = 'correction_requested' and nullif(trim(coalesce(new.correction_reason, '')), '') is null then
    raise exception 'Correction reason is required' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_association_member_transition on public.association_members;
create trigger trg_enforce_association_member_transition
before update on public.association_members
for each row
execute function public.enforce_association_member_transition();

alter table public.association_members enable row level security;
alter table public.association_member_events enable row level security;

drop policy if exists "Association member reviewers can read" on public.association_members;
create policy "Association member reviewers can read"
on public.association_members for select
using (public.association_member_can_read());

drop policy if exists "Association member reviewers can update" on public.association_members;
create policy "Association member reviewers can update"
on public.association_members for update
using (public.association_member_can_write())
with check (public.association_member_can_write());

drop policy if exists "Association member reviewers can read events" on public.association_member_events;
create policy "Association member reviewers can read events"
on public.association_member_events for select
using (public.association_member_can_read());

drop policy if exists "Association member reviewers can insert events" on public.association_member_events;
create policy "Association member reviewers can insert events"
on public.association_member_events for insert
with check (public.association_member_can_write());
