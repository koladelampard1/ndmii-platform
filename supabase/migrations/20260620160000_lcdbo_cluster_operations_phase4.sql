-- LCDBO Phase 4: cluster placement and participation operations.

alter table public.cluster_members drop constraint if exists cluster_members_status_check;
alter table public.cluster_members
  add constraint cluster_members_status_check check (
    status in (
      'invited', 'interested', 'under_review', 'accepted', 'onboarding',
      'needs_documents', 'active', 'placed', 'inactive', 'rejected',
      'waitlisted', 'withdrawn', 'paused', 'exited', 'removed'
    )
  );

alter table public.cluster_members
  add column if not exists assigned_officer_id uuid references public.users(id) on delete set null,
  add column if not exists assigned_by uuid references public.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists assignment_notes text;

create index if not exists idx_cluster_members_assigned_officer
  on public.cluster_members(assigned_officer_id, status)
  where assigned_officer_id is not null;

drop policy if exists "Assigned LCDBO officers can read cluster members" on public.cluster_members;
create policy "Assigned LCDBO officers can read cluster members" on public.cluster_members
  for select using (assigned_officer_id = public.lcdbo_current_app_user_id());

create table if not exists public.lcdbo_cluster_assessments (
  id uuid primary key default gen_random_uuid(),
  cluster_member_id uuid not null references public.cluster_members(id) on delete cascade,
  msme_id uuid not null references public.msmes(id) on delete cascade,
  production_capacity smallint not null,
  equipment_readiness smallint not null,
  workforce_readiness smallint not null,
  finance_readiness smallint not null,
  compliance_readiness smallint not null,
  market_readiness smallint not null,
  export_readiness smallint not null,
  digital_readiness smallint not null,
  overall_score numeric(4,2) not null,
  readiness_level text not null,
  assessor_id uuid not null references public.users(id) on delete restrict,
  assessment_notes text,
  recommended_support text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_cluster_assessments_scores_check check (
    production_capacity between 1 and 5
    and equipment_readiness between 1 and 5
    and workforce_readiness between 1 and 5
    and finance_readiness between 1 and 5
    and compliance_readiness between 1 and 5
    and market_readiness between 1 and 5
    and export_readiness between 1 and 5
    and digital_readiness between 1 and 5
    and overall_score between 1 and 5
  ),
  constraint lcdbo_cluster_assessments_readiness_check check (
    readiness_level in ('early_stage', 'developing', 'ready_for_cluster', 'ready_for_investment', 'ready_for_export')
  )
);

create table if not exists public.lcdbo_document_requests (
  id uuid primary key default gen_random_uuid(),
  cluster_member_id uuid not null references public.cluster_members(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete restrict,
  document_type text not null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'requested',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_document_requests_type_check check (document_type in (
    'business_registration', 'product_photos', 'equipment_evidence',
    'capacity_statement', 'financial_summary', 'compliance_document',
    'export_document', 'other'
  )),
  constraint lcdbo_document_requests_status_check check (
    status in ('requested', 'submitted', 'accepted', 'rejected', 'waived', 'expired')
  ),
  constraint lcdbo_document_requests_title_check check (nullif(trim(title), '') is not null)
);

create table if not exists public.lcdbo_document_submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.lcdbo_document_requests(id) on delete cascade,
  msme_id uuid not null references public.msmes(id) on delete cascade,
  submitted_by uuid not null references public.users(id) on delete restrict,
  file_url text,
  notes text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  status text not null default 'submitted',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_document_submissions_status_check check (status in ('submitted', 'accepted', 'rejected')),
  constraint lcdbo_document_submissions_content_check check (
    nullif(trim(coalesce(file_url, '')), '') is not null
    or nullif(trim(coalesce(notes, '')), '') is not null
  )
);

create index if not exists idx_lcdbo_cluster_assessments_member
  on public.lcdbo_cluster_assessments(cluster_member_id, created_at desc);
create index if not exists idx_lcdbo_cluster_assessments_msme
  on public.lcdbo_cluster_assessments(msme_id, created_at desc);
