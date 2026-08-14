-- LCDBO Correspondence: two-party representative workflow.
-- Additive transition layer for RMRDC and Roseate Forte representatives.
-- This preserves legacy correspondence history while making the representative
-- workflow the default for new correspondence.

alter table public.lcdbo_correspondence_records
  add column if not exists initiating_institution_id uuid references public.institutions(id) on delete set null,
  add column if not exists action_institution_id uuid references public.institutions(id) on delete set null,
  add column if not exists simplified_status text,
  add column if not exists final_pdf_path text,
  add column if not exists final_pdf_hash text,
  add column if not exists final_pdf_generated_at timestamptz;

alter table public.lcdbo_correspondence_records drop constraint if exists lcdbo_correspondence_simplified_status_check;
alter table public.lcdbo_correspondence_records
  add constraint lcdbo_correspondence_simplified_status_check check (
    simplified_status is null
    or simplified_status in (
      'draft',
      'awaiting_roseate',
      'awaiting_rmrdc',
      'returned_for_correction',
      'rejected',
      'ready_to_send',
      'sent',
      'delivery_failed',
      'response_received',
      'closed',
      'cancelled',
      'revoked',
      'superseded'
    )
  );

alter table public.lcdbo_correspondence_notification_jobs drop constraint if exists lcdbo_correspondence_notification_jobs_type_check;
alter table public.lcdbo_correspondence_notification_jobs
  add constraint lcdbo_correspondence_notification_jobs_type_check check (job_type in (
    'review_due_soon', 'review_overdue', 'approval_due_soon', 'approval_overdue',
    'awaiting_signature', 'signed_not_dispatched', 'delivery_failure',
    'response_due_three_days', 'response_due_one_day', 'response_overdue',
    'delegation_expiring', 'template_retiring',
    'representative_counterparty_action',
    'representative_returned_for_correction',
    'representative_rejected',
    'representative_ready_to_send'
  ));

create table if not exists public.lcdbo_correspondence_representative_authorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  representative_role text not null,
  authority_status text not null default 'active',
  authority_starts_at timestamptz not null default now(),
  authority_ends_at timestamptz,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_by uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  can_apply_signature boolean not null default false,
  can_dispatch boolean not null default false,
  is_primary boolean not null default false,
  signature_asset_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_correspondence_representative_role_check check (
    representative_role in ('rmrdc_representative', 'roseate_representative')
  ),
  constraint lcdbo_correspondence_representative_status_check check (
    authority_status in ('active', 'inactive', 'revoked', 'expired')
  ),
  constraint lcdbo_correspondence_representative_dates_check check (
    authority_ends_at is null or authority_ends_at > authority_starts_at
  ),
  constraint lcdbo_correspondence_representative_revocation_check check (
    (authority_status <> 'revoked' and revoked_at is null)
    or (authority_status = 'revoked' and revoked_at is not null)
  )
);

create unique index if not exists idx_lcdbo_correspondence_representative_active_user
  on public.lcdbo_correspondence_representative_authorities(user_id, programme_id, institution_id, representative_role)
  where authority_status = 'active';

create unique index if not exists idx_lcdbo_correspondence_representative_primary
  on public.lcdbo_correspondence_representative_authorities(programme_id, institution_id, representative_role)
  where authority_status = 'active' and is_primary = true;

create index if not exists idx_lcdbo_correspondence_records_representative_status
  on public.lcdbo_correspondence_records(programme_id, simplified_status, initiating_institution_id, action_institution_id, updated_at desc);

create index if not exists idx_lcdbo_correspondence_representative_lookup
  on public.lcdbo_correspondence_representative_authorities(user_id, programme_id, authority_status, authority_ends_at);

drop trigger if exists set_lcdbo_correspondence_representative_authorities_updated_at on public.lcdbo_correspondence_representative_authorities;
create trigger set_lcdbo_correspondence_representative_authorities_updated_at before update on public.lcdbo_correspondence_representative_authorities
  for each row execute function public.set_platform_foundation_updated_at();

