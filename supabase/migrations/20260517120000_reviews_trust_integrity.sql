-- Launch hardening: reviews must not create public trust signals until published.
-- This migration intentionally no-ops review-table changes when production has not
-- created provider marketplace reviews yet.

do $$
begin
  if to_regclass('public.reviews') is not null then
    alter table public.reviews
      add column if not exists publication_status text not null default 'published',
      add column if not exists moderated_at timestamptz,
      add column if not exists moderated_by uuid references public.users(id),
      add column if not exists moderation_note text;

    alter table public.reviews
      drop constraint if exists reviews_publication_status_check;

    alter table public.reviews
      add constraint reviews_publication_status_check
      check (publication_status in ('published', 'hidden', 'flagged'));

    create index if not exists idx_reviews_provider_publication_status
      on public.reviews(provider_id, publication_status);

    update public.reviews
    set
      publication_status = 'hidden',
      moderated_at = coalesce(moderated_at, now()),
      moderation_note = coalesce(moderation_note, 'Hidden during launch trust hardening because this review came from demo seed data.')
    where review_title in (
      'Reliable and professional',
      'Strong communication',
      'Great quality output',
      'Excellent delivery governance',
      'Reliable service quality'
    );
  end if;

  if to_regclass('public.review_metrics') is not null then
    alter table public.review_metrics
      add column if not exists positive_reviews integer not null default 0;
  end if;
end;
$$;

create or replace function public.recalculate_review_metrics(target_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_provider_id is null then
    return;
  end if;

  insert into review_metrics (
    provider_id,
    avg_rating,
    review_count,
    positive_reviews,
    five_star_count,
    four_star_count,
    three_star_count,
    two_star_count,
    one_star_count,
    updated_at
  )
  select
    target_provider_id,
    coalesce(round(avg(r.rating)::numeric, 2), 0),
    count(r.id)::int,
    count(r.id) filter (where r.rating >= 4)::int,
    count(r.id) filter (where r.rating = 5)::int,
    count(r.id) filter (where r.rating = 4)::int,
    count(r.id) filter (where r.rating = 3)::int,
    count(r.id) filter (where r.rating = 2)::int,
    count(r.id) filter (where r.rating = 1)::int,
    now()
  from reviews r
  where r.provider_id = target_provider_id
    and r.publication_status = 'published'
  on conflict (provider_id) do update set
    avg_rating = excluded.avg_rating,
    review_count = excluded.review_count,
    positive_reviews = excluded.positive_reviews,
    five_star_count = excluded.five_star_count,
    four_star_count = excluded.four_star_count,
    three_star_count = excluded.three_star_count,
    two_star_count = excluded.two_star_count,
    one_star_count = excluded.one_star_count,
    updated_at = now();
end;
$$;

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

do $$
declare
  provider record;
begin
  if to_regclass('public.reviews') is not null and to_regclass('public.review_metrics') is not null then
    drop trigger if exists reviews_refresh_metrics_after_insert on public.reviews;
    drop trigger if exists reviews_refresh_metrics_after_update on public.reviews;
    drop trigger if exists reviews_refresh_metrics_after_delete on public.reviews;

    create trigger reviews_refresh_metrics_after_insert
    after insert
    on public.reviews
    for each row
    execute function public.refresh_review_metrics_after_review_change();

    create trigger reviews_refresh_metrics_after_update
    after update of provider_id, rating, publication_status
    on public.reviews
    for each row
    execute function public.refresh_review_metrics_after_review_change();

    create trigger reviews_refresh_metrics_after_delete
    after delete
    on public.reviews
    for each row
    execute function public.refresh_review_metrics_after_review_change();

    if to_regclass('public.provider_profiles') is not null then
      for provider in select id from public.provider_profiles loop
        perform public.recalculate_review_metrics(provider.id);
      end loop;
    end if;
  end if;
end;
$$;

-- marketplace_provider_search is intentionally not recreated here. Reviews
-- hardening must not depend on optional marketplace taxonomy tables.
