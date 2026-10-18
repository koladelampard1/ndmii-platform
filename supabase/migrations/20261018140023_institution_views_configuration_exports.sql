-- Sprint 7: configurable institution operating profiles, management views and export audit.
-- The same workflow serves development-finance and microfinance institutions; only configuration varies.

create table public.institution_operating_profiles (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  operating_model text not null default 'relationship_mfb'
    check(operating_model in ('development_finance','relationship_mfb','agent_network_mfb')),
  short_name text not null check(length(btrim(short_name)) between 2 and 40),
  logo_url text check(logo_url is null or length(logo_url) <= 500),
  primary_color text not null default '#115E59' check(primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#D97706' check(accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  agent_label_singular text not null default 'Agent' check(length(btrim(agent_label_singular)) between 2 and 40),
  agent_label_plural text not null default 'Agents' check(length(btrim(agent_label_plural)) between 2 and 40),
  business_label_singular text not null default 'Business' check(length(btrim(business_label_singular)) between 2 and 40),
  business_label_plural text not null default 'Businesses' check(length(btrim(business_label_plural)) between 2 and 40),
  diagnostic_label text not null default 'Business diagnostic' check(length(btrim(diagnostic_label)) between 3 and 80),
  finance_label text not null default 'Finance readiness' check(length(btrim(finance_label)) between 3 and 80),
  support_label text not null default 'Continuing support' check(length(btrim(support_label)) between 3 and 80),
  follow_up_warning_days integer not null default 7 check(follow_up_warning_days between 1 and 60),
  critical_issue_sla_days integer not null default 3 check(critical_issue_sla_days between 1 and 30),
  post_finance_days integer not null default 180 check(post_finance_days between 1 and 730),
  development_return_days integer not null default 90 check(development_return_days between 1 and 365),
  additional_information_days integer not null default 30 check(additional_information_days between 1 and 90),
  default_follow_up_days integer not null default 7 check(default_follow_up_days between 1 and 60),
  export_formats text[] not null default array['csv']::text[]
    check(cardinality(export_formats) between 1 and 2 and export_formats <@ array['csv','json']::text[]),
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institution_support_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  pathway text not null check(pathway in ('post_finance','development_return','continuing_support','closed')),
  name text not null check(length(btrim(name)) between 3 and 120),
  objective text not null check(length(btrim(objective)) between 3 and 2000),
  target_days integer not null check(target_days between 0 and 730),
  follow_up_days integer check(follow_up_days between 1 and 60),
  milestone_blueprint jsonb not null default '[]'::jsonb check(jsonb_typeof(milestone_blueprint)='array'),
  active boolean not null default true,
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,institution_id),
  unique(institution_id,pathway),
  check((pathway='closed' and target_days=0 and follow_up_days is null)
    or (pathway<>'closed' and target_days between 1 and 730 and follow_up_days is not null))
);

create table public.institution_report_exports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  dataset text not null check(dataset in ('portfolio','agent_delivery','support_activity')),
  export_format text not null check(export_format in ('csv','json')),
  row_count integer not null check(row_count >= 0),
  requested_by_user_id uuid references public.users(id) on delete set null,
  generated_at timestamptz not null default now()
);

create index institution_support_templates_scope_idx
  on public.institution_support_templates(institution_id,pathway,active);
create index institution_report_exports_scope_idx
  on public.institution_report_exports(institution_id,generated_at desc);

alter table public.institution_operating_profiles enable row level security;
alter table public.institution_support_templates enable row level security;
alter table public.institution_report_exports enable row level security;
revoke all on public.institution_operating_profiles, public.institution_support_templates,
  public.institution_report_exports from public,anon,authenticated;
grant select,insert,update,delete on public.institution_operating_profiles,
  public.institution_support_templates to service_role;
revoke all on public.institution_report_exports from service_role;
grant select,insert on public.institution_report_exports to service_role;

