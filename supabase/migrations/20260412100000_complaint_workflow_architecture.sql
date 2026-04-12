-- Complaint workflow architecture hardening.

alter table if exists complaints
  add column if not exists complaint_reference text,
  add column if not exists provider_msme_id uuid references msmes(id),
  add column if not exists association_id uuid references associations(id),
  add column if not exists complainant_name text,
  add column if not exists complainant_email text,
  add column if not exists complainant_phone text,
  add column if not exists category text,
  add column if not exists title text,
  add column if not exists preferred_contact_method text,
  add column if not exists priority text default 'medium',
  add column if not exists assigned_admin_user_id uuid references users(id),
  add column if not exists assigned_association_user_id uuid references users(id),
  add column if not exists assigned_regulator_user_id uuid references users(id),
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz default now();

update complaints c
set
  complaint_reference = coalesce(c.complaint_reference, 'CMP-' || to_char(c.created_at::date, 'YYYYMMDD') || '-' || upper(substr(replace(c.id::text, '-', ''), 1, 6))),
  provider_msme_id = coalesce(c.provider_msme_id, c.msme_id, p.msme_id),
  association_id = coalesce(c.association_id, m.association_id),
  complainant_name = coalesce(c.complainant_name, c.reporter_name, 'Public Reporter'),
  complainant_email = coalesce(c.complainant_email, c.reporter_email),
  category = coalesce(c.category, c.complaint_category, c.complaint_type, 'marketplace_report'),
  title = coalesce(c.title, c.summary, left(c.description, 120), 'Complaint report'),
  preferred_contact_method = coalesce(c.preferred_contact_method, case when c.reporter_email is not null then 'email' else 'phone' end, 'email'),
  status = case when c.status in ('open', 'new') then 'submitted' else c.status end,
  priority = coalesce(c.priority, c.severity, 'medium'),
  updated_at = coalesce(c.updated_at, c.created_at, now())
from provider_profiles p
left join msmes m on m.id = coalesce(c.msme_id, p.msme_id)
where c.provider_profile_id = p.id;

create unique index if not exists idx_complaints_reference_unique on complaints(complaint_reference);
create index if not exists idx_complaints_provider_msme_id on complaints(provider_msme_id);
create index if not exists idx_complaints_association_id on complaints(association_id);
create index if not exists idx_complaints_status_created_at on complaints(status, created_at desc);

create table if not exists complaint_messages (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  author_user_id uuid references users(id),
  author_role text,
  message text not null,
  message_type text not null default 'response',
  visibility text not null default 'shared' check (visibility in ('shared', 'internal')),
  attachment_url text,
  created_at timestamptz not null default now()
);

create table if not exists complaint_status_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by_user_id uuid references users(id),
  changed_by_role text,
  note text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  uploaded_by_user_id uuid references users(id),
  visibility text not null default 'shared' check (visibility in ('shared', 'internal')),
  file_url text not null,
  file_name text,
  created_at timestamptz not null default now()
);

insert into complaint_status_history (complaint_id, from_status, to_status, changed_by_role, note)
select c.id, null, c.status, 'system', 'Backfilled initial status record'
from complaints c
where not exists (
  select 1 from complaint_status_history h where h.complaint_id = c.id
);

create or replace function set_complaints_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_complaints_updated_at on complaints;
create trigger trg_set_complaints_updated_at
before update on complaints
for each row
execute function set_complaints_updated_at();
