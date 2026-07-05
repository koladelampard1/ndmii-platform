-- DBIN DLPI Phase 3: registry operations and verification.
-- Adds registry cases, assignments, comments, notifications, certificate
-- records, lifecycle statuses, and operation indexes without public explorer,
-- GIS, marketplace, conveyancing, AI, or intelligence dashboards.

create table if not exists public.property_case_sequences (
  sequence_year integer primary key,
  last_value bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_case_sequences_year_check check (sequence_year >= 2026),
  constraint property_case_sequences_value_check check (last_value >= 0)
);

create table if not exists public.property_registry_cases (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null unique,
  application_reference text,
  property_id uuid not null references public.properties(id) on delete cascade,
  claim_id uuid references public.property_claims(id) on delete set null,
  status text not null default 'submitted',
  priority text not null default 'normal',
  assigned_to uuid references public.users(id) on delete set null,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamptz,
  decision text,
  decision_note text,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_registry_cases_status_check check (status in (
    'submitted',
    'under_review',
    'awaiting_documents',
    'awaiting_survey',
    'awaiting_ownership',
    'approved',
    'rejected',
    'returned',
    'suspended',
    'cancelled',
    'verified'
  )),
  constraint property_registry_cases_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint property_registry_cases_decision_check check (decision is null or decision in ('approved', 'rejected', 'returned', 'suspended', 'cancelled', 'verified'))
);

create unique index if not exists idx_property_registry_cases_property
  on public.property_registry_cases(property_id);
create index if not exists idx_property_registry_cases_status_created
  on public.property_registry_cases(status, created_at desc);
create index if not exists idx_property_registry_cases_assigned
  on public.property_registry_cases(assigned_to, status)
  where assigned_to is not null;

create table if not exists public.property_case_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.property_registry_cases(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  assignment_role text not null,
  assigned_to uuid references public.users(id) on delete set null,
  assigned_by uuid references public.users(id) on delete set null,
  status text not null default 'active',
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_case_assignments_role_check check (assignment_role in (
    'registry_manager',
    'land_registry_officer',
    'survey_officer',
    'document_verifier',
    'property_reviewer',
    'title_issuer'
  )),
  constraint property_case_assignments_status_check check (status in ('active', 'reassigned', 'completed', 'cancelled'))
);

create index if not exists idx_property_case_assignments_case
  on public.property_case_assignments(case_id, status);
create index if not exists idx_property_case_assignments_user
  on public.property_case_assignments(assigned_to, status)
  where assigned_to is not null;

create table if not exists public.property_case_comments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.property_registry_cases(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  comment text not null,
  visibility text not null default 'internal',
  comment_type text not null default 'comment',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint property_case_comments_visibility_check check (visibility in ('internal', 'applicant_visible')),
  constraint property_case_comments_type_check check (comment_type in ('comment', 'decision_note', 'correction_request', 'assignment_note')),
  constraint property_case_comments_text_check check (nullif(trim(comment), '') is not null)
);

create index if not exists idx_property_case_comments_case
  on public.property_case_comments(case_id, created_at desc);

create table if not exists public.property_notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.property_registry_cases(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  recipient_user_id uuid references public.users(id) on delete set null,
  notification_type text not null,
  title text not null,
  body text,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_notifications_type_check check (notification_type in (
    'application_assigned',
    'documents_requested',
    'application_returned',
    'application_approved',
    'npin_issued',
    'credential_issued'
  )),
  constraint property_notifications_status_check check (status in ('pending', 'read', 'archived')),
  constraint property_notifications_title_check check (nullif(trim(title), '') is not null)
);

create index if not exists idx_property_notifications_recipient
  on public.property_notifications(recipient_user_id, status, created_at desc)
  where recipient_user_id is not null;
create index if not exists idx_property_notifications_case
  on public.property_notifications(case_id, created_at desc)
  where case_id is not null;

create table if not exists public.property_certificates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.property_registry_cases(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete cascade,
  credential_id uuid references public.property_identity_credentials(id) on delete set null,
  certificate_reference text not null unique,
  certificate_type text not null default 'property_registration',
  status text not null default 'generated',
  generated_by uuid references public.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  certificate_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_certificates_type_check check (certificate_type in ('property_registration')),
  constraint property_certificates_status_check check (status in ('generated', 'voided', 'superseded'))
);

create index if not exists idx_property_certificates_property
  on public.property_certificates(property_id, generated_at desc);
create index if not exists idx_property_certificates_case
  on public.property_certificates(case_id, generated_at desc)
  where case_id is not null;

alter table public.properties drop constraint if exists properties_status_check;
alter table public.properties
  add constraint properties_status_check check (status in (
    'draft',
    'submitted',
    'under_review',
    'awaiting_documents',
    'awaiting_survey',
    'awaiting_ownership',
    'approved',
    'rejected',
    'returned',
    'suspended',
    'cancelled',
    'verified',
    'active',
    'transferred',
    'disputed',
    'archived'
  ));

