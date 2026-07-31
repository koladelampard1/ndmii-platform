-- EKIRS Sprint 1 remediation: field-officer assignment access boundaries.
-- Additive correction for already-applied Sprint 1 onboarding tables. This
-- does not provision users, reset data, seed records, or weaken workspace RLS.

create or replace function public.state_revenue_is_assigned_field_officer(
  target_application_id uuid,
  include_completed boolean default true
)
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
      and a.assigned_field_officer_id = public.state_revenue_current_app_user_id()
      and (
        include_completed
        or a.current_status in ('field_verification_assigned', 'field_verification_in_progress')
      )
  )
  or exists (
    select 1
    from public.state_revenue_verification_tasks t
    join public.state_revenue_applications a on a.id = t.application_id
    where t.application_id = target_application_id
      and t.assigned_officer_id = public.state_revenue_current_app_user_id()
      and (
        (include_completed and t.status in ('assigned', 'in_progress', 'submitted', 'returned_for_correction', 'accepted'))
        or (
          not include_completed
          and t.status in ('assigned', 'in_progress')
          and a.current_status in ('field_verification_assigned', 'field_verification_in_progress')
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
        or public.state_revenue_is_assigned_field_officer(a.id, true)
        or public.state_revenue_can_review_jurisdiction(a.jurisdiction_id)
      )
  )
$$;

create or replace function public.state_revenue_can_submit_field_outcome(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.state_revenue_is_assigned_field_officer(target_application_id, false)
$$;

revoke all on function public.state_revenue_is_assigned_field_officer(uuid, boolean) from public;
grant execute on function public.state_revenue_is_assigned_field_officer(uuid, boolean) to authenticated;
revoke all on function public.state_revenue_can_access_application(uuid) from public;
grant execute on function public.state_revenue_can_access_application(uuid) to authenticated;
revoke all on function public.state_revenue_can_submit_field_outcome(uuid) from public;
grant execute on function public.state_revenue_can_submit_field_outcome(uuid) to authenticated;

drop policy if exists "State revenue assigned officers can read applications" on public.state_revenue_applications;
create policy "State revenue assigned officers can read applications" on public.state_revenue_applications
  for select using (
    assigned_reviewer_id = public.state_revenue_current_app_user_id()
    or public.state_revenue_is_assigned_field_officer(id, true)
  );

drop policy if exists "State revenue participants can read tasks" on public.state_revenue_verification_tasks;
create policy "State revenue participants can read tasks" on public.state_revenue_verification_tasks
  for select using (
    (
      assigned_officer_id = public.state_revenue_current_app_user_id()
      and status in ('assigned', 'in_progress', 'submitted', 'returned_for_correction', 'accepted')
    )
    or assigned_supervisor_id = public.state_revenue_current_app_user_id()
    or public.state_revenue_can_access_application(application_id)
  );

drop policy if exists "State revenue assigned field officers can update own active tasks" on public.state_revenue_verification_tasks;
create policy "State revenue assigned field officers can update own active tasks" on public.state_revenue_verification_tasks
  for update using (
    assigned_officer_id = public.state_revenue_current_app_user_id()
    and status in ('assigned', 'in_progress')
    and public.state_revenue_can_submit_field_outcome(application_id)
  )
  with check (
    assigned_officer_id = public.state_revenue_current_app_user_id()
    and status in ('in_progress', 'submitted')
  );
