-- Harden provider quotes into a request -> offer -> accepted -> invoice workflow.

alter table if exists public.provider_quotes
  add column if not exists provider_service_id uuid references public.provider_services(id) on delete set null,
  add column if not exists service_title_snapshot text,
  add column if not exists service_category_snapshot text,
  add column if not exists service_pricing_mode_snapshot text,
  add column if not exists quoted_amount numeric(14,2),
  add column if not exists quoted_currency text not null default 'NGN',
  add column if not exists estimated_timeline text,
  add column if not exists quote_terms text,
  add column if not exists validity_days integer,
  add column if not exists provider_response_message text,
  add column if not exists quote_sent_at timestamptz,
  add column if not exists customer_decision_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.provider_quotes
set status = case
  when status = 'responded' then 'quoted'
  when status = 'pending_reviewed' then 'in_review'
  when status = 'submitted' then 'new'
  when status = 'won' then 'accepted'
  when status = 'lost' then 'declined'
  when status in ('new', 'in_review', 'quoted', 'accepted', 'declined', 'converted', 'closed') then status
  else 'new'
end
where status is distinct from case
  when status = 'responded' then 'quoted'
  when status = 'pending_reviewed' then 'in_review'
  when status = 'submitted' then 'new'
  when status = 'won' then 'accepted'
  when status = 'lost' then 'declined'
  when status in ('new', 'in_review', 'quoted', 'accepted', 'declined', 'converted', 'closed') then status
  else 'new'
end;

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
    and rel.relname = 'provider_quotes'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status in%';

  if constraint_name is not null then
    execute format('alter table public.provider_quotes drop constraint %I', constraint_name);
  end if;
end $$;

alter table if exists public.provider_quotes
  add constraint provider_quotes_status_check
  check (status in ('new', 'in_review', 'quoted', 'accepted', 'declined', 'converted', 'closed'));

alter table if exists public.provider_quotes
  drop constraint if exists provider_quotes_validity_days_check,
  add constraint provider_quotes_validity_days_check
  check (validity_days is null or validity_days between 1 and 365);

alter table if exists public.provider_quotes
  drop constraint if exists provider_quotes_quoted_amount_check,
  add constraint provider_quotes_quoted_amount_check
  check (quoted_amount is null or quoted_amount >= 0);

create index if not exists idx_provider_quotes_provider_service_id on public.provider_quotes(provider_service_id);
create index if not exists idx_provider_quotes_quote_sent_at on public.provider_quotes(quote_sent_at desc);
create index if not exists idx_provider_quotes_updated_at on public.provider_quotes(updated_at desc);

create table if not exists public.quote_status_history (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.provider_quotes(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.users(id) on delete set null,
  changed_by_role text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_status_history_quote_id on public.quote_status_history(quote_id);
create index if not exists idx_quote_status_history_created_at on public.quote_status_history(created_at desc);

insert into public.quote_status_history (quote_id, from_status, to_status, changed_by_role, note, created_at)
select pq.id, null, pq.status, 'system', 'Initial status captured during quote workflow hardening.', coalesce(pq.created_at, now())
from public.provider_quotes pq
where not exists (
  select 1
  from public.quote_status_history qsh
  where qsh.quote_id = pq.id
);

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
     or lower(u.email) = lower(auth.email())
  order by case when u.auth_user_id = auth.uid() then 0 else 1 end
  limit 1
$$;

create or replace function public.current_app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.id = public.current_app_user_id()
  limit 1
$$;

create or replace function public.current_user_is_quote_regulator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_user_role() in ('admin', 'fccpc_officer', 'reviewer'), false)
$$;

create or replace function public.current_user_owns_provider_quote(quote_provider_profile_id text)
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
    where p.id::text = quote_provider_profile_id
      and (
        u.auth_user_id = auth.uid()
        or lower(m.contact_email) = lower(auth.email())
      )
  )
$$;

alter table public.provider_quotes enable row level security;
alter table public.quote_invoice_links enable row level security;
alter table public.quote_status_history enable row level security;

drop policy if exists "Quote participants can read provider quotes" on public.provider_quotes;
create policy "Quote participants can read provider quotes"
on public.provider_quotes
for select
using (
  public.current_user_is_quote_regulator()
  or public.current_user_owns_provider_quote(provider_profile_id::text)
  or (requester_email is not null and lower(requester_email) = lower(auth.email()))
);

drop policy if exists "Provider owners can update provider quotes" on public.provider_quotes;
create policy "Provider owners can update provider quotes"
on public.provider_quotes
for update
using (
  public.current_user_is_quote_regulator()
  or public.current_user_owns_provider_quote(provider_profile_id::text)
)
with check (
  public.current_user_is_quote_regulator()
  or public.current_user_owns_provider_quote(provider_profile_id::text)
);

drop policy if exists "Provider owners can insert provider quotes" on public.provider_quotes;
create policy "Provider owners can insert provider quotes"
on public.provider_quotes
for insert
with check (
  public.current_user_is_quote_regulator()
  or public.current_user_owns_provider_quote(provider_profile_id::text)
  or (requester_email is not null and lower(requester_email) = lower(auth.email()))
);

drop policy if exists "Quote participants can read invoice links" on public.quote_invoice_links;
create policy "Quote participants can read invoice links"
on public.quote_invoice_links
for select
using (
  exists (
    select 1
    from public.provider_quotes pq
    where pq.id = quote_invoice_links.quote_id
      and (
        public.current_user_is_quote_regulator()
        or public.current_user_owns_provider_quote(pq.provider_profile_id::text)
        or (pq.requester_email is not null and lower(pq.requester_email) = lower(auth.email()))
      )
  )
);

drop policy if exists "Provider owners can insert invoice links" on public.quote_invoice_links;
create policy "Provider owners can insert invoice links"
on public.quote_invoice_links
for insert
with check (
  public.current_user_is_quote_regulator()
  or exists (
    select 1
    from public.provider_quotes pq
    where pq.id = quote_invoice_links.quote_id
      and public.current_user_owns_provider_quote(pq.provider_profile_id::text)
  )
);

drop policy if exists "Quote participants can read status history" on public.quote_status_history;
create policy "Quote participants can read status history"
on public.quote_status_history
for select
using (
  exists (
    select 1
    from public.provider_quotes pq
    where pq.id = quote_status_history.quote_id
      and (
        public.current_user_is_quote_regulator()
        or public.current_user_owns_provider_quote(pq.provider_profile_id::text)
        or (pq.requester_email is not null and lower(pq.requester_email) = lower(auth.email()))
      )
  )
);

drop policy if exists "Quote handlers can insert status history" on public.quote_status_history;
create policy "Quote handlers can insert status history"
on public.quote_status_history
for insert
with check (
  public.current_user_is_quote_regulator()
  or exists (
    select 1
    from public.provider_quotes pq
    where pq.id = quote_status_history.quote_id
      and public.current_user_owns_provider_quote(pq.provider_profile_id::text)
  )
);
