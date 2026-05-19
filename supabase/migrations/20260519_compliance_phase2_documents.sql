-- Compliance Phase 2 evidence uploads.
-- Adds private document metadata, immutable document events, private storage
-- bucket configuration, RLS, and storage object policies.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_document_event_type') then
    create type public.compliance_document_event_type as enum (
      'uploaded',
      'previewed',
      'downloaded',
      'deleted',
      'verification_requested'
    );
  end if;
end $$;

create table if not exists public.compliance_documents (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  compliance_item_id uuid not null references public.msme_compliance_items(id) on delete cascade,
  regulator_id uuid not null references public.compliance_regulators(id) on delete restrict,
  requirement_id uuid not null references public.compliance_requirement_definitions(id) on delete restrict,
  document_type text not null,
  original_filename text not null,
  storage_bucket text not null default 'compliance-evidence',
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  checksum_sha256 text not null,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  verified_at timestamptz,
  expires_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_documents_bucket_check check (storage_bucket = 'compliance-evidence'),
  constraint compliance_documents_size_check check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  constraint compliance_documents_mime_check check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  constraint compliance_documents_checksum_check check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  constraint compliance_documents_deleted_at_check check ((is_deleted and deleted_at is not null) or (not is_deleted and deleted_at is null))
);

create table if not exists public.compliance_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.compliance_documents(id) on delete set null,
  msme_id uuid references public.msmes(id) on delete cascade,
  compliance_item_id uuid references public.msme_compliance_items(id) on delete set null,
  regulator_id uuid references public.compliance_regulators(id) on delete set null,
  requirement_id uuid references public.compliance_requirement_definitions(id) on delete set null,
  event_type public.compliance_document_event_type not null,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists compliance_documents_storage_unique_idx
  on public.compliance_documents(storage_bucket, storage_path);
create index if not exists compliance_documents_msme_idx
  on public.compliance_documents(msme_id, uploaded_at desc);
create index if not exists compliance_documents_item_idx
  on public.compliance_documents(compliance_item_id, uploaded_at desc);
create index if not exists compliance_documents_requirement_idx
  on public.compliance_documents(requirement_id);
create index if not exists compliance_documents_regulator_idx
  on public.compliance_documents(regulator_id);
create index if not exists compliance_documents_active_idx
  on public.compliance_documents(msme_id, compliance_item_id, uploaded_at desc)
  where is_deleted = false;
create index if not exists compliance_document_events_document_idx
  on public.compliance_document_events(document_id, created_at desc);
create index if not exists compliance_document_events_msme_idx
  on public.compliance_document_events(msme_id, created_at desc);
create index if not exists compliance_document_events_type_idx
  on public.compliance_document_events(event_type);

create or replace function public.set_compliance_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_compliance_documents_updated_at on public.compliance_documents;
create trigger trg_compliance_documents_updated_at
before update on public.compliance_documents
for each row
execute function public.set_compliance_documents_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compliance-evidence',
  'compliance-evidence',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

create or replace function public.compliance_documents_can_read_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.compliance_current_role() in ('admin', 'reviewer', 'fccpc_officer', 'firs_officer', 'nrs_officer'), false);
$$;

create or replace function public.compliance_documents_owns_msme(target_msme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.msmes m
    left join public.users owner on owner.id = m.created_by
    where m.id = target_msme_id
      and (
        m.created_by = public.compliance_current_app_user_id()
        or owner.auth_user_id = auth.uid()
        or lower(m.contact_email) = lower(auth.email())
      )
  );
$$;

create or replace function public.compliance_document_item_matches(
  target_msme_id uuid,
  target_compliance_item_id uuid,
  target_regulator_id uuid,
  target_requirement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.msme_compliance_items item
    where item.id = target_compliance_item_id
      and item.msme_id = target_msme_id
      and item.regulator_id = target_regulator_id
      and item.requirement_id = target_requirement_id
  );
$$;

alter table public.compliance_documents enable row level security;
alter table public.compliance_document_events enable row level security;

drop policy if exists "Compliance evidence authorized users can read documents" on public.compliance_documents;
create policy "Compliance evidence authorized users can read documents"
on public.compliance_documents
for select
using (
  not is_deleted
  and (
    public.compliance_documents_can_read_all()
    or public.compliance_documents_owns_msme(msme_id)
  )
);

drop policy if exists "Compliance evidence owners can insert documents" on public.compliance_documents;
create policy "Compliance evidence owners can insert documents"
on public.compliance_documents
for insert
with check (
  not is_deleted
  and public.compliance_document_item_matches(msme_id, compliance_item_id, regulator_id, requirement_id)
  and (
    public.compliance_documents_can_read_all()
    or public.compliance_documents_owns_msme(msme_id)
  )
);

drop policy if exists "Compliance evidence authorized users can update documents" on public.compliance_documents;
create policy "Compliance evidence authorized users can update documents"
on public.compliance_documents
for update
using (
  public.compliance_documents_can_read_all()
  or public.compliance_documents_owns_msme(msme_id)
)
with check (
  public.compliance_document_item_matches(msme_id, compliance_item_id, regulator_id, requirement_id)
  and (
    public.compliance_documents_can_read_all()
    or public.compliance_documents_owns_msme(msme_id)
  )
);

drop policy if exists "Compliance evidence authorized users can read events" on public.compliance_document_events;
create policy "Compliance evidence authorized users can read events"
on public.compliance_document_events
for select
using (
  public.compliance_documents_can_read_all()
  or (msme_id is not null and public.compliance_documents_owns_msme(msme_id))
);

drop policy if exists "Compliance evidence authorized users can insert events" on public.compliance_document_events;
create policy "Compliance evidence authorized users can insert events"
on public.compliance_document_events
for insert
with check (
  public.compliance_documents_can_read_all()
  or (msme_id is not null and public.compliance_documents_owns_msme(msme_id))
);

drop policy if exists "Compliance evidence authorized users can read storage objects" on storage.objects;
create policy "Compliance evidence authorized users can read storage objects"
on storage.objects
for select
using (
  bucket_id = 'compliance-evidence'
  and (
    public.compliance_documents_can_read_all()
    or exists (
      select 1
      from public.compliance_documents document
      where document.storage_bucket = storage.objects.bucket_id
        and document.storage_path = storage.objects.name
        and document.is_deleted = false
        and public.compliance_documents_owns_msme(document.msme_id)
    )
  )
);

drop policy if exists "Compliance evidence authorized users can insert storage objects" on storage.objects;
create policy "Compliance evidence authorized users can insert storage objects"
on storage.objects
for insert
with check (
  bucket_id = 'compliance-evidence'
  and (
    public.compliance_documents_can_read_all()
    or exists (
      select 1
      from public.msmes m
      left join public.users owner on owner.id = m.created_by
      where m.id::text = (storage.foldername(name))[1]
        and (
          m.created_by = public.compliance_current_app_user_id()
          or owner.auth_user_id = auth.uid()
          or lower(m.contact_email) = lower(auth.email())
        )
    )
  )
);
