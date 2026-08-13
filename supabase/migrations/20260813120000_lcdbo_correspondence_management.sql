-- LCDBO Correspondence Management MVP.
-- Additive correspondence register, workflow, issuance, verification and audit
-- foundation for the RMRDC/Roseate Forte governed programme workspace.

create extension if not exists "pgcrypto";

create table if not exists public.lcdbo_correspondence_reference_counters (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  issuer text not null,
  direction text not null,
  reference_year integer not null,
  last_sequence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_correspondence_reference_issuer_check check (issuer in ('JNT', 'RMRDC', 'RFNL')),
  constraint lcdbo_correspondence_reference_direction_check check (direction in ('IN', 'OUT')),
  constraint lcdbo_correspondence_reference_unique unique (programme_id, issuer, direction, reference_year)
);

create table if not exists public.lcdbo_correspondence_contacts (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  name text not null,
  organisation text,
  role_title text,
  email text,
  phone text,
  address text,
  contact_type text not null default 'external',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_correspondence_contacts_name_check check (nullif(trim(name), '') is not null),
  constraint lcdbo_correspondence_contacts_type_check check (contact_type in ('external', 'rmrdc', 'roseate_forte', 'government', 'partner', 'internal')),
  constraint lcdbo_correspondence_contacts_status_check check (status in ('active', 'inactive', 'archived'))
);

create table if not exists public.lcdbo_correspondence_templates (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  template_key text not null,
  name text not null,
  issuer text not null,
  correspondence_type text not null,
  version text not null default '1.0',
  placeholder_schema jsonb not null default '{}'::jsonb,
  body_template text not null,
  status text not null default 'draft',
  effective_from date,
  effective_to date,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_correspondence_templates_key_unique unique (programme_id, template_key, version),
  constraint lcdbo_correspondence_templates_issuer_check check (issuer in ('JNT', 'RMRDC', 'RFNL')),
  constraint lcdbo_correspondence_templates_status_check check (status in ('draft', 'approved', 'retired')),
  constraint lcdbo_correspondence_templates_name_check check (nullif(trim(name), '') is not null),
  constraint lcdbo_correspondence_templates_body_check check (nullif(trim(body_template), '') is not null)
);

create table if not exists public.lcdbo_correspondence_records (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  reference text not null unique,
  direction text not null,
  issuer text not null,
  correspondence_type text not null,
  subject text not null,
  summary text,
  sensitivity text not null default 'internal',
  status text not null default 'draft',
  owner_id uuid references public.users(id) on delete set null,
  requester_id uuid references public.users(id) on delete set null,
  drafter_id uuid references public.users(id) on delete set null,
  current_assignee_id uuid references public.users(id) on delete set null,
  workstream_id uuid,
  state_id uuid references public.states(id) on delete set null,
  lga_id uuid references public.lgas(id) on delete set null,
  due_at timestamptz,
  response_required boolean not null default false,
  response_due_at timestamptz,
  received_at timestamptz,
  issued_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  closed_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  superseded_by uuid,
  supersedes_id uuid,
  current_version_id uuid,
  issued_version_id uuid,
  verification_record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_correspondence_direction_check check (direction in ('IN', 'OUT')),
  constraint lcdbo_correspondence_issuer_check check (issuer in ('JNT', 'RMRDC', 'RFNL')),
  constraint lcdbo_correspondence_sensitivity_check check (sensitivity in ('public', 'internal', 'confidential', 'restricted')),
  constraint lcdbo_correspondence_status_check check (status in (
    'draft', 'in_review', 'revision_requested', 'awaiting_approval',
    'awaiting_signature', 'signed', 'ready_for_dispatch', 'dispatch_failed',
    'sent', 'delivery_failed', 'delivered', 'acknowledged',
    'response_received', 'closed', 'rejected', 'superseded', 'revoked',
    'cancelled'
  )),
  constraint lcdbo_correspondence_subject_check check (nullif(trim(subject), '') is not null),
  constraint lcdbo_correspondence_reference_check check (reference ~ '^LCDBO/(JNT|RMRDC|RFNL)/[0-9]{4}/(IN|OUT)/[0-9]{6}$'),
  constraint lcdbo_correspondence_response_due_check check (response_due_at is null or response_required = true)
);

create table if not exists public.lcdbo_correspondence_parties (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  contact_id uuid references public.lcdbo_correspondence_contacts(id) on delete set null,
  party_role text not null,
  name text not null,
  organisation text,
  email text,
  phone text,
  address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_parties_role_check check (party_role in ('from', 'to', 'cc', 'bcc', 'signatory', 'observer')),
  constraint lcdbo_correspondence_parties_name_check check (nullif(trim(name), '') is not null)
);

