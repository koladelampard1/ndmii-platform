-- Keep open diagnostic work with the currently assigned agent, including returns.
create or replace function public.sync_institution_diagnostic_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.agent_member_id is distinct from new.agent_member_id or old.status is distinct from new.status) then
    update public.institution_diagnostic_cases
       set agent_member_id = new.agent_member_id, updated_at = now()
     where institution_id = new.institution_id and engagement_id = new.engagement_id
       and status <> 'approved';
  end if;
  return new;
end $$;
revoke all on function public.sync_institution_diagnostic_assignment() from public, anon, authenticated;
create trigger institution_diagnostic_assignment_sync
  after insert or update of agent_member_id,status on public.institution_business_assignments
  for each row execute function public.sync_institution_diagnostic_assignment();
