create table if not exists finance_readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references msmes(id) on delete cascade,
  submitted_by uuid references users(id),
  afri_score integer not null check (afri_score between 0 and 100),
  readiness_band text not null check (readiness_band in ('High','Moderate','Emerging')),
  score_breakdown jsonb not null default '{}'::jsonb,
  responses jsonb not null default '{}'::jsonb,
  auto_signals jsonb not null default '{}'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_readiness_assessments_msme_id on finance_readiness_assessments(msme_id);
create index if not exists idx_finance_readiness_assessments_created_at on finance_readiness_assessments(created_at desc);

alter table finance_readiness_assessments enable row level security;

drop policy if exists finance_readiness_assessments_select_own on finance_readiness_assessments;
create policy finance_readiness_assessments_select_own
on finance_readiness_assessments
for select
using (
  exists (
    select 1
    from msmes m
    where m.id = finance_readiness_assessments.msme_id
      and m.created_by::text = auth.uid()::text
  )
);
