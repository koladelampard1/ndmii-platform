create or replace function public.prevent_institution_onboarding_model_change()
returns trigger language plpgsql security invoker
set search_path = public
as $$
begin
  if old.operating_model <> new.operating_model then
    raise exception 'Operating model cannot be changed after onboarding initialization';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_institution_onboarding_model_change() from public, anon, authenticated;
grant execute on function public.prevent_institution_onboarding_model_change() to service_role;

create trigger prevent_institution_onboarding_model_change
before update of operating_model on public.institution_onboarding_projects
for each row execute function public.prevent_institution_onboarding_model_change();

create or replace function public.institution_go_live_readiness(p_institution_id uuid)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with facts as (
    select
      exists(select 1 from public.institution_operating_profiles p where p.institution_id = p_institution_id) as profile_ready,
      (select count(*) from public.institution_support_templates t where t.institution_id = p_institution_id and t.active) >= 3 as templates_ready,
      exists(select 1 from public.institution_members m where m.institution_id = p_institution_id and m.role = 'institution_admin' and m.status = 'active' and (m.expires_at is null or m.expires_at > now())) as administrator_ready,
      exists(select 1 from public.institution_agent_profiles a join public.institution_members m on m.id = a.member_id and m.institution_id = a.institution_id where a.institution_id = p_institution_id and m.status = 'active') as agent_ready,
      not exists(
        select 1 from public.institution_import_rows r
        join public.institution_import_batches b on b.id = r.batch_id and b.institution_id = r.institution_id
        where r.institution_id = p_institution_id and r.status = 'invalid'
          and b.id = (select latest.id from public.institution_import_batches latest
            where latest.institution_id = p_institution_id and latest.import_type = b.import_type
            order by latest.created_at desc, latest.id desc limit 1)
      ) as imports_ready,
      not exists(select 1 from public.institution_onboarding_checks c where c.institution_id = p_institution_id and c.required and c.status <> 'passed') as checks_ready,
      (select count(*) from public.institution_onboarding_checks c where c.institution_id = p_institution_id and c.required) as required_checks,
      (select count(*) from public.institution_onboarding_checks c where c.institution_id = p_institution_id and c.required and c.status = 'passed') as completed_checks
  ) select jsonb_build_object(
    'profileReady',profile_ready,'templatesReady',templates_ready,'administratorReady',administrator_ready,
    'agentReady',agent_ready,'importsReady',imports_ready,'checksReady',checks_ready,
    'requiredChecks',required_checks,'completedChecks',completed_checks,
    'canGoLive',profile_ready and templates_ready and administrator_ready and agent_ready and imports_ready and checks_ready
  ) from facts;
$$;

revoke all on function public.institution_go_live_readiness(uuid) from public, anon, authenticated;
grant execute on function public.institution_go_live_readiness(uuid) to service_role;