create or replace function public.institution_dashboard_snapshot(p_institution_id uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'overview',jsonb_build_object(
      'engagements',(select count(*) from institution_engagements where institution_id=p_institution_id),
      'activeEngagements',(select count(*) from institution_engagements where institution_id=p_institution_id and relationship_status='active'),
      'sharedBusinesses',(select count(*) from institution_engagements where institution_id=p_institution_id and passport_access_status='granted'),
      'diagnostics',(select count(*) from institution_diagnostic_cases where institution_id=p_institution_id),
      'approvedDiagnostics',(select count(*) from institution_diagnostic_cases where institution_id=p_institution_id and status='approved'),
      'financeCases',(select count(*) from institution_finance_cases where institution_id=p_institution_id),
      'applications',(select count(*) from institution_finance_applications where institution_id=p_institution_id),
      'facilityApprovals',(select count(*) from institution_finance_outcomes where institution_id=p_institution_id and outcome='facility_approved'),
      'approvedAmount',(select coalesce(sum(approved_amount),0) from institution_finance_outcomes where institution_id=p_institution_id and outcome='facility_approved'),
      'supportPlans',(select count(*) from institution_support_plans where institution_id=p_institution_id),
      'activeSupportPlans',(select count(*) from institution_support_plans where institution_id=p_institution_id and status in ('planned','active','on_hold')),
      'criticalIssues',(select count(*) from institution_support_issues where institution_id=p_institution_id and severity='critical' and status in ('open','monitoring')),
      'convertedReferrals',(select count(*) from institution_market_referrals where institution_id=p_institution_id and status='converted'),
      'overdueActions',(
        (select count(*) from institution_support_milestones where institution_id=p_institution_id and status in ('pending','in_progress') and due_date<current_date)+
        (select count(*) from institution_support_touchpoints where institution_id=p_institution_id and status='scheduled' and scheduled_at<now())+
        (select count(*) from institution_market_referrals where institution_id=p_institution_id and status in ('proposed','introduced','engaged') and follow_up_at<now())
      )
    ),
    'pipeline',jsonb_build_array(
      jsonb_build_object('key','identified','value',(select count(*) from institution_engagements where institution_id=p_institution_id)),
      jsonb_build_object('key','verified','value',(select count(*) from institution_engagements where institution_id=p_institution_id and passport_access_status='granted')),
      jsonb_build_object('key','diagnosed','value',(select count(*) from institution_diagnostic_cases where institution_id=p_institution_id and status='approved')),
      jsonb_build_object('key','finance_ready','value',(select count(*) from institution_finance_cases where institution_id=p_institution_id and status in ('ready','handed_over','accepted','closed'))),
      jsonb_build_object('key','handed_over','value',(select count(*) from institution_finance_applications where institution_id=p_institution_id)),
      jsonb_build_object('key','financed','value',(select count(*) from institution_finance_outcomes where institution_id=p_institution_id and outcome='facility_approved')),
      jsonb_build_object('key','supported','value',(select count(*) from institution_support_plans where institution_id=p_institution_id))
    ),
    'financeOutcomes',jsonb_build_object(
      'facility_approved',(select count(*) from institution_finance_outcomes where institution_id=p_institution_id and outcome='facility_approved'),
      'declined',(select count(*) from institution_finance_outcomes where institution_id=p_institution_id and outcome='declined'),
      'deferred',(select count(*) from institution_finance_outcomes where institution_id=p_institution_id and outcome='deferred'),
      'additional_information',(select count(*) from institution_finance_outcomes where institution_id=p_institution_id and outcome='additional_information'),
      'withdrawn',(select count(*) from institution_finance_outcomes where institution_id=p_institution_id and outcome='withdrawn')
    ),
    'agentDelivery',coalesce((select jsonb_agg(jsonb_build_object(
      'memberId',m.id,'name',coalesce(u.full_name,u.email,'Institution agent'),
      'activeAssignments',(select count(*) from institution_business_assignments a where a.institution_id=p_institution_id and a.agent_member_id=m.id and a.status='active'),
      'diagnostics',(select count(*) from institution_diagnostic_cases d where d.institution_id=p_institution_id and d.agent_member_id=m.id),
      'approvedDiagnostics',(select count(*) from institution_diagnostic_cases d where d.institution_id=p_institution_id and d.agent_member_id=m.id and d.status='approved'),
      'financeCases',(select count(*) from institution_finance_cases f where f.institution_id=p_institution_id and f.agent_member_id=m.id),
      'supportPlans',(select count(*) from institution_support_plans s where s.institution_id=p_institution_id and s.agent_member_id=m.id)
    ) order by coalesce(u.full_name,u.email)) from institution_members m left join users u on u.id=m.user_id
      where m.institution_id=p_institution_id and m.role='institution_agent' and m.status='active'),'[]'::jsonb),
    'sectors',coalesce((select jsonb_agg(jsonb_build_object('name',sector,'value',total) order by total desc,sector)
      from (select coalesce(nullif(btrim(m.sector),''),'Not stated') sector,count(*) total from institution_engagements e
        join msmes m on m.id=e.msme_id where e.institution_id=p_institution_id group by 1) s),'[]'::jsonb),
    'states',coalesce((select jsonb_agg(jsonb_build_object('name',state,'value',total) order by total desc,state)
      from (select coalesce(nullif(btrim(m.state),''),'Not stated') state,count(*) total from institution_engagements e
        join msmes m on m.id=e.msme_id where e.institution_id=p_institution_id group by 1) s),'[]'::jsonb)
  );
$$;
revoke all on function public.institution_dashboard_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.institution_dashboard_snapshot(uuid) to service_role;

