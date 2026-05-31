-- Associations Phase 4: controlled invitation and onboarding pipeline.
-- Raw invitation tokens are never persisted. This phase does not create MSMEs or issue credentials.

create extension if not exists pgcrypto;

create table if not exists public.association_member_invitations (
  id uuid primary key default gen_random_uuid(),
  association_member_id uuid not null references public.association_members(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  token_hash text not null unique,
  token_expires_at timestamptz not null,
  status text not null default 'generated'
    check (status in ('generated', 'sent', 'opened', 'accepted', 'expired')),
  sent_channel text,
  sent_to_masked text,
  opened_at timestamptz,
  accepted_at timestamptz,
  expired_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table if exists public.association_members
  drop constraint if exists association_members_activation_state_check;

alter table if exists public.association_members
  add constraint association_members_activation_state_check
  check (activation_state in (
    'imported', 'invited', 'invite_opened', 'account_created',
    'onboarding_started', 'onboarding_completed', 'credential_issued'
  ));

create index if not exists idx_association_member_invitations_member_created
  on public.association_member_invitations(association_member_id, created_at desc);
create index if not exists idx_association_member_invitations_association_created
  on public.association_member_invitations(association_id, created_at desc);
create index if not exists idx_association_member_invitations_status_expiry
  on public.association_member_invitations(status, token_expires_at);

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
    ('approved', 'pending_activation'),
    ('pending_activation', 'active')
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

  if new.member_status = 'active' and new.activation_state <> 'onboarding_completed' then
    raise exception 'Member activation requires completed onboarding' using errcode = '23514';
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

alter table public.association_member_invitations enable row level security;

drop policy if exists "Association member invitation readers" on public.association_member_invitations;
create policy "Association member invitation readers"
on public.association_member_invitations for select
using (public.association_member_can_read());

drop policy if exists "Association member invitation administrators insert" on public.association_member_invitations;
create policy "Association member invitation administrators insert"
on public.association_member_invitations for insert
with check (public.association_member_current_role() = 'admin');

drop policy if exists "Association member invitation administrators update" on public.association_member_invitations;
create policy "Association member invitation administrators update"
on public.association_member_invitations for update
using (public.association_member_current_role() = 'admin')
with check (public.association_member_current_role() = 'admin');
