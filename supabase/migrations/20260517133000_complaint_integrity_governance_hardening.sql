-- Complaint integrity and governance hardening for launch-safe workflows.
-- This migration is intentionally self-sufficient for production databases that
-- have partial complaint schemas. It only creates missing tables and adds
-- missing columns; it does not drop or rewrite existing complaint data.

create extension if not exists "pgcrypto";

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reference_code text,
  msme_id uuid,
  provider_msme_id text,
  provider_profile_id uuid,
  provider_id uuid,
  association_id uuid,
  complainant_name text,
  complainant_email text,
  complainant_phone text,
  complaint_type text,
  category text,
  severity text,
  status text default 'submitted',
  summary text,
  description text,
  resolution_summary text,
  assigned_to uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.complaint_messages (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid,
  sender_role text,
  sender_id uuid,
  message_body text,
  visibility text default 'shared',
  created_at timestamptz default now()
);

create table if not exists public.complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid,
  uploaded_by_role text,
  file_name text,
  file_url text,
  storage_path text,
  mime_type text,
  created_at timestamptz default now()
);

create table if not exists public.complaint_status_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid,
  from_status text,
  to_status text,
  changed_by_role text,
  changed_by uuid,
  note text,
  created_at timestamptz default now()
);

alter table if exists public.users
  add column if not exists auth_user_id uuid;

alter table public.complaints
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists reference_code text,
  add column if not exists complaint_reference text,
  add column if not exists msme_id uuid,
  add column if not exists provider_msme_id text,
  add column if not exists provider_profile_id uuid,
  add column if not exists provider_id uuid,
  add column if not exists association_id uuid,
  add column if not exists complainant_name text,
  add column if not exists complainant_email text,
  add column if not exists complainant_phone text,
  add column if not exists complaint_type text,
  add column if not exists complaint_category text,
  add column if not exists category text,
  add column if not exists title text,
  add column if not exists severity text,
  add column if not exists priority text default 'medium',
  add column if not exists status text default 'submitted',
  add column if not exists summary text,
  add column if not exists description text,
  add column if not exists resolution_summary text,
  add column if not exists related_reference text,
  add column if not exists preferred_contact_method text,
  add column if not exists regulator_target text,
  add column if not exists source_channel text,
  add column if not exists reporter_name text,
  add column if not exists reporter_email text,
  add column if not exists provider_business_name text,
  add column if not exists assigned_to uuid,
  add column if not exists assigned_officer_user_id uuid,
  add column if not exists assigned_admin_user_id uuid,
  add column if not exists assigned_association_user_id uuid,
  add column if not exists assigned_regulator_user_id uuid,
  add column if not exists investigation_notes text,
  add column if not exists state text,
  add column if not exists sector text,
  add column if not exists resolved_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists created_by_role text default 'system',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.complaint_messages
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists complaint_id uuid,
  add column if not exists sender_role text,
  add column if not exists sender_id uuid,
  add column if not exists message_body text,
  add column if not exists author_user_id uuid,
  add column if not exists author_role text,
  add column if not exists created_by_role text,
  add column if not exists message text,
  add column if not exists message_type text default 'response',
  add column if not exists visibility text default 'shared',
  add column if not exists attachment_url text,
  add column if not exists created_at timestamptz default now();

alter table public.complaint_attachments
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists complaint_id uuid,
  add column if not exists uploaded_by_role text,
  add column if not exists uploaded_by_user_id uuid,
  add column if not exists file_name text,
  add column if not exists file_url text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists visibility text default 'shared',
  add column if not exists created_at timestamptz default now();

alter table public.complaint_status_history
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists complaint_id uuid,
  add column if not exists from_status text,
  add column if not exists to_status text,
  add column if not exists changed_by_role text,
  add column if not exists changed_by uuid,
  add column if not exists changed_by_user_id uuid,
  add column if not exists note text,
  add column if not exists metadata jsonb,
  add column if not exists created_at timestamptz default now();

update public.complaints
set
  created_by_role = coalesce(created_by_role, 'system'),
  complaint_reference = coalesce(complaint_reference, reference_code),
  reference_code = coalesce(reference_code, complaint_reference),
  category = coalesce(category, complaint_category, complaint_type),
  priority = coalesce(priority, severity, 'medium'),
  updated_at = coalesce(updated_at, created_at, now());

update public.complaint_messages
set
  created_by_role = coalesce(created_by_role, author_role, sender_role),
  author_role = coalesce(author_role, sender_role),
  sender_role = coalesce(sender_role, author_role),
  author_user_id = coalesce(author_user_id, sender_id),
  sender_id = coalesce(sender_id, author_user_id),
  message = coalesce(message, message_body),
  message_body = coalesce(message_body, message);

update public.complaint_status_history
set changed_by_user_id = coalesce(changed_by_user_id, changed_by),
    changed_by = coalesce(changed_by, changed_by_user_id);

