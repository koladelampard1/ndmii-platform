-- Align provider_services with the canonical MSME service catalog fields.

alter table if exists provider_services
  add column if not exists provider_id uuid references provider_profiles(id) on delete cascade,
  add column if not exists title text,
  add column if not exists short_description text,
  add column if not exists category text,
  add column if not exists specialization text,
  add column if not exists pricing_mode text not null default 'fixed',
  add column if not exists min_price numeric(14,2),
  add column if not exists max_price numeric(14,2),
  add column if not exists currency text not null default 'NGN',
  add column if not exists vat_applicable boolean not null default false,
  add column if not exists turnaround_days integer;

update provider_services
set
  provider_id = coalesce(provider_id, provider_profile_id),
  title = coalesce(title, service_name),
  short_description = coalesce(short_description, description),
  category = coalesce(category, 'Professional Services'),
  min_price = coalesce(min_price, price_min),
  max_price = coalesce(max_price, price_max),
  pricing_mode = coalesce(pricing_mode, pricing_model, 'fixed'),
  availability_status = coalesce(
    availability_status,
    case when coalesce(is_active, true) then 'available' else 'unavailable' end
  )
where
  provider_id is null
  or title is null
  or short_description is null
  or category is null
  or min_price is null
  or max_price is null
  or pricing_mode is null
  or availability_status is null;

alter table if exists provider_services
  alter column provider_id set not null,
  alter column title set not null,
  alter column short_description set not null,
  alter column category set not null,
  alter column pricing_mode set not null,
  alter column availability_status set not null;

alter table if exists provider_services
  drop constraint if exists provider_services_pricing_mode_check,
  add constraint provider_services_pricing_mode_check
    check (pricing_mode in ('fixed', 'range', 'negotiable'));

alter table if exists provider_services
  drop constraint if exists provider_services_availability_status_check,
  add constraint provider_services_availability_status_check
    check (availability_status in ('available', 'limited', 'unavailable'));

alter table if exists provider_services
  drop constraint if exists provider_services_currency_check,
  add constraint provider_services_currency_check
    check (currency ~ '^[A-Z]{3}$');

alter table if exists provider_services
  drop constraint if exists provider_services_turnaround_days_check,
  add constraint provider_services_turnaround_days_check
    check (turnaround_days is null or turnaround_days >= 0);