create table if not exists public.lcdbo_correspondence_document_versions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  template_id uuid references public.lcdbo_correspondence_templates(id) on delete set null,
  version_number integer not null default 1,
  version_label text not null default 'v1',
  body text,
  content jsonb not null default '{}'::jsonb,
  source_file_path text,
  rendered_pdf_path text,
  document_hash text,
  is_frozen boolean not null default false,
  frozen_at timestamptz,
  invalidates_approvals_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_versions_unique_number unique (record_id, version_number),
  constraint lcdbo_correspondence_versions_label_check check (nullif(trim(version_label), '') is not null),
  constraint lcdbo_correspondence_versions_frozen_check check ((is_frozen = false and frozen_at is null) or (is_frozen = true and frozen_at is not null))
);

create table if not exists public.lcdbo_correspondence_workflow_actions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  document_version_id uuid references public.lcdbo_correspondence_document_versions(id) on delete set null,
  action_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_workflow_action_check check (action_type in (
    'created', 'updated', 'submitted_for_review', 'reviewed', 'revision_requested',
    'approved', 'rejected', 'signature_requested', 'signed', 'ready_for_dispatch',
    'dispatch_recorded', 'delivery_recorded', 'acknowledged', 'response_recorded',
    'closed', 'superseded', 'revoked', 'cancelled', 'commented'
  ))
);

create table if not exists public.lcdbo_correspondence_approvals (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  document_version_id uuid not null references public.lcdbo_correspondence_document_versions(id) on delete cascade,
  approval_role text not null,
  approver_id uuid not null references public.users(id) on delete restrict,
  decision text not null,
  decision_note text,
  decided_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_approvals_role_check check (approval_role in ('rmrdc_reviewer', 'roseate_reviewer', 'joint_secretariat', 'correspondence_admin')),
  constraint lcdbo_correspondence_approvals_decision_check check (decision in ('approved', 'rejected', 'revision_requested')),
  constraint lcdbo_correspondence_approvals_unique_role unique (record_id, document_version_id, approval_role)
);

create table if not exists public.lcdbo_correspondence_signature_events (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  document_version_id uuid not null references public.lcdbo_correspondence_document_versions(id) on delete restrict,
  signatory_id uuid not null references public.users(id) on delete restrict,
  delegated_by uuid references public.users(id) on delete set null,
  signature_role text not null,
  signature_asset_ref text,
  document_hash text not null,
  signed_pdf_path text,
  signed_at timestamptz not null default now(),
  signature_mode text not null default 'test_adapter',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_signature_role_check check (signature_role in ('rmrdc_signatory', 'roseate_signatory', 'joint_signatory', 'signatory_delegate')),
  constraint lcdbo_correspondence_signature_mode_check check (signature_mode in ('test_adapter', 'protected_asset', 'external_provider')),
  constraint lcdbo_correspondence_signature_hash_check check (nullif(trim(document_hash), '') is not null),
  constraint lcdbo_correspondence_signature_unique_role unique (record_id, document_version_id, signature_role)
);

create table if not exists public.lcdbo_correspondence_dispatch_events (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  dispatch_channel text not null,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  tracking_number text not null,
  status text not null default 'sent',
  dispatch_note text,
  dispatched_by uuid not null references public.users(id) on delete restrict,
  dispatched_at timestamptz not null default now(),
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_dispatch_channel_check check (dispatch_channel in ('email', 'courier', 'hand_delivery', 'official_portal', 'other')),
  constraint lcdbo_correspondence_dispatch_status_check check (status in ('queued', 'sent', 'failed', 'delivered', 'acknowledged')),
  constraint lcdbo_correspondence_dispatch_tracking_check check (nullif(trim(tracking_number), '') is not null)
);

create table if not exists public.lcdbo_correspondence_responses (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  response_reference text,
  response_summary text not null,
  response_document_path text,
  received_by uuid references public.users(id) on delete set null,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_responses_summary_check check (nullif(trim(response_summary), '') is not null)
);

create table if not exists public.lcdbo_correspondence_delegations (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  delegator_id uuid not null references public.users(id) on delete cascade,
  delegate_id uuid not null references public.users(id) on delete cascade,
  delegation_role text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active',
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_delegations_role_check check (delegation_role in ('rmrdc_signatory', 'roseate_signatory', 'joint_signatory')),
  constraint lcdbo_correspondence_delegations_status_check check (status in ('active', 'revoked', 'expired')),
  constraint lcdbo_correspondence_delegations_time_check check (expires_at is null or expires_at > starts_at)
);

