-- LCDBO Sprint 2 RLS remediation.
-- Fixes signed-in geographic coordinator inserts for delivery activities and
-- progress updates without broadening programme-wide, export or review access.

create or replace function public.lcdbo_can_save_delivery_activity(
  target_programme_id uuid,
  target_state_plan_id uuid,
  target_lga_plan_id uuid,
  target_cluster_plan_id uuid,
  target_owner_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.lcdbo_can_review_programme(target_programme_id) then
    return true;
  end if;

  -- Most-specific scope wins. A state assignment can create state-scoped
  -- activity, but cannot smuggle an LGA/cluster-scoped activity through by
  -- also sending the parent state_plan_id.
  if target_cluster_plan_id is not null then
    return public.lcdbo_can_manage_cluster_delivery_plan(target_cluster_plan_id);
  end if;

  if target_lga_plan_id is not null then
    return public.lcdbo_can_manage_lga_delivery_plan(target_lga_plan_id);
  end if;

  if target_state_plan_id is not null then
    return public.lcdbo_can_manage_state_delivery_plan(target_state_plan_id);
  end if;

  return false;
end;
$$;

create or replace function public.lcdbo_can_submit_delivery_progress_update(
  target_programme_id uuid,
  target_submitted_by uuid,
  target_workstream_id uuid,
  target_state_plan_id uuid,
  target_lga_plan_id uuid,
  target_cluster_plan_id uuid,
  target_delivery_item_id uuid,
  target_activity_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if target_submitted_by is distinct from public.lcdbo_current_app_user_id() then
    return false;
  end if;

  if public.lcdbo_can_review_programme(target_programme_id) then
    return true;
  end if;

  -- Geographic coordinators are intentionally blocked from national scopes.
  if target_workstream_id is not null or target_delivery_item_id is not null then
    return false;
  end if;

  if target_cluster_plan_id is not null then
    return public.lcdbo_can_manage_cluster_delivery_plan(target_cluster_plan_id);
  end if;

  if target_lga_plan_id is not null then
    return public.lcdbo_can_manage_lga_delivery_plan(target_lga_plan_id);
  end if;

  if target_state_plan_id is not null then
    return public.lcdbo_can_manage_state_delivery_plan(target_state_plan_id);
  end if;

  if target_activity_id is not null then
    return public.lcdbo_can_manage_delivery_activity(target_activity_id);
  end if;

  return false;
end;
$$;

revoke all on function public.lcdbo_can_save_delivery_activity(uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function public.lcdbo_can_save_delivery_activity(uuid, uuid, uuid, uuid, uuid) to authenticated;
revoke all on function public.lcdbo_can_submit_delivery_progress_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function public.lcdbo_can_submit_delivery_progress_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;

drop policy if exists "LCDBO delivery managers can manage activities" on public.lcdbo_delivery_activities;
drop policy if exists "LCDBO delivery managers can create activities" on public.lcdbo_delivery_activities;
drop policy if exists "LCDBO delivery managers can update activities" on public.lcdbo_delivery_activities;

create policy "LCDBO delivery managers can create activities"
  on public.lcdbo_delivery_activities
  for insert
  with check (
    public.lcdbo_can_save_delivery_activity(programme_id, state_plan_id, lga_plan_id, cluster_plan_id, owner_id)
    and (
      public.lcdbo_can_review_programme(programme_id)
      or (
        created_by = public.lcdbo_current_app_user_id()
        and (updated_by is null or updated_by = public.lcdbo_current_app_user_id())
        and (owner_id is null or owner_id = public.lcdbo_current_app_user_id())
      )
    )
  );

create policy "LCDBO delivery managers can update activities"
  on public.lcdbo_delivery_activities
  for update
  using (public.lcdbo_can_manage_delivery_activity(id))
  with check (
    public.lcdbo_can_save_delivery_activity(programme_id, state_plan_id, lga_plan_id, cluster_plan_id, owner_id)
    and (
      public.lcdbo_can_review_programme(programme_id)
      or (
        updated_by = public.lcdbo_current_app_user_id()
        and (owner_id is null or owner_id = public.lcdbo_current_app_user_id())
      )
    )
  );

drop policy if exists "LCDBO delivery managers can create progress updates" on public.lcdbo_delivery_progress_updates;
drop policy if exists "LCDBO delivery managers can review progress updates" on public.lcdbo_delivery_progress_updates;

create policy "LCDBO delivery managers can create progress updates"
  on public.lcdbo_delivery_progress_updates
  for insert
  with check (
    review_status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and public.lcdbo_can_submit_delivery_progress_update(
      programme_id,
      submitted_by,
      workstream_id,
      state_plan_id,
      lga_plan_id,
      cluster_plan_id,
      delivery_item_id,
      activity_id
    )
  );

create policy "LCDBO delivery managers can review progress updates"
  on public.lcdbo_delivery_progress_updates
  for update
  using (public.lcdbo_can_review_programme(programme_id))
  with check (
    public.lcdbo_can_review_programme(programme_id)
    and reviewed_by = public.lcdbo_current_app_user_id()
    and (review_status <> 'approved' or reviewed_by <> submitted_by)
  );
