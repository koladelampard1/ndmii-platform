-- LCDBO Correspondence Management workflow RLS remediation.
-- Additive patch from non-signatory UAT signed-session testing.
--
-- Fixes intended user-context workflow writes for document versions,
-- workflow actions, approvals, dispatch events and delivery-evidence review,
-- while adding institution-aware record access for RMRDC/Roseate scoped roles.

create or replace function public.lcdbo_correspondence_institution_for_record(
  target_record_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with target_record as (
    select r.issuer, r.metadata
    from public.lcdbo_correspondence_records r
    where r.id = target_record_id
    limit 1
  ),
  target_scope as (
    select case
      when lower(coalesce(target_record.metadata->>'institution_scope', '')) in ('rmrdc', 'raw_materials_research_and_development_council') then 'rmrdc'
      when lower(coalesce(target_record.metadata->>'institution_scope', '')) in ('roseate', 'roseate_forte', 'rfnl') then 'roseate-forte-nigeria-limited'
      when lower(coalesce(target_record.metadata->>'institution_scope', '')) = 'joint' then null
      when target_record.issuer = 'RMRDC' then 'rmrdc'
      when target_record.issuer = 'RFNL' then 'roseate-forte-nigeria-limited'
      else null
    end as institution_slug
    from target_record
  )
  select i.id
  from target_scope s
  join public.institutions i on i.slug = s.institution_slug
  limit 1
$$;

create or replace function public.lcdbo_correspondence_has_scoped_role(
  target_programme_id uuid,
  allowed_roles text[],
  target_institution_id uuid default null
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
              or (
                ra.scope_type = 'programme'
                and ra.scope_id = target_programme_id
                and (
                  target_institution_id is null
                  or (
                    ra.institution_id is null
                    and ra.role in (
                      'programme_officer',
                      'institution_admin',
                      'correspondence_admin',
                      'records_admin',
                      'data_analyst',
                      'auditor',
                      'observer'
                    )
                  )
                  or ra.institution_id = target_institution_id
                )
              )
              or (
                target_institution_id is not null
                and ra.institution_id = target_institution_id
              )
            )
        )
      )
  )
$$;

create or replace function public.lcdbo_correspondence_can_access_record(
  target_record_id uuid,
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
    from public.lcdbo_correspondence_records r
    where r.id = target_record_id
      and (
        public.lcdbo_correspondence_current_app_user_id() in (r.owner_id, r.requester_id, r.drafter_id, r.current_assignee_id)
        or public.lcdbo_correspondence_has_scoped_role(
          r.programme_id,
          allowed_roles,
          public.lcdbo_correspondence_institution_for_record(r.id)
        )
      )
  )
$$;

revoke all on function public.lcdbo_correspondence_institution_for_record(uuid) from anon;
revoke all on function public.lcdbo_correspondence_has_scoped_role(uuid, text[], uuid) from anon;
revoke all on function public.lcdbo_correspondence_can_access_record(uuid, text[]) from anon;
revoke all on function public.lcdbo_correspondence_institution_for_record(uuid) from public;
revoke all on function public.lcdbo_correspondence_has_scoped_role(uuid, text[], uuid) from public;
revoke all on function public.lcdbo_correspondence_can_access_record(uuid, text[]) from public;
grant execute on function public.lcdbo_correspondence_institution_for_record(uuid) to authenticated;
grant execute on function public.lcdbo_correspondence_has_scoped_role(uuid, text[], uuid) to authenticated;
grant execute on function public.lcdbo_correspondence_can_access_record(uuid, text[]) to authenticated;

drop policy if exists "LCDBO correspondence participants can read records" on public.lcdbo_correspondence_records;
create policy "LCDBO correspondence participants can read records"
  on public.lcdbo_correspondence_records for select
  using (
    public.lcdbo_correspondence_can_access_record(id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'requester', 'drafter', 'rmrdc_reviewer',
      'roseate_reviewer', 'joint_secretariat', 'rmrdc_signatory',
      'roseate_signatory', 'signatory_delegate', 'dispatch_officer',
      'data_analyst', 'auditor', 'observer'
    ])
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
  )
  with check (
    public.lcdbo_correspondence_can_access_record(id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'drafter', 'rmrdc_reviewer', 'roseate_reviewer',
      'joint_secretariat', 'rmrdc_signatory', 'roseate_signatory',
      'signatory_delegate', 'dispatch_officer'
    ])
  );

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
        public.lcdbo_correspondence_can_access_record(record_id, array[
          ''programme_officer'', ''institution_admin'', ''correspondence_admin'',
          ''records_admin'', ''requester'', ''drafter'', ''rmrdc_reviewer'',
          ''roseate_reviewer'', ''joint_secretariat'', ''rmrdc_signatory'',
          ''roseate_signatory'', ''signatory_delegate'', ''dispatch_officer'',
          ''data_analyst'', ''auditor'', ''observer''
        ])
      )',
      table_name,
      table_name
    );
  end loop;
