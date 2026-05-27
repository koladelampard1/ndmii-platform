-- Admin Verifications Phase 4: document request tracking.
-- Human-review document intelligence only. This table does not perform OCR,
-- AI extraction, face matching, sanctions checks, or automated decisions.

create extension if not exists "pgcrypto";

create table if not exists public.verification_document_requests (
  id uuid primary key default gen_random_uuid(),
  verification_review_id uuid not null references public.verification_reviews(id) on delete cascade,
  msme_id uuid not null references public.msmes(id) on delete cascade,
  document_type text not null,
  label text not null,
  status text not null default 'requested',
  requested_by uuid references public.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verification_document_requests_status_check check (status in ('requested', 'fulfilled', 'cancelled')),
  constraint verification_document_requests_label_check check (nullif(trim(label), '') is not null),
  constraint verification_document_requests_type_check check (document_type in (
    'CAC_CERTIFICATE',
    'TIN_PROOF',
    'UTILITY_BILL',
    'TAX_CLEARANCE',
    'BUSINESS_PREMISES_PERMIT',
    'BANK_PROOF',
    'PRODUCT_CERTIFICATION',
    'OTHER'
  )),
  constraint verification_document_requests_fulfilled_at_check check (
    (status = 'fulfilled' and fulfilled_at is not null)
    or (status <> 'fulfilled')
  )
);

create index if not exists verification_document_requests_review_idx
  on public.verification_document_requests(verification_review_id, requested_at desc);
create index if not exists verification_document_requests_msme_idx
  on public.verification_document_requests(msme_id, status, requested_at desc);
create index if not exists verification_document_requests_type_idx
  on public.verification_document_requests(document_type, status);

create or replace function public.set_verification_document_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_verification_document_requests_updated_at on public.verification_document_requests;
create trigger trg_verification_document_requests_updated_at
before update on public.verification_document_requests
for each row
execute function public.set_verification_document_requests_updated_at();

alter table public.verification_document_requests enable row level security;

drop policy if exists "Verification reviewers can read document requests" on public.verification_document_requests;
create policy "Verification reviewers can read document requests"
on public.verification_document_requests
for select
using (public.verification_can_read_reviews());

drop policy if exists "Verification reviewers can insert document requests" on public.verification_document_requests;
create policy "Verification reviewers can insert document requests"
on public.verification_document_requests
for insert
with check (public.verification_can_write_reviews());

drop policy if exists "Verification reviewers can update document requests" on public.verification_document_requests;
create policy "Verification reviewers can update document requests"
on public.verification_document_requests
for update
using (public.verification_can_write_reviews())
with check (public.verification_can_write_reviews());
