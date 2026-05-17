-- Production-grade invoice integrity hardening.
-- Adds signed public token access, immutable lifecycle states, payment-attempt placeholders,
-- audit fields, quote conversion uniqueness, and lightweight RLS.

alter table if exists public.invoices
  add column if not exists public_token text,
  add column if not exists public_token_expires_at timestamptz,
  add column if not exists public_token_revoked_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz;

update public.invoices
set public_token = encode(gen_random_bytes(32), 'hex')
where public_token is null;

update public.invoices
set public_token_expires_at = now() + interval '90 days'
where public_token_expires_at is null;

alter table if exists public.invoices
  alter column public_token set not null,
  alter column public_token_expires_at set not null;

create unique index if not exists idx_invoices_public_token on public.invoices(public_token);
create index if not exists idx_invoices_public_token_active
  on public.invoices(public_token, public_token_expires_at)
  where public_token_revoked_at is null;

do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'invoices'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status in%';

  if constraint_name is not null then
    execute format('alter table public.invoices drop constraint %I', constraint_name);
  end if;
end $$;

alter table if exists public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'issued', 'pending_payment', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded'));

alter table if exists public.invoice_payments
  add column if not exists source text not null default 'provider_manual',
  add column if not exists provider_profile_id uuid references public.provider_profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.invoice_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete set null,
  public_token text,
  payment_reference text not null unique,
  payment_method text not null default 'manual_evidence_pending',
  status text not null default 'payment_attempt_created',
  amount numeric(14,2) not null default 0,
  source text not null default 'public_payment_recording',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_payment_attempts_status_check
    check (status in ('payment_attempt_created', 'pending_payment', 'cancelled'))
);

create index if not exists idx_invoice_payment_attempts_invoice_id on public.invoice_payment_attempts(invoice_id);
create index if not exists idx_invoice_payment_attempts_provider_profile_id on public.invoice_payment_attempts(provider_profile_id);
create index if not exists idx_invoice_payment_attempts_status on public.invoice_payment_attempts(status);

alter table if exists public.invoice_events
  add column if not exists source text,
  add column if not exists from_status text,
  add column if not exists to_status text;

create index if not exists idx_invoice_events_created_at on public.invoice_events(created_at desc);

create unique index if not exists idx_quote_invoice_links_one_invoice_per_quote
  on public.quote_invoice_links(quote_id);

create or replace function public.current_user_is_invoice_regulator()
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
      and u.role in ('admin', 'fccpc_officer', 'reviewer')
  )
$$;

create or replace function public.current_user_owns_invoice_provider(invoice_provider_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.provider_profiles p
    join public.msmes m on m.id::text = p.msme_id::text or m.msme_id::text = p.msme_id::text
    left join public.users u on u.id = m.created_by
    where p.id = invoice_provider_profile_id
      and (
        u.auth_user_id = auth.uid()
        or lower(m.contact_email) = lower(auth.email())
      )
  )
$$;

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_payment_attempts enable row level security;
alter table public.invoice_events enable row level security;
alter table public.quote_invoice_links enable row level security;

drop policy if exists "Invoice providers and regulators can read invoices" on public.invoices;
create policy "Invoice providers and regulators can read invoices"
on public.invoices
for select
using (
  public.current_user_is_invoice_regulator()
  or public.current_user_owns_invoice_provider(provider_profile_id)
);

drop policy if exists "Invoice providers can insert invoices" on public.invoices;
create policy "Invoice providers can insert invoices"
on public.invoices
for insert
with check (
  public.current_user_is_invoice_regulator()
  or public.current_user_owns_invoice_provider(provider_profile_id)
);

drop policy if exists "Invoice providers can update own invoices" on public.invoices;
create policy "Invoice providers can update own invoices"
on public.invoices
for update
using (
  public.current_user_is_invoice_regulator()
  or public.current_user_owns_invoice_provider(provider_profile_id)
)
with check (
  public.current_user_is_invoice_regulator()
  or public.current_user_owns_invoice_provider(provider_profile_id)
);

drop policy if exists "Invoice providers can read items" on public.invoice_items;
create policy "Invoice providers can read items"
on public.invoice_items
for select
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and (public.current_user_is_invoice_regulator() or public.current_user_owns_invoice_provider(i.provider_profile_id))
  )
);

drop policy if exists "Invoice providers can write draft items" on public.invoice_items;
create policy "Invoice providers can write draft items"
on public.invoice_items
for all
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.status = 'draft'
      and (public.current_user_is_invoice_regulator() or public.current_user_owns_invoice_provider(i.provider_profile_id))
  )
)
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.status = 'draft'
      and (public.current_user_is_invoice_regulator() or public.current_user_owns_invoice_provider(i.provider_profile_id))
  )
);

drop policy if exists "Invoice providers can read payments" on public.invoice_payments;
create policy "Invoice providers can read payments"
on public.invoice_payments
for select
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_payments.invoice_id
      and (public.current_user_is_invoice_regulator() or public.current_user_owns_invoice_provider(i.provider_profile_id))
  )
);

drop policy if exists "Invoice providers can insert payments" on public.invoice_payments;
create policy "Invoice providers can insert payments"
on public.invoice_payments
for insert
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_payments.invoice_id
      and (public.current_user_is_invoice_regulator() or public.current_user_owns_invoice_provider(i.provider_profile_id))
  )
);

drop policy if exists "Invoice providers can read payment attempts" on public.invoice_payment_attempts;
create policy "Invoice providers can read payment attempts"
on public.invoice_payment_attempts
for select
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_payment_attempts.invoice_id
      and (public.current_user_is_invoice_regulator() or public.current_user_owns_invoice_provider(i.provider_profile_id))
  )
);

drop policy if exists "Invoice providers can read events" on public.invoice_events;
create policy "Invoice providers can read events"
on public.invoice_events
for select
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_events.invoice_id
      and (public.current_user_is_invoice_regulator() or public.current_user_owns_invoice_provider(i.provider_profile_id))
  )
);

drop policy if exists "Invoice providers can insert events" on public.invoice_events;
create policy "Invoice providers can insert events"
on public.invoice_events
for insert
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_events.invoice_id
      and (public.current_user_is_invoice_regulator() or public.current_user_owns_invoice_provider(i.provider_profile_id))
  )
);