create table if not exists public.lcdbo_correspondence_verification_records (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  verification_token text not null unique,
  canonical_url text not null,
  document_hash text not null,
  status text not null default 'valid',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_verification_status_check check (status in ('valid', 'revoked', 'superseded', 'expired')),
  constraint lcdbo_correspondence_verification_hash_check check (nullif(trim(document_hash), '') is not null)
);

create table if not exists public.lcdbo_correspondence_comments (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  comment_body text not null,
  visibility text not null default 'internal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_comments_body_check check (nullif(trim(comment_body), '') is not null),
  constraint lcdbo_correspondence_comments_visibility_check check (visibility in ('internal', 'auditor', 'public_note'))
);

alter table public.lcdbo_correspondence_records
  drop constraint if exists lcdbo_correspondence_current_version_fk,
  drop constraint if exists lcdbo_correspondence_issued_version_fk,
  drop constraint if exists lcdbo_correspondence_verification_fk,
  drop constraint if exists lcdbo_correspondence_superseded_by_fk,
  drop constraint if exists lcdbo_correspondence_supersedes_fk;

alter table public.lcdbo_correspondence_records
  add constraint lcdbo_correspondence_current_version_fk foreign key (current_version_id) references public.lcdbo_correspondence_document_versions(id) on delete set null,
  add constraint lcdbo_correspondence_issued_version_fk foreign key (issued_version_id) references public.lcdbo_correspondence_document_versions(id) on delete set null,
  add constraint lcdbo_correspondence_verification_fk foreign key (verification_record_id) references public.lcdbo_correspondence_verification_records(id) on delete set null,
  add constraint lcdbo_correspondence_superseded_by_fk foreign key (superseded_by) references public.lcdbo_correspondence_records(id) on delete set null,
  add constraint lcdbo_correspondence_supersedes_fk foreign key (supersedes_id) references public.lcdbo_correspondence_records(id) on delete set null;

alter table public.lcdbo_correspondence_contacts
  add column if not exists state text,
  add column if not exists country text not null default 'Nigeria',
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_by uuid references public.users(id) on delete set null,
  add column if not exists verified_at timestamptz;

alter table public.lcdbo_correspondence_templates
  add column if not exists signature_config jsonb not null default '{}'::jsonb,
  add column if not exists submitted_for_approval_at timestamptz,
  add column if not exists rejected_by uuid references public.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_note text,
  add column if not exists retired_by uuid references public.users(id) on delete set null,
  add column if not exists retired_at timestamptz;

alter table public.lcdbo_correspondence_templates
  drop constraint if exists lcdbo_correspondence_templates_status_check;
alter table public.lcdbo_correspondence_templates
  add constraint lcdbo_correspondence_templates_status_check check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'retired'));

alter table public.lcdbo_correspondence_delegations
  add column if not exists organisation text,
  add column if not exists correspondence_scope jsonb not null default '{}'::jsonb,
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists revoked_by uuid references public.users(id) on delete set null,
  add column if not exists revoked_at timestamptz;

create table if not exists public.lcdbo_correspondence_delivery_evidence (
  id uuid primary key default gen_random_uuid(),
  dispatch_event_id uuid not null references public.lcdbo_correspondence_dispatch_events(id) on delete cascade,
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  evidence_type text not null,
  file_path text,
  file_name text,
  file_size integer,
  mime_type text,
  file_hash text,
  receiving_person text,
  delivery_note text,
  captured_by uuid not null references public.users(id) on delete restrict,
  captured_at timestamptz not null default now(),
  supersedes_evidence_id uuid references public.lcdbo_correspondence_delivery_evidence(id) on delete set null,
  status text not null default 'active',
  invalidated_by uuid references public.users(id) on delete set null,
  invalidated_at timestamptz,
  invalidation_note text,
  malware_scan_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_delivery_evidence_type_check check (evidence_type in ('provider_message', 'waybill', 'receipt', 'acknowledgement', 'delivery_note', 'failure_notice', 'other')),
  constraint lcdbo_correspondence_delivery_evidence_status_check check (status in ('active', 'superseded', 'invalidated')),
  constraint lcdbo_correspondence_delivery_evidence_scan_check check (malware_scan_status in ('pending', 'passed', 'failed', 'not_required')),
  constraint lcdbo_correspondence_delivery_evidence_content_check check (
    nullif(trim(coalesce(file_path, '')), '') is not null
    or nullif(trim(coalesce(delivery_note, '')), '') is not null
    or nullif(trim(coalesce(receiving_person, '')), '') is not null
  )
);

