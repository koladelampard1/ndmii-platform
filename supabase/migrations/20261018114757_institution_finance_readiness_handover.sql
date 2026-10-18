-- Institution-configured finance preparation and explicit bank application records.
-- Readiness is evidence of preparation only. A bank decision exists only in finance outcomes.
create table public.institution_finance_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  name text not null check(length(btrim(name)) between 3 and 120),
  version integer not null default 1 check(version > 0),
  requirements jsonb not null check(jsonb_typeof(requirements) = 'array'),
  active boolean not null default true,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(id,institution_id), unique(institution_id,name,version)
);

create table public.institution_finance_cases (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
  engagement_id uuid not null, diagnostic_case_id uuid not null, template_id uuid not null, agent_member_id uuid not null,
  requirements jsonb not null check(jsonb_typeof(requirements)='array'),
  status text not null default 'collecting' check(status in ('collecting','ready','handed_over','returned','accepted','closed')),
  gap_summary text not null default '', readiness_note text not null default '',
  readiness_completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,institution_id), unique(institution_id,engagement_id),
  foreign key(engagement_id,institution_id) references public.institution_engagements(id,institution_id),
  foreign key(diagnostic_case_id,institution_id) references public.institution_diagnostic_cases(id,institution_id),
  foreign key(template_id,institution_id) references public.institution_finance_templates(id,institution_id),
  foreign key(agent_member_id,institution_id) references public.institution_members(id,institution_id)
);

create table public.institution_finance_requirement_items (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, case_id uuid not null,
  requirement_key text not null check(requirement_key ~ '^[a-z0-9_]{2,40}$'), label text not null,
  description text not null default '', required boolean not null default true,
  status text not null default 'missing' check(status in ('missing','requested','provided','verified','waived')),
  request_message text, gap_note text, requested_at timestamptz, provided_at timestamptz, verified_at timestamptz,
  verified_by_user_id uuid references public.users(id), updated_at timestamptz not null default now(),
  unique(id,institution_id,case_id), unique(case_id,requirement_key),
  foreign key(case_id,institution_id) references public.institution_finance_cases(id,institution_id) on delete cascade
);

create table public.institution_finance_documents (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, case_id uuid not null, requirement_item_id uuid not null,
  storage_path text not null unique, file_name text not null,
  mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),
  byte_size integer not null check(byte_size between 1 and 10485760),
  uploaded_by_user_id uuid references public.users(id), created_at timestamptz not null default now(),
  foreign key(case_id,institution_id) references public.institution_finance_cases(id,institution_id) on delete cascade,
  foreign key(requirement_item_id,institution_id,case_id) references public.institution_finance_requirement_items(id,institution_id,case_id)
);

create table public.institution_finance_applications (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, case_id uuid not null,
  application_reference text not null, status text not null default 'submitted' check(status in ('submitted','accepted','returned','withdrawn')),
  submitted_by_user_id uuid references public.users(id), submitted_at timestamptz not null default now(),
  override_incomplete boolean not null default false, override_reason text,
  reviewed_by_user_id uuid references public.users(id), reviewed_at timestamptz, return_reason text, next_action text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,institution_id), unique(case_id), unique(institution_id,application_reference),
  foreign key(case_id,institution_id) references public.institution_finance_cases(id,institution_id),
  check(not override_incomplete or length(btrim(override_reason)) >= 10)
);

create table public.institution_finance_outcomes (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, application_id uuid not null,
  outcome text not null check(outcome in ('facility_approved','declined','deferred','additional_information','withdrawn')),
  decision_date date not null, reason text not null check(length(btrim(reason)) between 3 and 3000),
  approved_amount numeric(18,2), currency text check(currency ~ '^[A-Z]{3}$'),
  recorded_by_user_id uuid not null references public.users(id), created_at timestamptz not null default now(),
  unique(application_id), foreign key(application_id,institution_id) references public.institution_finance_applications(id,institution_id),
  check((outcome='facility_approved' and approved_amount is not null and approved_amount > 0 and currency is not null)
     or (outcome<>'facility_approved' and approved_amount is null and currency is null))
);

create index institution_finance_case_queue_idx on public.institution_finance_cases(institution_id,agent_member_id,status,updated_at desc);
create index institution_finance_items_case_idx on public.institution_finance_requirement_items(institution_id,case_id,status);
create index institution_finance_applications_queue_idx on public.institution_finance_applications(institution_id,status,submitted_at desc);

alter table public.institution_finance_templates enable row level security;
alter table public.institution_finance_cases enable row level security;
alter table public.institution_finance_requirement_items enable row level security;
alter table public.institution_finance_documents enable row level security;
alter table public.institution_finance_applications enable row level security;
alter table public.institution_finance_outcomes enable row level security;
revoke all on public.institution_finance_templates, public.institution_finance_cases, public.institution_finance_requirement_items,
  public.institution_finance_documents, public.institution_finance_applications, public.institution_finance_outcomes from public,anon,authenticated;
