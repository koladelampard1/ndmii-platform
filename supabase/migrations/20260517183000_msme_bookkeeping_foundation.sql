-- MSME bookkeeping foundation.
-- Source-linked financial evidence layer for DBIN MSMEs. This is intentionally
-- lightweight and does not implement double-entry accounting.

create table if not exists public.bookkeeping_periods (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete set null,
  period_month date not null,
  status text not null default 'open',
  closed_by uuid references public.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookkeeping_periods_status_check check (status in ('open', 'closed')),
  constraint bookkeeping_periods_month_start_check check (period_month = date_trunc('month', period_month)::date),
  unique (msme_id, period_month)
);

create table if not exists public.bookkeeping_entries (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete set null,
  period_id uuid references public.bookkeeping_periods(id) on delete set null,
  entry_type text not null,
  category text not null,
  amount numeric(14,2) not null,
  currency text not null default 'NGN',
  transaction_date date not null default current_date,
  description text,
  source_type text not null default 'manual',
  source_id uuid,
  vat_applicable boolean not null default false,
  vat_amount numeric(14,2) not null default 0,
  status text not null default 'posted',
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookkeeping_entries_type_check check (entry_type in ('income', 'expense')),
  constraint bookkeeping_entries_source_type_check check (source_type in ('manual', 'invoice', 'payment', 'refund', 'tax')),
  constraint bookkeeping_entries_status_check check (status in ('draft', 'posted', 'void')),
  constraint bookkeeping_entries_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint bookkeeping_entries_amount_check check (amount >= 0),
  constraint bookkeeping_entries_vat_amount_check check (vat_amount >= 0)
);

create table if not exists public.bookkeeping_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.bookkeeping_entries(id) on delete cascade,
  msme_id uuid not null references public.msmes(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete set null,
  attachment_type text not null default 'receipt',
  bucket_id text not null default 'bookkeeping-evidence',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size integer not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  constraint bookkeeping_attachments_type_check check (attachment_type in ('receipt', 'invoice', 'payment_evidence', 'other')),
  constraint bookkeeping_attachments_size_check check (file_size > 0 and file_size <= 10485760)
);

create table if not exists public.bookkeeping_events (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.bookkeeping_entries(id) on delete cascade,
  msme_id uuid references public.msmes(id) on delete cascade,
  action text not null,
  actor_role text,
  actor_id uuid references public.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bookkeeping_periods_msme_month on public.bookkeeping_periods(msme_id, period_month desc);
create index if not exists idx_bookkeeping_periods_provider on public.bookkeeping_periods(provider_profile_id);
create index if not exists idx_bookkeeping_entries_msme_date on public.bookkeeping_entries(msme_id, transaction_date desc);
create index if not exists idx_bookkeeping_entries_provider_date on public.bookkeeping_entries(provider_profile_id, transaction_date desc);
create index if not exists idx_bookkeeping_entries_source on public.bookkeeping_entries(source_type, source_id);
create index if not exists idx_bookkeeping_entries_period on public.bookkeeping_entries(period_id);
create index if not exists idx_bookkeeping_attachments_entry on public.bookkeeping_attachments(entry_id);
create index if not exists idx_bookkeeping_attachments_msme on public.bookkeeping_attachments(msme_id);
create index if not exists idx_bookkeeping_events_entry on public.bookkeeping_events(entry_id, created_at desc);
create index if not exists idx_bookkeeping_events_msme on public.bookkeeping_events(msme_id, created_at desc);

create or replace function public.set_bookkeeping_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bookkeeping_periods_updated_at on public.bookkeeping_periods;
create trigger trg_bookkeeping_periods_updated_at
before update on public.bookkeeping_periods
for each row
execute function public.set_bookkeeping_updated_at();

drop trigger if exists trg_bookkeeping_entries_updated_at on public.bookkeeping_entries;
create trigger trg_bookkeeping_entries_updated_at
before update on public.bookkeeping_entries
for each row
execute function public.set_bookkeeping_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bookkeeping-evidence',
  'bookkeeping-evidence',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

create or replace function public.current_user_is_bookkeeping_regulator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role in ('admin', 'reviewer', 'fccpc_officer')
  )
