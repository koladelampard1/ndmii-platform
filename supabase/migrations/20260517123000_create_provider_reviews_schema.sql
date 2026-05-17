-- Production-safe provider marketplace reviews schema for DBIN.
-- This is intentionally additive and does not touch impact_assessment_reviews.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  reviewer_name text,
  reviewer_email text,
  rating integer not null check (rating between 1 and 5),
  review_title text,
  review_body text,
  is_featured boolean default false,
  provider_reply text,
  provider_reply_at timestamptz,
  provider_reply_by uuid references public.users(id),
  publication_status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reviews
  alter column provider_id set not null,
  alter column rating set not null,
  alter column is_featured set default false,
  alter column publication_status set default 'published',
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.reviews
  add column if not exists reviewer_email text,
  add column if not exists provider_reply text,
  add column if not exists provider_reply_at timestamptz,
  add column if not exists provider_reply_by uuid references public.users(id),
  add column if not exists publication_status text default 'published',
  add column if not exists updated_at timestamptz default now();

alter table public.reviews
  drop constraint if exists reviews_publication_status_check;

alter table public.reviews
  add constraint reviews_publication_status_check
  check (publication_status in ('published', 'hidden', 'flagged'));

create index if not exists idx_reviews_provider_id
  on public.reviews(provider_id);

create index if not exists idx_reviews_publication_status
  on public.reviews(publication_status);

create index if not exists idx_reviews_created_at_desc
  on public.reviews(created_at desc);

create index if not exists idx_reviews_provider_publication_status
  on public.reviews(provider_id, publication_status);

create table if not exists public.review_metrics (
  provider_id uuid primary key references public.provider_profiles(id) on delete cascade,
  avg_rating numeric default 0,
  review_count integer default 0,
  positive_reviews integer default 0,
  rating_1_count integer default 0,
  rating_2_count integer default 0,
  rating_3_count integer default 0,
  rating_4_count integer default 0,
  rating_5_count integer default 0,
  one_star_count integer default 0,
  two_star_count integer default 0,
  three_star_count integer default 0,
  four_star_count integer default 0,
  five_star_count integer default 0,
  updated_at timestamptz default now()
);

alter table public.review_metrics
  add column if not exists avg_rating numeric default 0,
  add column if not exists review_count integer default 0,
  add column if not exists positive_reviews integer default 0,
  add column if not exists rating_1_count integer default 0,
  add column if not exists rating_2_count integer default 0,
  add column if not exists rating_3_count integer default 0,
  add column if not exists rating_4_count integer default 0,
  add column if not exists rating_5_count integer default 0,
  add column if not exists one_star_count integer default 0,
  add column if not exists two_star_count integer default 0,
  add column if not exists three_star_count integer default 0,
  add column if not exists four_star_count integer default 0,
  add column if not exists five_star_count integer default 0,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_review_metrics_avg_rating
  on public.review_metrics(avg_rating desc);

create or replace function public.set_provider_reviews_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- The metrics recalculation function is created by
-- 20260517120000_reviews_trust_integrity.sql. Do not recreate it here:
-- PostgreSQL rejects CREATE OR REPLACE when an existing input parameter name
-- differs, and this migration must be safely rerunnable after 20260517120000.

create or replace function public.refresh_review_metrics_after_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_review_metrics(old.provider_id);
    return old;
  end if;

  perform public.recalculate_review_metrics(new.provider_id);

  if tg_op = 'UPDATE' and old.provider_id is distinct from new.provider_id then
    perform public.recalculate_review_metrics(old.provider_id);
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row
execute function public.set_provider_reviews_updated_at();

drop trigger if exists reviews_refresh_metrics_after_insert on public.reviews;
drop trigger if exists reviews_refresh_metrics_after_update on public.reviews;
drop trigger if exists reviews_refresh_metrics_after_delete on public.reviews;

create trigger reviews_refresh_metrics_after_insert
after insert on public.reviews
for each row
execute function public.refresh_review_metrics_after_review_change();

create trigger reviews_refresh_metrics_after_update
after update of provider_id, rating, publication_status on public.reviews
for each row
execute function public.refresh_review_metrics_after_review_change();

create trigger reviews_refresh_metrics_after_delete
after delete on public.reviews
for each row
execute function public.refresh_review_metrics_after_review_change();

do $$
declare
  provider_row record;
begin
  for provider_row in select id from public.provider_profiles loop
    perform public.recalculate_review_metrics(provider_row.id);
  end loop;
end;
$$;

alter table public.reviews enable row level security;

drop policy if exists "Public can read published provider reviews" on public.reviews;
create policy "Public can read published provider reviews"
on public.reviews
for select
using (publication_status = 'published');

drop policy if exists "Provider owners can read own reviews" on public.reviews;
create policy "Provider owners can read own reviews"
on public.reviews
for select
using (
  exists (
    select 1
    from public.provider_profiles p
    join public.msmes m on m.id::text = p.msme_id::text
    left join public.users u on u.id = m.created_by
    where p.id::text = reviews.provider_id::text
      and (
        u.auth_user_id = auth.uid()
        or lower(m.contact_email) = lower(auth.email())
      )
  )
);

drop policy if exists "Provider owners can update own review replies" on public.reviews;
create policy "Provider owners can update own review replies"
on public.reviews
for update
using (
  exists (
    select 1
    from public.provider_profiles p
    join public.msmes m on m.id::text = p.msme_id::text
    left join public.users u on u.id = m.created_by
    where p.id::text = reviews.provider_id::text
      and (
        u.auth_user_id = auth.uid()
        or lower(m.contact_email) = lower(auth.email())
      )
  )
)
with check (
  exists (
    select 1
    from public.provider_profiles p
    join public.msmes m on m.id::text = p.msme_id::text
    left join public.users u on u.id = m.created_by
    where p.id::text = reviews.provider_id::text
      and (
        u.auth_user_id = auth.uid()
        or lower(m.contact_email) = lower(auth.email())
      )
  )
);

-- marketplace_provider_search is intentionally not recreated here. Provider
-- reviews schema must not depend on optional marketplace taxonomy tables.
