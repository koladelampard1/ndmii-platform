-- State Revenue Service Workspace Framework Sprint 1.
-- Reusable business onboarding, eligibility verification, field review,
-- identity-resolution and jurisdiction relationship foundation.
--
-- This migration is intentionally additive. It does not provision users,
-- does not apply live revenue data, and does not issue identities by itself.

create extension if not exists "pgcrypto";

create table if not exists public.state_revenue_applications (
  id uuid primary key default gen_random_uuid(),
  application_reference text not null unique,
  jurisdiction_id text not null,
  institution_id uuid references public.institutions(id) on delete set null,
  applicant_user_id uuid references public.users(id) on delete set null,
  existing_business_id uuid references public.msmes(id) on delete set null,
  resolved_business_id uuid references public.msmes(id) on delete set null,
  proposed_business_name text,
  owner_name text,
  contact_email text,
  contact_phone text,
  application_type text not null default 'new_business',
  current_status text not null default 'draft',
  eligibility_status text not null default 'not_started',
  verification_level integer not null default 0,
  duplicate_status text not null default 'not_screened',
  assigned_reviewer_id uuid references public.users(id) on delete set null,
  assigned_field_officer_id uuid references public.users(id) on delete set null,
  sector text,
  business_type text,
  formality_status text not null default 'informal',
  cac_number text,
  tin text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason_code text,
  decision_notes text,
  additional_information_request jsonb not null default '{}'::jsonb,
  additional_information_due_at timestamptz,
  latest_applicant_response text,
  resubmitted_at timestamptz,
  resubmission_count integer not null default 0,
  classification text not null default 'uat',
  test_data boolean not null default true,
  consent_version text,
  privacy_notice_version text,
  declaration_accepted boolean not null default false,
  location_consent_status text not null default 'not_requested',
  metadata jsonb not null default '{}'::jsonb,
  public_lookup_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint state_revenue_applications_type_check check (application_type in ('new_business', 'existing_business')),
  constraint state_revenue_applications_status_check check (current_status in (
    'draft', 'submitted', 'contact_verification_required', 'jurisdiction_unverified',
    'evidence_required', 'duplicate_review_required', 'reviewer_assigned', 'under_review',
    'field_verification_required', 'field_verification_assigned',
    'field_verification_in_progress', 'field_verification_submitted',
    'additional_information_required', 'resubmitted', 'approved', 'rejected',
    'withdrawn', 'suspended', 'no_longer_operating'
  )),
  constraint state_revenue_applications_eligibility_check check (eligibility_status in (
    'not_started', 'incomplete', 'pending_review', 'eligible', 'ineligible', 'requires_field_verification'
  )),
  constraint state_revenue_applications_duplicate_check check (duplicate_status in (
    'not_screened', 'no_candidate', 'possible_match', 'strong_match',
    'confirmed_duplicate', 'distinct_business', 'manual_review_required',
    'resolved_existing_identity'
  )),
  constraint state_revenue_applications_formality_check check (formality_status in ('formal', 'informal', 'transitioning')),
  constraint state_revenue_applications_classification_check check (classification in ('live_operational', 'uat', 'synthetic_demo')),
  constraint state_revenue_applications_location_consent_check check (location_consent_status in ('not_requested', 'granted', 'denied', 'withdrawn')),
  constraint state_revenue_applications_reference_check check (application_reference ~ '^[A-Z0-9-]{12,48}$'),
  constraint state_revenue_applications_approval_business_check check (current_status <> 'approved' or resolved_business_id is not null),
  constraint state_revenue_applications_decision_dates_check check (
    (approved_at is null or rejected_at is null)
    and (submitted_at is null or approved_at is null or approved_at >= submitted_at)
    and (submitted_at is null or rejected_at is null or rejected_at >= submitted_at)
  )
);

