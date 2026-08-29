create table if not exists finance_readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references msmes(id) on delete cascade,
  submitted_by_user_id uuid references users(id) on delete set null,
  public_msme_id_snapshot text,
  score numeric(6,2),
  readiness_band text,
  assessment_payload jsonb not null default '{}'::jsonb,
  report_payload jsonb,
  generated_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_readiness_assessments_msme_id
  on finance_readiness_assessments(msme_id, created_at desc);

create index if not exists idx_finance_readiness_assessments_submitted_by
  on finance_readiness_assessments(submitted_by_user_id, created_at desc);

alter table finance_readiness_assessments
  enable row level security;

create policy finance_readiness_assessments_service_role_full_access
  on finance_readiness_assessments
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy finance_readiness_assessments_msme_select_own
  on finance_readiness_assessments
  for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from msmes m
      where m.id = finance_readiness_assessments.msme_id
        and (
          m.created_by = auth.uid()
          or lower(coalesce(m.contact_email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
        )
    )
  );

create policy finance_readiness_assessments_admin_select
  on finance_readiness_assessments
  for select
  using (
    auth.role() = 'authenticated'
    and lower(coalesce(auth.jwt()->>'app_role', auth.jwt()->>'role', '')) = 'admin'
  );
