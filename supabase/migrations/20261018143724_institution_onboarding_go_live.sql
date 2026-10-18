-- Sprint 8: repeatable institution onboarding, evidence-led UAT and go-live control.

create table public.institution_onboarding_projects (
  institution_id uuid primary key references public.institutions(id) on delete restrict,
  status text not null default 'configuration' check (status in ('configuration','data_setup','uat','ready','live','blocked')),
  operating_model text not null check (operating_model in ('development_finance','relationship_mfb','agent_network_mfb')),
  target_go_live_date date,
  expected_agents integer not null default 0 check (expected_agents between 0 and 100000),
  expected_businesses integer not null default 0 check (expected_businesses between 0 and 10000000),
  programme_owner text,
  technical_owner text,
  signoff_note text check (signoff_note is null or length(signoff_note) <= 4000),
  activated_at timestamptz,
  activated_by_user_id uuid references public.users(id) on delete set null,
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institution_onboarding_checks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  check_key text not null check (check_key ~ '^[a-z0-9_]{3,80}$'),
  category text not null check (category in ('governance','configuration','people','data','journey','security','operations')),
  label text not null check (length(btrim(label)) between 3 and 180),
  required boolean not null default true,
  status text not null default 'not_started' check (status in ('not_started','passed','failed','not_applicable')),
  evidence_note text check (evidence_note is null or length(evidence_note) <= 4000),
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://'),
  checked_by_user_id uuid references public.users(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, check_key),
  unique (id, institution_id)
);

create table public.institution_import_batches (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  import_type text not null check (import_type in ('bdsp_organisations','agents')),
  source_name text not null check (length(btrim(source_name)) between 1 and 180),
  status text not null default 'validating' check (status in ('validating','validated','partially_imported','imported','failed')),
  total_rows integer not null default 0 check (total_rows between 0 and 5000),
  valid_rows integer not null default 0 check (valid_rows between 0 and total_rows),
  imported_rows integer not null default 0 check (imported_rows between 0 and total_rows),
  failed_rows integer not null default 0 check (failed_rows between 0 and total_rows),
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, institution_id)
);

create table public.institution_import_rows (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  batch_id uuid not null,
  row_number integer not null check (row_number between 1 and 5000),
  row_data jsonb not null default '{}'::jsonb,
  status text not null check (status in ('valid','invalid','imported','skipped')),
  errors text[] not null default '{}'::text[],
  created_entity_id uuid,
  created_at timestamptz not null default now(),
  foreign key (batch_id, institution_id) references public.institution_import_batches(id, institution_id) on delete restrict,
  unique (batch_id, row_number)
);

create index institution_onboarding_checks_scope_idx on public.institution_onboarding_checks(institution_id, category, status);
create index institution_import_batches_scope_idx on public.institution_import_batches(institution_id, created_at desc);
create index institution_import_rows_scope_idx on public.institution_import_rows(institution_id, batch_id, status);
create index institution_onboarding_projects_updated_by_idx on public.institution_onboarding_projects(updated_by_user_id) where updated_by_user_id is not null;
create index institution_onboarding_projects_activated_by_idx on public.institution_onboarding_projects(activated_by_user_id) where activated_by_user_id is not null;
create index institution_onboarding_checks_checked_by_idx on public.institution_onboarding_checks(checked_by_user_id) where checked_by_user_id is not null;
create index institution_import_batches_created_by_idx on public.institution_import_batches(created_by_user_id) where created_by_user_id is not null;

alter table public.institution_onboarding_projects enable row level security;
alter table public.institution_onboarding_checks enable row level security;
alter table public.institution_import_batches enable row level security;
alter table public.institution_import_rows enable row level security;

revoke all on public.institution_onboarding_projects, public.institution_onboarding_checks,
  public.institution_import_batches, public.institution_import_rows from public, anon, authenticated;
grant select, insert, update on public.institution_onboarding_projects, public.institution_onboarding_checks,
  public.institution_import_batches, public.institution_import_rows to service_role;

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
  v_primary text;
  v_accent text;
  v_post_days integer;
  v_return_days integer;
  v_info_days integer;
  v_follow_days integer;
