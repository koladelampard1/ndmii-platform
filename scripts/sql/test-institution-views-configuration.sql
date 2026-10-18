-- Transactional Sprint 7 acceptance fixture. All test records roll back.
begin;
do $$
declare suffix text:=replace(gen_random_uuid()::text,'-','');bank_a uuid;bank_b uuid;user_id uuid;business_a uuid;business_b uuid;
  engagement_a uuid;engagement_b uuid;member_a uuid;member_b uuid;diagnostic_template_a uuid;diagnostic_template_b uuid;
  diagnostic_a uuid;diagnostic_b uuid;finance_template_a uuid;finance_template_b uuid;finance_a uuid;finance_b uuid;application_a uuid;application_b uuid;
  snapshot_a jsonb;snapshot_b jsonb;export_a jsonb;export_b jsonb;
begin
  if not exists(select 1 from public.institution_operating_profiles p join public.institutions i on i.id=p.institution_id where i.slug='boi' and p.operating_model='development_finance' and p.agent_label_singular='BDSP') then
    raise exception 'BOI operating profile is missing';
  end if;
  if (select count(*) from public.institution_support_templates t join public.institutions i on i.id=t.institution_id where i.slug='boi')<>4 then
    raise exception 'BOI support templates are incomplete';
  end if;
  insert into public.users(email,full_name,role) values('s7-'||suffix||'@example.invalid','Sprint 7 fixture','workspace_user') returning id into user_id;
  insert into public.institutions(name,slug,institution_type) values('Relationship MFB fixture','s7-relationship-'||suffix,'microfinance_bank') returning id into bank_a;
  insert into public.institutions(name,slug,institution_type) values('Agent Network MFB fixture','s7-network-'||suffix,'microfinance_bank') returning id into bank_b;
  insert into public.institution_operating_profiles(institution_id,operating_model,short_name,primary_color,accent_color,agent_label_singular,agent_label_plural,business_label_singular,business_label_plural,post_finance_days,development_return_days,additional_information_days,default_follow_up_days)
  values(bank_a,'relationship_mfb','RMFB','#1D4ED8','#F59E0B','Relationship Officer','Relationship Officers','Customer','Customers',90,45,14,3),
        (bank_b,'agent_network_mfb','AMFB','#7C3AED','#10B981','Field Agent','Field Agents','Microenterprise','Microenterprises',60,30,7,2);
  insert into public.institution_support_templates(institution_id,pathway,name,objective,target_days,follow_up_days)
  values(bank_a,'post_finance','Relationship follow-up','Maintain repayment and customer business performance.',90,3),
        (bank_b,'post_finance','Field follow-up','Maintain close field support after financing.',60,2);
  insert into public.msmes(msme_id,business_name,owner_name,state,sector,created_by)
  values('S7-A-'||suffix,'Relationship business','Owner A','Lagos','Retail',user_id) returning id into business_a;
  insert into public.msmes(msme_id,business_name,owner_name,state,sector,created_by)
  values('S7-B-'||suffix,'Agent network business','Owner B','Kano','Agriculture',user_id) returning id into business_b;
  insert into public.institution_engagements(institution_id,msme_id,relationship_status,passport_access_status)
  values(bank_a,business_a,'active','granted') returning id into engagement_a;
  insert into public.institution_engagements(institution_id,msme_id,relationship_status,passport_access_status)
  values(bank_b,business_b,'active','granted') returning id into engagement_b;
  insert into public.institution_members(institution_id,user_id,role,status) values(bank_a,user_id,'institution_agent','active') returning id into member_a;
  insert into public.institution_members(institution_id,user_id,role,status) values(bank_b,user_id,'institution_agent','active') returning id into member_b;
  insert into public.institution_diagnostic_templates(institution_id,name,questions) values(bank_a,'Fixture diagnostic', '[{"id":"q1","label":"A valid diagnostic question"}]') returning id into diagnostic_template_a;
  insert into public.institution_diagnostic_templates(institution_id,name,questions) values(bank_b,'Fixture diagnostic', '[{"id":"q1","label":"A valid diagnostic question"}]') returning id into diagnostic_template_b;
  insert into public.institution_diagnostic_cases(institution_id,engagement_id,template_id,agent_member_id,questions,status)
  values(bank_a,engagement_a,diagnostic_template_a,member_a,'[{"id":"q1","label":"A valid diagnostic question"}]','approved') returning id into diagnostic_a;
  insert into public.institution_diagnostic_cases(institution_id,engagement_id,template_id,agent_member_id,questions,status)
  values(bank_b,engagement_b,diagnostic_template_b,member_b,'[{"id":"q1","label":"A valid diagnostic question"}]','approved') returning id into diagnostic_b;
  insert into public.institution_finance_templates(institution_id,name,requirements) values(bank_a,'Fixture finance','[{"key":"id_doc","label":"Identity","description":"","required":true}]') returning id into finance_template_a;
  insert into public.institution_finance_templates(institution_id,name,requirements) values(bank_b,'Fixture finance','[{"key":"id_doc","label":"Identity","description":"","required":true}]') returning id into finance_template_b;
  insert into public.institution_finance_cases(institution_id,engagement_id,diagnostic_case_id,template_id,agent_member_id,requirements,status)
  values(bank_a,engagement_a,diagnostic_a,finance_template_a,member_a,'[{"key":"id_doc","label":"Identity","description":"","required":true}]','accepted') returning id into finance_a;
  insert into public.institution_finance_cases(institution_id,engagement_id,diagnostic_case_id,template_id,agent_member_id,requirements,status)
  values(bank_b,engagement_b,diagnostic_b,finance_template_b,member_b,'[{"key":"id_doc","label":"Identity","description":"","required":true}]','accepted') returning id into finance_b;
  insert into public.institution_finance_applications(institution_id,case_id,application_reference,status)
  values(bank_a,finance_a,'S7-A-'||suffix,'accepted') returning id into application_a;
  insert into public.institution_finance_applications(institution_id,case_id,application_reference,status)
  values(bank_b,finance_b,'S7-B-'||suffix,'accepted') returning id into application_b;
  insert into public.institution_finance_outcomes(institution_id,application_id,outcome,decision_date,reason,approved_amount,currency,recorded_by_user_id)
  values(bank_a,application_a,'facility_approved',current_date,'Fixture approval',100000,'NGN',user_id);
  insert into public.institution_finance_outcomes(institution_id,application_id,outcome,decision_date,reason,approved_amount,currency,recorded_by_user_id)
  values(bank_b,application_b,'facility_approved',current_date,'Fixture approval',100000,'NGN',user_id);
  if (select target_end_date-start_date from public.institution_support_plans where institution_id=bank_a)<>90 or
     (select target_end_date-start_date from public.institution_support_plans where institution_id=bank_b)<>60 then raise exception 'Configured support duration was not applied';end if;
  if (select objective from public.institution_support_plans where institution_id=bank_a)<>'Maintain repayment and customer business performance.' or
     (select objective from public.institution_support_plans where institution_id=bank_b)<>'Maintain close field support after financing.' then raise exception 'Configured support template was not applied';end if;
  snapshot_a:=public.institution_dashboard_snapshot(bank_a);snapshot_b:=public.institution_dashboard_snapshot(bank_b);
  if (snapshot_a#>>'{overview,engagements}')::int<>1 or (snapshot_b#>>'{overview,engagements}')::int<>1 or
     (snapshot_a#>>'{overview,facilityApprovals}')::int<>1 or (snapshot_b#>>'{overview,supportPlans}')::int<>1 then raise exception 'Dashboard totals do not reconcile';end if;
  if snapshot_a#>>'{sectors,0,name}'<>'Retail' or snapshot_b#>>'{sectors,0,name}'<>'Agriculture' then raise exception 'Dashboard tenant isolation failed';end if;
  export_a:=public.institution_export_dataset(bank_a,'portfolio');export_b:=public.institution_export_dataset(bank_b,'portfolio');
  if jsonb_array_length(export_a)<>1 or export_a#>>'{0,business_name}'<>'Relationship business' or
     jsonb_array_length(export_b)<>1 or export_b#>>'{0,business_name}'<>'Agent network business' then raise exception 'Export tenant isolation failed';end if;
  if has_table_privilege('anon','public.institution_operating_profiles','select') or
     has_table_privilege('authenticated','public.institution_support_templates','select') or
     has_table_privilege('authenticated','public.institution_report_exports','insert') then raise exception 'Browser role has Sprint 7 table access';end if;
  if has_table_privilege('service_role','public.institution_report_exports','update') or
     has_table_privilege('service_role','public.institution_report_exports','delete') then raise exception 'Export audit is mutable through service role';end if;
  if has_function_privilege('anon','public.institution_dashboard_snapshot(uuid)','execute') or
     has_function_privilege('authenticated','public.institution_export_dataset(uuid,text)','execute') then raise exception 'Browser role can execute Sprint 7 functions';end if;
end $$;
rollback;
