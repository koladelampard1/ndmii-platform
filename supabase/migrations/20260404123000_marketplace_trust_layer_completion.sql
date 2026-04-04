-- Sprint 2 completion pass: ownership linkage, provider-manageable reviews, and FCCPC complaint queue realism.

-- 1) Strengthen MSME ownership linkage for demo and self-registered MSME users.
update msmes m
set created_by = u.id
from users u
where u.role = 'msme'
  and m.created_by is null
  and m.contact_email is not null
  and lower(m.contact_email) = lower(u.email);

-- Ensure the primary demo MSME account is linked to a provider-backed MSME context.
update msmes
set created_by = (
  select id from users where email = 'msme.demo@ndmii.ng' limit 1
)
where msme_id = 'NDMII-LAG-0001'
  and created_by is distinct from (
    select id from users where email = 'msme.demo@ndmii.ng' limit 1
  );

-- 2) Guarantee provider profiles exist for linked MSMEs that should manage reviews.
insert into provider_profiles (msme_id, display_name, slug, short_description, long_description, logo_url, passport_url, trust_score, is_featured)
select
  m.id,
  m.business_name,
  lower(regexp_replace(m.business_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || right(m.msme_id, 4),
  'Verified NDMII provider in ' || m.state || ' offering trusted ' || lower(m.sector) || ' services.',
  m.business_name || ' operates on the NDMII marketplace with traceable identity and regulator-facing trust telemetry.',
  m.passport_photo_url,
  m.passport_photo_url,
  82,
  false
from msmes m
where m.created_by is not null
  and not exists (select 1 from provider_profiles p where p.msme_id = m.id)
on conflict (msme_id) do nothing;

-- 3) Seed review records that are manageable by linked provider owners.
with target_providers as (
  select p.id as provider_id, p.display_name
  from provider_profiles p
  join msmes m on m.id = p.msme_id
  join users u on u.id = m.created_by
  where u.role = 'msme'
)
insert into reviews (provider_id, reviewer_name, rating, review_title, review_body, provider_reply, provider_reply_at, is_featured)
select
  tp.provider_id,
  seeded.reviewer_name,
  seeded.rating,
  seeded.review_title,
  seeded.review_body,
  seeded.provider_reply,
  seeded.provider_reply_at,
  seeded.is_featured
from target_providers tp
cross join lateral (
  values
    ('Amina O.', 5, 'Excellent delivery governance', 'The provider completed scope with clear milestones and transparent communication.', 'Thank you for the strong feedback. Our team will maintain the same delivery discipline.', now() - interval '4 days', true),
    ('Kunle R.', 4, 'Reliable service quality', 'Service output was solid and identity verification gave us confidence.', null, null, false)
) as seeded(reviewer_name, rating, review_title, review_body, provider_reply, provider_reply_at, is_featured)
where not exists (
  select 1
  from reviews r
  where r.provider_id = tp.provider_id
    and r.review_title = seeded.review_title
);

-- 4) Seed FCCPC-routed complaints for visibility in regulator/admin queues.
with target_providers as (
  select p.id as provider_id, p.msme_id, m.business_name, m.state, m.sector
  from provider_profiles p
  join msmes m on m.id = p.msme_id
  where m.created_by is not null
  order by m.created_at asc
  limit 6
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
  tp.msme_id,
  tp.provider_id,
  tp.provider_id,
  'marketplace_report',
  'service_quality',
  'Public complaint routed for ' || tp.business_name,
  'Reporter flagged delayed fulfilment and requested FCCPC review for consumer protection follow-up.',
  case when row_number() over (order by tp.provider_id) % 2 = 0 then 'high' else 'medium' end,
  'fccpc',
  'open',
  tp.state,
  tp.sector,
  'Public Queue Seeder',
  'public-queue@ndmii.ng',
  'marketplace_sprint2_completion_seed'
from target_providers tp
where not exists (
  select 1
  from complaints c
  where c.provider_profile_id = tp.provider_id
    and c.source_channel = 'marketplace_sprint2_completion_seed'
);
