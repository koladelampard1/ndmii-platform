-- LCDBO Phase 4 preflight audit (SELECT-only).
-- Safe to run before applying 20260620160000_lcdbo_cluster_operations_phase4.sql.
-- Every result row is an issue to review. Empty result sets are passes.
-- This file performs no DDL, DML, function execution, or data mutation.

-- 0. Required Phase 1/Phase 3 relations must exist.
select
  required.object_name,
  'blocker'::text as severity,
  'required_relation_missing'::text as issue
from (values
  ('public.users'),
  ('public.msmes'),
  ('public.institutions'),
  ('public.programmes'),
  ('public.role_assignments'),
  ('public.industrial_clusters'),
  ('public.cluster_members'),
  ('public.platform_events')
) as required(object_name)
where to_regclass(required.object_name) is null
order by required.object_name;

-- 0a. Required Phase 1/Phase 3 helper functions must exist with the expected signatures.
select
  required.function_signature,
  'blocker'::text as severity,
  'required_function_missing'::text as issue
from (values
  ('public.set_platform_foundation_updated_at()'),
  ('public.lcdbo_current_app_user_id()'),
  ('public.lcdbo_can_review_programme(uuid)')
) as required(function_signature)
where to_regprocedure(required.function_signature) is null
order by required.function_signature;

-- 1. Rows that will fail the replacement cluster_members status constraint.
select
  cm.id as cluster_member_id,
  cm.cluster_id,
  cm.msme_id,
  cm.institution_id,
  cm.member_type,
  cm.status,
  'blocker'::text as severity,
  'invalid_cluster_member_status'::text as issue
from public.cluster_members cm
where cm.status is null
   or cm.status not in (
     'invited', 'interested', 'under_review', 'accepted', 'onboarding',
     'needs_documents', 'active', 'placed', 'inactive', 'rejected',
     'waitlisted', 'withdrawn', 'paused', 'exited', 'removed'
   )
order by cm.created_at, cm.id;

-- 2. MSME membership duplicates. These conflict with the Phase 3 uniqueness
-- assumption and make assignment/assessment ownership ambiguous in Phase 4.
select
  cm.cluster_id,
  cm.msme_id,
  count(*) as duplicate_count,
  array_agg(cm.id order by cm.created_at, cm.id) as cluster_member_ids,
  array_agg(cm.status order by cm.created_at, cm.id) as statuses,
  'blocker'::text as severity,
  'duplicate_msme_cluster_membership'::text as issue
from public.cluster_members cm
where cm.member_type = 'msme'
  and cm.msme_id is not null
group by cm.cluster_id, cm.msme_id
having count(*) > 1
order by count(*) desc, cm.cluster_id, cm.msme_id;

-- 2a. Subject/member_type combinations that violate Phase 4 operational assumptions.
select
  cm.id as cluster_member_id,
  cm.cluster_id,
  cm.msme_id,
  cm.institution_id,
  cm.member_type,
  cm.status,
  case
    when cm.msme_id is null and cm.institution_id is null then 'missing_member_subject'
    when cm.msme_id is not null and cm.institution_id is not null then 'multiple_member_subjects'
    when cm.member_type = 'msme' and cm.msme_id is null then 'msme_type_without_msme'
    when cm.member_type <> 'msme' and cm.msme_id is not null then 'non_msme_type_with_msme'
    when cm.status in ('accepted', 'onboarding', 'needs_documents', 'active', 'placed', 'inactive') and cm.msme_id is null then 'operational_status_without_msme'
  end as issue,
  'blocker'::text as severity
from public.cluster_members cm
where (cm.msme_id is null and cm.institution_id is null)
   or (cm.msme_id is not null and cm.institution_id is not null)
   or (cm.member_type = 'msme' and cm.msme_id is null)
   or (cm.member_type <> 'msme' and cm.msme_id is not null)
   or (cm.status in ('accepted', 'onboarding', 'needs_documents', 'active', 'placed', 'inactive') and cm.msme_id is null)
order by cm.created_at, cm.id;

-- 2b. Operational members outside LCDBO. They do not block DDL, but the Phase 4
-- dashboard and RLS helpers assume operational records belong to a programme cluster.
select
  cm.id as cluster_member_id,
  cm.status,
  cm.cluster_id,
  c.name as cluster_name,
  c.programme_id,
  p.slug as programme_slug,
  'warning'::text as severity,
  case when c.programme_id is null then 'operational_cluster_has_no_programme'
       else 'operational_member_is_not_lcdbo'
  end as issue
