-- Seeded demo authorization mappings for role-scoped access validation
with user_map as (
  select email, id
  from users
  where email in (
    'msme.demo@ndmii.ng',
    'assoc.lagos@ndmii.ng',
    'reviewer@ndmii.gov.ng',
    'officer@fccpc.gov.ng',
    'officer@firs.gov.ng',
    'admin@ndmii.gov.ng'
  )
)
update associations a
set officer_user_id = u.id
from user_map u
where u.email = 'assoc.lagos@ndmii.ng'
  and a.name = 'Lagos MSME Manufacturers Guild';

with msme_user as (
  select id from users where email = 'msme.demo@ndmii.ng' limit 1
), lagos_association as (
  select id from associations where name = 'Lagos MSME Manufacturers Guild' limit 1
)
update msmes m
set created_by = (select id from msme_user),
    association_id = coalesce(m.association_id, (select id from lagos_association))
where m.msme_id = 'NDMII-LAG-0003';

with lagos_association as (
  select id from associations where name = 'Lagos MSME Manufacturers Guild' limit 1
)
update msmes
set association_id = (select id from lagos_association)
where state = 'Lagos'
  and association_id is null;

update complaints
set assigned_officer_user_id = (select id from users where email = 'officer@fccpc.gov.ng' limit 1)
where assigned_officer_user_id is null;

update activity_logs
set actor_user_id = (select id from users where email = 'admin@ndmii.gov.ng' limit 1)
where actor_user_id is null
  and action in ('seed_import', 'role_bootstrap');
