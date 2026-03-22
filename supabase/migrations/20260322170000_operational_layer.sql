alter table if exists msmes
  add column if not exists flagged boolean default false,
  add column if not exists suspended boolean default false,
  add column if not exists enforcement_note text,
  add column if not exists compliance_tag text default 'partially compliant';

alter table if exists complaints
  add column if not exists summary text,
  add column if not exists severity text default 'medium',
  add column if not exists assigned_officer_user_id uuid references users(id),
  add column if not exists state text,
  add column if not exists sector text,
  add column if not exists investigation_notes text,
  add column if not exists closed_at timestamptz;

update complaints c
set summary = coalesce(c.summary, left(c.description, 120)),
    state = coalesce(c.state, m.state),
    sector = coalesce(c.sector, m.sector)
from msmes m
where c.msme_id = m.id;

alter table if exists tax_profiles
  add column if not exists arrears_status text default 'none',
  add column if not exists compliance_score integer default 70,
  add column if not exists last_reminder_at timestamptz,
  add column if not exists last_reviewed_at timestamptz;

alter table if exists associations
  add column if not exists lga_coverage text,
  add column if not exists profile text;

create table if not exists association_members (
  id uuid primary key default gen_random_uuid(),
  association_id uuid references associations(id) not null,
  msme_id uuid references msmes(id) not null,
  member_status text default 'pending',
  is_verified boolean default false,
  created_at timestamptz default now(),
  unique (association_id, msme_id)
);

alter table if exists manufacturer_profiles
  add column if not exists inspection_status text default 'pending',
  add column if not exists counterfeit_risk_flag boolean default false,
  add column if not exists compliance_badge text default 'silver';

create table if not exists manufacturer_products (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid references manufacturer_profiles(id) not null,
  product_name text not null,
  product_code text not null,
  verification_status text default 'verified',
  risk_flag boolean default false,
  created_at timestamptz default now()
);

insert into association_members (association_id, msme_id, member_status, is_verified)
select a.id, m.id,
  case when m.verification_status = 'verified' then 'active' else 'pending' end,
  m.verification_status = 'verified'
from associations a
join msmes m on m.state = a.state and m.sector = a.sector
on conflict (association_id, msme_id) do nothing;

insert into manufacturer_products (manufacturer_id, product_name, product_code, verification_status, risk_flag)
select mp.id,
  m.business_name || ' Core Product',
  mp.traceability_code || '-A',
  'verified',
  false
from manufacturer_profiles mp
join msmes m on m.id = mp.msme_id
on conflict do nothing;