begin
  if p_operating_model not in ('development_finance','relationship_mfb','agent_network_mfb') then
    raise exception 'Unsupported operating model';
  end if;
  select name into v_name from public.institutions where id = p_institution_id and status = 'active';
  if v_name is null then raise exception 'Institution unavailable'; end if;
  v_short_name := case when length(v_name) <= 40 then v_name when p_operating_model = 'development_finance' then 'DFI' else 'MFB' end;
  if p_operating_model = 'development_finance' then
    v_agent_singular := 'BDSP'; v_agent_plural := 'BDSPs'; v_business_singular := 'Enterprise'; v_business_plural := 'Enterprises';
    v_primary := '#005B5C'; v_accent := '#D4A72C'; v_post_days := 180; v_return_days := 90; v_info_days := 30; v_follow_days := 7;
  elsif p_operating_model = 'agent_network_mfb' then
    v_agent_singular := 'Field Agent'; v_agent_plural := 'Field Agents'; v_business_singular := 'Microenterprise'; v_business_plural := 'Microenterprises';
    v_primary := '#7C3AED'; v_accent := '#10B981'; v_post_days := 60; v_return_days := 30; v_info_days := 7; v_follow_days := 2;
  else
    v_agent_singular := 'Relationship Officer'; v_agent_plural := 'Relationship Officers'; v_business_singular := 'Customer'; v_business_plural := 'Customers';
    v_primary := '#1D4ED8'; v_accent := '#F59E0B'; v_post_days := 90; v_return_days := 45; v_info_days := 14; v_follow_days := 3;
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
    case when p_operating_model = 'development_finance' then 'Enterprise diagnostic' else 'Business assessment' end,
    case when p_operating_model = 'development_finance' then 'Finance readiness' else 'Loan readiness' end,
    case when p_operating_model = 'development_finance' then 'Enterprise development support' else 'Portfolio support' end,
    v_follow_days, case when p_operating_model = 'agent_network_mfb' then 1 else 2 end,
    v_post_days, v_return_days, v_info_days, v_follow_days,
    case when p_operating_model = 'relationship_mfb' then array['csv']::text[] else array['csv','json']::text[] end,
    p_user_id, now()
  ) on conflict (institution_id) do nothing;

  insert into public.institution_onboarding_projects (institution_id, operating_model, updated_by_user_id)
  values (p_institution_id, p_operating_model, p_user_id)
  on conflict (institution_id) do update set operating_model = excluded.operating_model, updated_by_user_id = excluded.updated_by_user_id, updated_at = now();

  insert into public.institution_support_templates (institution_id, pathway, name, objective, target_days, follow_up_days, active, updated_by_user_id)
  values
    (p_institution_id,'post_finance','Post-finance support','Track business performance, agreed use of funds and emerging risks.',v_post_days,v_follow_days,true,p_user_id),
    (p_institution_id,'development_return','Development return','Resolve readiness gaps before the business returns for finance consideration.',v_return_days,v_follow_days,true,p_user_id),
    (p_institution_id,'continuing_support','Continuing business support','Maintain structured advisory support and evidenced business progress.',v_return_days,v_follow_days,true,p_user_id),
    (p_institution_id,'closed','Closed journey','Retain the completed support record for audit and reporting.',0,null,true,p_user_id)
  on conflict (institution_id, pathway) do nothing;

  insert into public.institution_onboarding_checks (institution_id, check_key, category, label, required)
  values
    (p_institution_id,'executive_owner_confirmed','governance','Executive and operational owners confirmed',true),
    (p_institution_id,'operating_rules_approved','configuration','Branding, terminology, thresholds and timelines approved',true),
    (p_institution_id,'administrators_active','people','Institution administrators can access the workspace',true),
    (p_institution_id,'agent_roster_validated','people','Agent or relationship-officer roster validated',true),
    (p_institution_id,'initial_data_reconciled','data','Initial imported records reconciled to the source',true),
    (p_institution_id,'journey_uat_passed','journey','End-to-end customer journey passed UAT',true),
    (p_institution_id,'tenant_isolation_passed','security','Cross-institution access and export isolation passed',true),
    (p_institution_id,'support_model_agreed','operations','Support, escalation and incident ownership agreed',true),
    (p_institution_id,'mobile_devices_checked','journey','Priority mobile devices and browsers checked',false),
    (p_institution_id,'training_completed','operations','Administrators and field teams completed training',false)
  on conflict (institution_id, check_key) do nothing;

  return public.institution_go_live_readiness(p_institution_id);
end;
$$;

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
      not exists(select 1 from public.institution_onboarding_checks c where c.institution_id = p_institution_id and c.required and c.status not in ('passed','not_applicable')) as checks_ready,
      (select count(*) from public.institution_onboarding_checks c where c.institution_id = p_institution_id and c.required) as required_checks,
      (select count(*) from public.institution_onboarding_checks c where c.institution_id = p_institution_id and c.required and c.status in ('passed','not_applicable')) as completed_checks
  ) select jsonb_build_object(
    'profileReady',profile_ready,'templatesReady',templates_ready,'administratorReady',administrator_ready,
    'agentReady',agent_ready,'importsReady',imports_ready,'checksReady',checks_ready,
    'requiredChecks',required_checks,'completedChecks',completed_checks,
    'canGoLive',profile_ready and templates_ready and administrator_ready and agent_ready and imports_ready and checks_ready
  ) from facts;
$$;

create or replace function public.institution_activate_onboarding(
  p_institution_id uuid,
  p_user_id uuid,
  p_signoff_note text
) returns jsonb
language plpgsql security invoker
set search_path = public
as $$
declare v_readiness jsonb;
begin
  if length(btrim(coalesce(p_signoff_note,''))) not between 10 and 4000 then raise exception 'A valid sign-off note is required'; end if;
  select public.institution_go_live_readiness(p_institution_id) into v_readiness;
  if not coalesce((v_readiness->>'canGoLive')::boolean,false) then raise exception 'Institution has not passed every go-live control'; end if;
  update public.institution_onboarding_projects set status='live',signoff_note=btrim(p_signoff_note),activated_at=now(),
    activated_by_user_id=p_user_id,updated_by_user_id=p_user_id,updated_at=now()
  where institution_id=p_institution_id and status<>'live';
  if not found then raise exception 'Onboarding project is unavailable or already live'; end if;
  return v_readiness;
end;
$$;

-- Functions use only service-role-visible relations and are not browser APIs.
revoke all on function public.institution_initialize_onboarding(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.institution_go_live_readiness(uuid) from public, anon, authenticated;
revoke all on function public.institution_activate_onboarding(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.institution_initialize_onboarding(uuid,text,uuid) to service_role;
grant execute on function public.institution_go_live_readiness(uuid) to service_role;
grant execute on function public.institution_activate_onboarding(uuid,uuid,text) to service_role;

create trigger set_institution_onboarding_projects_updated_at before update on public.institution_onboarding_projects
for each row execute function public.set_platform_foundation_updated_at();
create trigger set_institution_onboarding_checks_updated_at before update on public.institution_onboarding_checks
for each row execute function public.set_platform_foundation_updated_at();