create table if not exists public.state_revenue_operating_locations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.state_revenue_applications(id) on delete cascade,
  business_id uuid references public.msmes(id) on delete cascade,
  jurisdiction_id text not null,
  state_code text not null,
  lga_name text not null,
  lga_id uuid references public.lgas(id) on delete set null,
  lcda_name text,
  ward text,
  town text not null,
  community text,
  address text not null,
  landmark text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  gps_consent_status text not null default 'not_requested',
  location_type text not null,
  business_activity text not null,
  operation_commenced_on date,
  is_primary boolean not null default false,
  status text not null default 'pending_review',
  verification_status text not null default 'self_declared',
  verification_level integer not null default 0,
  verified_at timestamptz,
  verified_by uuid references public.users(id) on delete set null,
  ceased_at timestamptz,
  source text not null default 'state_revenue_application',
  classification text not null default 'uat',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint state_revenue_locations_gps_consent_check check (gps_consent_status in ('not_requested', 'granted', 'denied', 'withdrawn')),
  constraint state_revenue_locations_type_check check (location_type in ('headquarters', 'branch', 'shop', 'market_stall', 'office', 'farm', 'production_site', 'warehouse', 'mobile_service_area', 'other')),
  constraint state_revenue_locations_status_check check (status in ('pending_review', 'active', 'suspended', 'ceased', 'rejected')),
  constraint state_revenue_locations_verification_check check (verification_status in ('self_declared', 'evidence_submitted', 'under_review', 'field_verified', 'rejected', 'ceased')),
  constraint state_revenue_locations_classification_check check (classification in ('live_operational', 'uat', 'synthetic_demo')),
  constraint state_revenue_locations_business_or_application_check check (application_id is not null or business_id is not null)
);

create table if not exists public.state_revenue_jurisdiction_relationships (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id text not null,
  institution_id uuid references public.institutions(id) on delete set null,
  business_id uuid not null references public.msmes(id) on delete cascade,
  operating_location_id uuid references public.state_revenue_operating_locations(id) on delete set null,
  application_id uuid references public.state_revenue_applications(id) on delete set null,
  relationship_status text not null default 'active',
  entry_pathway text not null,
  eligibility_status text not null default 'eligible',
  approved_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  suspended_at timestamptz,
  ceased_at timestamptz,
  compliance_readiness_status text not null default 'not_started',
  programme_status text not null default 'active',
  classification text not null default 'uat',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint state_revenue_relationship_status_check check (relationship_status in ('active', 'pending_review', 'suspended', 'ceased', 'rejected')),
  constraint state_revenue_relationship_entry_check check (entry_pathway in ('new_business', 'existing_business', 'duplicate_resolution', 'administrative_linkage')),
  constraint state_revenue_relationship_eligibility_check check (eligibility_status in ('eligible', 'ineligible', 'pending_review')),
  constraint state_revenue_relationship_classification_check check (classification in ('live_operational', 'uat', 'synthetic_demo'))
);