$$;

create or replace function public.current_user_owns_bookkeeping_msme(target_msme_id uuid, target_provider_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.msmes m
    left join public.users u on u.id = m.created_by
    where m.id = target_msme_id
      and (
        u.auth_user_id = auth.uid()
        or lower(m.contact_email) = lower(auth.email())
      )
  )
  or exists (
    select 1
    from public.provider_profiles p
    join public.msmes m on m.id::text = p.msme_id::text or m.msme_id::text = p.msme_id::text
    left join public.users u on u.id = m.created_by
    where p.id = target_provider_profile_id
      and (
        u.auth_user_id = auth.uid()
        or lower(m.contact_email) = lower(auth.email())
      )
  )
$$;

alter table public.bookkeeping_periods enable row level security;
alter table public.bookkeeping_entries enable row level security;
alter table public.bookkeeping_attachments enable row level security;
alter table public.bookkeeping_events enable row level security;

drop policy if exists "Bookkeeping owners and regulators can read periods" on public.bookkeeping_periods;
create policy "Bookkeeping owners and regulators can read periods"
on public.bookkeeping_periods
for select
using (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, provider_profile_id)
);

drop policy if exists "Bookkeeping owners can write periods" on public.bookkeeping_periods;
create policy "Bookkeeping owners can write periods"
on public.bookkeeping_periods
for all
using (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, provider_profile_id)
)
with check (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, provider_profile_id)
);

drop policy if exists "Bookkeeping owners and regulators can read entries" on public.bookkeeping_entries;
create policy "Bookkeeping owners and regulators can read entries"
on public.bookkeeping_entries
for select
using (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, provider_profile_id)
);

drop policy if exists "Bookkeeping owners can write entries" on public.bookkeeping_entries;
create policy "Bookkeeping owners can write entries"
on public.bookkeeping_entries
for all
using (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, provider_profile_id)
)
with check (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, provider_profile_id)
);

drop policy if exists "Bookkeeping owners and regulators can read attachments" on public.bookkeeping_attachments;
create policy "Bookkeeping owners and regulators can read attachments"
on public.bookkeeping_attachments
for select
using (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, provider_profile_id)
);

drop policy if exists "Bookkeeping owners can write attachments" on public.bookkeeping_attachments;
create policy "Bookkeeping owners can write attachments"
on public.bookkeeping_attachments
for all
using (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, provider_profile_id)
)
with check (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, provider_profile_id)
);

drop policy if exists "Bookkeeping owners and regulators can read events" on public.bookkeeping_events;
create policy "Bookkeeping owners and regulators can read events"
on public.bookkeeping_events
for select
using (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, null)
);

drop policy if exists "Bookkeeping owners can insert events" on public.bookkeeping_events;
create policy "Bookkeeping owners can insert events"
on public.bookkeeping_events
for insert
with check (
  public.current_user_is_bookkeeping_regulator()
  or public.current_user_owns_bookkeeping_msme(msme_id, null)
);

drop policy if exists "Bookkeeping evidence owners can read storage objects" on storage.objects;
create policy "Bookkeeping evidence owners can read storage objects"
on storage.objects
for select
using (
  bucket_id = 'bookkeeping-evidence'
  and (
    public.current_user_is_bookkeeping_regulator()
    or exists (
      select 1
      from public.bookkeeping_attachments a
      where a.bucket_id = storage.objects.bucket_id
        and a.storage_path = storage.objects.name
        and public.current_user_owns_bookkeeping_msme(a.msme_id, a.provider_profile_id)
    )
  )
);

drop policy if exists "Bookkeeping evidence owners can write storage objects" on storage.objects;
create policy "Bookkeeping evidence owners can write storage objects"
on storage.objects
for insert
with check (
  bucket_id = 'bookkeeping-evidence'
  and (
    public.current_user_is_bookkeeping_regulator()
    or exists (
      select 1
      from public.msmes m
      left join public.users u on u.id = m.created_by
      where m.id::text = (storage.foldername(name))[1]
        and (
          u.auth_user_id = auth.uid()
          or lower(m.contact_email) = lower(auth.email())
        )
    )
  )
);
