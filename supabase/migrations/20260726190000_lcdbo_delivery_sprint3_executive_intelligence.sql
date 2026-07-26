-- LCDBO Programme Delivery Core Sprint 3.
-- Executive delivery intelligence, governed evidence linkage, health override
-- governance and controlled-pilot readiness records.

alter table public.lcdbo_report_snapshots drop constraint if exists lcdbo_report_snapshots_type_check;
alter table public.lcdbo_report_snapshots
  add constraint lcdbo_report_snapshots_type_check check (report_type in (
    'national',
    'state',
    'cluster',
    'partner',
    'readiness',
    'participation',
    'data_quality',
    'programme_health',
    'executive_briefing',
    'executive_delivery',
    'executive_exceptions',
    'pilot_readiness',
    'evidence_verification',
    'programme_delivery',
    'workstream_performance',
    'milestone_deliverable',
    'risk_issue',
    'state_delivery',
    'lga_delivery',
    'cluster_delivery'
  ));

create table if not exists public.lcdbo_delivery_health_overrides (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  calculated_health text not null,
  override_health text not null,
  override_reason text not null,
  status text not null default 'active',
  applied_by uuid not null references public.users(id) on delete restrict,
  applied_at timestamptz not null default now(),
  removed_by uuid references public.users(id) on delete set null,
  removed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_delivery_health_overrides_target_type_check check (target_type in ('programme', 'workstream', 'state_plan', 'lga_plan', 'cluster_plan')),
  constraint lcdbo_delivery_health_overrides_health_check check (calculated_health in ('green', 'amber', 'red', 'grey') and override_health in ('green', 'amber', 'red', 'grey')),
  constraint lcdbo_delivery_health_overrides_status_check check (status in ('active', 'removed')),
  constraint lcdbo_delivery_health_overrides_reason_check check (nullif(trim(override_reason), '') is not null),
  constraint lcdbo_delivery_health_overrides_removed_check check ((status = 'removed' and removed_by is not null and removed_at is not null) or status = 'active')
);

create unique index if not exists idx_lcdbo_delivery_health_overrides_active
  on public.lcdbo_delivery_health_overrides(programme_id, target_type, target_id)
  where status = 'active';

create table if not exists public.lcdbo_delivery_evidence_links (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  related_entity_type text not null,
  related_entity_id uuid not null,
  evidence_type text not null,
  reference_title text not null,
  document_request_id uuid references public.lcdbo_document_requests(id) on delete set null,
  document_submission_id uuid references public.lcdbo_document_submissions(id) on delete set null,
  safe_url text,
  reference_note text,
  status text not null default 'referenced',
  data_classification text not null default 'operational',
  submitted_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  verification_outcome text,
  verification_note text,
  expires_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_delivery_evidence_links_entity_check check (related_entity_type in ('workstream', 'delivery_item', 'raid_item', 'decision', 'state_plan', 'lga_plan', 'cluster_plan', 'activity', 'progress_update', 'pilot_readiness')),
  constraint lcdbo_delivery_evidence_links_type_check check (evidence_type in ('approved_document', 'document_submission', 'external_link', 'reference_note')),
  constraint lcdbo_delivery_evidence_links_status_check check (status in ('referenced', 'submitted', 'under_review', 'verified', 'rejected', 'expired', 'superseded')),
  constraint lcdbo_delivery_evidence_links_classification_check check (data_classification in ('operational', 'aggregate', 'estimate', 'target', 'reference', 'external', 'test_uat')),
  constraint lcdbo_delivery_evidence_links_title_check check (nullif(trim(reference_title), '') is not null),
  constraint lcdbo_delivery_evidence_links_safe_url_check check (safe_url is null or safe_url ~* '^https?://'),
  constraint lcdbo_delivery_evidence_links_source_check check (
    document_request_id is not null
    or document_submission_id is not null
    or nullif(trim(coalesce(safe_url, '')), '') is not null
    or nullif(trim(coalesce(reference_note, '')), '') is not null
  ),
  constraint lcdbo_delivery_evidence_links_self_review_check check (reviewed_by is null or reviewed_by <> submitted_by or status not in ('verified', 'rejected'))
);