end;
$$;

drop policy if exists "LCDBO correspondence writers can create document versions" on public.lcdbo_correspondence_document_versions;
create policy "LCDBO correspondence writers can create document versions"
  on public.lcdbo_correspondence_document_versions for insert
  with check (
    created_by = public.lcdbo_correspondence_current_app_user_id()
    and public.lcdbo_correspondence_can_access_record(record_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'requester', 'drafter', 'joint_secretariat'
    ])
  );

drop policy if exists "LCDBO correspondence writers can update draft document versions" on public.lcdbo_correspondence_document_versions;
create policy "LCDBO correspondence writers can update draft document versions"
  on public.lcdbo_correspondence_document_versions for update
  using (
    is_frozen = false
    and public.lcdbo_correspondence_can_access_record(record_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'requester', 'drafter', 'joint_secretariat'
    ])
  )
  with check (
    is_frozen = false
    and public.lcdbo_correspondence_can_access_record(record_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'requester', 'drafter', 'joint_secretariat'
    ])
  );

drop policy if exists "LCDBO correspondence actors can record workflow actions" on public.lcdbo_correspondence_workflow_actions;
create policy "LCDBO correspondence actors can record workflow actions"
  on public.lcdbo_correspondence_workflow_actions for insert
  with check (
    actor_user_id = public.lcdbo_correspondence_current_app_user_id()
    and public.lcdbo_correspondence_can_access_record(record_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin', 'requester', 'drafter', 'rmrdc_reviewer',
      'roseate_reviewer', 'joint_secretariat', 'dispatch_officer'
    ])
  );

drop policy if exists "LCDBO correspondence reviewers can record approvals" on public.lcdbo_correspondence_approvals;
create policy "LCDBO correspondence reviewers can record approvals"
  on public.lcdbo_correspondence_approvals for insert
  with check (
    approver_id = public.lcdbo_correspondence_current_app_user_id()
    and approval_role in ('rmrdc_reviewer', 'roseate_reviewer', 'joint_secretariat', 'correspondence_admin')
    and public.lcdbo_correspondence_can_access_record(record_id, array[approval_role])
    and not exists (
      select 1
      from public.lcdbo_correspondence_records r
      where r.id = record_id
        and decision = 'approved'
        and r.created_by = approver_id
    )
  );

drop policy if exists "LCDBO correspondence reviewers can update own approvals" on public.lcdbo_correspondence_approvals;
create policy "LCDBO correspondence reviewers can update own approvals"
  on public.lcdbo_correspondence_approvals for update
  using (
    approver_id = public.lcdbo_correspondence_current_app_user_id()
    and public.lcdbo_correspondence_can_access_record(record_id, array[approval_role])
  )
  with check (
    approver_id = public.lcdbo_correspondence_current_app_user_id()
    and public.lcdbo_correspondence_can_access_record(record_id, array[approval_role])
  );

drop policy if exists "LCDBO correspondence dispatch officers can record dispatch" on public.lcdbo_correspondence_dispatch_events;
create policy "LCDBO correspondence dispatch officers can record dispatch"
  on public.lcdbo_correspondence_dispatch_events for insert
  with check (
    dispatched_by = public.lcdbo_correspondence_current_app_user_id()
    and exists (
      select 1
      from public.lcdbo_correspondence_records r
      where r.id = record_id
        and r.status in ('signed', 'ready_for_dispatch', 'dispatch_failed')
        and public.lcdbo_correspondence_can_access_record(r.id, array[
          'programme_officer', 'institution_admin', 'correspondence_admin',
          'records_admin', 'dispatch_officer'
        ])
        and exists (
          select 1
          from public.lcdbo_correspondence_signature_events s
          where s.record_id = r.id
        )
    )
  );

drop policy if exists "LCDBO correspondence operators can update delivery evidence" on public.lcdbo_correspondence_delivery_evidence;
create policy "LCDBO correspondence operators can update delivery evidence"
  on public.lcdbo_correspondence_delivery_evidence for update
  using (
    public.lcdbo_correspondence_can_access_record(record_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin'
    ])
  )
  with check (
    public.lcdbo_correspondence_can_access_record(record_id, array[
      'programme_officer', 'institution_admin', 'correspondence_admin',
      'records_admin'
    ])
    and (
      status <> 'invalidated'
      or invalidated_by = public.lcdbo_correspondence_current_app_user_id()
    )
  );
