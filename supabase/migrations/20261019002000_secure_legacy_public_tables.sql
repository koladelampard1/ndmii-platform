-- Replace unrestricted legacy Data API access with explicit row ownership and
-- role policies. Service-role server workflows continue to bypass RLS.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select u.id
  from public.users u
  where auth.uid() is not null
    and (u.auth_user_id = auth.uid() or lower(u.email) = lower(auth.email()))
  order by case when u.auth_user_id = auth.uid() then 0 else 1 end
  limit 1
$$;

create or replace function app_private.current_app_user_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select u.role
  from public.users u
  where u.id = app_private.current_app_user_id()
  limit 1
$$;

create or replace function app_private.has_any_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and coalesce(app_private.current_app_user_role() = any(allowed_roles), false)
$$;

create or replace function app_private.owns_msme(target_msme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.msmes m
    where m.id = target_msme_id
      and m.created_by = app_private.current_app_user_id()
  )
$$;

create or replace function app_private.owns_provider(target_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.provider_profiles p
    join public.msmes m on m.id::text = p.msme_id or m.msme_id = p.msme_id
    where p.id = target_provider_id
      and m.created_by = app_private.current_app_user_id()
  )
$$;

create or replace function app_private.owns_association(target_association_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.associations a
    where a.id = target_association_id
      and a.officer_user_id = app_private.current_app_user_id()
  )
$$;

create or replace function app_private.owns_manufacturer(target_manufacturer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.manufacturer_profiles mp
    where mp.id = target_manufacturer_id
      and app_private.owns_msme(mp.msme_id)
  )
$$;

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated, service_role;

alter default privileges in schema app_private revoke execute on functions from public, anon;

alter table public.users enable row level security;
alter table public.associations enable row level security;
alter table public.payments enable row level security;
alter table public.compliance_profiles enable row level security;
alter table public.manufacturer_profiles enable row level security;
alter table public.activity_logs enable row level security;
alter table public.tax_profiles enable row level security;
alter table public.manufacturer_products enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_services enable row level security;
alter table public.provider_gallery enable row level security;
alter table public.quote_requests enable row level security;

revoke all on public.users, public.associations, public.payments,
  public.compliance_profiles, public.manufacturer_profiles, public.activity_logs,
  public.tax_profiles, public.manufacturer_products, public.provider_profiles,
  public.provider_services, public.provider_gallery, public.quote_requests
from anon, authenticated;

grant select on public.associations, public.manufacturer_profiles,
  public.manufacturer_products, public.provider_profiles, public.provider_services,
  public.provider_gallery to anon;
grant insert on public.quote_requests to anon;

grant select, insert, update on public.users, public.associations, public.payments,
  public.compliance_profiles, public.manufacturer_profiles, public.tax_profiles,
  public.manufacturer_products, public.quote_requests to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant select, insert, update, delete on public.provider_profiles,
  public.provider_services, public.provider_gallery to authenticated;

create policy users_read_authorized on public.users
for select to authenticated
using (
  id = app_private.current_app_user_id()
  or app_private.has_any_role(array[
    'admin','super_admin','reviewer','boi_executive','programme_officer',
    'assessment_officer','field_officer','data_analyst','auditor',
    'association_officer','fccpc_officer','nrs_officer','firs_officer'
  ])
);

create policy users_create_self on public.users
for insert to authenticated
with check (
  auth_user_id = auth.uid()
  and role in ('public','msme')
  and lower(email) = lower(auth.email())
);

create policy users_update_self on public.users
for update to authenticated
using (id = app_private.current_app_user_id())
with check (
  auth_user_id = auth.uid()
  and lower(email) = lower(auth.email())
  and role = app_private.current_app_user_role()
);

create policy associations_public_read on public.associations
for select to anon, authenticated using (true);

create policy associations_create_authorized on public.associations
for insert to authenticated
with check (
  app_private.has_any_role(array['admin','super_admin'])
  or (
    app_private.current_app_user_role() = 'association_officer'
    and officer_user_id = app_private.current_app_user_id()
  )
);

create policy associations_update_authorized on public.associations
for update to authenticated
using (
  app_private.has_any_role(array['admin','super_admin'])
  or officer_user_id = app_private.current_app_user_id()
)
with check (
  app_private.has_any_role(array['admin','super_admin'])
  or officer_user_id = app_private.current_app_user_id()
);

create policy payments_read_authorized on public.payments
for select to authenticated
using (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','nrs_officer','firs_officer','data_analyst','auditor'])
);

create policy payments_create_authorized on public.payments
for insert to authenticated
with check (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','nrs_officer','firs_officer'])
);

create policy payments_update_authorized on public.payments
for update to authenticated
using (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','nrs_officer','firs_officer'])
)
with check (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','nrs_officer','firs_officer'])
);

create policy compliance_profiles_read_authorized on public.compliance_profiles
for select to authenticated
using (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer','nrs_officer','firs_officer','data_analyst','auditor'])
);

create policy compliance_profiles_create_authorized on public.compliance_profiles
for insert to authenticated
with check (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
);

create policy compliance_profiles_update_authorized on public.compliance_profiles
for update to authenticated
using (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
)
with check (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
);

create policy manufacturer_profiles_public_read on public.manufacturer_profiles
for select to anon, authenticated using (true);

