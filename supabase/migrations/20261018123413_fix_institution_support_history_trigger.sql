-- Correct the shared history writer to access only fields present on the table
-- that fired the trigger. Existing Sprint 6 data is unaffected.
create or replace function public.record_institution_support_history()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_plan_id uuid; v_institution_id uuid; v_entity_type text; v_old_status text; v_actor uuid; v_note text;
begin
  v_institution_id:=new.institution_id;
  if tg_table_name='institution_support_plans' then v_entity_type:='plan'; v_plan_id:=new.id;
  elsif tg_table_name='institution_support_milestones' then v_entity_type:='milestone'; v_plan_id:=new.plan_id;
  elsif tg_table_name='institution_support_touchpoints' then v_entity_type:='touchpoint'; v_plan_id:=new.plan_id;
  elsif tg_table_name='institution_support_issues' then v_entity_type:='issue'; v_plan_id:=new.plan_id;
  else v_entity_type:='referral'; v_plan_id:=new.plan_id; end if;
  if tg_op='INSERT' then
    if tg_table_name='institution_support_plans' then return new; end if;
    if tg_table_name='institution_support_milestones' then v_actor:=new.created_by_user_id; v_note:=new.title;
    elsif tg_table_name='institution_support_touchpoints' then v_actor:=new.created_by_user_id; v_note:=new.summary;
    elsif tg_table_name='institution_support_issues' then v_actor:=new.created_by_user_id; v_note:=new.summary;
    else v_actor:=new.created_by_user_id; v_note:=new.opportunity; end if;
    insert into public.institution_support_history(institution_id,plan_id,entity_type,entity_id,event_type,to_status,note,actor_user_id)
    values(v_institution_id,v_plan_id,v_entity_type,new.id,v_entity_type||'_created',new.status,v_note,v_actor);
  elsif old.status is distinct from new.status then
    v_old_status:=old.status;
    if tg_table_name='institution_support_plans' then v_actor:=new.created_by_user_id; v_note:=new.objective;
    elsif tg_table_name='institution_support_milestones' then v_actor:=new.created_by_user_id; v_note:=new.completion_note;
    elsif tg_table_name='institution_support_touchpoints' then v_actor:=coalesce(new.completed_by_user_id,new.created_by_user_id); v_note:=new.outcome_note;
    elsif tg_table_name='institution_support_issues' then v_actor:=coalesce(new.resolved_by_user_id,new.created_by_user_id); v_note:=new.resolution_note;
    else v_actor:=coalesce(new.updated_by_user_id,new.created_by_user_id); v_note:=new.outcome_note; end if;
    insert into public.institution_support_history(institution_id,plan_id,entity_type,entity_id,event_type,from_status,to_status,note,actor_user_id)
    values(v_institution_id,v_plan_id,v_entity_type,new.id,v_entity_type||'_status_changed',v_old_status,new.status,v_note,v_actor);
  end if;
  return new;
end $$;
revoke all on function public.record_institution_support_history() from public,anon,authenticated;
