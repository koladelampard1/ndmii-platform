create table if not exists finance_readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references msmes(id) on delete cascade,
  identity_score integer not null check (identity_score between 0 and 100),
  financial_score integer not null check (financial_score between 0 and 100),
  compliance_score integer not null check (compliance_score between 0 and 100),
  operational_score integer not null check (operational_score between 0 and 100),
  growth_score integer not null check (growth_score between 0 and 100),
  overall_score integer not null check (overall_score between 0 and 100),
  readiness_level text not null check (readiness_level in ('high', 'medium', 'emerging')),
  afri_snapshot jsonb not null,
  signal_snapshot jsonb not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_readiness_assessments_msme_id on finance_readiness_assessments(msme_id);
create index if not exists idx_finance_readiness_assessments_submitted_at on finance_readiness_assessments(submitted_at desc);