create index if not exists idx_complaints_reference_code on public.complaints(reference_code);
create index if not exists idx_complaints_complaint_reference on public.complaints(complaint_reference);
create index if not exists idx_complaints_msme_id on public.complaints(msme_id);
create index if not exists idx_complaints_provider_msme_id on public.complaints(provider_msme_id);
create index if not exists idx_complaints_provider_profile_id on public.complaints(provider_profile_id);
create index if not exists idx_complaints_provider_id on public.complaints(provider_id);
create index if not exists idx_complaints_association_id on public.complaints(association_id);
create index if not exists idx_complaints_status_created_at on public.complaints(status, created_at desc);
create index if not exists idx_complaint_messages_complaint_id on public.complaint_messages(complaint_id);
create index if not exists idx_complaint_attachments_complaint_id on public.complaint_attachments(complaint_id);
create index if not exists idx_complaint_status_history_complaint_id on public.complaint_status_history(complaint_id);

do $$
begin
  if to_regclass('public.msmes') is not null
     and not exists (select 1 from pg_constraint where conname = 'complaints_msme_id_fkey') then
    begin
      alter table public.complaints
        add constraint complaints_msme_id_fkey
        foreign key (msme_id) references public.msmes(id) on delete set null not valid;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.provider_profiles') is not null
     and not exists (select 1 from pg_constraint where conname = 'complaints_provider_profile_id_fkey') then
    begin
      alter table public.complaints
        add constraint complaints_provider_profile_id_fkey
        foreign key (provider_profile_id) references public.provider_profiles(id) on delete set null not valid;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.provider_profiles') is not null
     and not exists (select 1 from pg_constraint where conname = 'complaints_provider_id_fkey') then
    begin
      alter table public.complaints
        add constraint complaints_provider_id_fkey
        foreign key (provider_id) references public.provider_profiles(id) on delete set null not valid;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.associations') is not null
     and not exists (select 1 from pg_constraint where conname = 'complaints_association_id_fkey') then
    begin
      alter table public.complaints
        add constraint complaints_association_id_fkey
        foreign key (association_id) references public.associations(id) on delete set null not valid;
    exception when others then
      null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'complaint_messages_complaint_id_fkey') then
    begin
      alter table public.complaint_messages
        add constraint complaint_messages_complaint_id_fkey
        foreign key (complaint_id) references public.complaints(id) on delete cascade not valid;
    exception when others then
      null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'complaint_attachments_complaint_id_fkey') then
    begin
      alter table public.complaint_attachments
        add constraint complaint_attachments_complaint_id_fkey
        foreign key (complaint_id) references public.complaints(id) on delete cascade not valid;
    exception when others then
      null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'complaint_status_history_complaint_id_fkey') then
    begin
      alter table public.complaint_status_history
        add constraint complaint_status_history_complaint_id_fkey
        foreign key (complaint_id) references public.complaints(id) on delete cascade not valid;
    exception when others then
      null;
    end;
  end if;
end $$;

create or replace function public.set_complaints_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_complaints_updated_at on public.complaints;
create trigger trg_set_complaints_updated_at
before update on public.complaints
for each row
execute function public.set_complaints_updated_at();

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
     or lower(u.email) = lower(auth.email())
  order by case when u.auth_user_id = auth.uid() then 0 else 1 end
  limit 1
$$;

create or replace function public.current_app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.id = public.current_app_user_id()
  limit 1
$$;

create or replace function public.current_user_is_complaint_regulator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_user_role() in ('admin', 'fccpc_officer', 'reviewer'), false)
$$;

create or replace function public.current_user_owns_complaint_msme(
  complaint_msme_id text,
  complaint_provider_msme_id text,
  complaint_provider_profile_id text,
  complaint_provider_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.msmes m
    left join public.provider_profiles p on p.msme_id::text = m.id::text or p.msme_id::text = m.msme_id::text
    left join public.users u on u.id = m.created_by
    where (
      m.id::text = complaint_msme_id
      or m.msme_id::text = complaint_msme_id
      or m.id::text = complaint_provider_msme_id
      or m.msme_id::text = complaint_provider_msme_id
      or p.id::text = complaint_provider_profile_id
      or p.id::text = complaint_provider_id
    )
    and (
      u.auth_user_id = auth.uid()
      or lower(m.contact_email) = lower(auth.email())
    )
  )
$$;

create or replace function public.current_user_owns_complaint_association(complaint_association_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.associations a
    where a.id::text = complaint_association_id
      and a.officer_user_id = public.current_app_user_id()
  )
$$;

alter table public.complaints enable row level security;
alter table public.complaint_messages enable row level security;
alter table public.complaint_attachments enable row level security;
alter table public.complaint_status_history enable row level security;