create or replace function public.lcdbo_correspondence_current_representative_authority(
  target_programme_id uuid,
  target_institution_id uuid default null
)
returns table (
  authority_id uuid,
  user_id uuid,
  institution_id uuid,
  representative_role text,
  can_apply_signature boolean,
  can_dispatch boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    authority.id as authority_id,
    authority.user_id,
    authority.institution_id,
    authority.representative_role,
    authority.can_apply_signature,
    authority.can_dispatch
  from public.lcdbo_correspondence_representative_authorities authority
  join public.users app_user on app_user.id = authority.user_id
  where app_user.auth_user_id = auth.uid()
    and authority.programme_id = target_programme_id
    and (target_institution_id is null or authority.institution_id = target_institution_id)
    and authority.authority_status = 'active'
    and authority.authority_starts_at <= now()
    and (authority.authority_ends_at is null or authority.authority_ends_at > now())
  order by authority.is_primary desc, authority.assigned_at desc
  limit 1
$$;

create or replace function public.lcdbo_correspondence_is_representative_for_record(
  target_record_id uuid,
  require_signature boolean default false,
  require_dispatch boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lcdbo_correspondence_records correspondence_record
    join public.lcdbo_correspondence_current_representative_authority(correspondence_record.programme_id, null) authority on true
    where correspondence_record.id = target_record_id
      and (
        correspondence_record.initiating_institution_id = authority.institution_id
        or correspondence_record.action_institution_id = authority.institution_id
        or correspondence_record.issuer = case
          when authority.representative_role = 'rmrdc_representative' then 'RMRDC'
          when authority.representative_role = 'roseate_representative' then 'RFNL'
          else null
        end
        or coalesce(correspondence_record.metadata->>'institution_scope', '') = case
          when authority.representative_role = 'rmrdc_representative' then 'rmrdc'
          when authority.representative_role = 'roseate_representative' then 'roseate'
          else ''
        end
        or coalesce(correspondence_record.metadata->>'institution_scope', '') = 'joint'
      )
      and (require_signature = false or authority.can_apply_signature = true)
      and (require_dispatch = false or (
        authority.can_dispatch = true
        and correspondence_record.initiating_institution_id = authority.institution_id
      ))
  )
$$;

revoke all on function public.lcdbo_correspondence_current_representative_authority(uuid, uuid) from anon;
revoke all on function public.lcdbo_correspondence_is_representative_for_record(uuid, boolean, boolean) from anon;
revoke all on function public.lcdbo_correspondence_current_representative_authority(uuid, uuid) from public;
revoke all on function public.lcdbo_correspondence_is_representative_for_record(uuid, boolean, boolean) from public;
grant execute on function public.lcdbo_correspondence_current_representative_authority(uuid, uuid) to authenticated;
grant execute on function public.lcdbo_correspondence_is_representative_for_record(uuid, boolean, boolean) to authenticated;

alter table public.lcdbo_correspondence_representative_authorities enable row level security;

drop policy if exists "LCDBO correspondence representatives can read own authority" on public.lcdbo_correspondence_representative_authorities;
create policy "LCDBO correspondence representatives can read own authority"
  on public.lcdbo_correspondence_representative_authorities for select
  using (user_id = public.lcdbo_correspondence_current_app_user_id());

drop policy if exists "LCDBO correspondence admins can manage representative authority" on public.lcdbo_correspondence_representative_authorities;
create policy "LCDBO correspondence admins can manage representative authority"
  on public.lcdbo_correspondence_representative_authorities for all
  using (
    public.lcdbo_correspondence_has_scoped_role(programme_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin'
    ], institution_id)
  )
  with check (
    public.lcdbo_correspondence_has_scoped_role(programme_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin', 'records_admin'
    ], institution_id)
  );

