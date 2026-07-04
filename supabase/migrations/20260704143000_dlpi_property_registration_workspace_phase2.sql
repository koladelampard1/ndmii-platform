-- DBIN Property Platform Phase 2: registration workspace storage foundation.
-- Creates a private bucket used by the server-side property registration wizard
-- to persist supporting document uploads as metadata in property_documents.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-documents',
  'property-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.properties drop constraint if exists properties_status_check;
alter table public.properties
  add constraint properties_status_check check (status in (
    'draft',
    'submitted',
    'under_review',
    'verified',
    'active',
    'transferred',
    'suspended',
    'disputed',
    'archived',
    'cancelled',
    'rejected'
  ));

alter table public.properties drop constraint if exists properties_registry_status_check;
alter table public.properties
  add constraint properties_registry_status_check check (registry_status in (
    'draft',
    'submitted',
    'under_review',
    'verified',
    'active',
    'transferred',
    'suspended',
    'disputed',
    'archived',
    'cancelled',
    'rejected'
  ));
