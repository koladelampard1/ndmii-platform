alter table if exists associations
  add column if not exists status text default 'active',
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

alter table if exists compliance_profiles
  add column if not exists nin_checked_at timestamptz,
  add column if not exists bvn_checked_at timestamptz,
  add column if not exists cac_checked_at timestamptz,
  add column if not exists tin_checked_at timestamptz,
  add column if not exists validation_overridden_at timestamptz;
