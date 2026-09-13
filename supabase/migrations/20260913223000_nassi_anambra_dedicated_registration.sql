-- Dedicated DBIN onboarding channel for NASSI industrial clusters in Anambra State.
-- Registration records linked to this association are visible through the existing
-- association directory, membership queue and MSME administration surfaces.

insert into public.associations (
  name,
  slug,
  state,
  sector,
  status,
  category,
  location,
  lga_coverage,
  profile,
  description,
  updated_at
)
values (
  'National Association of Small Scale Industrialists (NASSI) – Anambra State',
  'nassi-anambra',
  'Anambra',
  'Multi-sector industrial clusters',
  'active',
  'Industry association',
  'Anambra',
  'Statewide',
  'NASSI Anambra State MSME and industrial cluster mobilisation.',
  'Dedicated association record for businesses registering through the NASSI Anambra cluster onboarding link.',
  now()
)
on conflict (slug) where slug is not null do update
set
  name = excluded.name,
  state = excluded.state,
  sector = excluded.sector,
  status = excluded.status,
  category = excluded.category,
  location = excluded.location,
  lga_coverage = excluded.lga_coverage,
  profile = excluded.profile,
  description = excluded.description,
  updated_at = excluded.updated_at;

