-- LCDBO Sprint 2 returned-representation RLS remediation.
-- The previous insert checks were valid, but PostgREST insert().select()
-- evaluates SELECT/RETURNING in the same statement. The original SELECT helpers
-- re-read the just-inserted row by id, which works after commit but fails during
-- INSERT ... RETURNING. These policies evaluate visibility from NEW row values
-- and preserve assignment-scoped access.

revoke all on table public.lcdbo_delivery_activities from anon;
revoke all on table public.lcdbo_delivery_progress_updates from anon;

revoke all on table public.lcdbo_delivery_activities from authenticated;
revoke all on table public.lcdbo_delivery_progress_updates from authenticated;

grant select, insert, update on table public.lcdbo_delivery_activities to authenticated;
grant select, insert, update on table public.lcdbo_delivery_progress_updates to authenticated;

drop policy if exists "LCDBO delivery readers can read activities" on public.lcdbo_delivery_activities;
create policy "LCDBO delivery readers can read activities"
  on public.lcdbo_delivery_activities
  for select
  using (
    public.lcdbo_can_view_all_delivery_programme(programme_id)
    or public.lcdbo_can_save_delivery_activity(programme_id, state_plan_id, lga_plan_id, cluster_plan_id, owner_id)
  );

drop policy if exists "LCDBO delivery readers can read progress updates" on public.lcdbo_delivery_progress_updates;
create policy "LCDBO delivery readers can read progress updates"
  on public.lcdbo_delivery_progress_updates
  for select
  using (
    public.lcdbo_can_view_all_delivery_programme(programme_id)
    or submitted_by = public.lcdbo_current_app_user_id()
    or (state_plan_id is not null and public.lcdbo_can_view_state_delivery_plan(state_plan_id))
    or (lga_plan_id is not null and public.lcdbo_can_view_lga_delivery_plan(lga_plan_id))
    or (cluster_plan_id is not null and public.lcdbo_can_view_cluster_delivery_plan(cluster_plan_id))
    or (activity_id is not null and public.lcdbo_can_view_delivery_activity(activity_id))
  );