create unique index if not exists idx_state_revenue_relationship_unique_active
  on public.state_revenue_jurisdiction_relationships(jurisdiction_id, business_id, coalesce(operating_location_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where relationship_status in ('active', 'pending_review', 'suspended');

create table if not exists public.state_revenue_application_evidence (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.state_revenue_applications(id) on delete cascade,
  evidence_type text not null,
  storage_bucket text,
  storage_path text,
  original_filename text,
  safe_filename text,
  mime_type text,
  file_size_bytes bigint,
  checksum_sha256 text,
  evidence_status text not null default 'submitted',
  replacement_for_evidence_id uuid references public.state_revenue_application_evidence(id) on delete set null,
  uploaded_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  classification text not null default 'uat',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint state_revenue_evidence_type_check check (evidence_type in (
    'operating_location_photograph', 'utility_bill', 'tenancy_or_occupancy',
    'market_association_confirmation', 'trade_association_confirmation',
    'local_government_permit', 'shop_or_business_permit', 'cac_document',
    'tin_reference', 'state_revenue_reference', 'field_verification_evidence',
    'geotagged_location_evidence', 'agriculture_farm_location_evidence', 'other'
  )),
  constraint state_revenue_evidence_status_check check (evidence_status in ('submitted', 'under_review', 'accepted', 'rejected', 'replacement_requested', 'superseded', 'withdrawn')),
  constraint state_revenue_evidence_classification_check check (classification in ('live_operational', 'uat', 'synthetic_demo')),
  constraint state_revenue_evidence_storage_path_check check (storage_path is null or storage_path !~ '(^/|\\.\\.)')
);

create table if not exists public.state_revenue_verification_tasks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.state_revenue_applications(id) on delete cascade,
  operating_location_id uuid references public.state_revenue_operating_locations(id) on delete set null,
  verification_type text not null,
  assigned_officer_id uuid references public.users(id) on delete set null,
  assigned_supervisor_id uuid references public.users(id) on delete set null,
  status text not null default 'assigned',
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  outcome text,
  notes text,
  location_match_status text,
  observed_business_activity text,
  contact_met text,
  evidence_ids uuid[] not null default '{}'::uuid[],
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_status text not null default 'pending',
  classification text not null default 'uat',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  constraint state_revenue_tasks_type_check check (verification_type in ('operating_location', 'duplicate_check', 'contact_check', 'evidence_review')),
  constraint state_revenue_tasks_status_check check (status in ('assigned', 'in_progress', 'submitted', 'returned_for_correction', 'accepted', 'cancelled')),
  constraint state_revenue_tasks_outcome_check check (outcome is null or outcome in (
    'verified_operating', 'partially_verified', 'location_not_found',
    'business_not_operating', 'relocated', 'applicant_unavailable',
    'address_incomplete', 'evidence_inconsistent', 'security_or_access_issue',
    'revisit_required', 'suspected_duplicate', 'suspected_fraud'
  )),
  constraint state_revenue_tasks_location_match_check check (location_match_status is null or location_match_status in ('matched', 'partial_match', 'mismatch', 'not_assessed')),
  constraint state_revenue_tasks_review_status_check check (review_status in ('pending', 'accepted', 'returned', 'rejected')),
  constraint state_revenue_tasks_classification_check check (classification in ('live_operational', 'uat', 'synthetic_demo'))
);

create table if not exists public.state_revenue_application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.state_revenue_applications(id) on delete cascade,
  previous_status text,
  new_status text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  reason_code text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.state_revenue_identity_resolution_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.state_revenue_applications(id) on delete cascade,
  candidate_business_id uuid references public.msmes(id) on delete set null,
  match_signals text[] not null default '{}'::text[],
  confidence_category text not null default 'low',
  resolution_status text not null default 'manual_review_required',
  resolved_business_id uuid references public.msmes(id) on delete set null,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint state_revenue_identity_resolution_confidence_check check (confidence_category in ('low', 'medium', 'high', 'exact')),
  constraint state_revenue_identity_resolution_status_check check (resolution_status in (
    'no_candidate', 'possible_match', 'strong_match', 'confirmed_duplicate',
    'distinct_business', 'manual_review_required', 'resolved_existing_identity'
  ))
);

create table if not exists public.state_revenue_notifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.state_revenue_applications(id) on delete cascade,
  recipient_user_id uuid references public.users(id) on delete set null,
  jurisdiction_id text not null,
  notification_type text not null,
  channel text not null default 'outbox',
  delivery_status text not null default 'not_configured',
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint state_revenue_notifications_channel_check check (channel in ('outbox', 'email', 'sms', 'whatsapp', 'in_app')),
  constraint state_revenue_notifications_status_check check (delivery_status in ('not_configured', 'queued', 'sent', 'failed', 'cancelled'))
);

create index if not exists idx_state_revenue_applications_jurisdiction_status on public.state_revenue_applications(jurisdiction_id, current_status, submitted_at desc);
create index if not exists idx_state_revenue_applications_applicant on public.state_revenue_applications(applicant_user_id, created_at desc);
create index if not exists idx_state_revenue_applications_existing_business on public.state_revenue_applications(existing_business_id);
create index if not exists idx_state_revenue_applications_resolved_business on public.state_revenue_applications(resolved_business_id);
create index if not exists idx_state_revenue_locations_application on public.state_revenue_operating_locations(application_id);
create index if not exists idx_state_revenue_locations_business_jurisdiction on public.state_revenue_operating_locations(business_id, jurisdiction_id, status);
create index if not exists idx_state_revenue_evidence_application on public.state_revenue_application_evidence(application_id, evidence_status);
create index if not exists idx_state_revenue_tasks_application on public.state_revenue_verification_tasks(application_id, status);
create index if not exists idx_state_revenue_tasks_assigned_officer on public.state_revenue_verification_tasks(assigned_officer_id, status) where assigned_officer_id is not null;
create index if not exists idx_state_revenue_status_history_application on public.state_revenue_application_status_history(application_id, created_at desc);
create index if not exists idx_state_revenue_identity_resolution_application on public.state_revenue_identity_resolution_records(application_id, resolution_status);

