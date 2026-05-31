create extension if not exists pgcrypto;

create table if not exists public.association_member_imports (
  id uuid primary key default gen_random_uuid(),
  association_id uuid,
  filename text,
  status text,
  total_rows integer default 0,
  valid_rows integer default 0,
  invalid_rows integer default 0,
  duplicate_rows integer default 0,
  created_count integer default 0,
  uploaded_by uuid,
  uploaded_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.association_member_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid,
  association_id uuid,
  row_number integer,
  status text,
  raw_payload jsonb default '{}'::jsonb,
  validation_errors jsonb default '[]'::jsonb,
  duplicate_reasons jsonb default '[]'::jsonb,
  member_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.association_member_events (
  id uuid primary key default gen_random_uuid(),
  association_id uuid,
  member_id uuid,
  event_type text,
  actor_id uuid,
  actor_role text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table if exists public.association_member_imports
  add column if not exists association_id uuid,
  add column if not exists filename text,
  add column if not exists file_name text,
  add column if not exists status text,
  add column if not exists total_rows integer default 0,
  add column if not exists valid_rows integer default 0,
  add column if not exists invalid_rows integer default 0,
  add column if not exists success_rows integer default 0,
  add column if not exists failed_rows integer default 0,
  add column if not exists duplicate_rows integer default 0,
  add column if not exists created_count integer default 0,
  add column if not exists created_rows integer default 0,
  add column if not exists updated_rows integer default 0,
  add column if not exists uploaded_by uuid,
  add column if not exists uploaded_at timestamptz default now(),
  add column if not exists notes text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.association_member_import_rows
  drop constraint if exists association_member_import_rows_status_check;

alter table if exists public.association_member_import_rows
  add column if not exists import_id uuid,
  add column if not exists association_id uuid,
  add column if not exists row_number integer,
  add column if not exists status text,
  add column if not exists raw_payload jsonb default '{}'::jsonb,
  add column if not exists validation_errors jsonb default '[]'::jsonb,
  add column if not exists duplicate_reasons jsonb default '[]'::jsonb,
  add column if not exists member_id uuid,
  add column if not exists association_member_id uuid,
  add column if not exists member_name text,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists phone_number text,
  add column if not exists phone_normalized text,
  add column if not exists whatsapp_number text,
  add column if not exists business_name text,
  add column if not exists state text,
  add column if not exists lga text,
  add column if not exists sector text,
  add column if not exists trade_type text,
  add column if not exists error_message text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists location text,
  add column if not exists cac_number text,
  add column if not exists tin text,
  add column if not exists address text,
  add column if not exists association_membership_number text,
  add column if not exists position_in_association text,
  add column if not exists cac_registered boolean,
  add column if not exists tin_registered boolean,
  add column if not exists tin_number text,
  add column if not exists workshop_address text,
  add column if not exists years_of_experience integer,
  add column if not exists duplicate_signal boolean default false,
  add column if not exists validated_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.association_member_events
  add column if not exists association_id uuid,
  add column if not exists member_id uuid,
  add column if not exists association_member_id uuid,
  add column if not exists import_id uuid,
  add column if not exists import_row_id uuid,
  add column if not exists event_type text,
  add column if not exists actor_id uuid,
  add column if not exists actor_user_id uuid,
  add column if not exists actor_role text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

alter table if exists public.association_members
  add column if not exists association_id uuid,
  add column if not exists msme_id uuid,
  add column if not exists member_status text default 'imported';

alter table if exists public.association_members
  drop constraint if exists association_members_invite_status_check;

alter table if exists public.association_members
  add column if not exists full_name text,
  add column if not exists phone_number text,
  add column if not exists phone_normalized text,
  add column if not exists whatsapp_number text,
  add column if not exists email text,
  add column if not exists business_name text,
  add column if not exists trade_type text,
  add column if not exists lga text,
  add column if not exists association_membership_number text,
  add column if not exists position_in_association text,
  add column if not exists cac_registered boolean default false,
  add column if not exists cac_number text,
  add column if not exists tin_registered boolean default false,
  add column if not exists tin_number text,
  add column if not exists workshop_address text,
  add column if not exists years_of_experience integer,
  add column if not exists is_verified boolean default false,
  add column if not exists invite_status text default 'PENDING',
  add column if not exists created_by_admin_id uuid,
  add column if not exists role text default 'member',
  add column if not exists source_import_id uuid,
  add column if not exists source_import_row_id uuid,
  add column if not exists source_row_number integer,
  add column if not exists duplicate_signal boolean default false,
  add column if not exists duplicate_reasons text[] default '{}',
  add column if not exists activation_state text default 'imported',
  add column if not exists status_changed_at timestamptz,
  add column if not exists updated_at timestamptz default now();

do $$
declare
  missing_columns text[];
begin
  select array_agg(required_column order by required_column)
  into missing_columns
  from unnest(array[
    'association_id',
    'msme_id',
    'full_name',
    'phone_number',
    'phone_normalized',
    'whatsapp_number',
    'email',
    'business_name',
    'trade_type',
    'lga',
    'association_membership_number',
    'position_in_association',
    'cac_registered',
    'cac_number',
    'tin_registered',
    'tin_number',
    'workshop_address',
    'years_of_experience',
    'source_import_id',
    'source_import_row_id',
    'source_row_number',
    'member_status',
    'is_verified',
    'invite_status',
    'duplicate_signal',
    'duplicate_reasons',
    'activation_state',
    'status_changed_at',
    'updated_at',
    'created_by_admin_id',
    'role'
  ]) as required(required_column)
  where not exists (
    select 1
    from information_schema.columns existing
    where existing.table_schema = 'public'
      and existing.table_name = 'association_members'
      and existing.column_name = required.required_column
  );

  if missing_columns is not null then
    raise exception 'association_members is missing required operational columns: %', array_to_string(missing_columns, ', ');
  end if;
end $$;

do $$
begin
  if to_regclass('public.association_members') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'association_members'
        and column_name = 'msme_id'
    ) then
      alter table public.association_members alter column msme_id drop not null;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'association_members'
        and column_name = 'member_status'
    ) then
      alter table public.association_members alter column member_status set default 'imported';
    end if;

    update public.association_members
    set
      member_status = case
        when lower(coalesce(member_status, '')) = 'pending' then 'pending_activation'
        when lower(coalesce(member_status, '')) in ('active', 'rejected') then lower(member_status)
        when lower(coalesce(member_status, '')) = 'duplicate_review' then 'duplicate_review'
        else coalesce(nullif(lower(member_status), ''), 'imported')
      end,
      activation_state = coalesce(nullif(lower(activation_state), ''), 'imported'),
      updated_at = now();
  end if;
