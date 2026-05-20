-- Compliance Phase 3 reviewer workflow.
-- Adds regulator review sessions, comments, export audit records, transition
-- guards, lightweight notification events, and RLS backstops.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_review_status') then
    create type public.compliance_review_status as enum (
      'pending_review',
      'under_review',
      'approved',
      'rejected',
      'changes_requested'
    );
  end if;
end $$;

alter type public.compliance_item_status add value if not exists 'resubmitted';
alter type public.compliance_event_type add value if not exists 'review_created';
alter type public.compliance_event_type add value if not exists 'review_assigned';
alter type public.compliance_event_type add value if not exists 'resubmitted';

create table if not exists public.compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  compliance_item_id uuid not null references public.msme_compliance_items(id) on delete cascade,
  reviewer_user_id uuid references public.users(id) on delete restrict,
  regulator_id uuid not null references public.compliance_regulators(id) on delete restrict,
  review_status public.compliance_review_status not null default 'pending_review',
  previous_status public.compliance_item_status,
  new_status public.compliance_item_status,
  decision_reason text,
  internal_notes text,
  requested_changes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_reviews_decision_reviewer_check check (
    review_status in ('pending_review', 'under_review')
    or reviewer_user_id is not null
  ),
  constraint compliance_reviews_decision_reason_check check (
    review_status not in ('rejected', 'changes_requested')
    or nullif(trim(coalesce(decision_reason, requested_changes, '')), '') is not null
  )
);

create table if not exists public.compliance_review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.compliance_reviews(id) on delete cascade,
  msme_id uuid not null references public.msmes(id) on delete cascade,
  compliance_item_id uuid not null references public.msme_compliance_items(id) on delete cascade,
  regulator_id uuid not null references public.compliance_regulators(id) on delete restrict,
  author_user_id uuid references public.users(id) on delete set null,
  author_role text not null,
  comment_body text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'msme_visible')),
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_review_exports (
  id uuid primary key default gen_random_uuid(),
  exported_by_user_id uuid references public.users(id) on delete set null,
  exported_by_role text not null,
  regulator_id uuid references public.compliance_regulators(id) on delete set null,
  review_status public.compliance_review_status,
  filters jsonb not null default '{}'::jsonb,
  export_format text not null default 'csv' check (export_format in ('csv')),
  export_count integer not null default 0 check (export_count >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists compliance_reviews_one_active_item_review_idx
  on public.compliance_reviews(compliance_item_id)
  where review_status in ('pending_review', 'under_review');
create index if not exists compliance_reviews_queue_idx
  on public.compliance_reviews(regulator_id, review_status, created_at desc);
create index if not exists compliance_reviews_msme_idx
  on public.compliance_reviews(msme_id, created_at desc);
create index if not exists compliance_reviews_reviewer_idx
  on public.compliance_reviews(reviewer_user_id, review_status);
create index if not exists compliance_review_comments_review_idx
  on public.compliance_review_comments(review_id, created_at desc);
create index if not exists compliance_review_comments_msme_idx
  on public.compliance_review_comments(msme_id, created_at desc);
create index if not exists compliance_review_exports_user_idx
  on public.compliance_review_exports(exported_by_user_id, created_at desc);

create or replace function public.set_compliance_review_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_compliance_reviews_updated_at on public.compliance_reviews;
create trigger trg_compliance_reviews_updated_at
before update on public.compliance_reviews
for each row
execute function public.set_compliance_review_updated_at();

create or replace function public.compliance_can_access_regulator_queue(target_regulator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.compliance_current_role() in ('admin', 'reviewer')
    or (
      public.compliance_current_role() in ('firs_officer', 'nrs_officer')
      and exists (
        select 1
        from public.compliance_regulators r
        where r.id = target_regulator_id
          and r.code in ('FIRS', 'VAT')
      )
    )
    or (
      public.compliance_current_role() = 'fccpc_officer'
      and exists (
        select 1
        from public.compliance_regulators r
        where r.id = target_regulator_id
          and r.code in ('PLATFORM_KYC', 'CAC', 'SON', 'NAFDAC', 'LOCAL_AUTHORITY')
      )
    ),
    false
  );
$$;

create or replace function public.compliance_can_read_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.compliance_current_role() in ('admin', 'reviewer', 'fccpc_officer', 'firs_officer', 'nrs_officer'), false);
$$;

create or replace function public.compliance_transition_allowed(from_status text, to_status text)
returns boolean
language sql
immutable
as $$
  select (from_status, to_status) in (
    ('not_started', 'submitted'),
    ('draft', 'submitted'),
    ('submitted', 'under_review'),
    ('resubmitted', 'under_review'),
    ('under_review', 'approved'),
    ('under_review', 'rejected'),
    ('under_review', 'changes_requested'),
    ('changes_requested', 'resubmitted'),
    ('rejected', 'resubmitted'),
    ('approved', 'under_review'),
    ('rejected', 'under_review'),
    ('changes_requested', 'under_review')
  );
$$;

create or replace function public.enforce_compliance_item_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not public.compliance_transition_allowed(old.status::text, new.status::text) then
      raise exception 'Invalid compliance status transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'approved' then
    if new.reviewer_user_id is null then
      raise exception 'Compliance approval requires reviewer identity'
        using errcode = '23514';
    end if;

    if old.status is distinct from 'under_review'::public.compliance_item_status then
      raise exception 'Compliance item must be under review before approval'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.compliance_documents d
      where d.compliance_item_id = new.id
        and d.msme_id = new.msme_id
        and d.is_deleted = false
    ) then
      raise exception 'Compliance approval requires at least one active evidence document'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_compliance_item_transition on public.msme_compliance_items;