drop trigger if exists set_state_revenue_applications_updated_at on public.state_revenue_applications;
create trigger set_state_revenue_applications_updated_at before update on public.state_revenue_applications
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_state_revenue_operating_locations_updated_at on public.state_revenue_operating_locations;
create trigger set_state_revenue_operating_locations_updated_at before update on public.state_revenue_operating_locations
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_state_revenue_relationships_updated_at on public.state_revenue_jurisdiction_relationships;
create trigger set_state_revenue_relationships_updated_at before update on public.state_revenue_jurisdiction_relationships
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_state_revenue_evidence_updated_at on public.state_revenue_application_evidence;
create trigger set_state_revenue_evidence_updated_at before update on public.state_revenue_application_evidence
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_state_revenue_tasks_updated_at on public.state_revenue_verification_tasks;
create trigger set_state_revenue_tasks_updated_at before update on public.state_revenue_verification_tasks
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_state_revenue_identity_resolution_updated_at on public.state_revenue_identity_resolution_records;
create trigger set_state_revenue_identity_resolution_updated_at before update on public.state_revenue_identity_resolution_records
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_state_revenue_notifications_updated_at on public.state_revenue_notifications;
create trigger set_state_revenue_notifications_updated_at before update on public.state_revenue_notifications
  for each row execute function public.set_platform_foundation_updated_at();

create or replace function public.state_revenue_current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.state_revenue_can_review_jurisdiction(target_jurisdiction_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    left join public.institutions i on i.slug = case
      when target_jurisdiction_id = 'ekiti' then 'ekiti-state-internal-revenue-service'
      else null
    end
    where u.auth_user_id = auth.uid()
      and (
        u.role in ('admin', 'super_admin')
        or exists (
          select 1
          from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role in (
              'state_revenue_executive', 'state_revenue_admin',
              'registration_reviewer', 'field_supervisor',
              'taxpayer_support_officer', 'data_analyst', 'auditor', 'observer'
            )
            and (
              ra.scope_type = 'global'
              or (i.id is not null and ra.scope_type = 'institution' and ra.institution_id = i.id)
              or (i.id is not null and ra.institution_id = i.id)
            )
        )
      )
  )
$$;

create or replace function public.state_revenue_can_operate_jurisdiction(target_jurisdiction_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    left join public.institutions i on i.slug = case
      when target_jurisdiction_id = 'ekiti' then 'ekiti-state-internal-revenue-service'
      else null
    end
    where u.auth_user_id = auth.uid()
      and (
        u.role in ('admin', 'super_admin')
        or exists (
          select 1
          from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role in (
              'state_revenue_executive', 'state_revenue_admin',
              'registration_reviewer', 'field_supervisor',
              'taxpayer_support_officer'
            )
            and (
              ra.scope_type = 'global'
              or (i.id is not null and ra.scope_type = 'institution' and ra.institution_id = i.id)
              or (i.id is not null and ra.institution_id = i.id)
            )
        )
      )
  )
$$;

create or replace function public.state_revenue_can_access_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.state_revenue_applications a
    where a.id = target_application_id
      and (
        a.applicant_user_id = public.state_revenue_current_app_user_id()
        or a.assigned_reviewer_id = public.state_revenue_current_app_user_id()
        or a.assigned_field_officer_id = public.state_revenue_current_app_user_id()
        or public.state_revenue_can_review_jurisdiction(a.jurisdiction_id)
      )
  )
$$;

revoke all on function public.state_revenue_current_app_user_id() from public;
grant execute on function public.state_revenue_current_app_user_id() to authenticated;
revoke all on function public.state_revenue_can_review_jurisdiction(text) from public;
grant execute on function public.state_revenue_can_review_jurisdiction(text) to authenticated;
revoke all on function public.state_revenue_can_operate_jurisdiction(text) from public;
grant execute on function public.state_revenue_can_operate_jurisdiction(text) to authenticated;
revoke all on function public.state_revenue_can_access_application(uuid) from public;
grant execute on function public.state_revenue_can_access_application(uuid) to authenticated;

