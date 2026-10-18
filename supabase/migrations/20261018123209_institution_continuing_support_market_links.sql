-- Sprint 6: institution-scoped continuing support and market linkage.
-- A finance decision remains immutable history. This layer records what happens after it.

alter table public.institution_finance_outcomes
  add constraint institution_finance_outcomes_id_institution_unique unique(id,institution_id);

create table public.institution_support_plans (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  engagement_id uuid not null,
  finance_case_id uuid not null,
  finance_application_id uuid not null,
  finance_outcome_id uuid not null,
  agent_member_id uuid not null,
  pathway text not null check(pathway in ('post_finance','development_return','continuing_support','closed')),
  status text not null default 'active' check(status in ('planned','active','on_hold','completed','closed')),
  objective text not null default '',
  start_date date not null,
  target_end_date date,
  next_follow_up_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,institution_id),
  unique(finance_outcome_id),
  foreign key(engagement_id,institution_id) references public.institution_engagements(id,institution_id),
  foreign key(finance_case_id,institution_id) references public.institution_finance_cases(id,institution_id),
  foreign key(finance_application_id,institution_id) references public.institution_finance_applications(id,institution_id),
  foreign key(finance_outcome_id,institution_id) references public.institution_finance_outcomes(id,institution_id),
  foreign key(agent_member_id,institution_id) references public.institution_members(id,institution_id),
  check(target_end_date is null or target_end_date >= start_date),
  check((status='completed' and completed_at is not null) or status<>'completed')
);

create table public.institution_support_milestones (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, plan_id uuid not null,
  title text not null check(length(btrim(title)) between 3 and 300),
  category text not null check(category in ('business_growth','facility_condition','repayment','compliance','market','development')),
  owner_type text not null check(owner_type in ('business','agent','institution')),
  due_date date not null,
  status text not null default 'pending' check(status in ('pending','in_progress','completed','cancelled')),
  completion_note text, completed_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,institution_id,plan_id),
  foreign key(plan_id,institution_id) references public.institution_support_plans(id,institution_id) on delete cascade,
  check((status='completed' and completed_at is not null and length(btrim(coalesce(completion_note,'')))>=3) or status<>'completed')
);

create table public.institution_support_touchpoints (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, plan_id uuid not null,
  kind text not null check(kind in ('field_visit','mentoring','training','review','check_in')),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check(status in ('scheduled','completed','missed','cancelled')),
  summary text not null check(length(btrim(summary)) between 3 and 1000),
  outcome_note text, next_follow_up_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  completed_by_user_id uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,institution_id,plan_id),
  foreign key(plan_id,institution_id) references public.institution_support_plans(id,institution_id) on delete cascade,
  check((status='completed' and completed_at is not null and length(btrim(coalesce(outcome_note,'')))>=3) or status<>'completed')
);

create table public.institution_support_issues (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, plan_id uuid not null,
  category text not null check(category in ('operational','financial','repayment','compliance','market','other')),
  severity text not null check(severity in ('low','medium','high','critical')),
  summary text not null check(length(btrim(summary)) between 3 and 1000),
  status text not null default 'open' check(status in ('open','monitoring','resolved','closed')),
  due_date date, resolution_note text,
  created_by_user_id uuid references public.users(id) on delete set null,
  resolved_by_user_id uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,institution_id,plan_id),
  foreign key(plan_id,institution_id) references public.institution_support_plans(id,institution_id) on delete cascade,
  check((status in ('resolved','closed') and resolved_at is not null and length(btrim(coalesce(resolution_note,'')))>=3) or status not in ('resolved','closed'))
);

create table public.institution_market_referrals (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, plan_id uuid not null,
  kind text not null check(kind in ('buyer','supplier')),
  partner_name text not null check(length(btrim(partner_name)) between 2 and 200),
  opportunity text not null check(length(btrim(opportunity)) between 3 and 1000),
  contact_name text, contact_channel text,
  status text not null default 'proposed' check(status in ('proposed','introduced','engaged','converted','declined','closed')),
  follow_up_at timestamptz, outcome_note text,
  created_by_user_id uuid references public.users(id) on delete set null,
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,institution_id,plan_id),
  foreign key(plan_id,institution_id) references public.institution_support_plans(id,institution_id) on delete cascade,
  check(contact_name is null or length(contact_name)<=200),
  check(contact_channel is null or length(contact_channel)<=300),
  check(outcome_note is null or length(outcome_note)<=2000)
);