alter table public.lcdbo_correspondence_delivery_evidence
  add column if not exists status text not null default 'active',
  add column if not exists invalidated_by uuid references public.users(id) on delete set null,
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidation_note text;

alter table public.lcdbo_correspondence_delivery_evidence
  drop constraint if exists lcdbo_correspondence_delivery_evidence_status_check;
alter table public.lcdbo_correspondence_delivery_evidence
  add constraint lcdbo_correspondence_delivery_evidence_status_check check (status in ('active', 'superseded', 'invalidated'));

create table if not exists public.lcdbo_correspondence_relationships (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  target_record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  relationship_type text not null,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_relationships_type_check check (relationship_type in ('reply_to', 'response_to', 'supersedes', 'superseded_by', 'follow_up_to', 'acknowledgement_of', 'related_to')),
  constraint lcdbo_correspondence_relationships_not_self check (source_record_id <> target_record_id),
  constraint lcdbo_correspondence_relationships_unique unique (source_record_id, target_record_id, relationship_type)
);

create table if not exists public.lcdbo_correspondence_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  record_id uuid references public.lcdbo_correspondence_records(id) on delete cascade,
  job_type text not null,
  idempotency_key text not null unique,
  recipient_user_id uuid references public.users(id) on delete set null,
  status text not null default 'pending',
  scheduled_for timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_correspondence_notification_jobs_status_check check (status in ('pending', 'sent', 'skipped', 'failed')),
  constraint lcdbo_correspondence_notification_jobs_type_check check (job_type in (
    'review_due_soon', 'review_overdue', 'approval_due_soon', 'approval_overdue',
    'awaiting_signature', 'signed_not_dispatched', 'delivery_failure',
    'response_due_three_days', 'response_due_one_day', 'response_overdue',
    'delegation_expiring', 'template_retiring'
  ))
);

create table if not exists public.lcdbo_correspondence_email_dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lcdbo_correspondence_records(id) on delete cascade,
  dispatch_event_id uuid references public.lcdbo_correspondence_dispatch_events(id) on delete set null,
  idempotency_key text not null unique,
  provider text not null,
  provider_message_id text,
  sender_identity text not null,
  to_recipients text[] not null default '{}'::text[],
  cc_recipients text[] not null default '{}'::text[],
  bcc_recipients text[] not null default '{}'::text[],
  subject text not null,
  body text not null,
  status text not null default 'queued',
  error_message text,
  attempted_by uuid references public.users(id) on delete set null,
  attempted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_correspondence_email_dispatch_status_check check (status in ('queued', 'sent_to_provider', 'delivered', 'delivery_failed', 'skipped')),
  constraint lcdbo_correspondence_email_dispatch_subject_check check (nullif(trim(subject), '') is not null)
);

create index if not exists idx_lcdbo_correspondence_records_programme_status
  on public.lcdbo_correspondence_records(programme_id, status, created_at desc);
create index if not exists idx_lcdbo_correspondence_records_reference
  on public.lcdbo_correspondence_records(reference);
create index if not exists idx_lcdbo_correspondence_records_assignee
  on public.lcdbo_correspondence_records(current_assignee_id, status)
  where current_assignee_id is not null;
create index if not exists idx_lcdbo_correspondence_records_response_due
  on public.lcdbo_correspondence_records(programme_id, response_required, response_due_at)
  where response_required = true;
create index if not exists idx_lcdbo_correspondence_versions_record
  on public.lcdbo_correspondence_document_versions(record_id, version_number desc);
create index if not exists idx_lcdbo_correspondence_actions_record
  on public.lcdbo_correspondence_workflow_actions(record_id, created_at desc);
create index if not exists idx_lcdbo_correspondence_approvals_record
  on public.lcdbo_correspondence_approvals(record_id, document_version_id);
create index if not exists idx_lcdbo_correspondence_signatures_record
  on public.lcdbo_correspondence_signature_events(record_id, document_version_id);
create index if not exists idx_lcdbo_correspondence_dispatch_record
  on public.lcdbo_correspondence_dispatch_events(record_id, created_at desc);
create index if not exists idx_lcdbo_correspondence_verification_token
  on public.lcdbo_correspondence_verification_records(verification_token);
create index if not exists idx_lcdbo_correspondence_delivery_evidence_record
  on public.lcdbo_correspondence_delivery_evidence(record_id, captured_at desc);
