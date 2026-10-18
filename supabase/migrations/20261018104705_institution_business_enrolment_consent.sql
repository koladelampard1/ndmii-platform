-- A bank may prepare an engagement, but only a verified business account can
-- authorize release of a fixed, minimal business identity summary.
alter table public.institution_engagements
  add column owner_user_id uuid references public.users(id) on delete restrict;
alter table public.institution_engagements
  add constraint institution_engagements_id_owner_key unique (id, owner_user_id);
create index institution_engagements_owner_idx
  on public.institution_engagements(owner_user_id, created_at desc);

create table public.institution_passport_consents (
  engagement_id uuid primary key,
  institution_id uuid not null,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'granted', 'revoked')),
  data_categories text[] not null default array['business_identity']::text[]
    check (data_categories = array['business_identity']::text[]),
  purpose text not null default 'Business development and financing preparation',
  notice_version text not null default '2026-10-v1',
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (engagement_id, institution_id)
    references public.institution_engagements(id, institution_id) on delete restrict,
  foreign key (engagement_id, owner_user_id)
    references public.institution_engagements(id, owner_user_id) on delete restrict
);
create index institution_passport_consents_owner_idx
  on public.institution_passport_consents(owner_user_id, status);
alter table public.institution_passport_consents enable row level security;
revoke all on public.institution_passport_consents from public, anon, authenticated;
grant select, insert, update on public.institution_passport_consents to service_role;

create function public.enrol_institution_business(
  p_institution_id uuid, p_owner_user_id uuid, p_actor_user_id uuid,
  p_public_id text, p_business_name text, p_owner_name text,
  p_state text, p_sector text, p_contact_email text
) returns table (business_id uuid, engagement_id uuid)
language plpgsql security invoker set search_path = public
as $$
declare v_business_id uuid; v_engagement_id uuid;
begin
  if not exists (select 1 from public.institutions where id = p_institution_id and status = 'active')
    or not exists (select 1 from public.users where id = p_owner_user_id and lower(email) = lower(p_contact_email) and auth_user_id is not null)
    or length(btrim(p_business_name)) not between 2 and 160
    or length(btrim(p_owner_name)) not between 2 and 160
    or length(btrim(p_state)) not between 2 and 80
    or length(btrim(p_sector)) not between 2 and 120 then
    raise exception 'Invalid enrolment input' using errcode = '22023';
  end if;
  -- Stop an agent from silently creating a second canonical identity for a
  -- business already linked to the same verified contact.
  if exists (select 1 from public.msmes where lower(contact_email) = lower(p_contact_email)
      and lower(btrim(business_name)) = lower(btrim(p_business_name))) then
    raise exception 'Business may already exist; owner must share the existing identity' using errcode = '23505';
  end if;
  insert into public.msmes(msme_id,business_name,owner_name,state,sector,contact_email,created_by,verification_status)
    values (p_public_id,btrim(p_business_name),btrim(p_owner_name),btrim(p_state),btrim(p_sector),lower(p_contact_email),p_actor_user_id,'pending_dbin_verification')
    returning id into v_business_id;
  insert into public.institution_engagements(institution_id,msme_id,owner_user_id,created_by_user_id)
    values (p_institution_id,v_business_id,p_owner_user_id,p_actor_user_id)
    returning id into v_engagement_id;
  insert into public.institution_passport_consents(engagement_id,institution_id,owner_user_id)
    values (v_engagement_id,p_institution_id,p_owner_user_id);
  insert into public.institution_engagement_events(institution_id,engagement_id,actor_user_id,event_type)
    values (p_institution_id,v_engagement_id,p_actor_user_id,'business_enrolled');
  return query select v_business_id,v_engagement_id;
end $$;
revoke all on function public.enrol_institution_business(uuid,uuid,uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.enrol_institution_business(uuid,uuid,uuid,text,text,text,text,text,text) to service_role;

create function public.request_institution_business(
  p_institution_id uuid, p_business_id uuid, p_owner_user_id uuid
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare v_engagement_id uuid;
begin
  if not exists (select 1 from public.institutions where id = p_institution_id and status = 'active')
    or not exists (select 1 from public.msmes where id = p_business_id and created_by = p_owner_user_id) then
    raise exception 'Business or institution unavailable' using errcode = 'P0002';
  end if;
  insert into public.institution_engagements(institution_id,msme_id,owner_user_id,created_by_user_id)
    values (p_institution_id,p_business_id,p_owner_user_id,p_owner_user_id)
    returning id into v_engagement_id;
  insert into public.institution_passport_consents(engagement_id,institution_id,owner_user_id)
    values (v_engagement_id,p_institution_id,p_owner_user_id);
  insert into public.institution_engagement_events(institution_id,engagement_id,actor_user_id,event_type)
    values (p_institution_id,v_engagement_id,p_owner_user_id,'business_relationship_requested');
  return v_engagement_id;
end $$;
revoke all on function public.request_institution_business(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.request_institution_business(uuid,uuid,uuid) to service_role;

create function public.decide_institution_passport_consent(
  p_engagement_id uuid, p_owner_user_id uuid, p_action text
) returns text
language plpgsql security invoker set search_path = public
as $$
declare v_engagement public.institution_engagements%rowtype; v_status text;
begin
  if p_action not in ('grant','revoke') then
    raise exception 'Invalid consent action' using errcode = '22023';
  end if;
  select * into v_engagement from public.institution_engagements
    where id = p_engagement_id and owner_user_id = p_owner_user_id for update;
  if not found or v_engagement.relationship_status = 'closed' then
    raise exception 'Engagement unavailable to this business owner' using errcode = 'P0002';
  end if;
  select status into v_status from public.institution_passport_consents
    where engagement_id = p_engagement_id and institution_id = v_engagement.institution_id
      and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Consent request unavailable' using errcode = 'P0002';
  end if;
  if (p_action = 'grant' and v_status = 'granted') or (p_action = 'revoke' and v_status <> 'granted') then
    raise exception 'Consent state has already changed' using errcode = '23505';
  end if;
  update public.institution_passport_consents set status = case when p_action = 'grant' then 'granted' else 'revoked' end,
    granted_at = case when p_action = 'grant' then now() else granted_at end,
    revoked_at = case when p_action = 'revoke' then now() else null end, updated_at = now()
    where engagement_id = p_engagement_id;
  update public.institution_engagements set passport_access_status = case when p_action = 'grant' then 'granted' else 'revoked' end,
    updated_at = now() where id = p_engagement_id;
  insert into public.institution_engagement_events(institution_id,engagement_id,actor_user_id,event_type,event_data)
    values (v_engagement.institution_id,p_engagement_id,p_owner_user_id,
      case when p_action = 'grant' then 'passport_access_granted' else 'passport_access_revoked' end,
      jsonb_build_object('dataCategories',array['business_identity'],'noticeVersion','2026-10-v1'));
  return case when p_action = 'grant' then 'granted' else 'revoked' end;
end $$;
revoke all on function public.decide_institution_passport_consent(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.decide_institution_passport_consent(uuid,uuid,text) to service_role;
