alter table if exists associations
  add column if not exists slug text,
  add column if not exists description text;

alter table if exists associations
  alter column state drop not null,
  alter column sector drop not null,
  alter column status set default 'active';

update associations
set status = lower(coalesce(status, 'active'))
where status is null or status <> lower(status);

with normalized as (
  select
    id,
    coalesce(nullif(lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')), ''), 'association') as base_slug
  from associations
  where slug is null or trim(slug) = ''
),
numbered as (
  select
    id,
    base_slug,
    row_number() over (partition by base_slug order by id) as duplicate_index
  from normalized
)
update associations a
set slug = case
  when numbered.duplicate_index = 1 then numbered.base_slug
  else numbered.base_slug || '-' || numbered.duplicate_index::text
end
from numbered
where a.id = numbered.id;

update associations
set description = coalesce(description, profile)
where description is null and profile is not null;

create unique index if not exists idx_associations_slug_unique
  on associations(slug)
  where slug is not null;