create index if not exists idx_lcdbo_correspondence_relationships_source
  on public.lcdbo_correspondence_relationships(source_record_id, created_at desc);
create index if not exists idx_lcdbo_correspondence_relationships_target
  on public.lcdbo_correspondence_relationships(target_record_id, created_at desc);
create index if not exists idx_lcdbo_correspondence_notification_jobs_pending
  on public.lcdbo_correspondence_notification_jobs(programme_id, status, scheduled_for)
  where status = 'pending';
create index if not exists idx_lcdbo_correspondence_email_attempts_record
  on public.lcdbo_correspondence_email_dispatch_attempts(record_id, attempted_at desc);

create or replace function public.lcdbo_correspondence_current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.lcdbo_correspondence_has_role(
  target_programme_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and (
        u.role in ('admin', 'super_admin')
        or u.role = any(allowed_roles)
        or exists (
          select 1
          from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role = any(allowed_roles)
            and (
              ra.scope_type = 'global'
              or (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
              or ra.institution_id = (
                select p.owning_institution_id
                from public.programmes p
                where p.id = target_programme_id
                limit 1
              )
            )
        )
      )
  )
$$;

create or replace function public.generate_lcdbo_correspondence_reference(
  target_issuer text,
  target_direction text,
  registered_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  lcdbo_programme_id uuid;
  reference_year integer;
  next_sequence integer;
begin
  if target_issuer not in ('JNT', 'RMRDC', 'RFNL') then
    raise exception 'Invalid LCDBO correspondence issuer.';
  end if;
  if target_direction not in ('IN', 'OUT') then
    raise exception 'Invalid LCDBO correspondence direction.';
  end if;

  select id into lcdbo_programme_id
  from public.programmes
  where slug = 'local-content-development-beyond-oil'
  limit 1;

  if lcdbo_programme_id is null then
    raise exception 'LCDBO programme is not configured.';
  end if;

  reference_year := extract(year from registered_at)::integer;

  insert into public.lcdbo_correspondence_reference_counters (
    programme_id, issuer, direction, reference_year, last_sequence
  )
  values (lcdbo_programme_id, target_issuer, target_direction, reference_year, 1)
  on conflict (programme_id, issuer, direction, reference_year)
  do update set
    last_sequence = public.lcdbo_correspondence_reference_counters.last_sequence + 1,
    updated_at = now()
  returning last_sequence into next_sequence;

  return format('LCDBO/%s/%s/%s/%s', target_issuer, reference_year, target_direction, lpad(next_sequence::text, 6, '0'));
end;
$$;

create or replace function public.lcdbo_correspondence_record_event(
  target_record_id uuid,
  target_action_type text,
  target_from_status text,
  target_to_status text,
  target_note text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app_user_id uuid;
  programme_id uuid;
  action_id uuid;
begin
  app_user_id := public.lcdbo_correspondence_current_app_user_id();
  select r.programme_id into programme_id
  from public.lcdbo_correspondence_records r
  where r.id = target_record_id;

  insert into public.lcdbo_correspondence_workflow_actions (
    record_id, action_type, from_status, to_status, actor_user_id, note, metadata
  ) values (
    target_record_id, target_action_type, target_from_status, target_to_status, app_user_id, target_note, target_metadata
  ) returning id into action_id;

  insert into public.platform_events (
    actor_user_id, event_type, entity_type, entity_id, scope_type, scope_id, metadata
  ) values (
    app_user_id,
    'lcdbo.correspondence.' || target_action_type,
    'lcdbo_correspondence_record',
    target_record_id,
    'programme',
    programme_id,
    coalesce(target_metadata, '{}'::jsonb) || jsonb_build_object('from_status', target_from_status, 'to_status', target_to_status)
  );

  return action_id;
end;
$$;

revoke all on function public.lcdbo_correspondence_current_app_user_id() from public;
grant execute on function public.lcdbo_correspondence_current_app_user_id() to authenticated;
revoke all on function public.lcdbo_correspondence_has_role(uuid, text[]) from public;
grant execute on function public.lcdbo_correspondence_has_role(uuid, text[]) to authenticated;
revoke all on function public.generate_lcdbo_correspondence_reference(text, text, timestamptz) from public;
grant execute on function public.generate_lcdbo_correspondence_reference(text, text, timestamptz) to authenticated;
revoke all on function public.lcdbo_correspondence_record_event(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.lcdbo_correspondence_record_event(uuid, text, text, text, text, jsonb) to authenticated;

alter table public.lcdbo_correspondence_reference_counters enable row level security;
alter table public.lcdbo_correspondence_records enable row level security;
alter table public.lcdbo_correspondence_contacts enable row level security;
alter table public.lcdbo_correspondence_templates enable row level security;
alter table public.lcdbo_correspondence_parties enable row level security;
alter table public.lcdbo_correspondence_document_versions enable row level security;
alter table public.lcdbo_correspondence_workflow_actions enable row level security;
alter table public.lcdbo_correspondence_approvals enable row level security;
alter table public.lcdbo_correspondence_signature_events enable row level security;
alter table public.lcdbo_correspondence_dispatch_events enable row level security;
alter table public.lcdbo_correspondence_responses enable row level security;
alter table public.lcdbo_correspondence_delegations enable row level security;
alter table public.lcdbo_correspondence_verification_records enable row level security;
alter table public.lcdbo_correspondence_comments enable row level security;
alter table public.lcdbo_correspondence_delivery_evidence enable row level security;
alter table public.lcdbo_correspondence_relationships enable row level security;
alter table public.lcdbo_correspondence_notification_jobs enable row level security;
alter table public.lcdbo_correspondence_email_dispatch_attempts enable row level security;

drop policy if exists "LCDBO correspondence participants can read records" on public.lcdbo_correspondence_records;
create policy "LCDBO correspondence participants can read records"
  on public.lcdbo_correspondence_records for select
  using (
    public.lcdbo_correspondence_has_role(programme_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'requester', 'drafter', 'rmrdc_reviewer',
      'roseate_reviewer', 'joint_secretariat', 'rmrdc_signatory',
      'roseate_signatory', 'signatory_delegate', 'dispatch_officer',
      'data_analyst', 'auditor', 'observer'
    ])
    or public.lcdbo_correspondence_current_app_user_id() in (owner_id, requester_id, drafter_id, current_assignee_id)
  );

drop policy if exists "LCDBO correspondence writers can create records" on public.lcdbo_correspondence_records;
create policy "LCDBO correspondence writers can create records"
  on public.lcdbo_correspondence_records for insert
  with check (
    public.lcdbo_correspondence_has_role(programme_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'requester', 'drafter', 'joint_secretariat'
    ])
    and created_by = public.lcdbo_correspondence_current_app_user_id()
  );

drop policy if exists "LCDBO correspondence operators can update records" on public.lcdbo_correspondence_records;
create policy "LCDBO correspondence operators can update records"
  on public.lcdbo_correspondence_records for update
  using (
    public.lcdbo_correspondence_has_role(programme_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'drafter', 'rmrdc_reviewer', 'roseate_reviewer',
      'joint_secretariat', 'rmrdc_signatory', 'roseate_signatory',
      'signatory_delegate', 'dispatch_officer'
    ])
    or current_assignee_id = public.lcdbo_correspondence_current_app_user_id()
  )
  with check (
    public.lcdbo_correspondence_has_role(programme_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'drafter', 'rmrdc_reviewer', 'roseate_reviewer',
      'joint_secretariat', 'rmrdc_signatory', 'roseate_signatory',
      'signatory_delegate', 'dispatch_officer'
    ])
    or current_assignee_id = public.lcdbo_correspondence_current_app_user_id()
  );

