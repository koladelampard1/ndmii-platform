-- Associations Phase 4C hotfix: durable draft workspace linkage after temporary PIN setup.
-- These fields support idempotent matching only. No verification or credential state is changed.

alter table if exists public.users
  add column if not exists phone text;

alter table if exists public.msmes
  add column if not exists contact_phone_normalized text,
  add column if not exists source text,
  add column if not exists source_association_member_id uuid;

create index if not exists idx_users_phone
  on public.users(phone);
create index if not exists idx_msmes_contact_phone_normalized
  on public.msmes(contact_phone_normalized);
create index if not exists idx_msmes_source_association_member
  on public.msmes(source_association_member_id);

create or replace function public.normalize_ng_phone(value text)
returns text
language sql
immutable
as $$
  select case
    when digits = '' then null
    when length(digits) = 11 and digits like '0%' then '+234' || substring(digits from 2)
    when length(digits) = 13 and digits like '234%' then '+' || digits
    when length(digits) = 10 then '+234' || digits
    when length(digits) >= 7 then '+' || digits
    else null
  end
  from (select regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g') as digits) normalized;
$$;

update public.msmes
set contact_phone_normalized = public.normalize_ng_phone(contact_phone)
where contact_phone_normalized is null
  and contact_phone is not null;

create or replace function public.sync_msme_contact_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.contact_phone_normalized := public.normalize_ng_phone(new.contact_phone);
  return new;
end;
$$;

drop trigger if exists trg_sync_msme_contact_phone_normalized on public.msmes;
create trigger trg_sync_msme_contact_phone_normalized
before insert or update of contact_phone on public.msmes
for each row
execute function public.sync_msme_contact_phone_normalized();