create trigger trg_enforce_compliance_item_transition
before update on public.msme_compliance_items
for each row
execute function public.enforce_compliance_item_transition();

create or replace function public.enforce_compliance_review_integrity()
returns trigger
language plpgsql
as $$
declare
  item_status public.compliance_item_status;
begin
  select status into item_status
  from public.msme_compliance_items
  where id = new.compliance_item_id
    and msme_id = new.msme_id
    and regulator_id = new.regulator_id;

  if item_status is null then
    raise exception 'Compliance review must match an existing compliance item'
      using errcode = '23503';
  end if;

  if item_status = 'archived' then
    raise exception 'Archived compliance items cannot be reviewed'
      using errcode = '23514';
  end if;

  if new.review_status in ('approved', 'rejected', 'changes_requested') then
    if new.reviewer_user_id is null then
      raise exception 'Review decisions require reviewer identity'
        using errcode = '23514';
    end if;

    if tg_op = 'INSERT' or old.review_status is distinct from 'under_review'::public.compliance_review_status then
      raise exception 'Review decisions require an under-review session'
        using errcode = '23514';
    end if;
  end if;

  if new.review_status = 'approved' and not exists (
    select 1
    from public.compliance_documents d
    where d.compliance_item_id = new.compliance_item_id
      and d.msme_id = new.msme_id
      and d.is_deleted = false
  ) then
    raise exception 'Review approval requires at least one active evidence document'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_compliance_review_integrity on public.compliance_reviews;
create trigger trg_enforce_compliance_review_integrity
before insert or update on public.compliance_reviews
for each row
execute function public.enforce_compliance_review_integrity();

alter table public.compliance_reviews enable row level security;
alter table public.compliance_review_comments enable row level security;
alter table public.compliance_review_exports enable row level security;

drop policy if exists "Compliance reviews scoped read" on public.compliance_reviews;
create policy "Compliance reviews scoped read"
on public.compliance_reviews
for select
using (
  public.compliance_owns_msme(msme_id)
  or public.compliance_can_access_regulator_queue(regulator_id)
  or reviewer_user_id = public.compliance_current_app_user_id()
);

drop policy if exists "Compliance reviews regulator insert" on public.compliance_reviews;
create policy "Compliance reviews regulator insert"
on public.compliance_reviews
for insert
with check (
  public.compliance_can_access_regulator_queue(regulator_id)
  and reviewer_user_id is not null
);

drop policy if exists "Compliance reviews regulator update" on public.compliance_reviews;
create policy "Compliance reviews regulator update"
on public.compliance_reviews
for update
using (
  public.compliance_can_access_regulator_queue(regulator_id)
  or reviewer_user_id = public.compliance_current_app_user_id()
)
with check (
  public.compliance_can_access_regulator_queue(regulator_id)
  or reviewer_user_id = public.compliance_current_app_user_id()
);

drop policy if exists "Compliance review comments scoped read" on public.compliance_review_comments;
create policy "Compliance review comments scoped read"
on public.compliance_review_comments
for select
using (
  (visibility = 'msme_visible' and public.compliance_owns_msme(msme_id))
  or public.compliance_can_access_regulator_queue(regulator_id)
);

drop policy if exists "Compliance review comments regulator insert" on public.compliance_review_comments;
create policy "Compliance review comments regulator insert"
on public.compliance_review_comments
for insert
with check (
  public.compliance_can_access_regulator_queue(regulator_id)
);

drop policy if exists "Compliance review exports regulator read" on public.compliance_review_exports;
create policy "Compliance review exports regulator read"
on public.compliance_review_exports
for select
using (
  public.compliance_can_access_regulator_queue(regulator_id)
  or public.compliance_current_role() in ('admin', 'reviewer')
);

drop policy if exists "Compliance review exports regulator insert" on public.compliance_review_exports;
create policy "Compliance review exports regulator insert"
on public.compliance_review_exports
for insert
with check (
  public.compliance_can_access_regulator_queue(regulator_id)
  or public.compliance_current_role() in ('admin', 'reviewer')
);
