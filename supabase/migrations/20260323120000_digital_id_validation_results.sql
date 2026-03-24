create table if not exists digital_ids (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references msmes(id) on delete cascade,
  ndmii_id text not null unique,
  issued_at timestamptz not null default now(),
  qr_code_ref text not null,
  status text not null default 'active',
  validation_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (msme_id)
);

create index if not exists idx_digital_ids_ndmii_id on digital_ids(ndmii_id);
create index if not exists idx_digital_ids_status on digital_ids(status);

create table if not exists validation_results (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references msmes(id) on delete cascade,
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

create index if not exists idx_validation_results_msme_id on validation_results(msme_id);
create index if not exists idx_validation_results_validated_at on validation_results(validated_at desc);
