-- Finance companies are distinct regulated institutions and must not be
-- represented as microfinance banks. The workflow remains shared while the
-- operating profile supplies institution-appropriate language and controls.
alter table public.institutions drop constraint if exists institutions_type_check;
alter table public.institutions add constraint institutions_type_check check (institution_type in (
  'federal_agency', 'state_government', 'lga', 'association', 'private_company',
  'development_finance_institution', 'microfinance_bank', 'finance_company', 'investor',
  'technical_partner', 'programme_secretariat', 'regulator'
));

alter table public.institution_operating_profiles
  drop constraint if exists institution_operating_profiles_operating_model_check;
alter table public.institution_operating_profiles
  add constraint institution_operating_profiles_operating_model_check
  check (operating_model in ('development_finance','relationship_mfb','agent_network_mfb','non_interest_finance'));

alter table public.institution_onboarding_projects
  drop constraint if exists institution_onboarding_projects_operating_model_check;
alter table public.institution_onboarding_projects
  add constraint institution_onboarding_projects_operating_model_check
  check (operating_model in ('development_finance','relationship_mfb','agent_network_mfb','non_interest_finance'));

create or replace function public.institution_initialize_onboarding(
  p_institution_id uuid,
  p_operating_model text,
  p_user_id uuid
) returns jsonb
language plpgsql security invoker
set search_path = public
as $$
declare
  v_name text;
  v_short_name text;
  v_agent_singular text;
  v_agent_plural text;
  v_business_singular text;
  v_business_plural text;
  v_diagnostic_label text;
  v_finance_label text;
  v_support_label text;
  v_primary text;
  v_accent text;
  v_post_days integer;
  v_return_days integer;
  v_info_days integer;
  v_follow_days integer;
  v_critical_days integer;
  v_export_formats text[];
