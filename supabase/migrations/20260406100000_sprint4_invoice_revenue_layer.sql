-- Sprint 4: Transaction, invoice, VAT, and revenue layer

create table if not exists provider_quotes (
  id uuid primary key default gen_random_uuid(),
  provider_profile_id uuid not null references provider_profiles(id) on delete cascade,
  requester_name text not null,
  requester_email text,
  requester_phone text,
  request_summary text not null,
  request_details text,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  status text not null default 'new' check (status in ('new', 'in_review', 'quoted', 'converted', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_provider_quotes_provider_profile_id on provider_quotes(provider_profile_id);
create index if not exists idx_provider_quotes_status on provider_quotes(status);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  provider_profile_id uuid not null references provider_profiles(id) on delete cascade,
  msme_id uuid not null references msmes(id) on delete cascade,
  invoice_number text not null unique,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  currency text not null default 'NGN',
  subtotal numeric(14,2) not null default 0,
  vat_rate numeric(5,2) not null default 7.5,
  vat_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'issued', 'pending_payment', 'paid', 'overdue', 'cancelled')),
  due_date date,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_provider_profile_id on invoices(provider_profile_id);
create index if not exists idx_invoices_msme_id on invoices(msme_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_due_date on invoices(due_date);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  item_name text not null,
  description text,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  vat_applicable boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_items_invoice_id on invoice_items(invoice_id);

create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  payment_reference text not null unique,
  payment_method text not null default 'card',
  payment_status text not null default 'initiated' check (payment_status in ('initiated', 'pending', 'success', 'failed', 'refunded')),
  amount numeric(14,2) not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_payments_invoice_id on invoice_payments(invoice_id);
create index if not exists idx_invoice_payments_status on invoice_payments(payment_status);

create table if not exists invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  event_type text not null,
  actor_role text,
  actor_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_events_invoice_id on invoice_events(invoice_id);
create index if not exists idx_invoice_events_event_type on invoice_events(event_type);

create table if not exists quote_invoice_links (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references provider_quotes(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(quote_id, invoice_id)
);

create index if not exists idx_quote_invoice_links_quote_id on quote_invoice_links(quote_id);
create index if not exists idx_quote_invoice_links_invoice_id on quote_invoice_links(invoice_id);

insert into provider_quotes (
  provider_profile_id,
  requester_name,
  requester_email,
  requester_phone,
  request_summary,
  request_details,
  budget_min,
  budget_max,
  status,
  created_at
)
select
  pqr.provider_id,
  pqr.customer_name,
  case when position('@' in pqr.customer_contact) > 0 then pqr.customer_contact else null end,
  case when position('@' in pqr.customer_contact) > 0 then null else pqr.customer_contact end,
  left(pqr.service_details, 120),
  pqr.service_details,
  null,
  null,
  case pqr.status
    when 'responded' then 'quoted'
    when 'in_review' then 'in_review'
    when 'closed' then 'closed'
    else 'new'
  end,
  pqr.created_at
from provider_quote_requests pqr
where not exists (
  select 1 from provider_quotes pq
  where pq.provider_profile_id = pqr.provider_id
    and pq.requester_name = pqr.customer_name
    and coalesce(pq.request_details, '') = coalesce(pqr.service_details, '')
);

with provider_seed as (
  select p.id as provider_id, p.msme_id, p.display_name, m.owner_name, m.contact_email, m.phone_number,
         row_number() over (order by p.created_at asc) as rn
  from provider_profiles p
  join msmes m on m.id = p.msme_id
)
insert into invoices (
  provider_profile_id,
  msme_id,
  invoice_number,
  customer_name,
  customer_email,
  customer_phone,
  currency,
  subtotal,
  vat_rate,
  vat_amount,
  total_amount,
  status,
  due_date,
  issued_at,
  paid_at,
  created_at,
  updated_at
)
select
  ps.provider_id,
  ps.msme_id,
  'NDMII-INV-' || to_char(now() - make_interval(days => ps.rn::int), 'YYYYMMDD') || '-' || lpad(ps.rn::text, 4, '0'),
  ps.owner_name,
  ps.contact_email,
  ps.phone_number,
  'NGN',
  250000 + (ps.rn * 5000),
  7.5,
  round((250000 + (ps.rn * 5000)) * 0.075, 2),
  round((250000 + (ps.rn * 5000)) * 1.075, 2),
  case when ps.rn % 3 = 0 then 'pending_payment' when ps.rn % 4 = 0 then 'draft' else 'paid' end,
  current_date + ((ps.rn % 14) + 3),
  now() - make_interval(days => ((ps.rn % 6) + 1)::int),
  case when ps.rn % 3 = 0 or ps.rn % 4 = 0 then null else now() - make_interval(days => (ps.rn % 2)::int) end,
  now() - make_interval(days => ((ps.rn % 8) + 1)::int),
  now() - make_interval(days => ((ps.rn % 4))::int)
from provider_seed ps
where ps.rn <= 18
  and not exists (
    select 1 from invoices i
    where i.provider_profile_id = ps.provider_id
      and i.invoice_number like 'NDMII-INV-%'
  );

insert into invoice_items (invoice_id, item_name, description, quantity, unit_price, line_total, vat_applicable)
select i.id,
  'Service package',
  'Verified professional service delivery package for NDMII marketplace transaction.',
  1,
  i.subtotal,
  i.subtotal,
  true
from invoices i
where i.invoice_number like 'NDMII-INV-%'
  and not exists (select 1 from invoice_items ii where ii.invoice_id = i.id);

insert into invoice_payments (invoice_id, payment_reference, payment_method, payment_status, amount, paid_at, created_at)
select
  i.id,
  'PMT-' || replace(i.id::text, '-', ''),
  case when random() > 0.5 then 'card' else 'bank_transfer' end,
  case when i.status = 'paid' then 'success' else 'pending' end,
  i.total_amount,
  i.paid_at,
  coalesce(i.paid_at, i.created_at)
from invoices i
where i.invoice_number like 'NDMII-INV-%'
  and i.status in ('paid', 'pending_payment')
  and not exists (select 1 from invoice_payments ip where ip.invoice_id = i.id);

insert into invoice_events (invoice_id, event_type, actor_role, actor_id, metadata, created_at)
select
  i.id,
  'invoice_seeded',
  'system',
  'migration_sprint4',
  jsonb_build_object('status', i.status, 'invoice_number', i.invoice_number),
  i.created_at
from invoices i
where i.invoice_number like 'NDMII-INV-%'
  and not exists (select 1 from invoice_events e where e.invoice_id = i.id and e.event_type = 'invoice_seeded');