from public.cluster_members cm
join public.industrial_clusters c on c.id = cm.cluster_id
left join public.programmes p on p.id = c.programme_id
where cm.status in ('accepted', 'onboarding', 'needs_documents', 'active', 'placed', 'inactive')
  and p.slug is distinct from 'local-content-development-beyond-oil'
order by cm.created_at, cm.id;

-- 3. Optional assignment values that are malformed. to_jsonb keeps this query
-- runnable when Phase 4 columns have not been added yet.
with assignment_values as (
  select
    cm.id,
    cm.cluster_id,
    cm.msme_id,
    nullif(to_jsonb(cm) ->> 'assigned_officer_id', '') as assigned_officer_text,
    nullif(to_jsonb(cm) ->> 'assigned_by', '') as assigned_by_text,
    nullif(to_jsonb(cm) ->> 'assigned_at', '') as assigned_at_text,
    nullif(to_jsonb(cm) ->> 'assignment_notes', '') as assignment_notes
  from public.cluster_members cm
)
select
  av.*,
  'blocker'::text as severity,
  case
    when av.assigned_officer_text is not null
      and av.assigned_officer_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then 'invalid_assigned_officer_uuid'
    when av.assigned_by_text is not null
      and av.assigned_by_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then 'invalid_assigned_by_uuid'
    when av.assigned_at_text is not null
      and av.assigned_at_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T]'
      then 'invalid_assigned_at_value'
  end as issue