create or replace function public.institution_export_dataset(p_institution_id uuid,p_dataset text)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare v_rows jsonb;
begin
  if p_dataset='portfolio' then
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc),'[]'::jsonb) into v_rows
    from (select e.created_at,e.id engagement_id,m.msme_id business_id,m.business_name,m.state,m.sector,
      e.relationship_status,e.passport_access_status,d.status diagnostic_status,f.status finance_status,
      a.application_reference,a.status application_status,o.outcome finance_outcome,o.decision_date,
      o.approved_amount,o.currency,s.pathway support_pathway,s.status support_status,s.next_follow_up_at
      from institution_engagements e join msmes m on m.id=e.msme_id
      left join institution_diagnostic_cases d on d.institution_id=e.institution_id and d.engagement_id=e.id
      left join institution_finance_cases f on f.institution_id=e.institution_id and f.engagement_id=e.id
      left join institution_finance_applications a on a.institution_id=f.institution_id and a.case_id=f.id
      left join institution_finance_outcomes o on o.institution_id=a.institution_id and o.application_id=a.id
      left join institution_support_plans s on s.institution_id=e.institution_id and s.engagement_id=e.id
      where e.institution_id=p_institution_id) row_data;
  elsif p_dataset='agent_delivery' then
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.agent_name),'[]'::jsonb) into v_rows
    from (select m.id agent_member_id,coalesce(u.full_name,u.email,'Institution agent') agent_name,
      p.service_states,b.name bdsp_organisation,
      (select count(*) from institution_business_assignments a where a.institution_id=p_institution_id and a.agent_member_id=m.id and a.status='active') active_assignments,
      (select count(*) from institution_diagnostic_cases d where d.institution_id=p_institution_id and d.agent_member_id=m.id) diagnostics,
      (select count(*) from institution_diagnostic_cases d where d.institution_id=p_institution_id and d.agent_member_id=m.id and d.status='approved') approved_diagnostics,
      (select count(*) from institution_finance_cases f where f.institution_id=p_institution_id and f.agent_member_id=m.id) finance_cases,
      (select count(*) from institution_support_plans s where s.institution_id=p_institution_id and s.agent_member_id=m.id) support_plans
      from institution_members m join institution_agent_profiles p on p.institution_id=m.institution_id and p.member_id=m.id
      left join users u on u.id=m.user_id left join institution_bdsp_organisations b on b.id=p.bdsp_organisation_id and b.institution_id=p.institution_id
      where m.institution_id=p_institution_id and m.role='institution_agent' and m.status='active') row_data;
  elsif p_dataset='support_activity' then
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.recorded_at desc),'[]'::jsonb) into v_rows
    from (select p.id plan_id,m.msme_id business_id,m.business_name,'plan' record_type,p.pathway category,
      p.status,p.objective summary,p.next_follow_up_at due_at,p.created_at recorded_at
      from institution_support_plans p join institution_engagements e on e.id=p.engagement_id and e.institution_id=p.institution_id
      join msmes m on m.id=e.msme_id where p.institution_id=p_institution_id
      union all select p.id,m.msme_id,m.business_name,'milestone',x.category,x.status,x.title,x.due_date::timestamptz,x.created_at
      from institution_support_milestones x join institution_support_plans p on p.id=x.plan_id and p.institution_id=x.institution_id
      join institution_engagements e on e.id=p.engagement_id and e.institution_id=p.institution_id join msmes m on m.id=e.msme_id
      where x.institution_id=p_institution_id
      union all select p.id,m.msme_id,m.business_name,'touchpoint',x.kind,x.status,x.summary,x.scheduled_at,x.created_at
      from institution_support_touchpoints x join institution_support_plans p on p.id=x.plan_id and p.institution_id=x.institution_id
      join institution_engagements e on e.id=p.engagement_id and e.institution_id=p.institution_id join msmes m on m.id=e.msme_id
      where x.institution_id=p_institution_id
      union all select p.id,m.msme_id,m.business_name,'issue',x.category,x.status,x.summary,x.due_date::timestamptz,x.created_at
      from institution_support_issues x join institution_support_plans p on p.id=x.plan_id and p.institution_id=x.institution_id
      join institution_engagements e on e.id=p.engagement_id and e.institution_id=p.institution_id join msmes m on m.id=e.msme_id
      where x.institution_id=p_institution_id
      union all select p.id,m.msme_id,m.business_name,'referral',x.kind,x.status,x.opportunity,x.follow_up_at,x.created_at
      from institution_market_referrals x join institution_support_plans p on p.id=x.plan_id and p.institution_id=x.institution_id
      join institution_engagements e on e.id=p.engagement_id and e.institution_id=p.institution_id join msmes m on m.id=e.msme_id
      where x.institution_id=p_institution_id) row_data;
  else raise exception using errcode='22023',message='unsupported_export_dataset'; end if;
  return v_rows;