create table public.institution_support_history (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, plan_id uuid not null,
  entity_type text not null check(entity_type in ('plan','milestone','touchpoint','issue','referral')),
  entity_id uuid not null,
  event_type text not null check(length(event_type) between 3 and 100),
  from_status text, to_status text, note text,
  actor_user_id uuid references public.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  foreign key(plan_id,institution_id) references public.institution_support_plans(id,institution_id) on delete cascade
);

create index institution_support_plan_queue_idx on public.institution_support_plans(institution_id,agent_member_id,status,next_follow_up_at);
create index institution_support_milestone_due_idx on public.institution_support_milestones(institution_id,plan_id,status,due_date);
create index institution_support_touchpoint_due_idx on public.institution_support_touchpoints(institution_id,plan_id,status,scheduled_at);
create index institution_support_issue_queue_idx on public.institution_support_issues(institution_id,plan_id,status,severity,due_date);
create index institution_market_referral_due_idx on public.institution_market_referrals(institution_id,plan_id,status,follow_up_at);
create index institution_support_history_plan_idx on public.institution_support_history(institution_id,plan_id,occurred_at desc);
create index institution_support_plans_engagement_fk_idx on public.institution_support_plans(engagement_id,institution_id);
create index institution_support_plans_case_fk_idx on public.institution_support_plans(finance_case_id,institution_id);
create index institution_support_plans_application_fk_idx on public.institution_support_plans(finance_application_id,institution_id);
create index institution_support_plans_outcome_fk_idx on public.institution_support_plans(finance_outcome_id,institution_id);
create index institution_support_plans_agent_fk_idx on public.institution_support_plans(agent_member_id,institution_id);
create index institution_support_plans_creator_idx on public.institution_support_plans(created_by_user_id);
create index institution_support_milestones_plan_fk_idx on public.institution_support_milestones(plan_id,institution_id);
create index institution_support_milestones_creator_idx on public.institution_support_milestones(created_by_user_id);
create index institution_support_touchpoints_plan_fk_idx on public.institution_support_touchpoints(plan_id,institution_id);
create index institution_support_touchpoints_creator_idx on public.institution_support_touchpoints(created_by_user_id);
create index institution_support_touchpoints_completer_idx on public.institution_support_touchpoints(completed_by_user_id);
create index institution_support_issues_plan_fk_idx on public.institution_support_issues(plan_id,institution_id);
create index institution_support_issues_creator_idx on public.institution_support_issues(created_by_user_id);
create index institution_support_issues_resolver_idx on public.institution_support_issues(resolved_by_user_id);
create index institution_market_referrals_plan_fk_idx on public.institution_market_referrals(plan_id,institution_id);
create index institution_market_referrals_creator_idx on public.institution_market_referrals(created_by_user_id);
create index institution_market_referrals_updater_idx on public.institution_market_referrals(updated_by_user_id);
create index institution_support_history_plan_fk_idx on public.institution_support_history(plan_id,institution_id);
create index institution_support_history_actor_idx on public.institution_support_history(actor_user_id);

alter table public.institution_support_plans enable row level security;
alter table public.institution_support_milestones enable row level security;
alter table public.institution_support_touchpoints enable row level security;
alter table public.institution_support_issues enable row level security;
alter table public.institution_market_referrals enable row level security;
alter table public.institution_support_history enable row level security;

revoke all on public.institution_support_plans, public.institution_support_milestones,
  public.institution_support_touchpoints, public.institution_support_issues,
  public.institution_market_referrals, public.institution_support_history from public,anon,authenticated;
grant select,insert,update,delete on public.institution_support_plans, public.institution_support_milestones,
  public.institution_support_touchpoints, public.institution_support_issues,
  public.institution_market_referrals to service_role;
revoke all on public.institution_support_history from service_role;
grant select on public.institution_support_history to service_role;