create index if not exists idx_lcdbo_delivery_evidence_links_programme
  on public.lcdbo_delivery_evidence_links(programme_id, status, related_entity_type);
create index if not exists idx_lcdbo_delivery_evidence_links_entity
  on public.lcdbo_delivery_evidence_links(related_entity_type, related_entity_id, status);

create table if not exists public.lcdbo_delivery_evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_link_id uuid not null references public.lcdbo_delivery_evidence_links(id) on delete cascade,
  previous_status text,
  new_status text not null,
  reviewed_by uuid not null references public.users(id) on delete restrict,
  review_note text,
  verification_outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lcdbo_delivery_evidence_reviews_status_check check (new_status in ('referenced', 'submitted', 'under_review', 'verified', 'rejected', 'expired', 'superseded'))
);

create index if not exists idx_lcdbo_delivery_evidence_reviews_link
  on public.lcdbo_delivery_evidence_reviews(evidence_link_id, created_at desc);

create table if not exists public.lcdbo_pilot_readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  scope_type text not null,
  state_plan_id uuid references public.lcdbo_state_delivery_plans(id) on delete cascade,
  lga_plan_id uuid references public.lcdbo_lga_delivery_plans(id) on delete cascade,
  cluster_plan_id uuid references public.lcdbo_cluster_delivery_plans(id) on delete cascade,
  outcome text not null default 'not_ready',
  readiness_score integer not null default 0,
  blocking_issue_count integer not null default 0,
  assessment_status text not null default 'draft',
  override_reason text,
  assessed_by uuid references public.users(id) on delete set null,
  assessed_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_pilot_readiness_scope_check check (
    (scope_type = 'state' and state_plan_id is not null and lga_plan_id is null and cluster_plan_id is null)
    or (scope_type = 'lga' and lga_plan_id is not null and cluster_plan_id is null)
    or (scope_type = 'cluster' and cluster_plan_id is not null)
  ),
  constraint lcdbo_pilot_readiness_outcome_check check (outcome in ('not_ready', 'conditionally_ready', 'ready_for_controlled_pilot', 'active', 'paused')),
  constraint lcdbo_pilot_readiness_score_check check (readiness_score between 0 and 100 and blocking_issue_count >= 0),
  constraint lcdbo_pilot_readiness_status_check check (assessment_status in ('draft', 'under_review', 'approved', 'changes_requested', 'rejected')),
  constraint lcdbo_pilot_readiness_override_check check (override_reason is null or nullif(trim(override_reason), '') is not null)
);

create unique index if not exists idx_lcdbo_pilot_readiness_state
  on public.lcdbo_pilot_readiness_assessments(programme_id, state_plan_id)
  where scope_type = 'state';
create unique index if not exists idx_lcdbo_pilot_readiness_lga
  on public.lcdbo_pilot_readiness_assessments(programme_id, lga_plan_id)
  where scope_type = 'lga';
create unique index if not exists idx_lcdbo_pilot_readiness_cluster
  on public.lcdbo_pilot_readiness_assessments(programme_id, cluster_plan_id)
  where scope_type = 'cluster';

create table if not exists public.lcdbo_pilot_readiness_dimensions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.lcdbo_pilot_readiness_assessments(id) on delete cascade,
  dimension_key text not null,
  requirement text not null,
  applicable boolean not null default true,
  not_applicable_reason text,
  current_status text not null default 'missing',
  evidence_required boolean not null default false,
  evidence_link_id uuid references public.lcdbo_delivery_evidence_links(id) on delete set null,
  responsible_owner_id uuid references public.users(id) on delete set null,
  reviewer_id uuid references public.users(id) on delete set null,
  verification_outcome text,
  blocking boolean not null default true,
  latest_update text,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_pilot_readiness_dimensions_unique unique (assessment_id, dimension_key),
  constraint lcdbo_pilot_readiness_dimensions_status_check check (current_status in ('missing', 'in_progress', 'met', 'not_applicable')),
  constraint lcdbo_pilot_readiness_dimensions_na_check check ((applicable = false and nullif(trim(coalesce(not_applicable_reason, '')), '') is not null) or applicable = true)
);