drop policy if exists "LCDBO correspondence participants can read records" on public.lcdbo_correspondence_records;
create policy "LCDBO correspondence participants can read records"
  on public.lcdbo_correspondence_records for select
  using (
    public.lcdbo_correspondence_can_access_record(id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'requester', 'drafter', 'rmrdc_reviewer',
      'roseate_reviewer', 'joint_secretariat', 'rmrdc_signatory',
      'roseate_signatory', 'signatory_delegate', 'dispatch_officer',
      'data_analyst', 'auditor', 'observer',
      'rmrdc_representative', 'roseate_representative'
    ])
    or public.lcdbo_correspondence_is_representative_for_record(id)
  );

drop policy if exists "LCDBO correspondence writers can create records" on public.lcdbo_correspondence_records;
create policy "LCDBO correspondence writers can create records"
  on public.lcdbo_correspondence_records for insert
  with check (
    created_by = public.lcdbo_correspondence_current_app_user_id()
    and (
      public.lcdbo_correspondence_has_role(programme_id, array[
        'programme_officer', 'institution_admin', 'correspondence_admin',
        'records_admin', 'requester', 'drafter', 'joint_secretariat'
      ])
      or exists (
        select 1
        from public.lcdbo_correspondence_current_representative_authority(programme_id, initiating_institution_id) authority
        where authority.user_id = created_by
          and authority.institution_id = initiating_institution_id
      )
    )
  );

drop policy if exists "LCDBO correspondence operators can update records" on public.lcdbo_correspondence_records;
create policy "LCDBO correspondence operators can update records"
  on public.lcdbo_correspondence_records for update
  using (
    public.lcdbo_correspondence_can_access_record(id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'drafter', 'rmrdc_reviewer', 'roseate_reviewer',
      'joint_secretariat', 'rmrdc_signatory', 'roseate_signatory',
      'signatory_delegate', 'dispatch_officer'
    ])
    or public.lcdbo_correspondence_is_representative_for_record(id)
  )
  with check (
    public.lcdbo_correspondence_can_access_record(id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'drafter', 'rmrdc_reviewer', 'roseate_reviewer',
      'joint_secretariat', 'rmrdc_signatory', 'roseate_signatory',
      'signatory_delegate', 'dispatch_officer'
    ])
    or public.lcdbo_correspondence_is_representative_for_record(id)
  );

drop policy if exists "LCDBO correspondence representatives can read contacts" on public.lcdbo_correspondence_contacts;
create policy "LCDBO correspondence representatives can read contacts"
  on public.lcdbo_correspondence_contacts for select
  using (
    exists (
      select 1
      from public.lcdbo_correspondence_current_representative_authority(programme_id, null)
    )
  );

drop policy if exists "LCDBO correspondence representatives can read approved templates" on public.lcdbo_correspondence_templates;
create policy "LCDBO correspondence representatives can read approved templates"
  on public.lcdbo_correspondence_templates for select
  using (
    status = 'approved'
    and exists (
      select 1
      from public.lcdbo_correspondence_current_representative_authority(programme_id, null)
    )
  );

drop policy if exists "LCDBO correspondence representatives can create document versions" on public.lcdbo_correspondence_document_versions;
create policy "LCDBO correspondence representatives can create document versions"
  on public.lcdbo_correspondence_document_versions for insert
  with check (
    created_by = public.lcdbo_correspondence_current_app_user_id()
    and exists (
      select 1
      from public.lcdbo_correspondence_records correspondence_record
      join public.lcdbo_correspondence_current_representative_authority(correspondence_record.programme_id, correspondence_record.initiating_institution_id) authority on true
      where correspondence_record.id = lcdbo_correspondence_document_versions.record_id
        and correspondence_record.initiating_institution_id = authority.institution_id
        and correspondence_record.status in ('draft', 'revision_requested')
        and coalesce(correspondence_record.simplified_status, 'draft') in ('draft', 'returned_for_correction')
    )
  );