alter table public.state_revenue_applications enable row level security;
alter table public.state_revenue_operating_locations enable row level security;
alter table public.state_revenue_jurisdiction_relationships enable row level security;
alter table public.state_revenue_application_evidence enable row level security;
alter table public.state_revenue_verification_tasks enable row level security;
alter table public.state_revenue_application_status_history enable row level security;
alter table public.state_revenue_identity_resolution_records enable row level security;
alter table public.state_revenue_notifications enable row level security;

drop policy if exists "State revenue applicants can read own applications" on public.state_revenue_applications;
create policy "State revenue applicants can read own applications" on public.state_revenue_applications
  for select using (applicant_user_id = public.state_revenue_current_app_user_id());
drop policy if exists "State revenue reviewers can read applications" on public.state_revenue_applications;
create policy "State revenue reviewers can read applications" on public.state_revenue_applications
  for select using (public.state_revenue_can_review_jurisdiction(jurisdiction_id));
drop policy if exists "State revenue assigned officers can read applications" on public.state_revenue_applications;
create policy "State revenue assigned officers can read applications" on public.state_revenue_applications
  for select using (
    assigned_reviewer_id = public.state_revenue_current_app_user_id()
    or assigned_field_officer_id = public.state_revenue_current_app_user_id()
  );
drop policy if exists "State revenue operators can mutate applications" on public.state_revenue_applications;
create policy "State revenue operators can mutate applications" on public.state_revenue_applications
  for all using (public.state_revenue_can_operate_jurisdiction(jurisdiction_id))
  with check (public.state_revenue_can_operate_jurisdiction(jurisdiction_id));

drop policy if exists "State revenue participants can read locations" on public.state_revenue_operating_locations;
create policy "State revenue participants can read locations" on public.state_revenue_operating_locations
  for select using (application_id is not null and public.state_revenue_can_access_application(application_id));
drop policy if exists "State revenue operators can manage locations" on public.state_revenue_operating_locations;
create policy "State revenue operators can manage locations" on public.state_revenue_operating_locations
  for all using (public.state_revenue_can_operate_jurisdiction(jurisdiction_id))
  with check (public.state_revenue_can_operate_jurisdiction(jurisdiction_id));

drop policy if exists "State revenue reviewers can read relationships" on public.state_revenue_jurisdiction_relationships;
create policy "State revenue reviewers can read relationships" on public.state_revenue_jurisdiction_relationships
  for select using (public.state_revenue_can_review_jurisdiction(jurisdiction_id));
drop policy if exists "State revenue operators can manage relationships" on public.state_revenue_jurisdiction_relationships;
create policy "State revenue operators can manage relationships" on public.state_revenue_jurisdiction_relationships
  for all using (public.state_revenue_can_operate_jurisdiction(jurisdiction_id))
  with check (public.state_revenue_can_operate_jurisdiction(jurisdiction_id));

drop policy if exists "State revenue participants can read evidence" on public.state_revenue_application_evidence;
create policy "State revenue participants can read evidence" on public.state_revenue_application_evidence
  for select using (public.state_revenue_can_access_application(application_id));
drop policy if exists "State revenue applicants can add own evidence" on public.state_revenue_application_evidence;
create policy "State revenue applicants can add own evidence" on public.state_revenue_application_evidence
  for insert with check (
    uploaded_by = public.state_revenue_current_app_user_id()
    and exists (
      select 1 from public.state_revenue_applications a
      where a.id = application_id
        and a.applicant_user_id = public.state_revenue_current_app_user_id()
        and a.current_status in ('draft', 'evidence_required', 'additional_information_required')
    )
  );
drop policy if exists "State revenue operators can manage evidence" on public.state_revenue_application_evidence;
create policy "State revenue operators can manage evidence" on public.state_revenue_application_evidence
  for all using (
    exists (select 1 from public.state_revenue_applications a where a.id = application_id and public.state_revenue_can_operate_jurisdiction(a.jurisdiction_id))
  )
  with check (
    exists (select 1 from public.state_revenue_applications a where a.id = application_id and public.state_revenue_can_operate_jurisdiction(a.jurisdiction_id))
  );

