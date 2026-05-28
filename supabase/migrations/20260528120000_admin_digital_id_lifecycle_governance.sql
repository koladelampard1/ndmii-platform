create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_role_check'
  ) then
    alter table public.users drop constraint users_role_check;
  end if;

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
      'auditor',
      'fccpc_officer',
      'nrs_officer',
      'firs_officer',
      'admin',
      'super_admin'
    ));
exception
  when undefined_table then
    null;
end $$;

alter table if exists public.digital_identity_credentials
  add column if not exists lifecycle_version integer not null default 0,
  add column if not exists lifecycle_reason text,
  add column if not exists lifecycle_source text,
  add column if not exists assigned_reviewer_id uuid references public.users(id) on delete set null,
  add column if not exists assigned_admin_id uuid references public.users(id) on delete set null,
  add column if not exists internal_notes text,
  add column if not exists renewal_requested_at timestamptz,
  add column if not exists renewal_requested_by uuid references public.users(id) on delete set null,
  add column if not exists regeneration_count integer not null default 0,
  add column if not exists last_regenerated_at timestamptz,
  add column if not exists token_invalidated_at timestamptz;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.digital_identity_credentials'::regclass
      and conname = 'digital_identity_credentials_status_check'
  ) then
    alter table public.digital_identity_credentials drop constraint digital_identity_credentials_status_check;
  end if;

  alter table public.digital_identity_credentials
    add constraint digital_identity_credentials_status_check
    check (status in ('pending', 'active', 'suspended', 'revoked', 'expired', 'renewal_pending'));
exception
  when undefined_table then
    null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.credential_events'::regclass
      and conname = 'credential_events_action_check'
  ) then
    alter table public.credential_events drop constraint credential_events_action_check;
  end if;

  alter table public.credential_events
    add constraint credential_events_action_check
    check (action in (
      'issued',
      'approved',
      'suspended',
      'revoked',
      'reissued',
      'verified',
      'expired',
      'renewal_requested',
      'note_saved',
      'assigned'
    ));
exception
  when undefined_table then
    null;
end $$;

create index if not exists idx_digital_identity_credentials_lifecycle_status
  on public.digital_identity_credentials(status, token_expires_at, updated_at desc);

create index if not exists idx_digital_identity_credentials_assigned_reviewer
  on public.digital_identity_credentials(assigned_reviewer_id, status)
  where assigned_reviewer_id is not null;

create index if not exists idx_digital_identity_credentials_regeneration
  on public.digital_identity_credentials(regeneration_count, last_regenerated_at desc);

create unique index if not exists idx_digital_identity_credentials_one_active_per_msme
  on public.digital_identity_credentials(msme_id)
  where status = 'active';

create or replace function public.enforce_digital_identity_lifecycle_governance()
returns trigger
language plpgsql
as $$
declare
  reason text;
begin
  if tg_op = 'INSERT' then
    if new.status is null then
      new.status := 'pending';
    end if;
    if new.status not in ('pending', 'active', 'suspended', 'revoked', 'expired', 'renewal_pending') then
      raise exception 'invalid_credential_lifecycle_status_%', new.status;
    end if;
    new.lifecycle_version := coalesce(new.lifecycle_version, 0);
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  reason := nullif(coalesce(new.lifecycle_reason, new.revocation_reason, ''), '');

  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'revoked_credentials_are_terminal';
  end if;

  if new.status in ('suspended', 'revoked') and reason is null then
    raise exception 'lifecycle_reason_required_for_%', new.status;
  end if;

  if old.status = 'pending' and new.status = 'revoked' and reason is null then
    raise exception 'pending_revocation_requires_review_reason';
  end if;

  if not (
    (old.status = 'pending' and new.status in ('active', 'revoked')) or
    (old.status = 'active' and new.status in ('suspended', 'revoked', 'expired', 'renewal_pending')) or
    (old.status = 'renewal_pending' and new.status = 'active') or
    (old.status = 'suspended' and new.status in ('active', 'revoked')) or
    (old.status = 'expired' and new.status = 'renewal_pending')
  ) then
    raise exception 'invalid_credential_transition_%_to_%', old.status, new.status;
  end if;

  new.lifecycle_version := coalesce(old.lifecycle_version, 0) + 1;
  return new;
end;
$$;

drop trigger if exists trg_digital_identity_lifecycle_governance on public.digital_identity_credentials;
create trigger trg_digital_identity_lifecycle_governance
before insert or update on public.digital_identity_credentials
for each row
execute function public.enforce_digital_identity_lifecycle_governance();

drop policy if exists "Credential regulators can write credentials" on public.digital_identity_credentials;
create policy "Credential regulators can write credentials"
on public.digital_identity_credentials
for update
using (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role in ('admin', 'super_admin', 'reviewer')
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role in ('admin', 'super_admin', 'reviewer')
  )
);

drop policy if exists "Credential regulators can read credential events" on public.credential_events;
create policy "Credential regulators can read credential events"
on public.credential_events
for select
using (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role in ('admin', 'super_admin', 'reviewer', 'fccpc_officer', 'firs_officer')
  )
);