drop policy if exists "LCDBO correspondence representatives can update draft document versions" on public.lcdbo_correspondence_document_versions;
create policy "LCDBO correspondence representatives can update draft document versions"
  on public.lcdbo_correspondence_document_versions for update
  using (
    is_frozen = false
    and exists (
      select 1
      from public.lcdbo_correspondence_records correspondence_record
      join public.lcdbo_correspondence_current_representative_authority(correspondence_record.programme_id, correspondence_record.initiating_institution_id) authority on true
      where correspondence_record.id = lcdbo_correspondence_document_versions.record_id
        and correspondence_record.initiating_institution_id = authority.institution_id
        and correspondence_record.status in ('draft', 'revision_requested')
    )
  )
  with check (
    is_frozen = false
    and exists (
      select 1
      from public.lcdbo_correspondence_records correspondence_record
      join public.lcdbo_correspondence_current_representative_authority(correspondence_record.programme_id, correspondence_record.initiating_institution_id) authority on true
      where correspondence_record.id = lcdbo_correspondence_document_versions.record_id
        and correspondence_record.initiating_institution_id = authority.institution_id
        and correspondence_record.status in ('draft', 'revision_requested')
    )
  );

drop policy if exists "LCDBO correspondence representatives can record workflow actions" on public.lcdbo_correspondence_workflow_actions;
create policy "LCDBO correspondence representatives can record workflow actions"
  on public.lcdbo_correspondence_workflow_actions for insert
  with check (
    actor_user_id = public.lcdbo_correspondence_current_app_user_id()
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_workflow_actions.record_id)
  );

drop policy if exists "LCDBO correspondence representatives can record approval decisions" on public.lcdbo_correspondence_approvals;
create policy "LCDBO correspondence representatives can record approval decisions"
  on public.lcdbo_correspondence_approvals for insert
  with check (
    approver_id = public.lcdbo_correspondence_current_app_user_id()
    and decision in ('approved', 'rejected', 'revision_requested')
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_approvals.record_id, true, false)
    and exists (
      select 1
      from public.lcdbo_correspondence_records correspondence_record
      join public.lcdbo_correspondence_current_representative_authority(correspondence_record.programme_id, null) authority on true
      where correspondence_record.id = lcdbo_correspondence_approvals.record_id
        and lcdbo_correspondence_approvals.document_version_id = correspondence_record.current_version_id
        and (
          (authority.representative_role = 'rmrdc_representative' and lcdbo_correspondence_approvals.approval_role = 'rmrdc_reviewer')
          or (authority.representative_role = 'roseate_representative' and lcdbo_correspondence_approvals.approval_role = 'roseate_reviewer')
        )
    )
  );

drop policy if exists "LCDBO correspondence representatives can update own approval decisions" on public.lcdbo_correspondence_approvals;
create policy "LCDBO correspondence representatives can update own approval decisions"
  on public.lcdbo_correspondence_approvals for update
  using (
    approver_id = public.lcdbo_correspondence_current_app_user_id()
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_approvals.record_id, true, false)
  )
  with check (
    approver_id = public.lcdbo_correspondence_current_app_user_id()
    and decision in ('approved', 'rejected', 'revision_requested')
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_approvals.record_id, true, false)
  );

drop policy if exists "LCDBO correspondence representatives can sign for own institution" on public.lcdbo_correspondence_signature_events;
create policy "LCDBO correspondence representatives can sign for own institution"
  on public.lcdbo_correspondence_signature_events for insert
  with check (
    signatory_id = public.lcdbo_correspondence_current_app_user_id()
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_signature_events.record_id, true, false)
    and exists (
      select 1
      from public.lcdbo_correspondence_records correspondence_record
      join public.lcdbo_correspondence_current_representative_authority(correspondence_record.programme_id, null) authority on true
      where correspondence_record.id = lcdbo_correspondence_signature_events.record_id
        and lcdbo_correspondence_signature_events.document_version_id = correspondence_record.current_version_id
        and (
          (authority.representative_role = 'rmrdc_representative' and lcdbo_correspondence_signature_events.signature_role = 'rmrdc_signatory')
          or (authority.representative_role = 'roseate_representative' and lcdbo_correspondence_signature_events.signature_role = 'roseate_signatory')
        )
    )
  );