create index if not exists idx_lcdbo_document_requests_member
  on public.lcdbo_document_requests(cluster_member_id, status, due_date);
create index if not exists idx_lcdbo_document_submissions_request
  on public.lcdbo_document_submissions(request_id, submitted_at desc);
create index if not exists idx_lcdbo_document_submissions_msme
  on public.lcdbo_document_submissions(msme_id, status);

drop trigger if exists set_lcdbo_cluster_assessments_updated_at on public.lcdbo_cluster_assessments;
create trigger set_lcdbo_cluster_assessments_updated_at before update on public.lcdbo_cluster_assessments
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_document_requests_updated_at on public.lcdbo_document_requests;
create trigger set_lcdbo_document_requests_updated_at before update on public.lcdbo_document_requests
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_document_submissions_updated_at on public.lcdbo_document_submissions;
create trigger set_lcdbo_document_submissions_updated_at before update on public.lcdbo_document_submissions
  for each row execute function public.set_platform_foundation_updated_at();

create or replace function public.lcdbo_can_access_cluster_member(target_cluster_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cluster_members cm
    join public.industrial_clusters c on c.id = cm.cluster_id
    left join public.msmes m on m.id = cm.msme_id
    where cm.id = target_cluster_member_id
      and (
        m.created_by = public.lcdbo_current_app_user_id()
        or cm.assigned_officer_id = public.lcdbo_current_app_user_id()
        or public.lcdbo_can_review_programme(c.programme_id)
      )
  )
$$;

create or replace function public.lcdbo_can_operate_cluster_member(target_cluster_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cluster_members cm
    join public.industrial_clusters c on c.id = cm.cluster_id
    where cm.id = target_cluster_member_id
      and (
        cm.assigned_officer_id = public.lcdbo_current_app_user_id()
        or public.lcdbo_can_review_programme(c.programme_id)
      )
  )
$$;

revoke all on function public.lcdbo_can_access_cluster_member(uuid) from public;
grant execute on function public.lcdbo_can_access_cluster_member(uuid) to authenticated;
revoke all on function public.lcdbo_can_operate_cluster_member(uuid) from public;
grant execute on function public.lcdbo_can_operate_cluster_member(uuid) to authenticated;

alter table public.lcdbo_cluster_assessments enable row level security;
alter table public.lcdbo_document_requests enable row level security;
alter table public.lcdbo_document_submissions enable row level security;

drop policy if exists "LCDBO participants can read assessments" on public.lcdbo_cluster_assessments;
create policy "LCDBO participants can read assessments" on public.lcdbo_cluster_assessments
  for select using (public.lcdbo_can_access_cluster_member(cluster_member_id));
drop policy if exists "LCDBO operators can create assessments" on public.lcdbo_cluster_assessments;
create policy "LCDBO operators can create assessments" on public.lcdbo_cluster_assessments
  for insert with check (public.lcdbo_can_operate_cluster_member(cluster_member_id));

drop policy if exists "LCDBO participants can read document requests" on public.lcdbo_document_requests;
create policy "LCDBO participants can read document requests" on public.lcdbo_document_requests
  for select using (public.lcdbo_can_access_cluster_member(cluster_member_id));
drop policy if exists "LCDBO operators can manage document requests" on public.lcdbo_document_requests;
create policy "LCDBO operators can manage document requests" on public.lcdbo_document_requests
  for all using (public.lcdbo_can_operate_cluster_member(cluster_member_id))
  with check (public.lcdbo_can_operate_cluster_member(cluster_member_id));

drop policy if exists "LCDBO participants can read document submissions" on public.lcdbo_document_submissions;
create policy "LCDBO participants can read document submissions" on public.lcdbo_document_submissions
  for select using (
    exists (
      select 1 from public.lcdbo_document_requests dr
      where dr.id = lcdbo_document_submissions.request_id
        and public.lcdbo_can_access_cluster_member(dr.cluster_member_id)
    )
  );