begin
  if p_operating_model not in ('development_finance','relationship_mfb','agent_network_mfb','non_interest_finance') then
    raise exception 'Unsupported operating model';
  end if;
  select name into v_name from public.institutions where id = p_institution_id and status = 'active';
  if v_name is null then raise exception 'Institution unavailable'; end if;

  v_short_name := case when length(v_name) <= 40 then v_name when p_operating_model = 'development_finance' then 'DFI'
    when p_operating_model = 'non_interest_finance' then 'Finance Co.' else 'MFB' end;

  if p_operating_model = 'development_finance' then
    v_agent_singular := 'BDSP'; v_agent_plural := 'BDSPs';
    v_business_singular := 'Enterprise'; v_business_plural := 'Enterprises';
    v_diagnostic_label := 'Enterprise diagnostic'; v_finance_label := 'Finance readiness';
    v_support_label := 'Enterprise development support';
    v_primary := '#005B5C'; v_accent := '#D4A72C'; v_post_days := 180; v_return_days := 90;
    v_info_days := 30; v_follow_days := 7; v_critical_days := 3; v_export_formats := array['csv','json']::text[];
  elsif p_operating_model = 'agent_network_mfb' then
    v_agent_singular := 'Field Agent'; v_agent_plural := 'Field Agents';
    v_business_singular := 'Microenterprise'; v_business_plural := 'Microenterprises';
    v_diagnostic_label := 'Field business check'; v_finance_label := 'Credit preparation';
    v_support_label := 'Business follow-up';
    v_primary := '#7C3AED'; v_accent := '#10B981'; v_post_days := 60; v_return_days := 30;
    v_info_days := 7; v_follow_days := 2; v_critical_days := 1; v_export_formats := array['csv','json']::text[];
  elsif p_operating_model = 'non_interest_finance' then
    v_agent_singular := 'Business Support Officer'; v_agent_plural := 'Business Support Officers';
    v_business_singular := 'MSME'; v_business_plural := 'MSMEs';
    v_diagnostic_label := 'Business and financing assessment'; v_finance_label := 'Ethical financing readiness';
    v_support_label := 'Enterprise partnership support';
    v_primary := '#176B3A'; v_accent := '#C7A53B'; v_post_days := 120; v_return_days := 60;
    v_info_days := 14; v_follow_days := 3; v_critical_days := 2; v_export_formats := array['csv','json']::text[];
  else
    v_agent_singular := 'Relationship Officer'; v_agent_plural := 'Relationship Officers';
    v_business_singular := 'Customer'; v_business_plural := 'Customers';
    v_diagnostic_label := 'Business assessment'; v_finance_label := 'Loan readiness';
    v_support_label := 'Portfolio support';
    v_primary := '#1D4ED8'; v_accent := '#F59E0B'; v_post_days := 90; v_return_days := 45;
    v_info_days := 14; v_follow_days := 3; v_critical_days := 2; v_export_formats := array['csv']::text[];
  end if;

  insert into public.institution_operating_profiles (
    institution_id, operating_model, short_name, primary_color, accent_color,
    agent_label_singular, agent_label_plural, business_label_singular, business_label_plural,
    diagnostic_label, finance_label, support_label, follow_up_warning_days, critical_issue_sla_days,
    post_finance_days, development_return_days, additional_information_days, default_follow_up_days,
    export_formats, updated_by_user_id, updated_at
  ) values (
    p_institution_id, p_operating_model, v_short_name, v_primary, v_accent,
    v_agent_singular, v_agent_plural, v_business_singular, v_business_plural,
    v_diagnostic_label, v_finance_label, v_support_label, v_follow_days, v_critical_days,
    v_post_days, v_return_days, v_info_days, v_follow_days, v_export_formats, p_user_id, now()
  ) on conflict (institution_id) do nothing;

  insert into public.institution_onboarding_projects (institution_id, operating_model, updated_by_user_id)
  values (p_institution_id, p_operating_model, p_user_id)
  on conflict (institution_id) do update set operating_model = excluded.operating_model,
    updated_by_user_id = excluded.updated_by_user_id, updated_at = now();

  insert into public.institution_support_templates
    (institution_id, pathway, name, objective, target_days, follow_up_days, active, updated_by_user_id)
  values
    (p_institution_id,'post_finance','Post-financing enterprise support','Track the agreed use of financing, enterprise performance, partnership obligations and emerging risks.',v_post_days,v_follow_days,true,p_user_id),
    (p_institution_id,'development_return','Financing-readiness development','Resolve documented readiness gaps before the MSME returns for an appropriate financing pathway.',v_return_days,v_follow_days,true,p_user_id),
    (p_institution_id,'continuing_support','Continuing enterprise support','Coordinate additional information, advisory work and evidenced enterprise progress.',v_return_days,v_follow_days,true,p_user_id),
    (p_institution_id,'closed','Closed journey','Retain the completed support and financing record for audit and reporting.',0,null,true,p_user_id)
  on conflict (institution_id, pathway) do nothing;

  insert into public.institution_onboarding_checks (institution_id, check_key, category, label, required)
  values
    (p_institution_id,'executive_owner_confirmed','governance','Executive and operational owners confirmed',true),
    (p_institution_id,'operating_rules_approved','configuration','Branding, terminology, thresholds and timelines approved',true),
    (p_institution_id,'administrators_active','people','Institution administrators can access the workspace',true),
    (p_institution_id,'agent_roster_validated','people','Business-support officer or agent roster validated',true),
    (p_institution_id,'initial_data_reconciled','data','Initial imported records reconciled to the source',true),
    (p_institution_id,'journey_uat_passed','journey','End-to-end MSME journey passed UAT',true),
    (p_institution_id,'tenant_isolation_passed','security','Cross-institution access and export isolation passed',true),
    (p_institution_id,'support_model_agreed','operations','Support, escalation and incident ownership agreed',true),
    (p_institution_id,'mobile_devices_checked','journey','Priority mobile devices and browsers checked',false),
    (p_institution_id,'training_completed','operations','Administrators and delivery teams completed training',false)
  on conflict (institution_id, check_key) do nothing;

  return public.institution_go_live_readiness(p_institution_id);
end;
$$;

revoke all on function public.institution_initialize_onboarding(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.institution_initialize_onboarding(uuid,text,uuid) to service_role;