end $$;

alter table if exists public.association_member_imports enable row level security;
alter table if exists public.association_member_import_rows enable row level security;
alter table if exists public.association_member_events enable row level security;

create index if not exists idx_association_member_imports_association_id
  on public.association_member_imports(association_id);
create index if not exists idx_association_member_imports_status
  on public.association_member_imports(status);
create index if not exists idx_association_member_imports_created_at
  on public.association_member_imports(created_at desc);

create index if not exists idx_association_member_import_rows_import_id
  on public.association_member_import_rows(import_id);
create index if not exists idx_association_member_import_rows_association_id
  on public.association_member_import_rows(association_id);
create index if not exists idx_association_member_import_rows_status
  on public.association_member_import_rows(status);
create index if not exists idx_association_member_import_rows_duplicate_signal
  on public.association_member_import_rows(duplicate_signal);
create index if not exists idx_association_member_import_rows_member_id
  on public.association_member_import_rows(member_id);

create index if not exists idx_association_member_events_association_id
  on public.association_member_events(association_id);
create index if not exists idx_association_member_events_member_id
  on public.association_member_events(member_id, created_at desc);
create index if not exists idx_association_member_events_association_member_id
  on public.association_member_events(association_member_id, created_at desc);
create index if not exists idx_association_member_events_import
  on public.association_member_events(import_id, created_at desc);

do $$
begin
  if to_regclass('public.association_members') is not null then
    create index if not exists idx_association_members_association_status
      on public.association_members(association_id, member_status);
    create index if not exists idx_association_members_duplicate_signal
      on public.association_members(duplicate_signal);
    create index if not exists idx_association_members_activation_state
      on public.association_members(activation_state);
    create index if not exists idx_association_members_phone_normalized
      on public.association_members(phone_normalized);
    create index if not exists idx_association_members_email
      on public.association_members(lower(email));
    create index if not exists idx_association_members_cac_number
      on public.association_members(cac_number);
    create index if not exists idx_association_members_tin_number
      on public.association_members(tin_number);
    create index if not exists idx_association_members_business_lga
      on public.association_members(lower(business_name), lower(lga));
    create unique index if not exists idx_association_members_import_row_unique
      on public.association_members(source_import_id, source_row_number);
  end if;
end $$;