alter table public.properties drop constraint if exists properties_registry_status_check;
alter table public.properties
  add constraint properties_registry_status_check check (registry_status in (
    'draft',
    'submitted',
    'under_review',
    'awaiting_documents',
    'awaiting_survey',
    'awaiting_ownership',
    'approved',
    'rejected',
    'returned',
    'suspended',
    'cancelled',
    'verified',
    'active',
    'transferred',
    'disputed',
    'archived'
  ));

alter table public.property_status_history drop constraint if exists property_status_history_new_status_check;
alter table public.property_status_history
  add constraint property_status_history_new_status_check check (new_status in (
    'draft',
    'submitted',
    'under_review',
    'awaiting_documents',
    'awaiting_survey',
    'awaiting_ownership',
    'approved',
    'rejected',
    'returned',
    'suspended',
    'cancelled',
    'verified',
    'active',
    'transferred',
    'disputed',
    'archived'
  ));

drop trigger if exists set_property_case_sequences_updated_at on public.property_case_sequences;
create trigger set_property_case_sequences_updated_at before update on public.property_case_sequences
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_registry_cases_updated_at on public.property_registry_cases;
create trigger set_property_registry_cases_updated_at before update on public.property_registry_cases
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_case_assignments_updated_at on public.property_case_assignments;
create trigger set_property_case_assignments_updated_at before update on public.property_case_assignments
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_notifications_updated_at on public.property_notifications;
create trigger set_property_notifications_updated_at before update on public.property_notifications
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_property_certificates_updated_at on public.property_certificates;
create trigger set_property_certificates_updated_at before update on public.property_certificates
  for each row execute function public.set_platform_foundation_updated_at();

create or replace function public.generate_property_case_reference(target_year integer default extract(year from now())::integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  case_year integer;
  next_value bigint;
begin
  case_year := coalesce(target_year, extract(year from now())::integer);

  if case_year < 2026 then
    raise exception 'Case reference year is invalid.';
  end if;

  if current_user not in ('postgres', 'supabase_admin')
     and current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Case references can only be generated by trusted registry services.';
  end if;

  insert into public.property_case_sequences (sequence_year, last_value)
  values (case_year, 0)
  on conflict (sequence_year) do nothing;

  update public.property_case_sequences
  set last_value = last_value + 1,
      updated_at = now()
  where sequence_year = case_year
  returning last_value into next_value;

  return 'CASE-' || case_year::text || '-' || lpad(next_value::text, 6, '0');
end;
$$;

revoke all on function public.generate_property_case_reference(integer) from public;
grant execute on function public.generate_property_case_reference(integer) to service_role;

alter table public.property_case_sequences enable row level security;
alter table public.property_registry_cases enable row level security;
alter table public.property_case_assignments enable row level security;
alter table public.property_case_comments enable row level security;
alter table public.property_notifications enable row level security;
alter table public.property_certificates enable row level security;

drop policy if exists "Property registry operators can manage registry cases" on public.property_registry_cases;
create policy "Property registry operators can manage registry cases" on public.property_registry_cases
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_registry_cases.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_registry_cases.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Property registry operators can manage case assignments" on public.property_case_assignments;
create policy "Property registry operators can manage case assignments" on public.property_case_assignments
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_case_assignments.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_case_assignments.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Property registry operators can manage case comments" on public.property_case_comments;
create policy "Property registry operators can manage case comments" on public.property_case_comments
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_case_comments.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_case_comments.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Property registry operators can manage property notifications" on public.property_notifications;
create policy "Property registry operators can manage property notifications" on public.property_notifications
  for all using (
    property_id is null
    or exists (
      select 1 from public.properties p
      where p.id = property_notifications.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  )
  with check (
    property_id is null
    or exists (
      select 1 from public.properties p
      where p.id = property_notifications.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Property registry operators can manage property certificates" on public.property_certificates;
create policy "Property registry operators can manage property certificates" on public.property_certificates
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_certificates.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_certificates.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

do $$
declare
  property_row record;
  generated_case_reference text;
begin
  for property_row in
    select p.id, p.application_reference, p.created_at, p.application_submitted_at, c.id as claim_id, p.status
    from public.properties p
    left join public.property_claims c on c.property_id = p.id and c.claim_type = 'registration'
    where p.status <> 'draft'
      and not exists (select 1 from public.property_registry_cases rc where rc.property_id = p.id)
    order by coalesce(p.application_submitted_at, p.created_at), p.id
  loop
    generated_case_reference := public.generate_property_case_reference(extract(year from coalesce(property_row.application_submitted_at, property_row.created_at, now()))::integer);

    insert into public.property_registry_cases (
      case_reference,
      application_reference,
      property_id,
      claim_id,
      status,
      submitted_at,
      metadata
    ) values (
      generated_case_reference,
      property_row.application_reference,
      property_row.id,
      property_row.claim_id,
      case
        when property_row.status in ('approved', 'rejected', 'returned', 'suspended', 'cancelled', 'verified', 'under_review', 'awaiting_documents', 'awaiting_survey', 'awaiting_ownership') then property_row.status
        else 'submitted'
      end,
      coalesce(property_row.application_submitted_at, property_row.created_at),
      jsonb_build_object('backfilled', true, 'phase', 'dlpi_property_registry_operations_phase3')
    );
  end loop;
end;
$$;
