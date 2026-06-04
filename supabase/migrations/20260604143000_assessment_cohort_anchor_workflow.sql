-- Impact Intelligence Assessment Phase 1: cohort anchoring and draft/submit workflow.
-- Legacy assessment rows remain valid; new app flows enforce cohort/member anchors.

alter table public.impact_assessments
  add column if not exists cohort_id uuid references public.impact_beneficiary_cohorts(id) on delete set null,
  add column if not exists cohort_member_id uuid references public.impact_cohort_members(id) on delete set null,
  add column if not exists field_visit_id uuid references public.impact_field_visits(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists returned_at timestamptz,
  add column if not exists returned_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists return_reason text;

create index if not exists idx_impact_assessments_programme_cohort_id
  on public.impact_assessments(programme_id, cohort_id);
create index if not exists idx_impact_assessments_cohort_member_id
  on public.impact_assessments(cohort_member_id);
create index if not exists idx_impact_assessments_intervention_id
  on public.impact_assessments(intervention_id);
create index if not exists idx_impact_assessments_field_visit_id
  on public.impact_assessments(field_visit_id);
create index if not exists idx_impact_assessments_status
  on public.impact_assessments(status);
create index if not exists idx_impact_assessments_assessment_type
  on public.impact_assessments(assessment_type);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'impact_assessments_status_check'
      and conrelid = 'public.impact_assessments'::regclass
  ) then
    alter table public.impact_assessments drop constraint impact_assessments_status_check;
  end if;

  alter table public.impact_assessments
    add constraint impact_assessments_status_check
    check (status in ('draft', 'scheduled', 'in_progress', 'submitted', 'reviewed', 'approved', 'returned', 'completed', 'archived'));
end $$;

update public.impact_assessments a
set
  cohort_id = coalesce(a.cohort_id, i.cohort_id),
  cohort_member_id = coalesce(a.cohort_member_id, i.cohort_member_id),
  metadata = coalesce(a.metadata, '{}'::jsonb)
    || jsonb_build_object('legacy_cohort_anchor_status', 'matched', 'legacy_cohort_anchor_source', 'intervention')
from public.impact_interventions i
where a.intervention_id = i.id
  and i.cohort_id is not null
  and i.cohort_member_id is not null
  and (a.cohort_id is null or a.cohort_member_id is null)
  and (a.metadata->>'legacy_cohort_anchor_status') is null;

with candidate_matches as (
  select
    a.id as assessment_id,
    cm.cohort_id,
    cm.id as cohort_member_id,
    count(*) over (partition by a.id) as match_count
  from public.impact_assessments a
  join public.impact_cohort_members cm
    on cm.programme_id = a.programme_id
   and cm.msme_id = a.msme_id
  where a.programme_id is not null
    and a.msme_id is not null
    and (a.cohort_id is null or a.cohort_member_id is null)
    and (a.metadata->>'legacy_cohort_anchor_status') is null
),
unambiguous_matches as (
  select assessment_id, cohort_id, cohort_member_id
  from candidate_matches
  where match_count = 1
)
update public.impact_assessments a
set
  cohort_id = um.cohort_id,
  cohort_member_id = um.cohort_member_id,
  metadata = coalesce(a.metadata, '{}'::jsonb)
    || jsonb_build_object('legacy_cohort_anchor_status', 'matched', 'legacy_cohort_anchor_source', 'programme_msme')
from unambiguous_matches um
where a.id = um.assessment_id;

with match_summary as (
  select
    a.id as assessment_id,
    case
      when count(cm.id) = 0 then 'no_match'
      when count(cm.id) = 1 then 'matched'
      else 'multiple_matches'
    end as anchor_status
  from public.impact_assessments a
  left join public.impact_cohort_members cm
    on cm.programme_id = a.programme_id
   and cm.msme_id = a.msme_id
  where (a.cohort_id is null or a.cohort_member_id is null)
    and (a.metadata->>'legacy_cohort_anchor_status') is null
  group by a.id
)
update public.impact_assessments a
set metadata = coalesce(a.metadata, '{}'::jsonb)
  || jsonb_build_object('legacy_cohort_anchor_status', ms.anchor_status)
from match_summary ms
where a.id = ms.assessment_id;

