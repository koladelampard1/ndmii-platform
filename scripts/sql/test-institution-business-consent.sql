-- Run after the Sprint 3 migration. All records roll back.
begin;
do $$
declare
  suffix text := replace(gen_random_uuid()::text, '-', '');
  owner_id uuid; agent_id uuid; bank_a uuid; bank_b uuid; business_id uuid;
  engagement_a uuid; engagement_b uuid; new_business uuid; new_engagement uuid;
begin
  insert into public.users(email,full_name,role,auth_user_id)
    values ('s3-owner-' || suffix || '@example.invalid','Test owner','msme',gen_random_uuid()) returning id into owner_id;
  insert into public.users(email,full_name,role)
    values ('s3-agent-' || suffix || '@example.invalid','Test agent','workspace_user') returning id into agent_id;
  insert into public.institutions(name,slug,institution_type)
    values ('S3 Bank A','s3-bank-a-' || suffix,'microfinance_bank') returning id into bank_a;
  insert into public.institutions(name,slug,institution_type)
    values ('S3 Bank B','s3-bank-b-' || suffix,'microfinance_bank') returning id into bank_b;
  insert into public.msmes(msme_id,business_name,owner_name,state,sector,created_by,contact_email)
    values ('S3-' || suffix,'Owned business','Test owner','Lagos','Retail',owner_id,
      's3-owner-' || suffix || '@example.invalid') returning id into business_id;
  engagement_a := public.request_institution_business(bank_a,business_id,owner_id);
  engagement_b := public.request_institution_business(bank_b,business_id,owner_id);
  if engagement_a = engagement_b then raise exception 'Banks share an engagement'; end if;
  begin
    update public.institution_passport_consents set institution_id = bank_a where engagement_id = engagement_b;
    raise exception 'Cross-bank consent was accepted';
  exception when foreign_key_violation then null;
  end;
  if public.decide_institution_passport_consent(engagement_a,owner_id,'grant') <> 'granted' then
    raise exception 'Grant failed'; end if;
  if (select status from public.institution_passport_consents where engagement_id = engagement_b) <> 'pending'
    or (select passport_access_status from public.institution_engagements where id = engagement_b) <> 'pending' then
    raise exception 'Consent crossed bank boundary'; end if;
  begin
    perform public.decide_institution_passport_consent(engagement_b,agent_id,'grant');
    raise exception 'Wrong owner granted access';
  exception when no_data_found then null;
  end;
  if public.decide_institution_passport_consent(engagement_a,owner_id,'revoke') <> 'revoked' then
    raise exception 'Revocation failed'; end if;
  if (select status from public.institution_passport_consents where engagement_id = engagement_a) <> 'revoked'
    or (select passport_access_status from public.institution_engagements where id = engagement_a) <> 'revoked' then
    raise exception 'Revocation status mismatch'; end if;
  select e.business_id,e.engagement_id into new_business,new_engagement
    from public.enrol_institution_business(bank_a,owner_id,agent_id,'S3-NEW-' || suffix,
      'Another business','Test owner','Lagos','Trade','s3-owner-' || suffix || '@example.invalid') e;
  if new_business is null or new_engagement is null then raise exception 'Atomic enrolment failed'; end if;
  begin
    perform public.enrol_institution_business(bank_b,owner_id,agent_id,'S3-DUP-' || suffix,
      'Another business','Test owner','Lagos','Trade','s3-owner-' || suffix || '@example.invalid');
    raise exception 'Duplicate canonical identity was accepted';
  exception when unique_violation then null;
  end;
  if has_table_privilege('authenticated','public.institution_passport_consents','SELECT')
    or has_function_privilege('authenticated','public.decide_institution_passport_consent(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.enrol_institution_business(uuid,uuid,uuid,text,text,text,text,text,text)','EXECUTE') then
    raise exception 'Client can bypass private consent API'; end if;
end $$;
rollback;
