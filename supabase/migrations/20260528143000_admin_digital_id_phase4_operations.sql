alter table if exists public.digital_identity_credentials
  add column if not exists assigned_reviewer_id uuid,
  add column if not exists assigned_admin_id uuid,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid,
  add column if not exists reassigned_count integer not null default 0,
  add column if not exists last_reassignment_at timestamptz,
  add column if not exists renewal_requested_at timestamptz,
  add column if not exists renewal_due_at timestamptz,
  add column if not exists sla_due_at timestamptz,
  add column if not exists sla_started_at timestamptz,
  add column if not exists last_activity_at timestamptz;

create index if not exists idx_digital_identity_credentials_assignment_sla
  on public.digital_identity_credentials(assigned_at, assigned_reviewer_id, assigned_admin_id, status);

create index if not exists idx_digital_identity_credentials_renewal_backlog
  on public.digital_identity_credentials(status, renewal_requested_at)
  where status = 'renewal_pending';
