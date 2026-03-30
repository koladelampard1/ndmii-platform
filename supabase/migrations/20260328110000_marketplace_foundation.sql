create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists provider_profiles (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references msmes(id) on delete cascade unique,
  display_name text not null,
  slug text not null unique,
  short_description text,
  long_description text,
  logo_url text,
  passport_url text,
  trust_score numeric(5,2) not null default 80,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists provider_categories (
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  category_id uuid not null references service_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider_id, category_id)
);

create table if not exists provider_specializations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  specialization text not null,
  created_at timestamptz not null default now()
);

create table if not exists provider_locations (
  provider_id uuid primary key references provider_profiles(id) on delete cascade,
  state text not null,
  lga text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists provider_gallery (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  asset_url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  review_title text not null,
  review_body text not null,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists review_metrics (
  provider_id uuid primary key references provider_profiles(id) on delete cascade,
  avg_rating numeric(4,2) not null default 0,
  review_count integer not null default 0,
  five_star_count integer not null default 0,
  four_star_count integer not null default 0,
  three_star_count integer not null default 0,
  two_star_count integer not null default 0,
  one_star_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_locations_state on provider_locations(state);
create index if not exists idx_reviews_provider_id on reviews(provider_id);
create index if not exists idx_review_metrics_avg_rating on review_metrics(avg_rating desc);

insert into service_categories (name, slug, description)
values
('Construction & Artisan', 'construction-artisan', 'Builders, electricians, plumbers, and local artisans.'),
('Fashion & Textiles', 'fashion-textiles', 'Tailors, fashion houses, and textile experts.'),
('Food Processing', 'food-processing', 'Packaged foods, agro-processing, and catering specialists.'),
('Professional Services', 'professional-services', 'Legal, accounting, logistics, and consulting providers.'),
('Creative & Media', 'creative-media', 'Design, media, branding, and digital storytelling services.'),
('Repairs & Maintenance', 'repairs-maintenance', 'Repair technicians, mechanics, and maintenance businesses.')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into provider_profiles (msme_id, display_name, slug, short_description, long_description, logo_url, passport_url, trust_score, is_featured)
select
  m.id,
  m.business_name,
  lower(regexp_replace(m.business_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || right(m.msme_id, 4),
  'Verified NDMII provider in ' || m.state || ' offering trusted ' || lower(m.sector) || ' services.',
  m.business_name || ' is a verified business in the NDMII marketplace with a validated identity profile and strong compliance records.',
  m.passport_photo_url,
  m.passport_photo_url,
  80 + (row_number() over(order by m.created_at) % 20),
  row_number() over(order by m.created_at) <= 8
from msmes m
where m.verification_status = 'verified'
on conflict (msme_id) do update set
  display_name = excluded.display_name,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  logo_url = coalesce(excluded.logo_url, provider_profiles.logo_url),
  passport_url = coalesce(excluded.passport_url, provider_profiles.passport_url),
  trust_score = excluded.trust_score,
  is_featured = excluded.is_featured,
  updated_at = now();

insert into provider_locations (provider_id, state, lga, address)
select p.id, m.state, coalesce(m.lga, 'Central ' || m.state), m.address
from provider_profiles p
join msmes m on m.id = p.msme_id
on conflict (provider_id) do update set
  state = excluded.state,
  lga = excluded.lga,
  address = excluded.address,
  updated_at = now();

insert into provider_specializations (provider_id, specialization)
select p.id,
  case m.sector
    when 'Manufacturing' then 'Custom fabrication and quality manufacturing'
    when 'Agro-processing' then 'Packaged food and agro value chain processing'
    when 'Retail' then 'Wholesale and neighborhood retail fulfillment'
    when 'Services' then 'Business services and enterprise operations support'
    when 'Creative' then 'Brand design, media production, and visual storytelling'
    else 'Specialized MSME business services'
  end
from provider_profiles p
join msmes m on m.id = p.msme_id
where not exists (
  select 1 from provider_specializations ps where ps.provider_id = p.id
);

insert into provider_categories (provider_id, category_id)
select p.id, c.id
from provider_profiles p
join msmes m on m.id = p.msme_id
join service_categories c on c.slug = case m.sector
  when 'Manufacturing' then 'construction-artisan'
  when 'Agro-processing' then 'food-processing'
  when 'Retail' then 'professional-services'
  when 'Services' then 'repairs-maintenance'
  when 'Creative' then 'creative-media'
  else 'professional-services'
end
on conflict (provider_id, category_id) do nothing;

insert into provider_gallery (provider_id, asset_url, caption, sort_order)
select p.id,
  coalesce(p.logo_url, 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80'),
  'Verified business storefront',
  1
from provider_profiles p
where not exists (select 1 from provider_gallery g where g.provider_id = p.id);

insert into reviews (provider_id, reviewer_name, rating, review_title, review_body, is_featured)
select p.id, v.reviewer_name, v.rating, v.review_title, v.review_body, v.is_featured
from provider_profiles p
cross join lateral (
  values
    ('Ngozi A.', 5, 'Reliable and professional', 'Completed our request on schedule with verified quality standards.', true),
    ('Musa K.', 4, 'Strong communication', 'Clear pricing, quick turnaround, and dependable delivery.', false),
    ('Aderonke T.', 5, 'Great quality output', 'Excellent workmanship and identity checks gave us confidence.', true)
) as v(reviewer_name, rating, review_title, review_body, is_featured)
where not exists (select 1 from reviews r where r.provider_id = p.id);

insert into review_metrics (provider_id, avg_rating, review_count, five_star_count, four_star_count, three_star_count, two_star_count, one_star_count, updated_at)
select
  r.provider_id,
  round(avg(r.rating)::numeric, 2),
  count(*)::int,
  count(*) filter (where r.rating = 5)::int,
  count(*) filter (where r.rating = 4)::int,
  count(*) filter (where r.rating = 3)::int,
  count(*) filter (where r.rating = 2)::int,
  count(*) filter (where r.rating = 1)::int,
  now()
from reviews r
group by r.provider_id
on conflict (provider_id) do update set
  avg_rating = excluded.avg_rating,
  review_count = excluded.review_count,
  five_star_count = excluded.five_star_count,
  four_star_count = excluded.four_star_count,
  three_star_count = excluded.three_star_count,
  two_star_count = excluded.two_star_count,
  one_star_count = excluded.one_star_count,
  updated_at = now();

create or replace view marketplace_provider_search as
select
  p.id as provider_id,
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
