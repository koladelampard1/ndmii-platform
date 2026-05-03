alter table if exists msmes
  add column if not exists registration_path text;

alter table if exists msmes
  alter column verification_status set default 'verified';

update msmes
set
  registration_path = coalesce(registration_path, 'legacy'),
  verification_status = case
    when verification_status in ('rejected', 'suspended') then verification_status
    else 'verified'
  end
where registration_path is null;

create table if not exists association_memberships (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations(id) on delete cascade,
  msme_id uuid not null references msmes(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  membership_type text not null check (membership_type in ('existing_member', 'join_request')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (association_id, msme_id)
);

create index if not exists idx_association_memberships_association_status
  on association_memberships(association_id, approval_status);

create index if not exists idx_association_memberships_msme_id
  on association_memberships(msme_id);
