create extension if not exists pgcrypto;

create table if not exists public.digital_identity_credentials (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  ndmii_id text not null,
  issued_at timestamptz not null default now(),
  qr_code_ref text,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'revoked')),
  validation_snapshot jsonb,
  public_token text,
  public_token_hash text,
  public_signature text,
  token_expires_at timestamptz,
  signature_version integer not null default 1,
  approved_at timestamptz,
  approved_by uuid references public.users(id),
  revoked_at timestamptz,
  revoked_by uuid references public.users(id),
  revocation_reason text,
  suspended_at timestamptz,
  suspended_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (msme_id),
  unique (ndmii_id)
);

create unique index if not exists idx_digital_identity_credentials_public_token
  on public.digital_identity_credentials(public_token)
  where public_token is not null;

create unique index if not exists idx_digital_identity_credentials_public_token_hash
  on public.digital_identity_credentials(public_token_hash)
  where public_token_hash is not null;

create index if not exists idx_digital_identity_credentials_token_status
  on public.digital_identity_credentials(status, token_expires_at, revoked_at);

create index if not exists idx_digital_identity_credentials_msme_status
  on public.digital_identity_credentials(msme_id, status);

create table if not exists public.credential_events (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.digital_identity_credentials(id) on delete cascade,
  action text not null check (action in ('issued', 'approved', 'suspended', 'revoked', 'reissued', 'verified')),
  actor_role text,
  actor_id uuid references public.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_credential_events_credential_id_created_at
  on public.credential_events(credential_id, created_at desc);

create index if not exists idx_credential_events_action_created_at
  on public.credential_events(action, created_at desc);

alter table public.digital_identity_credentials enable row level security;
alter table public.credential_events enable row level security;

drop policy if exists "Credential owners and regulators can read credentials" on public.digital_identity_credentials;
create policy "Credential owners and regulators can read credentials"
on public.digital_identity_credentials
for select
using (
  exists (
    select 1
    from public.users u
    left join public.msmes m on m.id = digital_identity_credentials.msme_id
    where u.auth_user_id = auth.uid()
      and (
        u.role in ('admin', 'reviewer', 'fccpc_officer', 'firs_officer')
        or m.created_by = u.id
      )
  )
);

drop policy if exists "Credential owners can create pending credentials" on public.digital_identity_credentials;
create policy "Credential owners can create pending credentials"
on public.digital_identity_credentials
for insert
with check (
  status = 'pending'
  and exists (
    select 1
    from public.users u
    join public.msmes m on m.id = digital_identity_credentials.msme_id
    where u.auth_user_id = auth.uid()
      and m.created_by = u.id
  )
);

drop policy if exists "Credential regulators can write credentials" on public.digital_identity_credentials;
create policy "Credential regulators can write credentials"
on public.digital_identity_credentials
for update
using (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role in ('admin', 'reviewer')
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role in ('admin', 'reviewer')
  )
);

drop policy if exists "Credential owners can refresh pending credentials" on public.digital_identity_credentials;
create policy "Credential owners can refresh pending credentials"
on public.digital_identity_credentials
for update
using (
  status = 'pending'
  and exists (
    select 1
    from public.users u
    join public.msmes m on m.id = digital_identity_credentials.msme_id
    where u.auth_user_id = auth.uid()
      and m.created_by = u.id
  )
)
with check (
  status = 'pending'
  and exists (
    select 1
    from public.users u
    join public.msmes m on m.id = digital_identity_credentials.msme_id
    where u.auth_user_id = auth.uid()
      and m.created_by = u.id
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
      and u.role in ('admin', 'reviewer', 'fccpc_officer', 'firs_officer')
  )
);

drop policy if exists "Authenticated users can insert credential events" on public.credential_events;
create policy "Authenticated users can insert credential events"
on public.credential_events
for insert
with check (auth.uid() is not null);

alter table if exists public.msmes
  add column if not exists passport_photo_path text;

with msme_credential_source as (
  select
    m.id as msme_row_id,
    coalesce(nullif(m.msme_id, ''), 'BIN-' || upper(left(coalesce(nullif(m.state, ''), 'LAG'), 3)) || '-' || right(replace(m.id::text, '-', ''), 9)) as ndmii_id,
    coalesce(m.issued_at, m.created_at, now()) as issued_at,
    case
      when coalesce(m.suspended, false) then 'suspended'
      when m.review_status = 'approved' or m.verification_status = 'verified' then 'active'
      else 'pending'
    end as credential_status,
    case
      when m.review_status = 'approved' or m.verification_status = 'verified' then coalesce(m.issued_at, m.created_at, now())
      else null
    end as approved_at,
    coalesce(m.created_at, now()) as created_at
  from public.msmes m
  where not exists (
    select 1
    from public.digital_identity_credentials c
    where c.msme_id = m.id
  )
)
insert into public.digital_identity_credentials (
  msme_id,
  ndmii_id,
  issued_at,
  qr_code_ref,
  status,
  validation_snapshot,
  public_token,
  public_token_hash,
  token_expires_at,
  signature_version,
  approved_at,
  created_at,
  updated_at
)
select
  source.msme_row_id,
  source.ndmii_id,
  source.issued_at,
  null,
  source.credential_status,
  null,
  encode(gen_random_bytes(32), 'hex'),
  null,
  now() + interval '1 year',
  1,
  source.approved_at,
  source.created_at,
  now()
from msme_credential_source source;

update public.digital_identity_credentials
set
  public_token = coalesce(public_token, encode(gen_random_bytes(32), 'hex')),
  token_expires_at = coalesce(token_expires_at, now() + interval '1 year'),
  signature_version = coalesce(signature_version, 1)
where public_token is null
   or token_expires_at is null
   or signature_version is null;

update public.digital_identity_credentials
set public_token_hash = encode(digest(public_token, 'sha256'), 'hex')
where public_token is not null
  and public_token_hash is null;

update public.digital_identity_credentials
set public_signature = encode(hmac(public_token_hash || ':' || ndmii_id || ':' || signature_version::text, current_setting('app.jwt_secret', true), 'sha256'), 'hex')
where public_token_hash is not null
  and public_signature is null
  and nullif(current_setting('app.jwt_secret', true), '') is not null;

update public.digital_identity_credentials
set qr_code_ref = '/verify/c/' || public_token
where public_token is not null
  and (qr_code_ref is null or qr_code_ref not like '/verify/c/%');

update public.digital_identity_credentials
set status = 'pending'
where status not in ('pending', 'active', 'suspended', 'revoked');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'msme-passports',
  'msme-passports',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