drop policy if exists "LCDBO correspondence representatives can record owned dispatch" on public.lcdbo_correspondence_dispatch_events;
create policy "LCDBO correspondence representatives can record owned dispatch"
  on public.lcdbo_correspondence_dispatch_events for insert
  with check (
    dispatched_by = public.lcdbo_correspondence_current_app_user_id()
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_dispatch_events.record_id, false, true)
    and exists (
      select 1
      from public.lcdbo_correspondence_records correspondence_record
      where correspondence_record.id = lcdbo_correspondence_dispatch_events.record_id
        and coalesce(correspondence_record.simplified_status, '') = 'ready_to_send'
        and correspondence_record.status in ('ready_for_dispatch', 'dispatch_failed')
        and exists (
          select 1
          from public.lcdbo_correspondence_signature_events signature
          where signature.record_id = correspondence_record.id
            and signature.document_version_id = correspondence_record.current_version_id
            and signature.signature_role = 'rmrdc_signatory'
        )
        and exists (
          select 1
          from public.lcdbo_correspondence_signature_events signature
          where signature.record_id = correspondence_record.id
            and signature.document_version_id = correspondence_record.current_version_id
            and signature.signature_role = 'roseate_signatory'
        )
    )
  );

drop policy if exists "LCDBO correspondence representatives can create verification records" on public.lcdbo_correspondence_verification_records;
create policy "LCDBO correspondence representatives can create verification records"
  on public.lcdbo_correspondence_verification_records for insert
  with check (
    status = 'valid'
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_verification_records.record_id, true, false)
    and exists (
      select 1
      from public.lcdbo_correspondence_records correspondence_record
      where correspondence_record.id = lcdbo_correspondence_verification_records.record_id
        and correspondence_record.current_version_id is not null
    )
  );

drop policy if exists "LCDBO correspondence representatives can queue notifications" on public.lcdbo_correspondence_notification_jobs;
create policy "LCDBO correspondence representatives can queue notifications"
  on public.lcdbo_correspondence_notification_jobs for insert
  with check (
    job_type in (
      'representative_counterparty_action',
      'representative_returned_for_correction',
      'representative_rejected',
      'representative_ready_to_send'
    )
    and status = 'pending'
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_notification_jobs.record_id)
  );

drop policy if exists "LCDBO correspondence representatives can maintain queued notifications" on public.lcdbo_correspondence_notification_jobs;
create policy "LCDBO correspondence representatives can maintain queued notifications"
  on public.lcdbo_correspondence_notification_jobs for update
  using (
    job_type in (
      'representative_counterparty_action',
      'representative_returned_for_correction',
      'representative_rejected',
      'representative_ready_to_send'
    )
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_notification_jobs.record_id)
  )
  with check (
    job_type in (
      'representative_counterparty_action',
      'representative_returned_for_correction',
      'representative_rejected',
      'representative_ready_to_send'
    )
    and status in ('pending', 'skipped', 'failed')
    and public.lcdbo_correspondence_is_representative_for_record(lcdbo_correspondence_notification_jobs.record_id)
  );

revoke all on table public.lcdbo_correspondence_representative_authorities from anon;
grant select, insert, update on table public.lcdbo_correspondence_representative_authorities to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_approvals to authenticated;
grant select, insert on table public.lcdbo_correspondence_verification_records to authenticated;
grant select, insert, update on table public.lcdbo_correspondence_notification_jobs to authenticated;
