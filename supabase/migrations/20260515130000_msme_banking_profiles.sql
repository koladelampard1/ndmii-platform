-- MSME banking profile foundation.
-- Stores display-safe banking metadata for invoice, quotation, procurement, VAT, and future payout readiness.

create table if not exists public.msme_banking_profiles (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade unique,
  bank_name text not null,
  account_name text not null,
  account_number_masked text not null,
  account_number_last4 text not null,
  account_type text,
  currency text not null default 'NGN',
  swift_code text,
  sort_code text,
  vat_number text,
  preferred_payment_method text not null default 'bank_transfer',
  payout_enabled boolean not null default false,
  verification_status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint msme_banking_profiles_account_last4_check check (account_number_last4 ~ '^[0-9]{4}$'),
  constraint msme_banking_profiles_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint msme_banking_profiles_payment_method_check check (preferred_payment_method in ('bank_transfer', 'mobile_money', 'card', 'cheque')),
  constraint msme_banking_profiles_verification_status_check check (verification_status in ('pending_review', 'verified', 'changes_requested', 'rejected'))
);

alter table public.msme_banking_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists msme_id uuid,
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists account_number_masked text,
  add column if not exists account_number_last4 text,
  add column if not exists account_type text,
  add column if not exists currency text default 'NGN',
  add column if not exists swift_code text,
  add column if not exists sort_code text,
  add column if not exists vat_number text,
  add column if not exists preferred_payment_method text default 'bank_transfer',
  add column if not exists payout_enabled boolean default false,
  add column if not exists verification_status text default 'pending_review',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.msme_banking_profiles
set
  currency = coalesce(currency, 'NGN'),
  preferred_payment_method = coalesce(preferred_payment_method, 'bank_transfer'),
  payout_enabled = coalesce(payout_enabled, false),
  verification_status = coalesce(verification_status, 'pending_review'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.msme_banking_profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.msme_banking_profiles
      add constraint msme_banking_profiles_pkey primary key (id);
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.msme_banking_profiles
    where msme_id is not null
    group by msme_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add unique msme_banking_profiles.msme_id constraint while duplicate MSME banking profiles exist';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.msme_banking_profiles'::regclass
      and conname = 'msme_banking_profiles_msme_id_key'
  ) then
    alter table public.msme_banking_profiles
      add constraint msme_banking_profiles_msme_id_key unique (msme_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.msme_banking_profiles'::regclass
      and conname = 'msme_banking_profiles_msme_id_fkey'
  ) then
    alter table public.msme_banking_profiles
      add constraint msme_banking_profiles_msme_id_fkey
      foreign key (msme_id) references public.msmes(id) on delete cascade;
  end if;
end;
$$;

alter table public.msme_banking_profiles
  alter column id set not null,
  alter column msme_id set not null,
  alter column bank_name set not null,
  alter column account_name set not null,
  alter column account_number_masked set not null,
  alter column account_number_last4 set not null,
  alter column currency set not null,
  alter column preferred_payment_method set not null,
  alter column payout_enabled set not null,
  alter column verification_status set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.msme_banking_profiles'::regclass
      and conname = 'msme_banking_profiles_account_last4_check'
  ) then
    alter table public.msme_banking_profiles
      add constraint msme_banking_profiles_account_last4_check check (account_number_last4 ~ '^[0-9]{4}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.msme_banking_profiles'::regclass
      and conname = 'msme_banking_profiles_currency_check'
  ) then
    alter table public.msme_banking_profiles
      add constraint msme_banking_profiles_currency_check check (currency ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.msme_banking_profiles'::regclass
      and conname = 'msme_banking_profiles_payment_method_check'
  ) then
    alter table public.msme_banking_profiles
      add constraint msme_banking_profiles_payment_method_check check (preferred_payment_method in ('bank_transfer', 'mobile_money', 'card', 'cheque'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.msme_banking_profiles'::regclass
      and conname = 'msme_banking_profiles_verification_status_check'
  ) then
    alter table public.msme_banking_profiles
      add constraint msme_banking_profiles_verification_status_check check (verification_status in ('pending_review', 'verified', 'changes_requested', 'rejected'));
  end if;
end;
$$;

create index if not exists idx_msme_banking_profiles_msme_id on public.msme_banking_profiles(msme_id);
create index if not exists idx_msme_banking_profiles_verification_status on public.msme_banking_profiles(verification_status);

create or replace function public.set_msme_banking_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_msme_banking_profiles_updated_at on public.msme_banking_profiles;
create trigger set_msme_banking_profiles_updated_at
before update on public.msme_banking_profiles
for each row
execute function public.set_msme_banking_profiles_updated_at();

alter table public.msme_banking_profiles enable row level security;

drop policy if exists "MSME owners can view own banking profile" on public.msme_banking_profiles;
create policy "MSME owners can view own banking profile"
on public.msme_banking_profiles
for select
using (
  exists (
    select 1
    from public.msmes m
    join public.users u on u.id = m.created_by
    where m.id = msme_banking_profiles.msme_id
      and u.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.msmes m
    where m.id = msme_banking_profiles.msme_id
      and lower(m.contact_email) = lower(auth.email())
  )
  or exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role in ('admin', 'reviewer', 'firs_officer')
  )
);

drop policy if exists "MSME owners can insert own banking profile" on public.msme_banking_profiles;
create policy "MSME owners can insert own banking profile"
on public.msme_banking_profiles
for insert
with check (
  exists (
    select 1
    from public.msmes m
    join public.users u on u.id = m.created_by
    where m.id = msme_banking_profiles.msme_id
      and u.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.msmes m
    where m.id = msme_banking_profiles.msme_id
      and lower(m.contact_email) = lower(auth.email())
  )
);

drop policy if exists "MSME owners can update own editable banking profile" on public.msme_banking_profiles;
create policy "MSME owners can update own editable banking profile"
on public.msme_banking_profiles
for update
using (
  exists (
    select 1
    from public.msmes m
    join public.users u on u.id = m.created_by
    where m.id = msme_banking_profiles.msme_id
      and u.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.msmes m
    where m.id = msme_banking_profiles.msme_id
      and lower(m.contact_email) = lower(auth.email())
  )
)
with check (
  exists (
    select 1
    from public.msmes m
    join public.users u on u.id = m.created_by
    where m.id = msme_banking_profiles.msme_id
      and u.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.msmes m
    where m.id = msme_banking_profiles.msme_id
      and lower(m.contact_email) = lower(auth.email())
  )
);