insert into public.activity_logs (action, entity_type, entity_id, metadata, created_at)
select
  'assessment_anchor_backfilled',
  'impact_assessment',
  a.id,
  jsonb_build_object(
    'legacy_cohort_anchor_status', a.metadata->>'legacy_cohort_anchor_status',
    'legacy_cohort_anchor_source', a.metadata->>'legacy_cohort_anchor_source',
    'cohort_id', a.cohort_id,
    'cohort_member_id', a.cohort_member_id
  ),
  now()
from public.impact_assessments a
where a.metadata->>'legacy_cohort_anchor_status' = 'matched'
  and a.cohort_id is not null
  and a.cohort_member_id is not null;

create or replace function public.validate_impact_assessment_anchor()
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
  visit_programme_id uuid;
  visit_intervention_id uuid;
  visit_msme_id uuid;
begin
  if new.cohort_id is not null then
    select programme_id into cohort_programme_id
    from public.impact_beneficiary_cohorts
    where id = new.cohort_id;

    if cohort_programme_id is null then
      raise exception 'Selected assessment cohort does not exist.';
    end if;

    if new.programme_id is not null and cohort_programme_id <> new.programme_id then
      raise exception 'Selected assessment cohort does not belong to the selected programme.';
    end if;
  end if;

  if new.cohort_member_id is not null then
    select cohort_id, programme_id, msme_id
      into member_cohort_id, member_programme_id, member_msme_id
    from public.impact_cohort_members
    where id = new.cohort_member_id;

    if member_cohort_id is null then
      raise exception 'Selected assessment cohort member does not exist.';
    end if;

    if new.cohort_id is not null and member_cohort_id <> new.cohort_id then
      raise exception 'Selected assessment cohort member does not belong to the selected cohort.';
    end if;

    if new.programme_id is not null and member_programme_id <> new.programme_id then
      raise exception 'Selected assessment cohort member does not belong to the selected programme.';
    end if;

    if new.msme_id is not null and member_msme_id <> new.msme_id then
      raise exception 'Selected assessment cohort member MSME does not match the assessment MSME.';
    end if;
  end if;

  if new.intervention_id is not null then
    select programme_id, cohort_id, cohort_member_id, msme_id
      into intervention_programme_id, intervention_cohort_id, intervention_member_id, intervention_msme_id
    from public.impact_interventions
    where id = new.intervention_id;

    if intervention_programme_id is null and intervention_msme_id is null then
      raise exception 'Selected assessment intervention does not exist.';
    end if;

    if new.programme_id is not null and intervention_programme_id is not null and intervention_programme_id <> new.programme_id then
      raise exception 'Selected intervention does not belong to the selected programme.';
    end if;

    if new.cohort_id is not null and intervention_cohort_id is not null and intervention_cohort_id <> new.cohort_id then
      raise exception 'Selected intervention does not belong to the selected cohort.';
    end if;

    if new.cohort_member_id is not null and intervention_member_id is not null and intervention_member_id <> new.cohort_member_id then
      raise exception 'Selected intervention does not belong to the selected cohort member.';
    end if;

    if new.msme_id is not null and intervention_msme_id is not null and intervention_msme_id <> new.msme_id then
      raise exception 'Selected intervention MSME does not match the assessment MSME.';
    end if;
  end if;

  if new.field_visit_id is not null then
    select programme_id, intervention_id, msme_id
      into visit_programme_id, visit_intervention_id, visit_msme_id
    from public.impact_field_visits
    where id = new.field_visit_id;

    if visit_programme_id is null and visit_msme_id is null then
      raise exception 'Selected assessment field visit does not exist.';
    end if;

    if new.programme_id is not null and visit_programme_id is not null and visit_programme_id <> new.programme_id then
      raise exception 'Selected field visit does not belong to the selected programme.';
    end if;

    if new.intervention_id is not null and visit_intervention_id is not null and visit_intervention_id <> new.intervention_id then
      raise exception 'Selected field visit does not belong to the selected intervention.';
    end if;

    if new.msme_id is not null and visit_msme_id is not null and visit_msme_id <> new.msme_id then
      raise exception 'Selected field visit MSME does not match the assessment MSME.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_impact_assessment_anchor on public.impact_assessments;
create trigger validate_impact_assessment_anchor
before insert or update on public.impact_assessments
for each row execute function public.validate_impact_assessment_anchor();
