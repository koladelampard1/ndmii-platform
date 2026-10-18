-- Run after migration. All fixture records roll back.
begin;
do $$
declare
  suffix text := replace(gen_random_uuid()::text, '-', '');
  bank_a uuid;
  bank_b uuid;
  staff_id uuid;
  agent_id uuid;
  business_id uuid;
  member_a uuid;
  member_b uuid;
  bdsp_a uuid;
  engagement_a uuid;
  engagement_b uuid;
begin
  insert into public.users(email, full_name, role)
  values ('sprint2-staff-' || suffix || '@example.invalid', 'Test staff', 'workspace_user')
  returning id into staff_id;
  insert into public.users(email, full_name, role)
  values ('sprint2-agent-' || suffix || '@example.invalid', 'Test agent', 'workspace_user')
  returning id into agent_id;
  insert into public.msmes(msme_id, business_name, owner_name, state, sector, created_by)
  values ('S2-' || suffix, 'Sprint 2 business', 'Owner', 'Lagos', 'Retail', staff_id)
  returning id into business_id;
  insert into public.institutions(name, slug, institution_type)
  values ('Sprint 2 Bank A', 'sprint2-bank-a-' || suffix, 'microfinance_bank')
  returning id into bank_a;
  insert into public.institutions(name, slug, institution_type)
  values ('Sprint 2 Bank B', 'sprint2-bank-b-' || suffix, 'microfinance_bank')
  returning id into bank_b;

  insert into public.institution_members(institution_id, user_id, role, status)
  values (bank_a, agent_id, 'institution_agent', 'active')
  returning id into member_a;
  insert into public.institution_members(institution_id, user_id, role, status)
  values (bank_b, agent_id, 'institution_agent', 'active')
  returning id into member_b;
  insert into public.institution_bdsp_organisations(institution_id, name, service_states)
  values (bank_a, 'BDSP A', array['Lagos']) returning id into bdsp_a;
  insert into public.institution_agent_profiles(institution_id, member_id, bdsp_organisation_id, service_states)
  values (bank_a, member_a, bdsp_a, array['Lagos']);
  insert into public.institution_agent_profiles(institution_id, member_id, service_states)
  values (bank_b, member_b, array['Lagos']);

  insert into public.institution_engagements(institution_id, msme_id)
  values (bank_a, business_id) returning id into engagement_a;
  insert into public.institution_engagements(institution_id, msme_id)
  values (bank_b, business_id) returning id into engagement_b;
  insert into public.institution_business_assignments(institution_id, engagement_id, agent_member_id)
  values (bank_a, engagement_a, member_a);
  insert into public.institution_business_assignments(institution_id, engagement_id, agent_member_id)
  values (bank_b, engagement_b, member_b);

  if (select count(*) from public.institution_business_assignments where institution_id = bank_a) <> 1
    or (select count(*) from public.institution_business_assignments where institution_id = bank_b) <> 1
    or member_a = member_b then
    raise exception 'Separate institution queues failed';
  end if;

  begin
    update public.institution_agent_profiles
    set bdsp_organisation_id = bdsp_a where member_id = member_b;
    raise exception 'Foreign BDSP was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.institution_business_assignments(institution_id, engagement_id, agent_member_id)
    values (bank_a, engagement_b, member_a);
    raise exception 'Foreign engagement was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.institution_business_assignments(institution_id, engagement_id, agent_member_id)
    values (bank_b, engagement_a, member_b);
    raise exception 'Foreign engagement was accepted';
  exception when foreign_key_violation then null;
  end;
  if has_table_privilege('anon', 'public.institution_business_assignments', 'SELECT')
    or has_table_privilege('authenticated', 'public.institution_agent_profiles', 'SELECT')
    or has_table_privilege('authenticated', 'public.institution_bdsp_organisations', 'INSERT') then
    raise exception 'Client role has direct Sprint 2 table access';
  end if;
  update public.institution_members set status = 'revoked' where id = member_a;
  if (select status from public.institution_members where id = member_a) <> 'revoked'
    or (select status from public.institution_members where id = member_b) <> 'active' then
    raise exception 'Revocation crossed institution boundaries';
  end if;
end $$;
rollback;
