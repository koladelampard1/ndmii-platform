-- Associations Phase 4C: fast-track account access with per-member temporary PINs.
-- Raw PINs are never persisted. This does not verify MSMEs or issue digital credentials.

create extension if not exists pgcrypto;

create table if not exists public.association_member_access_credentials (
  id uuid primary key default gen_random_uuid(),
  association_member_id uuid not null unique references public.association_members(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  login_phone_normalized text,
  login_email text,
  temporary_pin_hash text not null,
  temporary_pin_expires_at timestamptz not null,
  must_change_password boolean not null default true,
  first_login_completed_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed', 'expired', 'revoked')),
  auth_user_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (login_phone_normalized is not null or login_email is not null)
);

create table if not exists public.association_member_access_notifications (
  id uuid primary key default gen_random_uuid(),
  association_member_access_credential_id uuid not null references public.association_member_access_credentials(id) on delete cascade,
  association_member_id uuid not null references public.association_members(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  channel text not null default 'printed_access_slip'
    check (channel in ('sms', 'whatsapp', 'email', 'printed_access_slip', 'manual')),
  status text not null default 'pending_manual'
    check (status in ('pending_manual', 'queued', 'sent', 'failed')),
  destination_masked text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table if exists public.association_members
  add column if not exists access_status text,
  add column if not exists access_pin_expires_at timestamptz,
  add column if not exists access_first_login_completed_at timestamptz,
  add column if not exists access_notification_status text;

create index if not exists idx_association_member_access_credentials_login_phone
  on public.association_member_access_credentials(login_phone_normalized);
create index if not exists idx_association_member_access_credentials_login_email
  on public.association_member_access_credentials(lower(login_email));
create index if not exists idx_association_member_access_credentials_status_expiry
  on public.association_member_access_credentials(status, temporary_pin_expires_at);
create index if not exists idx_association_member_access_notifications_member_created
  on public.association_member_access_notifications(association_member_id, created_at desc);
create index if not exists idx_association_members_access_status
  on public.association_members(access_status, access_pin_expires_at);

alter table public.association_member_access_credentials enable row level security;
alter table public.association_member_access_notifications enable row level security;

drop policy if exists "Association member access credential readers" on public.association_member_access_credentials;
create policy "Association member access credential readers"
on public.association_member_access_credentials for select
using (public.association_member_can_read());

drop policy if exists "Association member access credential administrators insert" on public.association_member_access_credentials;
create policy "Association member access credential administrators insert"
on public.association_member_access_credentials for insert
with check (public.association_member_current_role() = 'admin');

drop policy if exists "Association member access credential administrators update" on public.association_member_access_credentials;
create policy "Association member access credential administrators update"
on public.association_member_access_credentials for update
using (public.association_member_current_role() = 'admin')
with check (public.association_member_current_role() = 'admin');

drop policy if exists "Association member access notification readers" on public.association_member_access_notifications;
create policy "Association member access notification readers"
on public.association_member_access_notifications for select
using (public.association_member_can_read());

drop policy if exists "Association member access notification administrators insert" on public.association_member_access_notifications;
create policy "Association member access notification administrators insert"
on public.association_member_access_notifications for insert
with check (public.association_member_current_role() = 'admin');