from assignment_values av
where (av.assigned_officer_text is not null and av.assigned_officer_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
   or (av.assigned_by_text is not null and av.assigned_by_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
   or (av.assigned_at_text is not null and av.assigned_at_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T]')
order by av.id;

-- 3a. Assignment references that do not resolve to users.
with normalized_assignments as (
  select
    cm.id,
    cm.cluster_id,
    cm.msme_id,
    case when nullif(to_jsonb(cm) ->> 'assigned_officer_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (to_jsonb(cm) ->> 'assigned_officer_id')::uuid end as assigned_officer_id,
    case when nullif(to_jsonb(cm) ->> 'assigned_by', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (to_jsonb(cm) ->> 'assigned_by')::uuid end as assigned_by
  from public.cluster_members cm
)
select
  na.id as cluster_member_id,
  na.cluster_id,
  na.msme_id,
  na.assigned_officer_id,
  na.assigned_by,
  'blocker'::text as severity,
  case
    when na.assigned_officer_id is not null and officer.id is null then 'assigned_officer_user_missing'
    when na.assigned_by is not null and assigner.id is null then 'assigned_by_user_missing'
  end as issue
from normalized_assignments na
left join public.users officer on officer.id = na.assigned_officer_id
left join public.users assigner on assigner.id = na.assigned_by
where (na.assigned_officer_id is not null and officer.id is null)
   or (na.assigned_by is not null and assigner.id is null)
order by na.id;

-- 3b. Incomplete or stale assignment metadata.
with assignment_values as (
  select
    cm.id,
    cm.cluster_id,
    cm.msme_id,
    nullif(to_jsonb(cm) ->> 'assigned_officer_id', '') as assigned_officer_id,
    nullif(to_jsonb(cm) ->> 'assigned_by', '') as assigned_by,
    nullif(to_jsonb(cm) ->> 'assigned_at', '') as assigned_at,
    nullif(btrim(to_jsonb(cm) ->> 'assignment_notes'), '') as assignment_notes
  from public.cluster_members cm
)
select
  av.*,
  'warning'::text as severity,
  case
    when av.assigned_officer_id is not null and av.assigned_by is null then 'assignment_missing_assigner'
    when av.assigned_officer_id is not null and av.assigned_at is null then 'assignment_missing_timestamp'
    when av.assigned_officer_id is null and (av.assigned_at is not null or av.assignment_notes is not null) then 'cleared_assignment_has_stale_metadata'
  end as issue
from assignment_values av
where (av.assigned_officer_id is not null and av.assigned_by is null)
   or (av.assigned_officer_id is not null and av.assigned_at is null)
   or (av.assigned_officer_id is null and (av.assigned_at is not null or av.assignment_notes is not null))
order by av.id;

-- 3c. Same MSME/cluster combination associated with multiple officers.
with normalized_assignments as (
  select
    cm.id,
    cm.cluster_id,
    cm.msme_id,
    case when nullif(to_jsonb(cm) ->> 'assigned_officer_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (to_jsonb(cm) ->> 'assigned_officer_id')::uuid end as assigned_officer_id
  from public.cluster_members cm
  where cm.msme_id is not null
)
select
  na.cluster_id,
  na.msme_id,
  count(*) as membership_row_count,
  count(distinct na.assigned_officer_id) as distinct_officer_count,
  array_agg(na.id order by na.id) as cluster_member_ids,
  array_agg(distinct na.assigned_officer_id) filter (where na.assigned_officer_id is not null) as assigned_officer_ids,
  'blocker'::text as severity,
  'conflicting_duplicate_assignments'::text as issue
from normalized_assignments na
group by na.cluster_id, na.msme_id
having count(distinct na.assigned_officer_id) > 1
order by na.cluster_id, na.msme_id;

-- 4. Broken references in existing cluster membership data. Existing FKs should
-- prevent these, but this detects unvalidated/disabled constraints or imported data.
select
  cm.id as cluster_member_id,
  cm.cluster_id,
  cm.msme_id,
  cm.institution_id,
  'blocker'::text as severity,
  case
    when c.id is null then 'cluster_reference_missing'
    when cm.msme_id is not null and m.id is null then 'msme_reference_missing'
    when cm.institution_id is not null and i.id is null then 'institution_reference_missing'
  end as issue
from public.cluster_members cm
left join public.industrial_clusters c on c.id = cm.cluster_id
left join public.msmes m on m.id = cm.msme_id
left join public.institutions i on i.id = cm.institution_id
where c.id is null
   or (cm.msme_id is not null and m.id is null)
   or (cm.institution_id is not null and i.id is null)
order by cm.id;

-- 4a. Cluster/MSME relationship mismatches relevant to ownership and RLS.
select
  cm.id as cluster_member_id,
  cm.cluster_id,
  c.name as cluster_name,
  c.programme_id,
  cm.msme_id,
  m.business_name,
  m.created_by,
  'warning'::text as severity,
  case
    when c.programme_id is null then 'cluster_programme_missing'
    when cm.msme_id is not null and m.created_by is null then 'msme_owner_missing'
    when m.created_by is not null and owner.id is null then 'msme_owner_user_missing'
    when owner.id is not null and owner.auth_user_id is null then 'msme_owner_has_no_auth_link'
  end as issue
from public.cluster_members cm
join public.industrial_clusters c on c.id = cm.cluster_id
left join public.msmes m on m.id = cm.msme_id
left join public.users owner on owner.id = m.created_by
where c.programme_id is null
   or (cm.msme_id is not null and m.created_by is null)
   or (m.created_by is not null and owner.id is null)
   or (owner.id is not null and owner.auth_user_id is null)
order by cm.id;

-- 5. Phase 4 object-name collisions. Existing tables are blockers because
-- CREATE TABLE IF NOT EXISTS would silently reuse potentially incompatible schemas.
select
  objects.object_name,
  to_regclass(objects.object_name) as existing_relation,
  'blocker'::text as severity,
  'phase4_table_already_exists_review_schema_before_migration'::text as issue
from (values
  ('public.lcdbo_cluster_assessments'),
  ('public.lcdbo_document_requests'),
  ('public.lcdbo_document_submissions')
) as objects(object_name)
where to_regclass(objects.object_name) is not null
order by objects.object_name;

-- 5a. Existing Phase 4 assignment columns with incompatible data types.
select
  c.table_schema,
  c.table_name,
  expected.column_name,
  expected.expected_data_type,
  c.data_type as actual_data_type,
  c.udt_name as actual_udt_name,
  'blocker'::text as severity,
  'incompatible_existing_assignment_column'::text as issue
from (values
  ('assigned_officer_id', 'uuid'),
  ('assigned_by', 'uuid'),
  ('assigned_at', 'timestamp with time zone'),
  ('assignment_notes', 'text')
) as expected(column_name, expected_data_type)
join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'cluster_members'
 and c.column_name = expected.column_name
where c.data_type <> expected.expected_data_type
order by expected.column_name;

-- 5b. Index-name collisions or mismatched pre-existing definitions.
select
  idx.schemaname,
  idx.tablename,
  idx.indexname,
  idx.indexdef,
  'blocker'::text as severity,
  'phase4_index_name_collision_or_definition_mismatch'::text as issue
from pg_indexes idx
where idx.indexname in (
  'idx_cluster_members_assigned_officer',
  'idx_lcdbo_cluster_assessments_member',
  'idx_lcdbo_cluster_assessments_msme',
  'idx_lcdbo_document_requests_member',
  'idx_lcdbo_document_submissions_request',
  'idx_lcdbo_document_submissions_msme'
)
and not (
  (idx.schemaname = 'public' and idx.tablename = 'cluster_members' and idx.indexname = 'idx_cluster_members_assigned_officer'
    and idx.indexdef ilike '%(assigned_officer_id, status)%' and idx.indexdef ilike '%assigned_officer_id is not null%')
  or (idx.schemaname = 'public' and idx.tablename = 'lcdbo_cluster_assessments' and idx.indexname = 'idx_lcdbo_cluster_assessments_member'
    and idx.indexdef ilike '%(cluster_member_id, created_at desc)%')
  or (idx.schemaname = 'public' and idx.tablename = 'lcdbo_cluster_assessments' and idx.indexname = 'idx_lcdbo_cluster_assessments_msme'
    and idx.indexdef ilike '%(msme_id, created_at desc)%')
  or (idx.schemaname = 'public' and idx.tablename = 'lcdbo_document_requests' and idx.indexname = 'idx_lcdbo_document_requests_member'
    and idx.indexdef ilike '%(cluster_member_id, status, due_date)%')
  or (idx.schemaname = 'public' and idx.tablename = 'lcdbo_document_submissions' and idx.indexname = 'idx_lcdbo_document_submissions_request'
    and idx.indexdef ilike '%(request_id, submitted_at desc)%')
  or (idx.schemaname = 'public' and idx.tablename = 'lcdbo_document_submissions' and idx.indexname = 'idx_lcdbo_document_submissions_msme'
    and idx.indexdef ilike '%(msme_id, status)%')
)
order by idx.indexname;

-- 5c. Current indexes marked invalid/not ready. Any result should be repaired
-- before adding more operational indexes.
select
  ns.nspname as schema_name,
  tbl.relname as table_name,
  idx.relname as index_name,
  pi.indisvalid,
  pi.indisready,
  'blocker'::text as severity,
  'existing_index_invalid_or_not_ready'::text as issue
from pg_index pi
join pg_class idx on idx.oid = pi.indexrelid
join pg_class tbl on tbl.oid = pi.indrelid
join pg_namespace ns on ns.oid = tbl.relnamespace
where ns.nspname = 'public'
  and tbl.relname in ('cluster_members', 'lcdbo_cluster_assessments', 'lcdbo_document_requests', 'lcdbo_document_submissions')
  and (not pi.indisvalid or not pi.indisready)
order by tbl.relname, idx.relname;

-- 6. Duplicate auth mappings make lcdbo_current_app_user_id() nondeterministic.
select
  u.auth_user_id,
  count(*) as user_row_count,
  array_agg(u.id order by u.id) as app_user_ids,
  array_agg(u.role order by u.id) as roles,
  'blocker'::text as severity,
  'duplicate_auth_user_mapping'::text as issue
from public.users u
where u.auth_user_id is not null
group by u.auth_user_id
having count(*) > 1
order by count(*) desc, u.auth_user_id;

-- 6a. Assigned officers without authentication links cannot satisfy RLS.
with normalized_assignments as (
  select
    cm.id,
    cm.cluster_id,
    case when nullif(to_jsonb(cm) ->> 'assigned_officer_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (to_jsonb(cm) ->> 'assigned_officer_id')::uuid end as assigned_officer_id
  from public.cluster_members cm
)
select
  na.id as cluster_member_id,
  na.cluster_id,
  u.id as assigned_officer_id,
  u.email,
  u.role,
  'blocker'::text as severity,
  'assigned_officer_has_no_auth_user_id'::text as issue
from normalized_assignments na
join public.users u on u.id = na.assigned_officer_id
where u.auth_user_id is null
order by na.id;

-- 6b. Assigned users outside the application eligibility set and without an
-- active LCDBO programme-scoped operational role.
with lcdbo as (
  select id from public.programmes where slug = 'local-content-development-beyond-oil'
), normalized_assignments as (
  select
    cm.id,
    cm.cluster_id,
    case when nullif(to_jsonb(cm) ->> 'assigned_officer_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (to_jsonb(cm) ->> 'assigned_officer_id')::uuid end as assigned_officer_id
  from public.cluster_members cm
)
select
  na.id as cluster_member_id,
  na.cluster_id,
  u.id as assigned_officer_id,
  u.email,
  u.role,
  'warning'::text as severity,
  'assigned_user_not_in_lcdbo_officer_eligibility_set'::text as issue
from normalized_assignments na
join public.users u on u.id = na.assigned_officer_id
where coalesce(u.role, '') not in ('programme_officer', 'field_officer', 'assessment_officer', 'admin', 'super_admin')
  and not exists (
    select 1
    from public.role_assignments ra
    join lcdbo on true
    where ra.user_id = u.id
      and ra.scope_type = 'programme'
      and ra.scope_id = lcdbo.id
      and ra.role in ('programme_officer', 'field_officer', 'assessment_officer')
      and ra.status = 'active'
      and (ra.expires_at is null or ra.expires_at > now())
  )
order by na.id;

-- 6c. LCDBO programme identity must resolve to exactly one row.
select
  'local-content-development-beyond-oil'::text as programme_slug,
  count(*) as matching_rows,
  array_agg(p.id order by p.id) as programme_ids,
  'blocker'::text as severity,
  'lcdbo_programme_resolution_not_unique'::text as issue
from public.programmes p
where p.slug = 'local-content-development-beyond-oil'
having count(*) <> 1;

-- 6d. Global reviewers without auth links cannot pass lcdbo_can_review_programme().
select
  u.id as user_id,
  u.email,
  u.role,
  u.auth_user_id,
  'blocker'::text as severity,
  'global_lcdbo_reviewer_has_no_auth_link'::text as issue
from public.users u
where u.role in ('admin', 'super_admin', 'programme_officer')
  and u.auth_user_id is null
order by u.role, u.id;

-- 6e. Active programme role assignments that cannot authorize correctly.
select
  ra.id as role_assignment_id,
  ra.user_id,
  ra.role,
  ra.scope_type,
  ra.scope_id,
  ra.status,
  ra.expires_at,
  'warning'::text as severity,
  case
    when u.id is null then 'role_assignment_user_missing'
    when ra.scope_id is null then 'programme_role_scope_missing'
    when p.id is null then 'programme_role_scope_not_found'
    when u.auth_user_id is null then 'programme_role_user_has_no_auth_link'
    when ra.expires_at is not null and ra.expires_at <= now() then 'active_role_assignment_is_expired'
  end as issue
from public.role_assignments ra
left join public.users u on u.id = ra.user_id
left join public.programmes p on p.id = ra.scope_id
where ra.scope_type = 'programme'
  and ra.role in ('programme_officer', 'field_officer', 'assessment_officer', 'institution_admin')
  and ra.status = 'active'
  and (
    u.id is null
    or ra.scope_id is null
    or p.id is null
    or u.auth_user_id is null
    or (ra.expires_at is not null and ra.expires_at <= now())
  )
order by ra.id;

-- 6f. Summary counts for a final human sanity check. This query always returns
-- one row and is informational, not a pass/fail result.
select
  (select count(*) from public.cluster_members) as total_cluster_members,
  (select count(*) from public.cluster_members where member_type = 'msme') as msme_cluster_members,
  (select count(*) from public.cluster_members where status in ('accepted', 'onboarding', 'needs_documents', 'active', 'placed', 'inactive')) as operational_members,
  (select count(*) from public.industrial_clusters where programme_id is null) as clusters_without_programmes,
  (select count(*) from public.programmes where slug = 'local-content-development-beyond-oil') as lcdbo_programme_rows,
  (select count(*) from public.users where auth_user_id is null) as users_without_auth_links,
  'informational'::text as severity,
  'preflight_summary'::text as issue;