drop policy if exists "State revenue participants can read tasks" on public.state_revenue_verification_tasks;
create policy "State revenue participants can read tasks" on public.state_revenue_verification_tasks
  for select using (
    assigned_officer_id = public.state_revenue_current_app_user_id()
    or assigned_supervisor_id = public.state_revenue_current_app_user_id()
    or public.state_revenue_can_access_application(application_id)
  );
drop policy if exists "State revenue operators can manage tasks" on public.state_revenue_verification_tasks;
create policy "State revenue operators can manage tasks" on public.state_revenue_verification_tasks
  for all using (
    exists (select 1 from public.state_revenue_applications a where a.id = application_id and public.state_revenue_can_operate_jurisdiction(a.jurisdiction_id))
  )
  with check (
    exists (select 1 from public.state_revenue_applications a where a.id = application_id and public.state_revenue_can_operate_jurisdiction(a.jurisdiction_id))
  );

drop policy if exists "State revenue participants can read status history" on public.state_revenue_application_status_history;
create policy "State revenue participants can read status history" on public.state_revenue_application_status_history
  for select using (public.state_revenue_can_access_application(application_id));
drop policy if exists "State revenue participants can read identity resolution" on public.state_revenue_identity_resolution_records;
create policy "State revenue participants can read identity resolution" on public.state_revenue_identity_resolution_records
  for select using (public.state_revenue_can_access_application(application_id));
drop policy if exists "State revenue reviewers can manage identity resolution" on public.state_revenue_identity_resolution_records;
create policy "State revenue reviewers can manage identity resolution" on public.state_revenue_identity_resolution_records
  for all using (
    exists (select 1 from public.state_revenue_applications a where a.id = application_id and public.state_revenue_can_operate_jurisdiction(a.jurisdiction_id))
  )
  with check (
    exists (select 1 from public.state_revenue_applications a where a.id = application_id and public.state_revenue_can_operate_jurisdiction(a.jurisdiction_id))
  );
drop policy if exists "State revenue participants can read notifications" on public.state_revenue_notifications;
create policy "State revenue participants can read notifications" on public.state_revenue_notifications
  for select using (
    recipient_user_id = public.state_revenue_current_app_user_id()
    or (application_id is not null and public.state_revenue_can_access_application(application_id))
    or public.state_revenue_can_review_jurisdiction(jurisdiction_id)
  );

revoke all on table public.state_revenue_applications from anon;
revoke all on table public.state_revenue_operating_locations from anon;
revoke all on table public.state_revenue_jurisdiction_relationships from anon;
revoke all on table public.state_revenue_application_evidence from anon;
revoke all on table public.state_revenue_verification_tasks from anon;
revoke all on table public.state_revenue_application_status_history from anon;
revoke all on table public.state_revenue_identity_resolution_records from anon;
revoke all on table public.state_revenue_notifications from anon;

grant select, insert, update on table public.state_revenue_applications to authenticated;
grant select, insert, update on table public.state_revenue_operating_locations to authenticated;
grant select, insert, update on table public.state_revenue_jurisdiction_relationships to authenticated;
grant select, insert, update on table public.state_revenue_application_evidence to authenticated;
grant select, insert, update on table public.state_revenue_verification_tasks to authenticated;
grant select on table public.state_revenue_application_status_history to authenticated;
grant select, insert, update on table public.state_revenue_identity_resolution_records to authenticated;
grant select on table public.state_revenue_notifications to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'state-revenue-evidence',
  'state-revenue-evidence',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

drop policy if exists "State revenue evidence objects require authenticated access" on storage.objects;
create policy "State revenue evidence objects require authenticated access"
  on storage.objects for select
  using (
    bucket_id = 'state-revenue-evidence'
    and auth.role() = 'authenticated'
    and exists (
      select 1
      from public.state_revenue_application_evidence e
      where e.storage_bucket = bucket_id
        and e.storage_path = name
        and public.state_revenue_can_access_application(e.application_id)
    )
  );