end $$;
revoke all on function public.institution_export_dataset(uuid,text) from public,anon,authenticated;
grant execute on function public.institution_export_dataset(uuid,text) to service_role;

-- Support-plan creation now reads institution configuration, with safe defaults for unconfigured tenants.
create or replace function public.create_institution_support_plan_from_outcome()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_case public.institution_finance_cases; v_pathway text; v_status text; v_objective text; v_days integer;
  v_follow_up_days integer; v_plan_id uuid; v_template public.institution_support_templates; v_profile public.institution_operating_profiles;
begin
  select c.* into v_case from public.institution_finance_applications a
    join public.institution_finance_cases c on c.id=a.case_id and c.institution_id=a.institution_id
    where a.id=new.application_id and a.institution_id=new.institution_id;
  if v_case.id is null then raise exception using errcode='P0002',message='finance_case_unavailable'; end if;
  select * into v_profile from public.institution_operating_profiles where institution_id=new.institution_id;
  if new.outcome='facility_approved' then v_pathway:='post_finance'; v_status:='active';
    v_objective:='Support responsible facility use, repayment and sustainable business growth.'; v_days:=coalesce(v_profile.post_finance_days,180);
  elsif new.outcome in ('declined','deferred') then v_pathway:='development_return'; v_status:='active';
    v_objective:='Address the recorded decision gaps and prepare the business for its next appropriate pathway.'; v_days:=coalesce(v_profile.development_return_days,90);
  elsif new.outcome='additional_information' then v_pathway:='continuing_support'; v_status:='active';
    v_objective:='Coordinate the additional information and follow-up required by the institution.'; v_days:=coalesce(v_profile.additional_information_days,30);
  else v_pathway:='closed'; v_status:='closed'; v_objective:='Application withdrawn; retain the complete journey record.'; v_days:=0; end if;
  select * into v_template from public.institution_support_templates
    where institution_id=new.institution_id and pathway=v_pathway and active limit 1;
  v_objective:=coalesce(v_template.objective,v_objective); v_days:=coalesce(v_template.target_days,v_days);
  v_follow_up_days:=coalesce(v_template.follow_up_days,v_profile.default_follow_up_days,7);
  insert into public.institution_support_plans(institution_id,engagement_id,finance_case_id,finance_application_id,
    finance_outcome_id,agent_member_id,pathway,status,objective,start_date,target_end_date,next_follow_up_at,created_by_user_id)
  values(new.institution_id,v_case.engagement_id,v_case.id,new.application_id,new.id,v_case.agent_member_id,v_pathway,v_status,
    v_objective,new.decision_date,new.decision_date+v_days,case when v_status='active' then now()+make_interval(days=>v_follow_up_days) else null end,new.recorded_by_user_id)
  returning id into v_plan_id;
  insert into public.institution_support_history(institution_id,plan_id,entity_type,entity_id,event_type,to_status,note,actor_user_id)
  values(new.institution_id,v_plan_id,'plan',v_plan_id,'plan_created',v_status,v_objective,new.recorded_by_user_id);
  return new;
end $$;
revoke all on function public.create_institution_support_plan_from_outcome() from public,anon,authenticated;

insert into public.institution_operating_profiles(institution_id,operating_model,short_name,primary_color,accent_color,
  agent_label_singular,agent_label_plural,business_label_singular,business_label_plural,diagnostic_label,finance_label,support_label,
  follow_up_warning_days,critical_issue_sla_days,post_finance_days,development_return_days,additional_information_days,default_follow_up_days)
select id,'development_finance','BOI','#005B5C','#D4A72C','BDSP','BDSPs','Enterprise','Enterprises',
  'Enterprise diagnostic','Finance readiness','Enterprise development support',7,3,180,90,30,7
from public.institutions where slug='boi'
on conflict(institution_id) do nothing;

insert into public.institution_support_templates(institution_id,pathway,name,objective,target_days,follow_up_days)
select i.id,v.pathway,v.name,v.objective,v.target_days,v.follow_up_days
from public.institutions i cross join (values
  ('post_finance','BOI post-finance enterprise support','Support responsible facility deployment, repayment performance and sustainable enterprise growth.',180,7),
  ('development_return','BOI enterprise development return','Address the recorded financing gaps and prepare the enterprise for its next appropriate BOI pathway.',90,7),
  ('continuing_support','BOI additional-information support','Coordinate the additional information, advisory work and follow-up required for the enterprise.',30,5),
  ('closed','BOI closed journey record','Retain the complete enterprise-development journey after withdrawal.',0,null)
) as v(pathway,name,objective,target_days,follow_up_days)
where i.slug='boi'
on conflict(institution_id,pathway) do nothing;
