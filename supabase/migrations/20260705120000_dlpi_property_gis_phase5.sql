-- DLPI Property Platform Phase 5: GIS and boundary intelligence.
-- Additive GeoJSON-first geometry model. No PostGIS dependency is introduced.

create table if not exists public.property_geometries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  geometry_type text not null default 'point',
  geojson jsonb not null default '{}'::jsonb,
  centroid_latitude numeric(10,7),
  centroid_longitude numeric(10,7),
  bounding_box jsonb not null default '{}'::jsonb,
  area_value numeric(18,4),
  area_unit text,
  coordinate_system text not null default 'WGS84',
  survey_plan_number text,
  surveyor_name text,
  surveyor_registration_number text,
  captured_by uuid references public.users(id) on delete set null,
  captured_at timestamptz not null default now(),
  verification_status text not null default 'draft',
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  source text not null default 'manual',
  privacy_visibility text not null default 'registry_only',
  notes text,
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_geometries_geometry_type_check check (geometry_type in ('point', 'polygon', 'multipolygon', 'line')),
  constraint property_geometries_latitude_check check (centroid_latitude is null or centroid_latitude between -90 and 90),
  constraint property_geometries_longitude_check check (centroid_longitude is null or centroid_longitude between -180 and 180),
  constraint property_geometries_area_check check (area_value is null or area_value >= 0),
  constraint property_geometries_status_check check (verification_status in ('draft', 'submitted', 'verified', 'rejected', 'correction_requested', 'superseded')),
  constraint property_geometries_source_check check (source in ('manual', 'gps', 'survey_plan', 'imported', 'satellite_reference')),
  constraint property_geometries_privacy_check check (privacy_visibility in ('private', 'registry_only', 'public_generalized')),
  constraint property_geometries_geojson_check check (jsonb_typeof(geojson) = 'object'),
  constraint property_geometries_bbox_check check (jsonb_typeof(bounding_box) = 'object'),
  constraint property_geometries_survey_coordinate_system_check check (
    (nullif(trim(coalesce(survey_plan_number, '')), '') is null
      and nullif(trim(coalesce(surveyor_name, '')), '') is null
      and nullif(trim(coalesce(surveyor_registration_number, '')), '') is null)
    or nullif(trim(coordinate_system), '') is not null
  )
);

create unique index if not exists idx_property_geometries_active_property
  on public.property_geometries(property_id)
  where superseded_at is null and verification_status <> 'superseded';

create index if not exists idx_property_geometries_property_status
  on public.property_geometries(property_id, verification_status, updated_at desc);
create index if not exists idx_property_geometries_centroid
  on public.property_geometries(centroid_latitude, centroid_longitude)
  where centroid_latitude is not null and centroid_longitude is not null;
create index if not exists idx_property_geometries_public
  on public.property_geometries(privacy_visibility, verification_status)
  where privacy_visibility = 'public_generalized' and verification_status = 'verified';

create table if not exists public.property_geometry_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  geometry_id uuid references public.property_geometries(id) on delete set null,
  event_type text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint property_geometry_events_type_check check (event_type in (
    'geometry.created',
    'geometry.updated',
    'geometry.submitted',
    'geometry.verified',
    'geometry.rejected',
    'geometry.correction_requested',
    'geometry.superseded',
    'geometry.privacy_changed'
  ))
);

create index if not exists idx_property_geometry_events_property
  on public.property_geometry_events(property_id, created_at desc);
create index if not exists idx_property_geometry_events_geometry
  on public.property_geometry_events(geometry_id, created_at desc);

drop trigger if exists set_property_geometries_updated_at on public.property_geometries;
create trigger set_property_geometries_updated_at before update on public.property_geometries
  for each row execute function public.set_platform_foundation_updated_at();

alter table public.property_geometries enable row level security;
alter table public.property_geometry_events enable row level security;

drop policy if exists "Public can read generalized verified property geometry" on public.property_geometries;
create policy "Public can read generalized verified property geometry"
  on public.property_geometries for select
  using (
    privacy_visibility = 'public_generalized'
    and verification_status = 'verified'
    and exists (
      select 1
      from public.properties p
      where p.id = property_geometries.property_id
        and p.npin is not null
        and p.status in ('approved', 'verified', 'active')
    )
  );

drop policy if exists "Property registry operators can manage property geometry" on public.property_geometries;
create policy "Property registry operators can manage property geometry"
  on public.property_geometries for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_geometries.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_geometries.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Applicants can manage editable property geometry" on public.property_geometries;
create policy "Applicants can manage editable property geometry"
  on public.property_geometries for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_geometries.property_id
        and p.registered_by = public.property_current_app_user_id()
        and p.status in ('draft', 'submitted')
        and property_geometries.verification_status in ('draft', 'submitted', 'rejected', 'correction_requested')
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_geometries.property_id
        and p.registered_by = public.property_current_app_user_id()
        and p.status in ('draft', 'submitted')
    )
  );

drop policy if exists "Property registry operators can read geometry events" on public.property_geometry_events;
create policy "Property registry operators can read geometry events"
  on public.property_geometry_events for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_geometry_events.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Property registry operators can insert geometry events" on public.property_geometry_events;
create policy "Property registry operators can insert geometry events"
  on public.property_geometry_events for insert
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_geometry_events.property_id
        and public.property_can_manage_registry(p.state_id, p.lga_id, p.registry_institution_id)
    )
  );

drop policy if exists "Applicants can read own geometry events" on public.property_geometry_events;
create policy "Applicants can read own geometry events"
  on public.property_geometry_events for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_geometry_events.property_id
        and p.registered_by = public.property_current_app_user_id()
    )
  );
