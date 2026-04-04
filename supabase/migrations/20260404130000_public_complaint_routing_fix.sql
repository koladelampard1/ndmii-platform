alter table if exists complaints
  add column if not exists provider_business_name text;

update complaints c
set provider_business_name = coalesce(
  c.provider_business_name,
  m.business_name,
  p.display_name,
  'Unknown business'
)
from provider_profiles p
left join msmes m on m.id = p.msme_id
where c.provider_profile_id = p.id
  and c.provider_business_name is null;
