-- LCDBO Phase 3: MSME enrolment and industrial cluster participation.
-- Additive workflow fields, state constraints, ownership policies, and a
-- registration-safe enrolment RPC for the existing DBIN programme workspace.

alter table if exists public.msmes
  add column if not exists registration_context jsonb not null default '{}'::jsonb;

alter table public.programme_enrolments
  add column if not exists application_note text,
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references public.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.cluster_members
  add column if not exists interest_reason text,
  add column if not exists capacity_summary text,
  add column if not exists product_or_service text,
  add column if not exists current_location text,
  add column if not exists preferred_support text[] not null default '{}'::text[],
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references public.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.programme_enrolments drop constraint if exists programme_enrolments_status_check;
alter table public.programme_enrolments
  add constraint programme_enrolments_status_check check (
    status in ('invited', 'pending_review', 'active', 'rejected', 'suspended', 'withdrawn', 'paused', 'completed')
  );

alter table public.cluster_members drop constraint if exists cluster_members_status_check;
alter table public.cluster_members
  add constraint cluster_members_status_check check (
    status in ('invited', 'interested', 'under_review', 'accepted', 'rejected', 'waitlisted', 'withdrawn', 'active', 'paused', 'exited', 'removed')
  );

create unique index if not exists idx_programme_enrolments_unique_msme
  on public.programme_enrolments(programme_id, msme_id)
  where msme_id is not null and enrolment_type = 'msme';

create unique index if not exists idx_cluster_members_unique_msme
  on public.cluster_members(cluster_id, msme_id)
  where msme_id is not null and member_type = 'msme';

create index if not exists idx_programme_enrolments_review_queue
  on public.programme_enrolments(programme_id, status, enrolled_at desc);

create index if not exists idx_cluster_members_review_queue
  on public.cluster_members(cluster_id, status, joined_at desc);

create or replace function public.lcdbo_current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.lcdbo_can_review_programme(target_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and (
        u.role in ('admin', 'super_admin', 'programme_officer')
        or exists (
          select 1
          from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin')
            and (
              ra.scope_type = 'global'
              or (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
            )
        )
      )
  )
$$;

revoke all on function public.lcdbo_current_app_user_id() from public;
grant execute on function public.lcdbo_current_app_user_id() to authenticated;
revoke all on function public.lcdbo_can_review_programme(uuid) from public;
grant execute on function public.lcdbo_can_review_programme(uuid) to authenticated;

drop policy if exists "MSMEs can read own programme enrolments" on public.programme_enrolments;
create policy "MSMEs can read own programme enrolments"
  on public.programme_enrolments for select
  using (
    exists (
      select 1 from public.msmes m
      where m.id = programme_enrolments.msme_id
        and m.created_by = public.lcdbo_current_app_user_id()
    )
  );

drop policy if exists "LCDBO reviewers can read programme enrolments" on public.programme_enrolments;
create policy "LCDBO reviewers can read programme enrolments"
  on public.programme_enrolments for select
  using (public.lcdbo_can_review_programme(programme_id));

drop policy if exists "MSMEs can withdraw own programme enrolments" on public.programme_enrolments;
-- MSME mutations run through ownership-checked server actions (and the
-- registration RPC above) so review fields cannot be altered through PostgREST.

drop policy if exists "LCDBO reviewers can update programme enrolments" on public.programme_enrolments;
create policy "LCDBO reviewers can update programme enrolments"
  on public.programme_enrolments for update
  using (public.lcdbo_can_review_programme(programme_id))
  with check (public.lcdbo_can_review_programme(programme_id));

drop policy if exists "MSMEs can read own cluster interests" on public.cluster_members;
create policy "MSMEs can read own cluster interests"
  on public.cluster_members for select
  using (
    exists (
      select 1 from public.msmes m
      where m.id = cluster_members.msme_id
        and m.created_by = public.lcdbo_current_app_user_id()
    )
  );

drop policy if exists "LCDBO reviewers can read cluster interests" on public.cluster_members;
create policy "LCDBO reviewers can read cluster interests"
  on public.cluster_members for select
  using (
    exists (
      select 1
      from public.industrial_clusters c
      where c.id = cluster_members.cluster_id
        and public.lcdbo_can_review_programme(c.programme_id)
    )
  );

drop policy if exists "MSMEs can withdraw own cluster interests" on public.cluster_members;
-- Cluster-interest mutations also remain behind ownership-checked server
-- actions to prevent applicants from editing programme review decisions.

drop policy if exists "LCDBO reviewers can update cluster interests" on public.cluster_members;
create policy "LCDBO reviewers can update cluster interests"
  on public.cluster_members for update
  using (
    exists (
      select 1
      from public.industrial_clusters c
      where c.id = cluster_members.cluster_id
        and public.lcdbo_can_review_programme(c.programme_id)
    )
  )
  with check (
    exists (
      select 1
      from public.industrial_clusters c
      where c.id = cluster_members.cluster_id
        and public.lcdbo_can_review_programme(c.programme_id)
    )
  );

create or replace function public.request_lcdbo_enrolment(
  target_msme_id uuid,
  registration_source text default 'lcdbo_public_site'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app_user_id uuid;
  lcdbo_programme_id uuid;
  enrolment_id uuid;
begin
  app_user_id := public.lcdbo_current_app_user_id();
  if app_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.msmes m
    where m.id = target_msme_id and m.created_by = app_user_id
  ) then
    raise exception 'The MSME record is not owned by the current user.';
  end if;

  select id into lcdbo_programme_id
  from public.programmes
  where slug = 'local-content-development-beyond-oil'
  limit 1;

  if lcdbo_programme_id is null then
    raise exception 'LCDBO programme is not configured.';
  end if;

  insert into public.programme_enrolments (
    programme_id, msme_id, enrolment_type, status, enrolled_by, metadata
  ) values (
    lcdbo_programme_id,
    target_msme_id,
    'msme',
    'pending_review',
    app_user_id,
    jsonb_build_object('programme', 'lcdbo', 'source', coalesce(nullif(trim(registration_source), ''), 'lcdbo_public_site'))
  )
  on conflict (programme_id, msme_id) where msme_id is not null and enrolment_type = 'msme'
  do update set
    status = case
      when programme_enrolments.status in ('active', 'suspended') then programme_enrolments.status
      else 'pending_review'
    end,
    exited_at = null,
    enrolled_by = excluded.enrolled_by,
    metadata = programme_enrolments.metadata || excluded.metadata,
    updated_at = now()
  returning id into enrolment_id;

  insert into public.platform_events (
    actor_user_id, event_type, entity_type, entity_id, scope_type, scope_id, metadata
  ) values (
    app_user_id,
    'lcdbo.enrolment.created',
    'programme_enrolment',
    enrolment_id,
    'programme',
    lcdbo_programme_id,
    jsonb_build_object('msme_id', target_msme_id, 'source', registration_source)
  );

  return enrolment_id;
end;
$$;

revoke all on function public.request_lcdbo_enrolment(uuid, text) from public;
grant execute on function public.request_lcdbo_enrolment(uuid, text) to authenticated;
