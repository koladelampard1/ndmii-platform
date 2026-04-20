alter table if exists associations
  add column if not exists category text,
  add column if not exists type text,
  add column if not exists contact_person_name text,
  add column if not exists location text,
  add column if not exists logo_url text,
  add column if not exists created_by_admin_id uuid references users(id),
  add column if not exists updated_at timestamptz not null default now();

update associations
set
  category = coalesce(category, sector, 'General'),
  location = coalesce(location, state, 'Unknown'),
  status = upper(coalesce(status, 'ACTIVE'))
where true;

alter table if exists associations
  alter column status set default 'ACTIVE';

alter table if exists association_members
  add column if not exists role text not null default 'MEMBER' check (role in ('MEMBER', 'ASSOCIATION_ADMIN')),
  add column if not exists invite_status text not null default 'INVITED' check (invite_status in ('INVITED', 'ACTIVATED', 'FAILED', 'ALREADY_EXISTS')),
  add column if not exists invite_token text,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists created_by_admin_id uuid references users(id);

create index if not exists idx_association_members_invite_status on association_members(invite_status);
create index if not exists idx_association_members_invite_token on association_members(invite_token);
create index if not exists idx_associations_created_by_admin_id on associations(created_by_admin_id);

alter table if exists association_member_import_rows
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists location text,
  add column if not exists association_member_id text,
  add column if not exists cac_number text,
  add column if not exists tin text,
  add column if not exists address text;
