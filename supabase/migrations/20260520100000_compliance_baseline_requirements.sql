-- Ensure every MSME has uploadable baseline compliance requirements.
-- Existing current items are preserved; only missing MVP catalog items are added.

with inserted_items as (
  insert into public.msme_compliance_items (
    msme_id,
    requirement_id,
    regulator_id,
    status,
    is_required,
    source,
    metadata,
    created_at,
    updated_at
  )
  select
    m.id,
    req.id,
    req.regulator_id,
    'not_started'::public.compliance_item_status,
    req.is_mandatory,
    'system_generated',
    jsonb_build_object(
      'phase', 'phase1',
      'generated_reason', 'baseline_mvp_requirement',
      'certified_truth', false
    ),
    now(),
    now()
  from public.msmes m
  cross join public.compliance_requirement_definitions req
  where req.is_active = true
    and not exists (
      select 1
      from public.msme_compliance_items existing
      where existing.msme_id = m.id
        and existing.requirement_id = req.id
        and existing.renewal_of is null
    )
  returning id, msme_id, regulator_id, status, source, metadata
)
insert into public.compliance_events (
  msme_id,
  compliance_item_id,
  regulator_id,
  event_type,
  actor_type,
  actor_role,
  from_status,
  to_status,
  summary,
  metadata,
  created_at
)
select
  item.msme_id,
  item.id,
  item.regulator_id,
  'item_created',
  'system',
  'system',
  null,
  item.status::text,
  'Baseline compliance requirement prepared for evidence upload.',
  jsonb_build_object(
    'phase', 'phase1',
    'source', item.source,
    'generated_reason', 'baseline_mvp_requirement',
    'certified_truth', false
  ) || item.metadata,
  now()
from inserted_items item;

insert into public.msme_compliance_profiles (
  msme_id,
  overall_status,
  compliance_score,
  risk_level,
  total_required_count,
  approved_count,
  pending_count,
  under_review_count,
  changes_requested_count,
  rejected_count,
  expired_count,
  expiring_soon_count,
  suspended_count,
  revoked_count,
  last_submitted_at,
  last_reviewed_at,
  next_deadline_at,
  last_recalculated_at,
  metadata,
  created_at,
  updated_at
)
select
  m.id,
  case
    when count(item.id) filter (where item.status in ('suspended', 'revoked')) > 0 then 'suspended'::public.compliance_item_status
    when count(item.id) filter (where item.status = 'expired') > 0 then 'expired'::public.compliance_item_status
    when count(item.id) filter (where item.status = 'rejected') > 0 then 'rejected'::public.compliance_item_status
    when count(item.id) filter (where item.status = 'changes_requested') > 0 then 'changes_requested'::public.compliance_item_status
    when count(item.id) filter (where item.status in ('submitted', 'under_review')) > 0 then 'under_review'::public.compliance_item_status
    when count(item.id) filter (where item.is_required) > 0
      and count(item.id) filter (where item.is_required and item.status = 'approved') = count(item.id) filter (where item.is_required)
      then 'approved'::public.compliance_item_status
    else 'not_started'::public.compliance_item_status
  end,
  case
    when count(item.id) filter (where item.is_required) = 0 then 0
    else greatest(
      0,
      least(
        100,
        round(
          ((count(item.id) filter (where item.is_required and item.status = 'approved'))::numeric
            / nullif(count(item.id) filter (where item.is_required), 0)::numeric) * 100
        )::integer
        - (count(item.id) filter (where item.is_required and item.status in ('expired', 'suspended', 'revoked')) * 20)::integer
        - (count(item.id) filter (where item.is_required and item.status = 'rejected') * 10)::integer
      )
    )
  end,
  case
    when count(item.id) filter (where item.status in ('suspended', 'revoked', 'expired')) > 0 then 'critical'
    when count(item.id) filter (where item.status in ('rejected', 'changes_requested')) > 0 then 'high'
    when count(item.id) filter (where item.status in ('not_started', 'draft', 'submitted', 'under_review')) > 0 then 'medium'
    when count(item.id) > 0 then 'low'
    else 'medium'
  end,
  count(item.id) filter (where item.is_required)::integer,
  count(item.id) filter (where item.status = 'approved')::integer,
  count(item.id) filter (where item.status in ('not_started', 'draft', 'submitted'))::integer,
  count(item.id) filter (where item.status = 'under_review')::integer,
  count(item.id) filter (where item.status = 'changes_requested')::integer,
  count(item.id) filter (where item.status = 'rejected')::integer,
  count(item.id) filter (where item.status = 'expired')::integer,
  count(item.id) filter (where item.status = 'expiring_soon')::integer,
  count(item.id) filter (where item.status = 'suspended')::integer,
  count(item.id) filter (where item.status = 'revoked')::integer,
  max(item.submitted_at),
  max(coalesce(item.approved_at, item.rejected_at, item.updated_at)),
  min(item.expires_at)::timestamptz,
  now(),
  jsonb_build_object(
    'source', 'baseline_mvp_recalculation',
    'generated_reason', 'baseline_mvp_requirement',
    'certified_truth', false
  ),
  now(),
  now()
from public.msmes m
left join public.msme_compliance_items item
  on item.msme_id = m.id
  and item.renewal_of is null
group by m.id
on conflict (msme_id) do update
set overall_status = excluded.overall_status,
    compliance_score = excluded.compliance_score,
    risk_level = excluded.risk_level,
    total_required_count = excluded.total_required_count,
    approved_count = excluded.approved_count,
    pending_count = excluded.pending_count,
    under_review_count = excluded.under_review_count,
    changes_requested_count = excluded.changes_requested_count,
    rejected_count = excluded.rejected_count,
    expired_count = excluded.expired_count,
    expiring_soon_count = excluded.expiring_soon_count,
    suspended_count = excluded.suspended_count,
    revoked_count = excluded.revoked_count,
    last_submitted_at = excluded.last_submitted_at,
    last_reviewed_at = excluded.last_reviewed_at,
    next_deadline_at = excluded.next_deadline_at,
    last_recalculated_at = excluded.last_recalculated_at,
    metadata = coalesce(public.msme_compliance_profiles.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();
