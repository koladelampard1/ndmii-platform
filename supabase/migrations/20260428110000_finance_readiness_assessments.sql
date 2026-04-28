create table if not exists finance_readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references msmes(id) on delete cascade,
  pathway text not null check (pathway in ('loan','grant','investment')),
  responses jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  score integer not null check (score between 0 and 100),
  band text not null,
  result jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_readiness_assessments_msme_id on finance_readiness_assessments(msme_id);
create index if not exists idx_finance_readiness_assessments_created_at on finance_readiness_assessments(created_at desc);
