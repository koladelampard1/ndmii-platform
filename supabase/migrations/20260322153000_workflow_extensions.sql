alter table if exists msmes
  add column if not exists lga text,
  add column if not exists address text,
  add column if not exists business_type text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists review_status text default 'draft',
  add column if not exists reviewer_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists issued_at timestamptz;

alter table if exists compliance_profiles
  add column if not exists overall_status text default 'pending',
  add column if not exists nin_status text default 'pending',
  add column if not exists bvn_status text default 'pending',
  add column if not exists cac_status text default 'pending',
  add column if not exists tin_status text default 'pending',
  add column if not exists admin_override_status text,
  add column if not exists override_notes text,
  add column if not exists overridden_by uuid references users(id);

create table if not exists tax_profiles (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid references msmes(id) unique,
  tax_category text not null,
  vat_applicable boolean default true,
  estimated_monthly_obligation numeric(14,2) not null default 0,
  outstanding_amount numeric(14,2) not null default 0,
  compliance_status text default 'pending',
  created_at timestamptz default now()
);

alter table if exists payments
  add column if not exists receipt_reference text;