drop policy if exists "LCDBO correspondence verification is public safe" on public.lcdbo_correspondence_verification_records;
create policy "LCDBO correspondence verification is public safe"
  on public.lcdbo_correspondence_verification_records for select
  using (status in ('valid', 'superseded', 'revoked', 'expired'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'lcdbo_correspondence_parties',
    'lcdbo_correspondence_document_versions',
    'lcdbo_correspondence_workflow_actions',
    'lcdbo_correspondence_approvals',
    'lcdbo_correspondence_signature_events',
    'lcdbo_correspondence_dispatch_events',
    'lcdbo_correspondence_responses',
    'lcdbo_correspondence_delivery_evidence',
    'lcdbo_correspondence_email_dispatch_attempts',
    'lcdbo_correspondence_comments'
  ] loop
    execute format('drop policy if exists "LCDBO correspondence scoped read %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "LCDBO correspondence scoped read %s" on public.%I for select using (
        exists (
          select 1 from public.lcdbo_correspondence_records r
          where r.id = %I.record_id
            and (
              public.lcdbo_correspondence_has_role(r.programme_id, array[
                ''programme_officer'', ''institution_admin'', ''correspondence_admin'',
                ''records_admin'', ''requester'', ''drafter'', ''rmrdc_reviewer'',
                ''roseate_reviewer'', ''joint_secretariat'', ''rmrdc_signatory'',
                ''roseate_signatory'', ''signatory_delegate'', ''dispatch_officer'',
                ''data_analyst'', ''auditor'', ''observer''
              ])
              or public.lcdbo_correspondence_current_app_user_id() in (r.owner_id, r.requester_id, r.drafter_id, r.current_assignee_id)
            )
        )
      )',
      table_name,
      table_name,
      table_name
    );
  end loop;
