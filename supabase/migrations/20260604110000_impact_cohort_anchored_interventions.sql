-- Impact Intelligence Phase 2B: cohort-anchored interventions.
-- Existing intervention rows remain valid; new anchors are nullable and backfilled only when unambiguous.

alter table public.impact_interventions
  add column if not exists cohort_id uuid references public.impact_beneficiary_cohorts(id) on delete set null,
  add column if not exists cohort_member_id uuid references public.impact_cohort_members(id) on delete set null,
  add column if not exists assigned_officer_id uuid references public.users(id) on delete set null,
  add column if not exists closure_reason text,
  add column if not exists closure_note text,
  add column if not exists closed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists disbursed_at timestamptz;

alter table public.impact_intervention_events
  add column if not exists cohort_id uuid references public.impact_beneficiary_cohorts(id) on delete set null,
  add column if not exists cohort_member_id uuid references public.impact_cohort_members(id) on delete set null;

create index if not exists idx_impact_interventions_programme_cohort_id
  on public.impact_interventions(programme_id, cohort_id);
create index if not exists idx_impact_interventions_cohort_member_id
  on public.impact_interventions(cohort_member_id);
create index if not exists idx_impact_interventions_assigned_officer_id
  on public.impact_interventions(assigned_officer_id);
create index if not exists idx_impact_intervention_events_cohort_id
  on public.impact_intervention_events(cohort_id);
create index if not exists idx_impact_intervention_events_cohort_member_id
  on public.impact_intervention_events(cohort_member_id);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'impact_intervention_events_type_check'
      and conrelid = 'public.impact_intervention_events'::regclass
  ) then
    alter table public.impact_intervention_events drop constraint impact_intervention_events_type_check;
  end if;

  alter table public.impact_intervention_events
    add constraint impact_intervention_events_type_check
    check (event_type in (
      'created',
      'status_changed',
      'stage_changed',
      'note',
      'documented',
      'reviewed',
      'intervention_created',
      'intervention_anchor_backfilled',
      'intervention_stage_changed',
      'intervention_status_changed',
      'intervention_financials_updated',
      'intervention_assigned',
      'intervention_closed'
    ));
end $$;

create or replace function public.validate_impact_intervention_anchor()
returns trigger
language plpgsql
as $$
declare
  cohort_programme_id uuid;
  member_cohort_id uuid;
  member_programme_id uuid;
  member_msme_id uuid;
  lifecycle_changed boolean;
begin
  lifecycle_changed := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then
    lifecycle_changed := old.status is distinct from new.status
      or old.metadata->>'stage' is distinct from new.metadata->>'stage';
  end if;

  if new.cohort_id is not null then
    select programme_id into cohort_programme_id
    from public.impact_beneficiary_cohorts
    where id = new.cohort_id;

    if cohort_programme_id is null then
      raise exception 'Selected intervention cohort does not exist.';
    end if;

    if new.programme_id is not null and cohort_programme_id <> new.programme_id then
      raise exception 'Selected intervention cohort does not belong to the selected programme.';
    end if;
  end if;

  if new.cohort_member_id is not null then
    select cohort_id, programme_id, msme_id
      into member_cohort_id, member_programme_id, member_msme_id
    from public.impact_cohort_members
    where id = new.cohort_member_id;

    if member_cohort_id is null then
      raise exception 'Selected intervention cohort member does not exist.';
    end if;

    if new.cohort_id is not null and member_cohort_id <> new.cohort_id then
      raise exception 'Selected cohort member does not belong to the selected cohort.';
    end if;

    if new.programme_id is not null and member_programme_id <> new.programme_id then
      raise exception 'Selected cohort member does not belong to the selected programme.';
    end if;

    if new.msme_id is not null and member_msme_id <> new.msme_id then
      raise exception 'Selected cohort member MSME does not match the intervention MSME.';
    end if;
  end if;

  if new.disbursed_amount is not null and new.approved_amount is null then
    raise exception 'Approved amount is required before recording disbursement.';
  end if;

  if new.approved_amount is not null and new.disbursed_amount is not null and new.disbursed_amount > new.approved_amount then
    raise exception 'Disbursed amount cannot exceed approved amount.';
  end if;

  if new.status = 'completed'
    and lifecycle_changed
    and (
    nullif(trim(coalesce(new.closure_reason, '')), '') is null
    or nullif(trim(coalesce(new.closure_note, '')), '') is null
  ) then
    raise exception 'Completed interventions require closure reason and closure note.';
  end if;

  if coalesce(new.metadata->>'stage', '') = 'closure'
    and lifecycle_changed
    and (
    nullif(trim(coalesce(new.closure_reason, '')), '') is null
    or nullif(trim(coalesce(new.closure_note, '')), '') is null
  ) then
    raise exception 'Closure-stage interventions require closure reason and closure note.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_impact_intervention_anchor on public.impact_interventions;
create trigger validate_impact_intervention_anchor
before insert or update on public.impact_interventions
for each row execute function public.validate_impact_intervention_anchor();

with candidate_matches as (
  select
    i.id as intervention_id,
    cm.cohort_id,
    cm.id as cohort_member_id,
    count(*) over (partition by i.id) as match_count
  from public.impact_interventions i
  join public.impact_cohort_members cm
    on cm.programme_id = i.programme_id
   and cm.msme_id = i.msme_id
  where i.programme_id is not null
    and i.msme_id is not null
),
unambiguous_matches as (
  select intervention_id, cohort_id, cohort_member_id
  from candidate_matches
  where match_count = 1
),
match_summary as (
  select
    i.id as intervention_id,
    case
      when count(cm.cohort_member_id) = 0 then 'no_match'
      when count(cm.cohort_member_id) = 1 then 'matched'
      else 'multiple_matches'
    end as anchor_status
  from public.impact_interventions i
  left join candidate_matches cm on cm.intervention_id = i.id
  where i.programme_id is not null
    and i.msme_id is not null
  group by i.id
)
update public.impact_interventions i
set
  cohort_id = coalesce(i.cohort_id, um.cohort_id),
  cohort_member_id = coalesce(i.cohort_member_id, um.cohort_member_id),
  metadata = coalesce(i.metadata, '{}'::jsonb)
    || jsonb_build_object('legacy_cohort_anchor_status', ms.anchor_status)
from match_summary ms
left join unambiguous_matches um on um.intervention_id = ms.intervention_id
where i.id = ms.intervention_id
  and (i.metadata->>'legacy_cohort_anchor_status') is null;

insert into public.activity_logs (action, entity_type, entity_id, metadata, created_at)
select
  'intervention_anchor_backfilled',
  'impact_intervention',
  i.id,
  jsonb_build_object(
    'legacy_cohort_anchor_status', i.metadata->>'legacy_cohort_anchor_status',
    'cohort_id', i.cohort_id,
    'cohort_member_id', i.cohort_member_id
  ),
  now()
from public.impact_interventions i
where i.metadata->>'legacy_cohort_anchor_status' = 'matched';

insert into public.impact_intervention_events (
  intervention_id,
  programme_id,
  cohort_id,
  msme_id,
  event_type,
  title,
  note,
  created_at,
  metadata
)
select
  i.id,
  i.programme_id,
  i.cohort_id,
  i.msme_id,
  'intervention_anchor_backfilled',
  'Intervention anchor backfilled',
  'Legacy intervention was matched to one cohort member.',
  now(),
  jsonb_build_object('cohort_member_id', i.cohort_member_id)
from public.impact_interventions i
where i.metadata->>'legacy_cohort_anchor_status' = 'matched';
