-- Sprint 3: Provider Operations Layer foundation

create table if not exists provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  category text not null,
  specialization text,
  title text not null,
  short_description text not null,
  pricing_mode text not null default 'fixed' check (pricing_mode in ('fixed', 'range', 'negotiable')),
  min_price numeric(14,2),
  max_price numeric(14,2),
  turnaround_time text,
  vat_applicable boolean not null default false,
  availability_status text not null default 'available' check (availability_status in ('available', 'limited', 'unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_services_provider_id on provider_services(provider_id);
create index if not exists idx_provider_services_category on provider_services(category);

alter table provider_gallery
  add column if not exists is_featured boolean not null default false;

alter table provider_gallery
  add column if not exists updated_at timestamptz not null default now();

create table if not exists provider_quote_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  customer_name text not null,
  customer_contact text not null,
  service_details text not null,
  requested_date date,
  status text not null default 'new' check (status in ('new', 'in_review', 'responded', 'closed')),
  provider_response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_quote_requests_provider_id on provider_quote_requests(provider_id);
create index if not exists idx_provider_quote_requests_status on provider_quote_requests(status);

create table if not exists association_member_imports (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations(id) on delete cascade,
  uploaded_by uuid references users(id) on delete set null,
  file_name text,
  total_rows integer not null default 0,
  success_rows integer not null default 0,
  failed_rows integer not null default 0,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists association_member_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references association_member_imports(id) on delete cascade,
  row_number integer not null,
  member_name text,
  email text,
  phone text,
  business_name text,
  state text,
  lga text,
  sector text,
  status text not null default 'pending' check (status in ('pending', 'imported', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_association_member_imports_association_id on association_member_imports(association_id);
create index if not exists idx_association_member_import_rows_import_id on association_member_import_rows(import_id);

insert into provider_services (provider_id, category, specialization, title, short_description, pricing_mode, min_price, max_price, turnaround_time, vat_applicable, availability_status)
select
  p.id,
  coalesce(c.name, 'Professional Services') as category,
  ps.specialization,
  p.display_name || ' Core Service',
  coalesce(p.short_description, 'Verified NDMII service delivery package.'),
  'range',
  50000,
  250000,
  '5-10 business days',
  true,
  'available'
from provider_profiles p
left join provider_categories pc on pc.provider_id = p.id
left join service_categories c on c.id = pc.category_id
left join lateral (
  select specialization
  from provider_specializations sp
  where sp.provider_id = p.id
  order by sp.created_at asc
  limit 1
) ps on true
where not exists (
  select 1 from provider_services s where s.provider_id = p.id
);

-- Keep demo MSME accounts easy to test for ownership mapping.
update msmes m
set created_by = u.id
from users u
where u.role = 'msme'
  and m.created_by is null
  and m.contact_email is not null
  and lower(m.contact_email) = lower(u.email);

insert into provider_profiles (msme_id, display_name, slug, short_description, long_description, logo_url, passport_url, trust_score, is_featured)
select
  m.id,
  m.business_name,
  lower(regexp_replace(m.business_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || right(m.msme_id, 4),
  'Verified NDMII provider in ' || m.state || ' delivering trusted marketplace services.',
  m.business_name || ' is enabled for provider operations and quote response workflows on NDMII.',
  m.passport_photo_url,
  m.passport_photo_url,
  84,
  false
from msmes m
where m.created_by is not null
  and not exists (select 1 from provider_profiles p where p.msme_id = m.id)
on conflict (msme_id) do nothing;
