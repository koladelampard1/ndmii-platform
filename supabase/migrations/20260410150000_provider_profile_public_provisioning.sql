-- Ensure public marketplace MSMEs always have provider_profiles rows.

alter table provider_profiles
  add column if not exists public_slug text;

alter table provider_profiles
  add column if not exists business_name text;

alter table provider_profiles
  add column if not exists is_verified boolean not null default true;

alter table provider_profiles
  add column if not exists is_active boolean not null default true;

create unique index if not exists idx_provider_profiles_public_slug_unique
  on provider_profiles(public_slug)
  where public_slug is not null;

create or replace function build_provider_profile_slug(input_business_name text, input_msme_public_id text)
returns text
language sql
immutable
as $$
  select concat_ws(
    '-',
    nullif(regexp_replace(lower(coalesce(input_business_name, 'provider')), '[^a-z0-9]+', '-', 'g'), ''),
    nullif(regexp_replace(lower(coalesce(input_msme_public_id, 'provider')), '[^a-z0-9]+', '-', 'g'), '')
  );
$$;

create or replace function ensure_provider_profile_for_public_msme(target_msme_id uuid)
returns uuid
language plpgsql
as $$
declare
  msme_row msmes%rowtype;
  stable_slug text;
  resolved_provider_id uuid;
begin
  select *
  into msme_row
  from msmes
  where id = target_msme_id
    and verification_status in ('verified', 'approved')
  limit 1;

  if msme_row.id is null then
    return null;
  end if;

  stable_slug := build_provider_profile_slug(msme_row.business_name, msme_row.msme_id);

  insert into provider_profiles (
    msme_id,
    display_name,
    business_name,
    slug,
    public_slug,
    short_description,
    long_description,
    logo_url,
    passport_url,
    is_verified,
    is_active,
    updated_at
  )
  values (
    msme_row.id,
    msme_row.business_name,
    msme_row.business_name,
    stable_slug,
    stable_slug,
    'Verified NDMII provider in ' || msme_row.state || ' delivering trusted ' || lower(msme_row.sector) || ' services.',
    msme_row.business_name || ' is a verified business in the NDMII marketplace with a validated identity profile and strong compliance records.',
    msme_row.passport_photo_url,
    msme_row.passport_photo_url,
    true,
    true,
    now()
  )
  on conflict (msme_id) do update set
    display_name = coalesce(nullif(provider_profiles.display_name, ''), excluded.display_name),
    business_name = coalesce(nullif(provider_profiles.business_name, ''), excluded.business_name),
    slug = coalesce(nullif(provider_profiles.slug, ''), excluded.slug),
    public_slug = coalesce(nullif(provider_profiles.public_slug, ''), excluded.public_slug),
    short_description = coalesce(provider_profiles.short_description, excluded.short_description),
    long_description = coalesce(provider_profiles.long_description, excluded.long_description),
    logo_url = coalesce(provider_profiles.logo_url, excluded.logo_url),
    passport_url = coalesce(provider_profiles.passport_url, excluded.passport_url),
    is_verified = coalesce(provider_profiles.is_verified, true),
    is_active = coalesce(provider_profiles.is_active, true),
    updated_at = now()
  returning id into resolved_provider_id;

  return resolved_provider_id;
end;
$$;

create or replace function sync_provider_profile_on_msme_public_approval()
returns trigger
language plpgsql
as $$
begin
  if new.verification_status in ('verified', 'approved') then
    perform ensure_provider_profile_for_public_msme(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_provider_profile_on_msme_public_approval on msmes;

create trigger trg_sync_provider_profile_on_msme_public_approval
after insert or update of verification_status, business_name, msme_id, state, sector, passport_photo_url on msmes
for each row
execute function sync_provider_profile_on_msme_public_approval();

-- Backfill currently public marketplace MSMEs with missing provider_profiles rows and missing slugs.
select ensure_provider_profile_for_public_msme(m.id)
from msmes m
where m.verification_status in ('verified', 'approved');
