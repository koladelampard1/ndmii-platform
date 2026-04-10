-- Canonicalize provider profile routing to public_slug and safely deduplicate provider_profiles per MSME.

-- 1) Ensure every provider profile has a usable public_slug.
update provider_profiles p
set public_slug = coalesce(nullif(p.public_slug, ''), nullif(p.slug, ''), build_provider_profile_slug(coalesce(m.business_name, p.display_name, 'provider'), m.msme_id))
from msmes m
where m.id = p.msme_id
  and (p.public_slug is null or btrim(p.public_slug) = '');

-- 2) Rank duplicates and pick a canonical row per msme_id.
create temporary table tmp_provider_profile_dedupe as
with ranked as (
  select
    p.id,
    p.msme_id,
    p.public_slug,
    p.slug,
    row_number() over (
      partition by p.msme_id
      order by
        case
          when p.public_slug is null then 0
          when p.public_slug like 'msme-%' then 1
          else 3
        end desc,
        length(coalesce(p.public_slug, '')) desc,
        p.updated_at desc,
        p.created_at desc,
        p.id asc
    ) as rn
  from provider_profiles p
)
select
  ranked.msme_id,
  ranked.id as canonical_id,
  ranked.public_slug as canonical_public_slug
from ranked
where ranked.rn = 1;

create temporary table tmp_provider_profile_duplicates as
select
  p.msme_id,
  p.id as duplicate_id,
  c.canonical_id,
  c.canonical_public_slug
from provider_profiles p
join tmp_provider_profile_dedupe c on c.msme_id = p.msme_id
where p.id <> c.canonical_id;

-- 3) Re-point dependent records from duplicate provider IDs to canonical IDs.
update provider_categories pc
set provider_id = d.canonical_id
from tmp_provider_profile_duplicates d
where pc.provider_id = d.duplicate_id
  and not exists (
    select 1 from provider_categories existing
    where existing.provider_id = d.canonical_id
      and existing.category_id = pc.category_id
  );

delete from provider_categories pc
using tmp_provider_profile_duplicates d
where pc.provider_id = d.duplicate_id;

update provider_specializations ps
set provider_id = d.canonical_id
from tmp_provider_profile_duplicates d
where ps.provider_id = d.duplicate_id;

update provider_locations pl
set provider_id = d.canonical_id
from tmp_provider_profile_duplicates d
where pl.provider_id = d.duplicate_id;

update provider_gallery pg
set provider_id = d.canonical_id
from tmp_provider_profile_duplicates d
where pg.provider_id = d.duplicate_id;

update reviews r
set provider_id = d.canonical_id
from tmp_provider_profile_duplicates d
where r.provider_id = d.duplicate_id;

update review_metrics rm
set provider_id = d.canonical_id
from tmp_provider_profile_duplicates d
where rm.provider_id = d.duplicate_id;

update provider_replies pr
set provider_id = d.canonical_id
from tmp_provider_profile_duplicates d
where pr.provider_id = d.duplicate_id;

update provider_quote_replies pqr
set provider_id = d.canonical_id
from tmp_provider_profile_duplicates d
where pqr.provider_id = d.duplicate_id;

update provider_quotes pq
set provider_profile_id = d.canonical_id
from tmp_provider_profile_duplicates d
where pq.provider_profile_id = d.duplicate_id;

update invoices i
set provider_profile_id = d.canonical_id
from tmp_provider_profile_duplicates d
where i.provider_profile_id = d.duplicate_id;

update complaints c
set provider_profile_id = d.canonical_id
from tmp_provider_profile_duplicates d
where c.provider_profile_id = d.duplicate_id;

update complaints c
set provider_id = d.canonical_id
from tmp_provider_profile_duplicates d
where c.provider_id = d.duplicate_id;

-- 4) Remove duplicate provider profile rows now that references are migrated.
delete from provider_profiles p
using tmp_provider_profile_duplicates d
where p.id = d.duplicate_id;

-- 5) Enforce one provider profile per MSME for future writes.
create unique index if not exists idx_provider_profiles_msme_id_unique
  on provider_profiles(msme_id);

-- 6) Ensure marketplace search view exposes public_slug for canonical linking.
create or replace view marketplace_provider_search as
select
  p.id as provider_id,
  p.public_slug,
  p.msme_id as msme_row_id,
  m.msme_id,
  d.ndmii_id,
  m.business_name,
  m.owner_name,
  m.passport_photo_url,
  m.verification_status,
  m.review_status,
  m.state,
  m.lga,
  m.address,
  m.sector,
  p.short_description,
  p.long_description,
  p.logo_url,
  p.passport_url,
  p.trust_score,
  p.is_featured,
  c.name as category_name,
  ps.specialization,
  rm.avg_rating,
  rm.review_count,
  lower(concat_ws(' ', m.business_name, m.msme_id, coalesce(d.ndmii_id, ''), c.name, ps.specialization, m.state, m.lga)) as search_text
from provider_profiles p
join msmes m on m.id = p.msme_id
left join digital_ids d on d.msme_id = m.id
left join provider_categories pc on pc.provider_id = p.id
left join service_categories c on c.id = pc.category_id
left join lateral (
  select specialization
  from provider_specializations ps
  where ps.provider_id = p.id
  order by ps.created_at asc
  limit 1
) ps on true
left join review_metrics rm on rm.provider_id = p.id;
