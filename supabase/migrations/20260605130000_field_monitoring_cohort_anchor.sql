-- Impact Intelligence Monitoring Phase 1-2: cohort-anchored field visits.
-- Legacy rows remain valid; new field visits must be created through programme/cohort/member anchors.

alter table public.impact_field_visits
  add column if not exists cohort_id uuid references public.impact_beneficiary_cohorts(id) on delete set null,
  add column if not exists cohort_member_id uuid references public.impact_cohort_members(id) on delete set null;

create index if not exists idx_impact_field_visits_programme_cohort_id
  on public.impact_field_visits(programme_id, cohort_id);
create index if not exists idx_impact_field_visits_cohort_member_id
  on public.impact_field_visits(cohort_member_id);
create index if not exists idx_impact_field_visits_intervention_id
  on public.impact_field_visits(intervention_id);
create index if not exists idx_impact_field_visits_assessment_id
  on public.impact_field_visits(assessment_id);
create index if not exists idx_impact_field_visits_assigned_to_user_id
  on public.impact_field_visits(assigned_to_user_id);
create index if not exists idx_impact_field_visits_status
  on public.impact_field_visits(status);

with intervention_matches as (
  select
    v.id as visit_id,
    i.cohort_id,
    i.cohort_member_id
  from public.impact_field_visits v
  join public.impact_interventions i on i.id = v.intervention_id
  where i.cohort_id is not null
    and i.cohort_member_id is not null
    and (v.cohort_id is null or v.cohort_member_id is null)
)
update public.impact_field_visits v
set
  cohort_id = im.cohort_id,
  cohort_member_id = im.cohort_member_id,
  metadata = coalesce(v.metadata, '{}'::jsonb)
    || jsonb_build_object('legacy_cohort_anchor_status', 'matched', 'legacy_cohort_anchor_source', 'intervention')
from intervention_matches im
where v.id = im.visit_id;

with assessment_matches as (
  select
    v.id as visit_id,
    a.cohort_id,
    a.cohort_member_id
  from public.impact_field_visits v
  join public.impact_assessments a on a.id = v.assessment_id
  where a.cohort_id is not null
    and a.cohort_member_id is not null
    and (v.cohort_id is null or v.cohort_member_id is null)
)
update public.impact_field_visits v
set
  cohort_id = am.cohort_id,
  cohort_member_id = am.cohort_member_id,
  metadata = coalesce(v.metadata, '{}'::jsonb)
    || jsonb_build_object('legacy_cohort_anchor_status', 'matched', 'legacy_cohort_anchor_source', 'assessment')
from assessment_matches am
where v.id = am.visit_id;

with candidate_matches as (
  select
    v.id as visit_id,
    cm.cohort_id,
    cm.id as cohort_member_id,
    count(*) over (partition by v.id) as match_count
  from public.impact_field_visits v
  join public.impact_cohort_members cm
    on cm.programme_id = v.programme_id
   and cm.msme_id = v.msme_id
  where v.programme_id is not null
    and v.msme_id is not null
    and (v.cohort_id is null or v.cohort_member_id is null)
),
unambiguous_matches as (
  select visit_id, cohort_id, cohort_member_id
  from candidate_matches
  where match_count = 1
)
update public.impact_field_visits v
set
  cohort_id = um.cohort_id,
  cohort_member_id = um.cohort_member_id,
  metadata = coalesce(v.metadata, '{}'::jsonb)
    || jsonb_build_object('legacy_cohort_anchor_status', 'matched', 'legacy_cohort_anchor_source', 'programme_msme')
from unambiguous_matches um
where v.id = um.visit_id;

with match_summary as (
  select
    v.id as visit_id,
    case
      when count(cm.id) = 0 then 'no_match'
      when count(cm.id) = 1 then 'matched'
      else 'multiple_matches'
    end as anchor_status
  from public.impact_field_visits v
  left join public.impact_cohort_members cm
    on cm.programme_id = v.programme_id
   and cm.msme_id = v.msme_id
  where (v.cohort_id is null or v.cohort_member_id is null)
    and (v.metadata->>'legacy_cohort_anchor_status') is null
  group by v.id
)
update public.impact_field_visits v
set metadata = coalesce(v.metadata, '{}'::jsonb)
  || jsonb_build_object('legacy_cohort_anchor_status', ms.anchor_status)
from match_summary ms
where v.id = ms.visit_id;

insert into public.activity_logs (action, entity_type, entity_id, metadata, created_at)
select
  'field_visit_anchor_backfilled',
  'impact_field_visit',
  v.id,
  jsonb_build_object(
    'legacy_cohort_anchor_status', v.metadata->>'legacy_cohort_anchor_status',
    'legacy_cohort_anchor_source', v.metadata->>'legacy_cohort_anchor_source',
    'programme_id', v.programme_id,
    'cohort_id', v.cohort_id,
    'cohort_member_id', v.cohort_member_id
  ),
  now()