create index if not exists idx_lcdbo_pilot_readiness_dimensions_assessment
  on public.lcdbo_pilot_readiness_dimensions(assessment_id, blocking, current_status);

drop trigger if exists set_lcdbo_delivery_health_overrides_updated_at on public.lcdbo_delivery_health_overrides;
create trigger set_lcdbo_delivery_health_overrides_updated_at before update on public.lcdbo_delivery_health_overrides
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_delivery_evidence_links_updated_at on public.lcdbo_delivery_evidence_links;
create trigger set_lcdbo_delivery_evidence_links_updated_at before update on public.lcdbo_delivery_evidence_links
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_pilot_readiness_assessments_updated_at on public.lcdbo_pilot_readiness_assessments;
create trigger set_lcdbo_pilot_readiness_assessments_updated_at before update on public.lcdbo_pilot_readiness_assessments
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_pilot_readiness_dimensions_updated_at on public.lcdbo_pilot_readiness_dimensions;
create trigger set_lcdbo_pilot_readiness_dimensions_updated_at before update on public.lcdbo_pilot_readiness_dimensions
  for each row execute function public.set_platform_foundation_updated_at();

create or replace function public.lcdbo_can_view_delivery_governance(target_programme_id uuid)
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
        u.role in ('admin', 'super_admin', 'programme_officer', 'data_analyst', 'auditor')
        or exists (
          select 1
          from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin', 'data_analyst', 'auditor', 'observer', 'state_coordinator', 'lga_coordinator', 'cluster_manager')
            and (
              ra.scope_type = 'global'
              or (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
            )
        )
      )
  )
$$;

create or replace function public.lcdbo_can_manage_delivery_governance(target_programme_id uuid)
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

revoke all on function public.lcdbo_can_view_delivery_governance(uuid) from public;
grant execute on function public.lcdbo_can_view_delivery_governance(uuid) to authenticated;
revoke all on function public.lcdbo_can_manage_delivery_governance(uuid) from public;
grant execute on function public.lcdbo_can_manage_delivery_governance(uuid) to authenticated;

alter table public.lcdbo_delivery_health_overrides enable row level security;
alter table public.lcdbo_delivery_evidence_links enable row level security;
alter table public.lcdbo_delivery_evidence_reviews enable row level security;
alter table public.lcdbo_pilot_readiness_assessments enable row level security;
alter table public.lcdbo_pilot_readiness_dimensions enable row level security;

drop policy if exists "LCDBO governance readers can read health overrides" on public.lcdbo_delivery_health_overrides;
create policy "LCDBO governance readers can read health overrides" on public.lcdbo_delivery_health_overrides
  for select using (public.lcdbo_can_view_delivery_governance(programme_id));
drop policy if exists "LCDBO governance managers can manage health overrides" on public.lcdbo_delivery_health_overrides;
create policy "LCDBO governance managers can manage health overrides" on public.lcdbo_delivery_health_overrides
  for all using (public.lcdbo_can_manage_delivery_governance(programme_id))
  with check (public.lcdbo_can_manage_delivery_governance(programme_id));

drop policy if exists "LCDBO governance readers can read evidence links" on public.lcdbo_delivery_evidence_links;
create policy "LCDBO governance readers can read evidence links" on public.lcdbo_delivery_evidence_links
  for select using (public.lcdbo_can_view_delivery_governance(programme_id));
