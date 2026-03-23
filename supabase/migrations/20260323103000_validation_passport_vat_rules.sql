alter table if exists msmes
  add column if not exists passport_photo_url text;

alter table if exists compliance_profiles
  add column if not exists nin_response_summary text,
  add column if not exists bvn_response_summary text,
  add column if not exists cac_response_summary text,
  add column if not exists tin_response_summary text;

create table if not exists vat_rules (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  vat_percent numeric(5,2) not null default 7.50,
  applies_to text not null default 'service',
  status text not null default 'active',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into vat_rules (category, vat_percent, applies_to, status, notes)
values
  ('General goods', 7.50, 'product', 'active', 'Default VAT simulation category.'),
  ('Essential food products', 2.50, 'product', 'active', 'Reduced VAT relief simulation.'),
  ('Professional services', 10.00, 'service', 'active', 'High-value service simulation.'),
  ('Agricultural processing', 5.00, 'service', 'active', 'Supportive sector VAT rate.')
on conflict (category) do nothing;