from public.impact_field_visits v
where v.metadata->>'legacy_cohort_anchor_status' = 'matched'
  and v.cohort_id is not null
  and v.cohort_member_id is not null;

create or replace function public.validate_impact_field_visit_anchor()
returns trigger
language plpgsql
as $$
declare
  cohort_programme_id uuid;
  member_cohort_id uuid;
  member_programme_id uuid;
  member_msme_id uuid;
  intervention_programme_id uuid;
  intervention_cohort_id uuid;
  intervention_member_id uuid;
  intervention_msme_id uuid;
  assessment_programme_id uuid;
  assessment_cohort_id uuid;
  assessment_member_id uuid;
  assessment_msme_id uuid;
  assigned_role text;
begin
  if tg_op = 'INSERT' then
    if new.programme_id is null then
      raise exception 'Select a programme for this field visit.';
    end if;

    if new.cohort_id is null then
      raise exception 'Select a beneficiary cohort for this field visit.';
    end if;

    if new.cohort_member_id is null then
      raise exception 'Select a cohort beneficiary for this field visit.';
    end if;
  end if;

  if new.cohort_id is not null then
    select programme_id into cohort_programme_id
    from public.impact_beneficiary_cohorts
    where id = new.cohort_id;

    if cohort_programme_id is null then
      raise exception 'Selected field visit cohort does not exist.';
    end if;

    if new.programme_id is not null and cohort_programme_id <> new.programme_id then
      raise exception 'Selected field visit cohort does not belong to the selected programme.';
    end if;
  end if;

  if new.cohort_member_id is not null then
    select cohort_id, programme_id, msme_id
      into member_cohort_id, member_programme_id, member_msme_id
    from public.impact_cohort_members
    where id = new.cohort_member_id;

    if member_cohort_id is null then
      raise exception 'Selected field visit cohort beneficiary does not exist.';
    end if;

    if new.cohort_id is not null and member_cohort_id <> new.cohort_id then
      raise exception 'Selected field visit cohort beneficiary does not belong to the selected cohort.';
    end if;

    if new.programme_id is not null and member_programme_id <> new.programme_id then
      raise exception 'Selected field visit cohort beneficiary does not belong to the selected programme.';
    end if;

    new.msme_id := member_msme_id;
  end if;

  if new.intervention_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id
      into intervention_programme_id, intervention_cohort_id, intervention_member_id, intervention_msme_id
    from public.impact_interventions
    where id = new.intervention_id;

    if intervention_programme_id is null and intervention_msme_id is null then
      raise exception 'Selected field visit intervention does not exist.';
    end if;

    if new.programme_id is not null and intervention_programme_id is not null and intervention_programme_id <> new.programme_id then
      raise exception 'Selected field visit intervention does not belong to the selected programme.';
    end if;

    if new.cohort_id is not null and intervention_cohort_id is not null and intervention_cohort_id <> new.cohort_id then
      raise exception 'Selected field visit intervention does not belong to the selected cohort.';
    end if;

    if new.cohort_member_id is not null and intervention_member_id is not null and intervention_member_id <> new.cohort_member_id then
      raise exception 'Selected field visit intervention does not belong to the selected cohort beneficiary.';
    end if;

    if new.msme_id is not null and intervention_msme_id is not null and intervention_msme_id <> new.msme_id then
      raise exception 'Selected field visit intervention MSME does not match the selected cohort beneficiary.';
    end if;
  end if;

  if new.assessment_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id
      into assessment_programme_id, assessment_cohort_id, assessment_member_id, assessment_msme_id
    from public.impact_assessments
    where id = new.assessment_id;

    if assessment_programme_id is null and assessment_msme_id is null then
      raise exception 'Selected field visit assessment does not exist.';
    end if;

    if new.programme_id is not null and assessment_programme_id is not null and assessment_programme_id <> new.programme_id then
      raise exception 'Selected field visit assessment does not belong to the selected programme.';
    end if;

    if new.cohort_id is not null and assessment_cohort_id is not null and assessment_cohort_id <> new.cohort_id then
      raise exception 'Selected field visit assessment does not belong to the selected cohort.';
    end if;

    if new.cohort_member_id is not null and assessment_member_id is not null and assessment_member_id <> new.cohort_member_id then
      raise exception 'Selected field visit assessment does not belong to the selected cohort beneficiary.';
    end if;

    if new.msme_id is not null and assessment_msme_id is not null and assessment_msme_id <> new.msme_id then
      raise exception 'Selected field visit assessment MSME does not match the selected cohort beneficiary.';
    end if;
  end if;

  if new.assigned_to_user_id is not null then
    select role into assigned_role
    from public.users
    where id = new.assigned_to_user_id;

    if assigned_role is null then
      raise exception 'Selected field officer does not exist.';
    end if;

    if assigned_role <> 'field_officer' then
      raise exception 'Selected assignee must have field_officer role.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_impact_field_visit_anchor on public.impact_field_visits;
create trigger validate_impact_field_visit_anchor
before insert or update on public.impact_field_visits
for each row execute function public.validate_impact_field_visit_anchor();
