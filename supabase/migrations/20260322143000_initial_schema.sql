create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('public','msme','association_officer','reviewer','fccpc_officer','firs_officer','admin')),
  created_at timestamptz default now()
);

create table if not exists associations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  sector text not null,
  officer_user_id uuid references users(id),
  created_at timestamptz default now()
);

create table if not exists msmes (
  id uuid primary key default gen_random_uuid(),
  msme_id text unique not null,
  business_name text not null,
  owner_name text not null,
  state text not null,
  sector text not null,
  nin text,
  bvn text,
  cac_number text,
  tin text,
  verification_status text default 'pending',
  association_id uuid references associations(id),
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid references msmes(id),
  complaint_type text not null,
  description text not null,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid references msmes(id),
  amount numeric(14,2) not null,
  tax_type text not null,
  status text default 'simulated_paid',
  payment_date date default current_date,
  created_at timestamptz default now()
);

create table if not exists compliance_profiles (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid references msmes(id),
  score integer not null check (score between 0 and 100),
  risk_level text not null,
  last_reviewed_at timestamptz default now()
);

create table if not exists manufacturer_profiles (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid references msmes(id),
  product_category text not null,
  traceability_code text unique not null,
  standards_status text not null,
  created_at timestamptz default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