create function public.create_institution_support_plan_from_outcome()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_case public.institution_finance_cases; v_pathway text; v_status text; v_objective text; v_days integer; v_plan_id uuid;
begin
  select c.* into v_case from public.institution_finance_applications a
    join public.institution_finance_cases c on c.id=a.case_id and c.institution_id=a.institution_id
    where a.id=new.application_id and a.institution_id=new.institution_id;
  if v_case.id is null then raise exception using errcode='P0002',message='finance_case_unavailable'; end if;
  if new.outcome='facility_approved' then
    v_pathway:='post_finance'; v_status:='active'; v_objective:='Support responsible facility use, repayment and sustainable business growth.'; v_days:=180;
  elsif new.outcome in ('declined','deferred') then
    v_pathway:='development_return'; v_status:='active'; v_objective:='Address the recorded decision gaps and prepare the business for its next appropriate pathway.'; v_days:=90;
  elsif new.outcome='additional_information' then
    v_pathway:='continuing_support'; v_status:='active'; v_objective:='Coordinate the additional information and follow-up required by the institution.'; v_days:=30;
  else
    v_pathway:='closed'; v_status:='closed'; v_objective:='Application withdrawn; retain the complete journey record.'; v_days:=0;
  end if;
  insert into public.institution_support_plans(institution_id,engagement_id,finance_case_id,finance_application_id,
    finance_outcome_id,agent_member_id,pathway,status,objective,start_date,target_end_date,next_follow_up_at,created_by_user_id)
  values(new.institution_id,v_case.engagement_id,v_case.id,new.application_id,new.id,v_case.agent_member_id,v_pathway,v_status,
    v_objective,new.decision_date,new.decision_date+v_days,case when v_status='active' then now()+interval '7 days' else null end,new.recorded_by_user_id)
  returning id into v_plan_id;
  insert into public.institution_support_history(institution_id,plan_id,entity_type,entity_id,event_type,to_status,note,actor_user_id)
  values(new.institution_id,v_plan_id,'plan',v_plan_id,'plan_created',v_status,v_objective,new.recorded_by_user_id);
  return new;
end $$;
revoke all on function public.create_institution_support_plan_from_outcome() from public,anon,authenticated;
create trigger institution_finance_outcome_support_plan after insert on public.institution_finance_outcomes
for each row execute function public.create_institution_support_plan_from_outcome();

insert into public.institution_support_plans(institution_id,engagement_id,finance_case_id,finance_application_id,
  finance_outcome_id,agent_member_id,pathway,status,objective,start_date,target_end_date,next_follow_up_at,created_by_user_id)
select o.institution_id,c.engagement_id,c.id,a.id,o.id,c.agent_member_id,
  case when o.outcome='facility_approved' then 'post_finance'
    when o.outcome in ('declined','deferred') then 'development_return'
    when o.outcome='additional_information' then 'continuing_support' else 'closed' end,
  case when o.outcome='withdrawn' then 'closed' else 'active' end,
  case when o.outcome='facility_approved' then 'Support responsible facility use, repayment and sustainable business growth.'
    when o.outcome in ('declined','deferred') then 'Address the recorded decision gaps and prepare the business for its next appropriate pathway.'
    when o.outcome='additional_information' then 'Coordinate the additional information and follow-up required by the institution.'
    else 'Application withdrawn; retain the complete journey record.' end,
  o.decision_date,
  o.decision_date + case when o.outcome='facility_approved' then 180 when o.outcome in ('declined','deferred') then 90
    when o.outcome='additional_information' then 30 else 0 end,
  case when o.outcome='withdrawn' then null else o.created_at+interval '7 days' end,
  o.recorded_by_user_id
from public.institution_finance_outcomes o
join public.institution_finance_applications a on a.id=o.application_id and a.institution_id=o.institution_id
join public.institution_finance_cases c on c.id=a.case_id and c.institution_id=a.institution_id
on conflict(finance_outcome_id) do nothing;

insert into public.institution_support_history(institution_id,plan_id,entity_type,entity_id,event_type,to_status,note,actor_user_id,occurred_at)
select p.institution_id,p.id,'plan',p.id,'plan_created',p.status,p.objective,p.created_by_user_id,p.created_at
from public.institution_support_plans p
where not exists(select 1 from public.institution_support_history h where h.plan_id=p.id and h.event_type='plan_created');

create function public.record_institution_support_history()
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

create trigger institution_support_plan_history after update of status on public.institution_support_plans
for each row execute function public.record_institution_support_history();
create trigger institution_support_milestone_history after insert or update of status on public.institution_support_milestones
for each row execute function public.record_institution_support_history();
create trigger institution_support_touchpoint_history after insert or update of status on public.institution_support_touchpoints
for each row execute function public.record_institution_support_history();
create trigger institution_support_issue_history after insert or update of status on public.institution_support_issues
for each row execute function public.record_institution_support_history();
create trigger institution_market_referral_history after insert or update of status on public.institution_market_referrals
for each row execute function public.record_institution_support_history();

create function public.sync_institution_support_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='active' and (tg_op='INSERT' or old.agent_member_id is distinct from new.agent_member_id or old.status is distinct from new.status) then
    update public.institution_support_plans set agent_member_id=new.agent_member_id,updated_at=now()
    where institution_id=new.institution_id and engagement_id=new.engagement_id and status not in ('completed','closed');
  end if;
  return new;
end $$;
revoke all on function public.sync_institution_support_assignment() from public,anon,authenticated;
create trigger institution_support_assignment_sync after insert or update of agent_member_id,status on public.institution_business_assignments
for each row execute function public.sync_institution_support_assignment();
