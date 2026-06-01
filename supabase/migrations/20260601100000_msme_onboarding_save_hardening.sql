-- Keep association fast-track workspace provisioning idempotent.
create unique index if not exists idx_msmes_source_association_member_unique
  on public.msmes(source_association_member_id)
  where source_association_member_id is not null;

-- Repair environments where the legacy onboarding validation table was not applied.
create table if not exists public.validation_results (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  nin_status text not null default 'pending',
  bvn_status text not null default 'pending',
  cac_status text not null default 'pending',
  tin_status text not null default 'pending',
  confidence_score integer not null default 0,
  validation_summary text,
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (msme_id)
);

create index if not exists idx_validation_results_msme_id
  on public.validation_results(msme_id);
create index if not exists idx_validation_results_validated_at
  on public.validation_results(validated_at desc);