drop policy if exists "LCDBO governance managers can manage evidence links" on public.lcdbo_delivery_evidence_links;
create policy "LCDBO governance managers can manage evidence links" on public.lcdbo_delivery_evidence_links
  for all using (public.lcdbo_can_manage_delivery_governance(programme_id))
  with check (public.lcdbo_can_manage_delivery_governance(programme_id));

drop policy if exists "LCDBO governance readers can read evidence reviews" on public.lcdbo_delivery_evidence_reviews;
create policy "LCDBO governance readers can read evidence reviews" on public.lcdbo_delivery_evidence_reviews
  for select using (
    exists (
      select 1 from public.lcdbo_delivery_evidence_links e
      where e.id = lcdbo_delivery_evidence_reviews.evidence_link_id
        and public.lcdbo_can_view_delivery_governance(e.programme_id)
    )
  );
drop policy if exists "LCDBO governance managers can create evidence reviews" on public.lcdbo_delivery_evidence_reviews;
create policy "LCDBO governance managers can create evidence reviews" on public.lcdbo_delivery_evidence_reviews
  for insert with check (
    exists (
      select 1 from public.lcdbo_delivery_evidence_links e
      where e.id = lcdbo_delivery_evidence_reviews.evidence_link_id
        and public.lcdbo_can_manage_delivery_governance(e.programme_id)
    )
  );

drop policy if exists "LCDBO governance readers can read readiness assessments" on public.lcdbo_pilot_readiness_assessments;
create policy "LCDBO governance readers can read readiness assessments" on public.lcdbo_pilot_readiness_assessments
  for select using (public.lcdbo_can_view_delivery_governance(programme_id));
drop policy if exists "LCDBO governance managers can manage readiness assessments" on public.lcdbo_pilot_readiness_assessments;
create policy "LCDBO governance managers can manage readiness assessments" on public.lcdbo_pilot_readiness_assessments
  for all using (public.lcdbo_can_manage_delivery_governance(programme_id))
  with check (public.lcdbo_can_manage_delivery_governance(programme_id));

drop policy if exists "LCDBO governance readers can read readiness dimensions" on public.lcdbo_pilot_readiness_dimensions;
create policy "LCDBO governance readers can read readiness dimensions" on public.lcdbo_pilot_readiness_dimensions
  for select using (
    exists (
      select 1 from public.lcdbo_pilot_readiness_assessments a
      where a.id = lcdbo_pilot_readiness_dimensions.assessment_id
        and public.lcdbo_can_view_delivery_governance(a.programme_id)
    )
  );
drop policy if exists "LCDBO governance managers can manage readiness dimensions" on public.lcdbo_pilot_readiness_dimensions;
create policy "LCDBO governance managers can manage readiness dimensions" on public.lcdbo_pilot_readiness_dimensions
  for all using (
    exists (
      select 1 from public.lcdbo_pilot_readiness_assessments a
      where a.id = lcdbo_pilot_readiness_dimensions.assessment_id
        and public.lcdbo_can_manage_delivery_governance(a.programme_id)
    )
  )
  with check (
    exists (
      select 1 from public.lcdbo_pilot_readiness_assessments a
      where a.id = lcdbo_pilot_readiness_dimensions.assessment_id
        and public.lcdbo_can_manage_delivery_governance(a.programme_id)
    )
  );

revoke all on table public.lcdbo_delivery_health_overrides from anon;
revoke all on table public.lcdbo_delivery_evidence_links from anon;
revoke all on table public.lcdbo_delivery_evidence_reviews from anon;
revoke all on table public.lcdbo_pilot_readiness_assessments from anon;
revoke all on table public.lcdbo_pilot_readiness_dimensions from anon;

grant select, insert, update on table public.lcdbo_delivery_health_overrides to authenticated;
grant select, insert, update on table public.lcdbo_delivery_evidence_links to authenticated;
grant select, insert on table public.lcdbo_delivery_evidence_reviews to authenticated;
grant select, insert, update on table public.lcdbo_pilot_readiness_assessments to authenticated;
grant select, insert, update on table public.lcdbo_pilot_readiness_dimensions to authenticated;
