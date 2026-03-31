alter table if exists reviews
  add column if not exists provider_reply text,
  add column if not exists provider_reply_at timestamptz,
  add column if not exists provider_reply_by uuid references users(id);

alter table if exists complaints
  add column if not exists provider_id uuid references provider_profiles(id),
  add column if not exists reporter_name text,
  add column if not exists reporter_email text,
  add column if not exists source_channel text default 'marketplace_public_profile';

create index if not exists idx_complaints_provider_id on complaints(provider_id);

update reviews r
set provider_reply = case
    when r.rating >= 5 then 'Thank you for trusting our verified team. We appreciate your partnership and look forward to serving your next request.'
    when r.rating = 4 then 'Thanks for the thoughtful feedback. We are improving delivery speed and communication on every engagement.'
    else 'Thank you for your feedback. Our team has reviewed your concerns and implemented corrective steps.'
  end,
  provider_reply_at = now()
where r.provider_reply is null;

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
  complaint_type,
  summary,
  description,
  severity,
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
  'service_quality',
  'Delivery follow-up needed for ' || pc.business_name,
  'Customer reported delayed completion and requested regulator follow-up for documentation review.',
  case when pc.rn % 3 = 0 then 'high' else 'medium' end,
  'open',
  pc.state,
  pc.sector,
  'Marketplace User',
  'public-demo@ndmii.ng',
  'marketplace_seed'
from provider_context pc
where pc.rn <= 6
  and not exists (
    select 1
    from complaints c
    where c.provider_id = pc.provider_id
      and c.source_channel = 'marketplace_seed'
  );
