alter table if exists complaints
  add column if not exists provider_profile_id uuid references provider_profiles(id),
  add column if not exists complaint_category text,
  add column if not exists regulator_target text;

update complaints
set provider_profile_id = coalesce(provider_profile_id, provider_id)
where provider_id is not null;

update complaints
set complaint_category = coalesce(complaint_category, complaint_type, 'marketplace_report');

update complaints
set regulator_target = coalesce(
  regulator_target,
  case
    when coalesce(complaint_category, complaint_type, '') in ('service_quality', 'pricing_dispute', 'identity_concern', 'marketplace_report') then 'fccpc'
    else 'fccpc'
  end
);

create index if not exists idx_complaints_provider_profile_id on complaints(provider_profile_id);
create index if not exists idx_complaints_regulator_target on complaints(regulator_target);

update reviews r
set provider_reply = case
    when r.rating >= 5 then 'Thank you for choosing our verified team. We remain committed to reliable delivery and transparent service updates.'
    when r.rating = 4 then 'We appreciate this feedback and have already improved milestone updates and completion timelines.'
    else 'Thank you for your feedback. We have reviewed this concern and put corrective actions in place.'
  end,
  provider_reply_at = coalesce(r.provider_reply_at, now())
where r.provider_reply is null
  and exists (
    select 1
    from provider_profiles p
    where p.id = r.provider_id
  );

with provider_context as (
  select
    p.id as provider_id,
    p.msme_id,
    m.state,
    m.sector,
    m.business_name,
    row_number() over (order by p.created_at asc) as rn
  from provider_profiles p
  join msmes m on m.id = p.msme_id
)
insert into complaints (
  msme_id,
  provider_id,
  provider_profile_id,
  complaint_type,
  complaint_category,
  summary,
  description,
  severity,
  regulator_target,
  status,
  state,
  sector,
  reporter_name,
  reporter_email,
  source_channel
)
select
  pc.msme_id,
  pc.provider_id,
  pc.provider_id,
  'service_quality',
  'service_quality',
  'Public service complaint for ' || pc.business_name,
  'Public reporter submitted a service quality complaint and requested FCCPC review.',
  case when pc.rn % 2 = 0 then 'high' else 'medium' end,
  'fccpc',
  'open',
  pc.state,
  pc.sector,
  'NDMII Demo Reporter',
  'public-demo@ndmii.ng',
  'marketplace_sprint2_seed'
from provider_context pc
where pc.rn <= 4
  and not exists (
    select 1
    from complaints c
    where c.provider_profile_id = pc.provider_id
      and c.source_channel = 'marketplace_sprint2_seed'
  );
