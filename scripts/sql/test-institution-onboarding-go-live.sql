begin;

do $$
declare
  v_user uuid;
  v_first uuid := gen_random_uuid();
  v_second uuid := gen_random_uuid();
  v_first_admin uuid;
  v_first_agent uuid;
  v_second_admin uuid;
  v_second_agent uuid;
  v_batch uuid;
  v_ready jsonb;
begin
  select id into v_user from public.users where auth_user_id is not null order by created_at limit 1;
  if v_user is null then raise exception 'Fixture requires one verified application user'; end if;

  insert into public.institutions(id,name,slug,institution_type,status) values
    (v_first,'Sprint 8 Relationship Reference','sprint8-relationship-' || replace(v_first::text,'-',''),'microfinance_bank','active'),
    (v_second,'Sprint 8 Agent Network Reference','sprint8-network-' || replace(v_second::text,'-',''),'microfinance_bank','active');

  perform public.institution_initialize_onboarding(v_first,'relationship_mfb',v_user);
  perform public.institution_initialize_onboarding(v_second,'agent_network_mfb',v_user);
  begin
    perform public.institution_initialize_onboarding(v_first,'agent_network_mfb',v_user);
    raise exception 'Operating model mutation should have failed';
  exception when others then
    if sqlerrm = 'Operating model mutation should have failed' then raise; end if;
  end;

  insert into public.institution_members(institution_id,user_id,role,status,joined_at) values
    (v_first,v_user,'institution_admin','active',now()) returning id into v_first_admin;
  insert into public.institution_members(institution_id,user_id,role,status,joined_at) values
    (v_first,v_user,'institution_agent','active',now()) returning id into v_first_agent;
  insert into public.institution_members(institution_id,user_id,role,status,joined_at) values
    (v_second,v_user,'institution_admin','active',now()) returning id into v_second_admin;
  insert into public.institution_members(institution_id,user_id,role,status,joined_at) values
    (v_second,v_user,'institution_agent','active',now()) returning id into v_second_agent;
  insert into public.institution_agent_profiles(institution_id,member_id,service_states) values
    (v_first,v_first_agent,array['Lagos']), (v_second,v_second_agent,array['Ogun']);

  update public.institution_onboarding_checks set status='not_applicable',checked_by_user_id=v_user,checked_at=now()
  where institution_id=v_first and required and check_key='tenant_isolation_passed';
  select public.institution_go_live_readiness(v_first) into v_ready;
  if (v_ready->>'checksReady')::boolean then raise exception 'Required control cannot be waived'; end if;

  update public.institution_onboarding_checks set status='passed',checked_by_user_id=v_user,checked_at=now()
  where institution_id in (v_first,v_second) and required;

  select public.institution_go_live_readiness(v_first) into v_ready;
  if not (v_ready->>'canGoLive')::boolean then raise exception 'Relationship MFB should be ready: %',v_ready; end if;
  select public.institution_go_live_readiness(v_second) into v_ready;
  if not (v_ready->>'canGoLive')::boolean then raise exception 'Agent-network MFB should be ready: %',v_ready; end if;

  if (select post_finance_days from public.institution_operating_profiles where institution_id=v_first) <> 90 then raise exception 'Relationship rules not applied'; end if;
  if (select post_finance_days from public.institution_operating_profiles where institution_id=v_second) <> 60 then raise exception 'Agent-network rules not applied'; end if;
  if (select count(*) from public.institution_onboarding_checks where institution_id=v_first) <> 10 then raise exception 'First tenant checks incomplete'; end if;
  if (select count(*) from public.institution_onboarding_checks where institution_id=v_second) <> 10 then raise exception 'Second tenant checks incomplete'; end if;

  insert into public.institution_import_batches(institution_id,import_type,source_name,status,total_rows,valid_rows,failed_rows,created_by_user_id,completed_at)
  values(v_first,'agents','Isolation fixture','failed',1,0,1,v_user,now()) returning id into v_batch;
  insert into public.institution_import_rows(institution_id,batch_id,row_number,row_data,status,errors)
  values(v_first,v_batch,1,'{"email":"invalid"}'::jsonb,'invalid',array['Invalid email']);
  select public.institution_go_live_readiness(v_first) into v_ready;
  if (v_ready->>'importsReady')::boolean then raise exception 'Invalid import must block go-live'; end if;
  select public.institution_go_live_readiness(v_second) into v_ready;
  if not (v_ready->>'importsReady')::boolean then raise exception 'Import failure leaked across tenants'; end if;

  insert into public.institution_import_batches(institution_id,import_type,source_name,status,total_rows,valid_rows,imported_rows,created_by_user_id,completed_at)
  values(v_first,'agents','Reconciled fixture','imported',1,1,1,v_user,now());
  select public.institution_go_live_readiness(v_first) into v_ready;
  if not (v_ready->>'importsReady')::boolean then raise exception 'A clean latest import should reconcile the previous batch'; end if;

  perform public.institution_activate_onboarding(v_second,v_user,'Fixture UAT passed and operations ownership was confirmed.');
  if (select status from public.institution_onboarding_projects where institution_id=v_second) <> 'live' then raise exception 'Atomic activation failed'; end if;

  if has_table_privilege('anon','public.institution_onboarding_projects','select') then raise exception 'Anon can read onboarding'; end if;
  if has_table_privilege('authenticated','public.institution_import_rows','select') then raise exception 'Authenticated can read imports'; end if;
  if has_function_privilege('anon','public.institution_go_live_readiness(uuid)','execute') then raise exception 'Anon can execute readiness'; end if;
  if has_function_privilege('authenticated','public.institution_activate_onboarding(uuid,uuid,text)','execute') then raise exception 'Authenticated can activate onboarding'; end if;
end $$;

rollback;