drop policy if exists "Complaint participants can read complaints" on public.complaints;
create policy "Complaint participants can read complaints"
on public.complaints
for select
using (
  public.current_user_is_complaint_regulator()
  or public.current_user_owns_complaint_msme(msme_id::text, provider_msme_id::text, provider_profile_id::text, provider_id::text)
  or public.current_user_owns_complaint_association(association_id::text)
  or (complainant_email is not null and lower(complainant_email) = lower(auth.email()))
);

drop policy if exists "Complaint handlers can update complaints" on public.complaints;
create policy "Complaint handlers can update complaints"
on public.complaints
for update
using (
  public.current_user_is_complaint_regulator()
  or public.current_user_owns_complaint_msme(msme_id::text, provider_msme_id::text, provider_profile_id::text, provider_id::text)
  or public.current_user_owns_complaint_association(association_id::text)
)
with check (
  public.current_user_is_complaint_regulator()
  or public.current_user_owns_complaint_msme(msme_id::text, provider_msme_id::text, provider_profile_id::text, provider_id::text)
  or public.current_user_owns_complaint_association(association_id::text)
);

drop policy if exists "Complaint handlers can insert complaints" on public.complaints;
create policy "Complaint handlers can insert complaints"
on public.complaints
for insert
with check (
  public.current_user_is_complaint_regulator()
  or public.current_user_owns_complaint_msme(msme_id::text, provider_msme_id::text, provider_profile_id::text, provider_id::text)
  or public.current_user_owns_complaint_association(association_id::text)
);

drop policy if exists "Complaint participants can read messages" on public.complaint_messages;
create policy "Complaint participants can read messages"
on public.complaint_messages
for select
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_messages.complaint_id
      and (
        public.current_user_is_complaint_regulator()
        or public.current_user_owns_complaint_msme(c.msme_id::text, c.provider_msme_id::text, c.provider_profile_id::text, c.provider_id::text)
        or public.current_user_owns_complaint_association(c.association_id::text)
        or (c.complainant_email is not null and lower(c.complainant_email) = lower(auth.email()))
      )
  )
);

drop policy if exists "Complaint handlers can insert messages" on public.complaint_messages;
create policy "Complaint handlers can insert messages"
on public.complaint_messages
for insert
with check (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_messages.complaint_id
      and (
        public.current_user_is_complaint_regulator()
        or public.current_user_owns_complaint_msme(c.msme_id::text, c.provider_msme_id::text, c.provider_profile_id::text, c.provider_id::text)
        or public.current_user_owns_complaint_association(c.association_id::text)
        or (c.complainant_email is not null and lower(c.complainant_email) = lower(auth.email()))
      )
  )
);

drop policy if exists "Complaint participants can read attachments" on public.complaint_attachments;
create policy "Complaint participants can read attachments"
on public.complaint_attachments
for select
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_attachments.complaint_id
      and (
        public.current_user_is_complaint_regulator()
        or public.current_user_owns_complaint_msme(c.msme_id::text, c.provider_msme_id::text, c.provider_profile_id::text, c.provider_id::text)
        or public.current_user_owns_complaint_association(c.association_id::text)
        or (c.complainant_email is not null and lower(c.complainant_email) = lower(auth.email()))
      )
  )
);

drop policy if exists "Complaint handlers can insert attachments" on public.complaint_attachments;
create policy "Complaint handlers can insert attachments"
on public.complaint_attachments
for insert
with check (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_attachments.complaint_id
      and (
        public.current_user_is_complaint_regulator()
        or public.current_user_owns_complaint_msme(c.msme_id::text, c.provider_msme_id::text, c.provider_profile_id::text, c.provider_id::text)
        or public.current_user_owns_complaint_association(c.association_id::text)
        or (c.complainant_email is not null and lower(c.complainant_email) = lower(auth.email()))
      )
  )
);

drop policy if exists "Complaint participants can read status history" on public.complaint_status_history;
create policy "Complaint participants can read status history"
on public.complaint_status_history
for select
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_status_history.complaint_id
      and (
        public.current_user_is_complaint_regulator()
        or public.current_user_owns_complaint_msme(c.msme_id::text, c.provider_msme_id::text, c.provider_profile_id::text, c.provider_id::text)
        or public.current_user_owns_complaint_association(c.association_id::text)
        or (c.complainant_email is not null and lower(c.complainant_email) = lower(auth.email()))
      )
  )
);

drop policy if exists "Complaint handlers can insert status history" on public.complaint_status_history;
create policy "Complaint handlers can insert status history"
on public.complaint_status_history
for insert
with check (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_status_history.complaint_id
      and (
        public.current_user_is_complaint_regulator()
        or public.current_user_owns_complaint_msme(c.msme_id::text, c.provider_msme_id::text, c.provider_profile_id::text, c.provider_id::text)
        or public.current_user_owns_complaint_association(c.association_id::text)
        or (c.complainant_email is not null and lower(c.complainant_email) = lower(auth.email()))
      )
  )
);