grant select,insert,update,delete on public.institution_finance_templates, public.institution_finance_cases, public.institution_finance_requirement_items,
  public.institution_finance_documents, public.institution_finance_applications, public.institution_finance_outcomes to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('institution-finance-documents','institution-finance-documents',false,10485760,array['application/pdf','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.sync_institution_finance_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='active' and (tg_op='INSERT' or old.agent_member_id is distinct from new.agent_member_id or old.status is distinct from new.status) then
    update public.institution_finance_cases set agent_member_id=new.agent_member_id,updated_at=now()
    where institution_id=new.institution_id and engagement_id=new.engagement_id and status not in ('accepted','closed');
  end if;
  return new;
end $$;
revoke all on function public.sync_institution_finance_assignment() from public,anon,authenticated;
create trigger institution_finance_assignment_sync after insert or update of agent_member_id,status on public.institution_business_assignments
for each row execute function public.sync_institution_finance_assignment();

create function public.submit_institution_finance_application(
  p_institution_id uuid,p_case_id uuid,p_reference text,p_actor_user_id uuid,p_override boolean,p_override_reason text
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_case public.institution_finance_cases; v_incomplete integer; v_id uuid; v_existing_status text;
begin
  select * into v_case from public.institution_finance_cases where id=p_case_id and institution_id=p_institution_id for update;
  if v_case.id is null or v_case.status not in ('collecting','ready','returned') then raise exception using errcode='P0002',message='case_unavailable'; end if;
  select count(*) into v_incomplete from public.institution_finance_requirement_items
    where case_id=p_case_id and institution_id=p_institution_id and required and status not in ('verified','waived');
  if v_incomplete>0 and (not p_override or length(btrim(coalesce(p_override_reason,'')))<10) then
    raise exception using errcode='P0001',message='incomplete_requirements';
  end if;
  select id,status into v_id,v_existing_status from public.institution_finance_applications where case_id=p_case_id for update;
  if v_id is null then
    insert into public.institution_finance_applications(institution_id,case_id,application_reference,submitted_by_user_id,override_incomplete,override_reason)
      values(p_institution_id,p_case_id,p_reference,p_actor_user_id,p_override,case when p_override then p_override_reason else null end)
      returning id into v_id;
  elsif v_existing_status='returned' then
    update public.institution_finance_applications set status='submitted',submitted_by_user_id=p_actor_user_id,submitted_at=now(),
      override_incomplete=p_override,override_reason=case when p_override then p_override_reason else null end,
      reviewed_by_user_id=null,reviewed_at=null,return_reason=null,next_action=null,updated_at=now() where id=v_id;
  else raise exception using errcode='23505',message='application_exists'; end if;
  update public.institution_finance_cases set status='handed_over',readiness_completed_at=now(),updated_at=now() where id=p_case_id;
  return v_id;
end $$;
revoke all on function public.submit_institution_finance_application(uuid,uuid,text,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.submit_institution_finance_application(uuid,uuid,text,uuid,boolean,text) to service_role;

create function public.review_institution_finance_application(
  p_institution_id uuid,p_application_id uuid,p_actor_user_id uuid,p_action text,p_reason text,p_next_action text
) returns void language plpgsql security invoker set search_path=public as $$
declare v_case_id uuid; v_status text;
begin
  select case_id,status into v_case_id,v_status from public.institution_finance_applications
    where id=p_application_id and institution_id=p_institution_id for update;
  if v_case_id is null or v_status<>'submitted' then raise exception using errcode='P0002',message='application_unavailable'; end if;
  if p_action='accept' then
    update public.institution_finance_applications set status='accepted',reviewed_by_user_id=p_actor_user_id,reviewed_at=now(),return_reason=null,next_action=null,updated_at=now() where id=p_application_id;
    update public.institution_finance_cases set status='accepted',updated_at=now() where id=v_case_id;
  elsif p_action='return' and length(btrim(coalesce(p_reason,'')))>=10 and length(btrim(coalesce(p_next_action,'')))>=3 then
    update public.institution_finance_applications set status='returned',reviewed_by_user_id=p_actor_user_id,reviewed_at=now(),return_reason=p_reason,next_action=p_next_action,updated_at=now() where id=p_application_id;
    update public.institution_finance_cases set status='returned',updated_at=now() where id=v_case_id;
  else raise exception using errcode='22023',message='invalid_review'; end if;
end $$;
revoke all on function public.review_institution_finance_application(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.review_institution_finance_application(uuid,uuid,uuid,text,text,text) to service_role;

create function public.record_institution_finance_outcome(
  p_institution_id uuid,p_application_id uuid,p_actor_user_id uuid,p_outcome text,p_decision_date date,
  p_reason text,p_approved_amount numeric,p_currency text
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_case_id uuid; v_status text; v_id uuid;
begin
  select case_id,status into v_case_id,v_status from public.institution_finance_applications
    where id=p_application_id and institution_id=p_institution_id for update;
  if v_case_id is null or v_status<>'accepted' then raise exception using errcode='P0002',message='accepted_application_required'; end if;
  insert into public.institution_finance_outcomes(institution_id,application_id,outcome,decision_date,reason,approved_amount,currency,recorded_by_user_id)
  values(p_institution_id,p_application_id,p_outcome,p_decision_date,p_reason,p_approved_amount,p_currency,p_actor_user_id) returning id into v_id;
  update public.institution_finance_cases set status='closed',updated_at=now() where id=v_case_id;
  return v_id;
end $$;
revoke all on function public.record_institution_finance_outcome(uuid,uuid,uuid,text,date,text,numeric,text) from public,anon,authenticated;
grant execute on function public.record_institution_finance_outcome(uuid,uuid,uuid,text,date,text,numeric,text) to service_role;
