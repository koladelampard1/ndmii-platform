-- Staging-only integration check after the migration is applied. Changes roll back.
begin;

do $$
declare
  bank_a uuid;
  bank_b uuid;
  business_id uuid;
  engagement_a uuid;
  engagement_b uuid;
  test_user uuid;
  test_suffix text := replace(gen_random_uuid()::text, '-', '');
begin
  insert into public.users(email, full_name, role)
  values ('institution-test-' || test_suffix || '@example.invalid', 'Institution test', 'workspace_user')
  returning id into test_user;

  insert into public.msmes(msme_id, business_name, owner_name, state, sector, created_by)
  values ('TEST-' || test_suffix, 'Isolation test business', 'Test owner', 'Lagos', 'Retail', test_user)
  returning id into business_id;

  insert into public.institutions(name, slug, institution_type)
  values ('Test Bank A', 'test-bank-a-' || test_suffix, 'microfinance_bank') returning id into bank_a;
  insert into public.institutions(name, slug, institution_type)
  values ('Test Bank B', 'test-bank-b-' || test_suffix, 'microfinance_bank') returning id into bank_b;

  insert into public.institution_members(institution_id, user_id, role, status)
  values (bank_a, test_user, 'institution_officer', 'active');

  insert into public.institution_engagements(institution_id, msme_id, created_by_user_id)
  values (bank_a, business_id, test_user) returning id into engagement_a;
  insert into public.institution_engagements(institution_id, msme_id, created_by_user_id)
  values (bank_b, business_id, test_user) returning id into engagement_b;

  if engagement_a = engagement_b or
     (select count(*) from public.institution_engagements where msme_id = business_id) <> 2 or
     (select count(*) from public.institution_engagements where institution_id = bank_a and msme_id = business_id) <> 1 then
    raise exception 'Institution engagement isolation failed';
  end if;

  if has_table_privilege('anon', 'public.institution_engagements', 'SELECT') or
     has_table_privilege('authenticated', 'public.institution_engagements', 'SELECT') or
     has_table_privilege('authenticated', 'public.institution_engagements', 'INSERT') then
    raise exception 'Client role has direct engagement table access';
  end if;

  begin
    insert into public.institution_engagement_events(institution_id, engagement_id, event_type)
    values (bank_b, engagement_a, 'invalid_cross_bank_event');
    raise exception 'Cross-bank event unexpectedly accepted';
  exception when foreign_key_violation then
    null; -- The composite foreign key rejected a false institution claim.
  end;
end $$;

rollback;