end;
$$;

-- Contacts/templates/delegations do not all contain record_id, so create their
-- programme-scoped policies explicitly after the common record-scoped block.
drop policy if exists "LCDBO correspondence scoped read lcdbo_correspondence_contacts" on public.lcdbo_correspondence_contacts;
create policy "LCDBO correspondence scoped read lcdbo_correspondence_contacts"
  on public.lcdbo_correspondence_contacts for select
  using (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin', 'requester', 'drafter', 'auditor', 'observer']));

drop policy if exists "LCDBO correspondence scoped read lcdbo_correspondence_templates" on public.lcdbo_correspondence_templates;
create policy "LCDBO correspondence scoped read lcdbo_correspondence_templates"
  on public.lcdbo_correspondence_templates for select
  using (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin', 'requester', 'drafter', 'auditor', 'observer']));

drop policy if exists "LCDBO correspondence scoped read lcdbo_correspondence_delegations" on public.lcdbo_correspondence_delegations;
create policy "LCDBO correspondence scoped read lcdbo_correspondence_delegations"
  on public.lcdbo_correspondence_delegations for select
  using (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin', 'rmrdc_signatory', 'roseate_signatory', 'auditor']));

drop policy if exists "LCDBO correspondence admins can manage contacts" on public.lcdbo_correspondence_contacts;
create policy "LCDBO correspondence admins can manage contacts"
  on public.lcdbo_correspondence_contacts for all
  using (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin']))
  with check (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin']));

drop policy if exists "LCDBO correspondence admins can manage templates" on public.lcdbo_correspondence_templates;
create policy "LCDBO correspondence admins can manage templates"
  on public.lcdbo_correspondence_templates for all
  using (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin']))
  with check (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin']));

drop policy if exists "LCDBO correspondence admins can manage delegations" on public.lcdbo_correspondence_delegations;
create policy "LCDBO correspondence admins can manage delegations"
  on public.lcdbo_correspondence_delegations for all
  using (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin']))
  with check (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin']));

drop policy if exists "LCDBO correspondence scoped read relationships" on public.lcdbo_correspondence_relationships;
create policy "LCDBO correspondence scoped read relationships"
  on public.lcdbo_correspondence_relationships for select
  using (
    exists (
      select 1
      from public.lcdbo_correspondence_records r
      where r.id in (source_record_id, target_record_id)
        and (
          public.lcdbo_correspondence_has_role(r.programme_id, array[
            'programme_officer', 'institution_admin', 'correspondence_admin',
            'records_admin', 'requester', 'drafter', 'rmrdc_reviewer',
            'roseate_reviewer', 'joint_secretariat', 'dispatch_officer',
            'data_analyst', 'auditor', 'observer'
          ])
          or public.lcdbo_correspondence_current_app_user_id() in (r.owner_id, r.requester_id, r.drafter_id, r.current_assignee_id)
        )
    )
  );

drop policy if exists "LCDBO correspondence operators can create relationships" on public.lcdbo_correspondence_relationships;
create policy "LCDBO correspondence operators can create relationships"
  on public.lcdbo_correspondence_relationships for insert
  with check (
    exists (
      select 1 from public.lcdbo_correspondence_records r
      where r.id = source_record_id
        and public.lcdbo_correspondence_has_role(r.programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin', 'requester', 'drafter', 'joint_secretariat'])
    )
    and created_by = public.lcdbo_correspondence_current_app_user_id()
  );

drop policy if exists "LCDBO correspondence operators can write delivery evidence" on public.lcdbo_correspondence_delivery_evidence;
create policy "LCDBO correspondence operators can write delivery evidence"
  on public.lcdbo_correspondence_delivery_evidence for insert
  with check (
    exists (
      select 1 from public.lcdbo_correspondence_records r
      where r.id = record_id
        and public.lcdbo_correspondence_has_role(r.programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin', 'dispatch_officer'])
    )
    and captured_by = public.lcdbo_correspondence_current_app_user_id()
  );

drop policy if exists "LCDBO correspondence admins can manage notification jobs" on public.lcdbo_correspondence_notification_jobs;
create policy "LCDBO correspondence admins can manage notification jobs"
  on public.lcdbo_correspondence_notification_jobs for all
  using (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin', 'auditor']))
  with check (public.lcdbo_correspondence_has_role(programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin']));

drop policy if exists "LCDBO correspondence dispatch can create email attempts" on public.lcdbo_correspondence_email_dispatch_attempts;
create policy "LCDBO correspondence dispatch can create email attempts"
  on public.lcdbo_correspondence_email_dispatch_attempts for insert
  with check (
    exists (
      select 1 from public.lcdbo_correspondence_records r
      where r.id = record_id
        and public.lcdbo_correspondence_has_role(r.programme_id, array['programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin', 'dispatch_officer'])
    )
    and (attempted_by is null or attempted_by = public.lcdbo_correspondence_current_app_user_id())
  );

revoke all on table public.lcdbo_correspondence_reference_counters from anon;
revoke all on table public.lcdbo_correspondence_records from anon;
revoke all on table public.lcdbo_correspondence_contacts from anon;
revoke all on table public.lcdbo_correspondence_templates from anon;
revoke all on table public.lcdbo_correspondence_parties from anon;
revoke all on table public.lcdbo_correspondence_document_versions from anon;
revoke all on table public.lcdbo_correspondence_workflow_actions from anon;
revoke all on table public.lcdbo_correspondence_approvals from anon;
revoke all on table public.lcdbo_correspondence_signature_events from anon;
revoke all on table public.lcdbo_correspondence_dispatch_events from anon;
revoke all on table public.lcdbo_correspondence_responses from anon;
revoke all on table public.lcdbo_correspondence_delegations from anon;
revoke all on table public.lcdbo_correspondence_verification_records from anon;
revoke all on table public.lcdbo_correspondence_comments from anon;
revoke all on table public.lcdbo_correspondence_delivery_evidence from anon;
revoke all on table public.lcdbo_correspondence_relationships from anon;
revoke all on table public.lcdbo_correspondence_notification_jobs from anon;
revoke all on table public.lcdbo_correspondence_email_dispatch_attempts from anon;

grant select, insert, update on table public.lcdbo_correspondence_records to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_contacts to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_templates to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_parties to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_document_versions to authenticated;
grant select, insert on table public.lcdbo_correspondence_workflow_actions to authenticated;
grant select, insert on table public.lcdbo_correspondence_approvals to authenticated;
grant select, insert on table public.lcdbo_correspondence_signature_events to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_dispatch_events to authenticated;
grant select, insert on table public.lcdbo_correspondence_responses to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_delegations to authenticated;
grant select on table public.lcdbo_correspondence_verification_records to anon, authenticated;
grant select, insert on table public.lcdbo_correspondence_comments to authenticated;
grant select, insert on table public.lcdbo_correspondence_delivery_evidence to authenticated;
grant select, insert on table public.lcdbo_correspondence_relationships to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_notification_jobs to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_email_dispatch_attempts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('lcdbo-correspondence-documents', 'lcdbo-correspondence-documents', false, 15728640, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/png', 'image/jpeg']),
  ('lcdbo-correspondence-final', 'lcdbo-correspondence-final', false, 15728640, array['application/pdf']),
  ('lcdbo-correspondence-signatures', 'lcdbo-correspondence-signatures', false, 1048576, array['image/png', 'image/svg+xml'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

with lcdbo_programme as (
  select id from public.programmes where slug = 'local-content-development-beyond-oil' limit 1
)
insert into public.lcdbo_correspondence_templates (
  programme_id, template_key, name, issuer, correspondence_type, version,
  placeholder_schema, body_template, status, approved_at, metadata
)
select
  id,
  'official-letter-basic',
  'Official LCDBO Letter',
  'JNT',
  'official_letter',
  '1.0',
  jsonb_build_object(
    'required', jsonb_build_array('reference', 'date', 'recipient_name', 'subject', 'body', 'signatory_block', 'verification_url')
  ),
  'Reference: {{reference}}\nDate: {{date}}\n\n{{recipient_name}}\n\nSubject: {{subject}}\n\n{{body}}\n\n{{signatory_block}}\n\nVerify this correspondence at {{verification_url}}.',
  'approved',
  now(),
  jsonb_build_object('source', 'lcdbo_correspondence_mvp', 'signature_policy', 'server_side_only')
from lcdbo_programme
on conflict (programme_id, template_key, version) do update set
  status = 'approved',
  updated_at = now();