create policy manufacturer_profiles_create_authorized on public.manufacturer_profiles
for insert to authenticated
with check (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
);

create policy manufacturer_profiles_update_authorized on public.manufacturer_profiles
for update to authenticated
using (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
)
with check (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
);

create policy manufacturer_products_public_read on public.manufacturer_products
for select to anon, authenticated using (true);

create policy manufacturer_products_create_authorized on public.manufacturer_products
for insert to authenticated
with check (
  app_private.owns_manufacturer(manufacturer_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
);

create policy manufacturer_products_update_authorized on public.manufacturer_products
for update to authenticated
using (
  app_private.owns_manufacturer(manufacturer_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
)
with check (
  app_private.owns_manufacturer(manufacturer_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
);

create policy activity_logs_read_authorized on public.activity_logs
for select to authenticated
using (
  actor_user_id = app_private.current_app_user_id()
  or app_private.has_any_role(array['admin','super_admin','reviewer','programme_officer','data_analyst','auditor','fccpc_officer','nrs_officer','firs_officer'])
);

create policy activity_logs_create_authorized on public.activity_logs
for insert to authenticated
with check (
  actor_user_id = app_private.current_app_user_id()
  or (actor_user_id is null and auth.uid() is not null)
  or app_private.has_any_role(array['admin','super_admin'])
);

create policy tax_profiles_read_authorized on public.tax_profiles
for select to authenticated
using (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','nrs_officer','firs_officer','data_analyst','auditor'])
);

create policy tax_profiles_create_authorized on public.tax_profiles
for insert to authenticated
with check (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','nrs_officer','firs_officer'])
);

create policy tax_profiles_update_authorized on public.tax_profiles
for update to authenticated
using (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','nrs_officer','firs_officer'])
)
with check (
  app_private.owns_msme(msme_id)
  or app_private.has_any_role(array['admin','super_admin','nrs_officer','firs_officer'])
);

create policy provider_profiles_public_read on public.provider_profiles
for select to anon, authenticated using (true);

create policy provider_profiles_create_authorized on public.provider_profiles
for insert to authenticated
with check (
  exists (
    select 1 from public.msmes m
    where (m.id::text = provider_profiles.msme_id or m.msme_id = provider_profiles.msme_id)
      and m.created_by = app_private.current_app_user_id()
  )
  or app_private.has_any_role(array['admin','super_admin','reviewer'])
);

create policy provider_profiles_update_authorized on public.provider_profiles
for update to authenticated
using (
  app_private.owns_provider(id)
  or app_private.has_any_role(array['admin','super_admin','reviewer'])
)
with check (
  app_private.owns_provider(id)
  or app_private.has_any_role(array['admin','super_admin','reviewer'])
);

create policy provider_profiles_delete_authorized on public.provider_profiles
for delete to authenticated
using (
  app_private.owns_provider(id)
  or app_private.has_any_role(array['admin','super_admin'])
);

create policy provider_services_public_read on public.provider_services
for select to anon, authenticated using (true);

create policy provider_services_create_authorized on public.provider_services
for insert to authenticated
with check (
  app_private.owns_provider(provider_id)
  and (provider_profile_id is null or provider_profile_id = provider_id)
  or app_private.has_any_role(array['admin','super_admin'])
);

create policy provider_services_update_authorized on public.provider_services
for update to authenticated
using (
  app_private.owns_provider(provider_id)
  or app_private.has_any_role(array['admin','super_admin'])
)
with check (
  (app_private.owns_provider(provider_id) and (provider_profile_id is null or provider_profile_id = provider_id))
  or app_private.has_any_role(array['admin','super_admin'])
);

create policy provider_services_delete_authorized on public.provider_services
for delete to authenticated
using (
  app_private.owns_provider(provider_id)
  or app_private.has_any_role(array['admin','super_admin'])
);

create policy provider_gallery_public_read on public.provider_gallery
for select to anon, authenticated using (true);

create policy provider_gallery_create_authorized on public.provider_gallery
for insert to authenticated
with check (
  app_private.owns_provider(provider_profile_id)
  or app_private.has_any_role(array['admin','super_admin'])
);

create policy provider_gallery_update_authorized on public.provider_gallery
for update to authenticated
using (
  app_private.owns_provider(provider_profile_id)
  or app_private.has_any_role(array['admin','super_admin'])
)
with check (
  app_private.owns_provider(provider_profile_id)
  or app_private.has_any_role(array['admin','super_admin'])
);

create policy provider_gallery_delete_authorized on public.provider_gallery
for delete to authenticated
using (
  app_private.owns_provider(provider_profile_id)
  or app_private.has_any_role(array['admin','super_admin'])
);

create policy quote_requests_public_create on public.quote_requests
for insert to anon, authenticated
with check (
  provider_profile_id is not null
  and status = 'pending'
  and exists (select 1 from public.provider_profiles p where p.id = provider_profile_id and coalesce(p.is_active, true))
);

create policy quote_requests_read_authorized on public.quote_requests
for select to authenticated
using (
  app_private.owns_provider(provider_profile_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer','auditor'])
);

create policy quote_requests_update_authorized on public.quote_requests
for update to authenticated
using (
  app_private.owns_provider(provider_profile_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
)
with check (
  app_private.owns_provider(provider_profile_id)
  or app_private.has_any_role(array['admin','super_admin','reviewer','fccpc_officer'])
);
