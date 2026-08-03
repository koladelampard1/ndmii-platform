-- LCDBO National LGA Anchor-Product and Cluster Catalogue Governance Foundation.
-- Additive only. This migration prepares governed source intelligence,
-- anchor-product assessment, and public-cluster publication metadata.
-- It does not publish anchor products, create 774 clusters, or apply the
-- attached RMRDC source rows automatically.

alter table public.industrial_clusters
  add column if not exists public_reference text,
  add column if not exists public_slug text,
  add column if not exists public_summary text,
  add column if not exists public_visibility text not null default 'private',
  add column if not exists publication_status text not null default 'unpublished',
  add column if not exists data_classification text not null default 'internal_programme_record',
  add column if not exists publication_approved_by uuid references public.users(id) on delete set null,
  add column if not exists publication_approved_at timestamptz,
  add column if not exists last_public_reviewed_at timestamptz,
  add column if not exists source_methodology_note text;

alter table public.industrial_clusters drop constraint if exists industrial_clusters_public_visibility_check;
alter table public.industrial_clusters
  add constraint industrial_clusters_public_visibility_check check (
    public_visibility in ('private', 'internal', 'opportunity_explorer', 'public_catalogue')
  );

alter table public.industrial_clusters drop constraint if exists industrial_clusters_publication_status_check;
alter table public.industrial_clusters
  add constraint industrial_clusters_publication_status_check check (
    publication_status in ('unpublished', 'draft', 'under_review', 'approved', 'published', 'unpublished_by_review', 'archived')
  );

alter table public.industrial_clusters drop constraint if exists industrial_clusters_data_classification_check;
alter table public.industrial_clusters
  add constraint industrial_clusters_data_classification_check check (
    data_classification in (
      'live_operational_data',
      'approved_programme_record',
      'configured_target',
      'governed_estimate',
      'proposed_opportunity',
      'illustrative_example',
      'reference_geography',
      'synthetic_uat_data',
      'unverified_unknown_provenance',
      'internal_programme_record'
    )
  );

alter table public.industrial_clusters drop constraint if exists industrial_clusters_public_catalogue_check;
alter table public.industrial_clusters
  add constraint industrial_clusters_public_catalogue_check check (
    public_visibility <> 'public_catalogue'
    or (
      publication_status = 'published'
      and public_reference is not null
      and nullif(trim(public_reference), '') is not null
      and public_slug is not null
      and nullif(trim(public_slug), '') is not null
      and publication_approved_by is not null
      and publication_approved_at is not null
      and data_classification in ('approved_programme_record', 'live_operational_data')
    )
  );

create unique index if not exists idx_industrial_clusters_public_reference
  on public.industrial_clusters(public_reference)
  where public_reference is not null;

create unique index if not exists idx_industrial_clusters_public_slug
  on public.industrial_clusters(public_slug)
  where public_slug is not null;

create index if not exists idx_industrial_clusters_public_catalogue
  on public.industrial_clusters(programme_id, public_visibility, publication_status)
  where public_visibility = 'public_catalogue';

create table if not exists public.lcdbo_source_documents (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  title text not null,
  source_institution text not null,
  prepared_by text,
  publication_date date,
  document_date_label text,
  document_type text not null default 'rmrdc_lga_investment_profile',
  source_classification text not null default 'RMRDC Reference Source — 2017',
  provenance_note text,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  registered_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_source_documents_type_check check (document_type in ('rmrdc_lga_investment_profile', 'spreadsheet', 'field_report', 'institutional_approval', 'other'))
);

create table if not exists public.lcdbo_source_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.lcdbo_source_documents(id) on delete cascade,
  batch_key text not null unique,
  extraction_method text not null,
  methodology_version text not null,
  source_row_count integer not null default 0,
  extracted_state_count integer not null default 0,
  canonical_lga_matched_count integer not null default 0,
  exact_match_count integer not null default 0,
  alias_match_count integer not null default 0,
  ambiguous_count integer not null default 0,
  missing_canonical_lga_count integer not null default 0,
  import_status text not null default 'staged',
  extraction_report jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  imported_by uuid references public.users(id) on delete set null,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_source_import_batches_status_check check (import_status in ('staged', 'imported', 'review_required', 'rejected', 'superseded'))
);

create table if not exists public.lcdbo_lga_source_aliases (
  id uuid primary key default gen_random_uuid(),
  source_state_label text not null,
  source_lga_label text not null,
  canonical_state_id uuid references public.states(id) on delete set null,
  canonical_lga_id uuid references public.lgas(id) on delete set null,
  reconciliation_status text not null default 'unmapped',
  reconciliation_note text,
  confidence_score numeric(4,3),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_lga_source_aliases_unique_source unique (source_state_label, source_lga_label),
  constraint lcdbo_lga_source_aliases_reconciliation_check check (reconciliation_status in ('exact', 'alias', 'ambiguous', 'unmapped', 'missing_from_canonical', 'requires_review'))
);

create table if not exists public.lcdbo_lga_resource_source_rows (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.lcdbo_source_documents(id) on delete cascade,
  import_batch_id uuid references public.lcdbo_source_import_batches(id) on delete set null,
  source_row_id text not null unique,
  source_page integer not null,
  source_serial integer,
  source_state_label text not null,
  source_lga_label text not null,
  canonical_state_id uuid references public.states(id) on delete set null,
  canonical_lga_id uuid references public.lgas(id) on delete set null,
  reconciliation_status text not null default 'unmapped',
  reconciliation_note text,
  original_raw_material_text text not null,
  original_investment_opportunity_text text not null,
  source_text text not null,
  extraction_status text not null default 'extracted',
  extraction_confidence text not null default 'requires_review',
  source_classification text not null default 'RMRDC Reference Source — 2017',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_lga_resource_source_rows_page_check check (source_page > 0),
  constraint lcdbo_lga_resource_source_rows_reconciliation_check check (reconciliation_status in ('exact', 'alias', 'ambiguous', 'unmapped', 'missing_from_canonical', 'requires_review')),
  constraint lcdbo_lga_resource_source_rows_extraction_check check (extraction_status in ('extracted', 'reviewed', 'rejected', 'superseded'))
);

create table if not exists public.lcdbo_raw_materials (
  id uuid primary key default gen_random_uuid(),
  material_key text not null unique,
  canonical_name text not null,
  category text not null default 'unclassified',
  aliases text[] not null default '{}'::text[],
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_raw_materials_status_check check (status in ('active', 'inactive', 'requires_review', 'archived'))
);

create table if not exists public.lcdbo_lga_raw_material_evidence (
  id uuid primary key default gen_random_uuid(),
  source_row_id uuid not null references public.lcdbo_lga_resource_source_rows(id) on delete cascade,
  raw_material_id uuid references public.lcdbo_raw_materials(id) on delete set null,
  source_raw_material_text text not null,
  canonical_state_id uuid references public.states(id) on delete set null,
  canonical_lga_id uuid references public.lgas(id) on delete set null,
  evidence_status text not null default 'source_listed',
  confidence text not null default 'requires_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_lga_raw_material_evidence_status_check check (evidence_status in ('source_listed', 'normalised', 'rejected', 'superseded')),
  constraint lcdbo_lga_raw_material_evidence_confidence_check check (confidence in ('high', 'medium', 'requires_review'))
);

create table if not exists public.lcdbo_resource_investment_opportunities (
  id uuid primary key default gen_random_uuid(),
  source_row_id uuid references public.lcdbo_lga_resource_source_rows(id) on delete set null,
  canonical_state_id uuid references public.states(id) on delete set null,
  canonical_lga_id uuid references public.lgas(id) on delete set null,
  raw_material_id uuid references public.lcdbo_raw_materials(id) on delete set null,
  opportunity_text text not null,
  opportunity_classification text not null default 'proposed_opportunity',
  publication_status text not null default 'unpublished',
  public_visibility text not null default 'internal',
  methodology_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_resource_investment_opportunities_classification_check check (opportunity_classification in ('source_listed_opportunity', 'candidate_opportunity', 'proposed_opportunity', 'approved_programme_record')),
  constraint lcdbo_resource_investment_opportunities_publication_check check (publication_status in ('unpublished', 'draft', 'under_review', 'published', 'archived')),
  constraint lcdbo_resource_investment_opportunities_visibility_check check (public_visibility in ('internal', 'opportunity_explorer', 'public_catalogue'))
);

create table if not exists public.lcdbo_anchor_product_candidates (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  canonical_state_id uuid not null references public.states(id) on delete restrict,
  canonical_lga_id uuid not null references public.lgas(id) on delete restrict,
  raw_material_id uuid references public.lcdbo_raw_materials(id) on delete set null,
  source_row_id uuid references public.lcdbo_lga_resource_source_rows(id) on delete set null,
  candidate_product_name text not null,
  candidate_status text not null default 'candidate',
  selection_methodology text,
  assessment_factors jsonb not null default '{}'::jsonb,
  reviewer_recommendation text,
  recommended_by uuid references public.users(id) on delete set null,
  recommended_at timestamptz,
  approval_status text not null default 'pending_validation',
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  effective_from date,
  superseded_at timestamptz,
  superseded_by_candidate_id uuid references public.lcdbo_anchor_product_candidates(id) on delete set null,
  override_reason text,
  public_visibility text not null default 'internal',
  publication_status text not null default 'unpublished',
  data_classification text not null default 'candidate_anchor_product',
  last_reviewed_at timestamptz,
  methodology_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_anchor_product_candidates_status_check check (candidate_status in ('extracted', 'reconciled', 'candidate', 'under_assessment', 'recommended', 'institutionally_approved', 'published', 'superseded', 'archived', 'rejected')),
  constraint lcdbo_anchor_product_candidates_approval_check check (approval_status in ('pending_validation', 'under_assessment', 'recommended', 'approved', 'rejected', 'returned_for_information', 'superseded')),
  constraint lcdbo_anchor_product_candidates_public_visibility_check check (public_visibility in ('internal', 'opportunity_explorer', 'public_catalogue')),
  constraint lcdbo_anchor_product_candidates_publication_check check (publication_status in ('unpublished', 'draft', 'under_review', 'published', 'archived')),
  constraint lcdbo_anchor_product_candidates_approved_check check (
    approval_status <> 'approved'
    or (
      approved_by is not null
      and approved_at is not null
      and effective_from is not null
      and superseded_at is null
    )
  )
);

create unique index if not exists idx_lcdbo_anchor_one_current_approved_per_lga
  on public.lcdbo_anchor_product_candidates(programme_id, canonical_lga_id)
  where approval_status = 'approved' and superseded_at is null;

create index if not exists idx_lcdbo_anchor_candidates_queue
  on public.lcdbo_anchor_product_candidates(programme_id, approval_status, candidate_status);

create table if not exists public.lcdbo_anchor_product_decision_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.lcdbo_anchor_product_candidates(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  decision_type text not null,
  previous_status text,
  new_status text not null,
  decision_note text,
  override_reason text,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint lcdbo_anchor_product_decision_type_check check (decision_type in ('candidate_created', 'assessment_submitted', 'recommended', 'approved', 'rejected', 'returned_for_information', 'override_applied', 'superseded', 'published', 'unpublished'))
);

create table if not exists public.lcdbo_cluster_publications (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  cluster_id uuid not null references public.industrial_clusters(id) on delete cascade,
  anchor_product_candidate_id uuid references public.lcdbo_anchor_product_candidates(id) on delete set null,
  canonical_state_id uuid references public.states(id) on delete set null,
  canonical_lga_id uuid references public.lgas(id) on delete set null,
  public_reference text not null unique,
  public_slug text not null unique,
  public_title text not null,
  public_summary text not null,
  publication_status text not null default 'draft',
  public_visibility text not null default 'internal',
  data_classification text not null default 'approved_programme_record',
  methodology_version text,
  methodology_note text,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lcdbo_cluster_publications_status_check check (publication_status in ('draft', 'under_review', 'approved', 'published', 'unpublished', 'archived')),
  constraint lcdbo_cluster_publications_visibility_check check (public_visibility in ('internal', 'opportunity_explorer', 'public_catalogue')),
  constraint lcdbo_cluster_publications_publish_check check (
    publication_status <> 'published'
    or (
      public_visibility = 'public_catalogue'
      and approved_by is not null
      and approved_at is not null
      and published_at is not null
      and data_classification in ('approved_programme_record', 'live_operational_data')
    )
  )
);

create unique index if not exists idx_lcdbo_cluster_publications_one_published
  on public.lcdbo_cluster_publications(cluster_id)
  where publication_status = 'published' and public_visibility = 'public_catalogue';

create or replace function public.lcdbo_can_govern_anchor_products(target_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.lcdbo_can_review_programme(target_programme_id)
$$;

create or replace function public.lcdbo_can_read_anchor_governance(target_programme_id uuid)
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
            and ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin', 'data_analyst', 'auditor', 'observer')
            and (
              (ra.scope_type = 'global' and ra.role in ('admin', 'super_admin', 'programme_officer'))
              or (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
            )
        )
      )
  )
$$;

revoke all on function public.lcdbo_can_govern_anchor_products(uuid) from public;
grant execute on function public.lcdbo_can_govern_anchor_products(uuid) to authenticated;
revoke all on function public.lcdbo_can_read_anchor_governance(uuid) from public;
grant execute on function public.lcdbo_can_read_anchor_governance(uuid) to authenticated;

alter table public.lcdbo_source_documents enable row level security;
alter table public.lcdbo_source_import_batches enable row level security;
alter table public.lcdbo_lga_source_aliases enable row level security;
alter table public.lcdbo_lga_resource_source_rows enable row level security;
alter table public.lcdbo_raw_materials enable row level security;
alter table public.lcdbo_lga_raw_material_evidence enable row level security;
alter table public.lcdbo_resource_investment_opportunities enable row level security;
alter table public.lcdbo_anchor_product_candidates enable row level security;
alter table public.lcdbo_anchor_product_decision_history enable row level security;
alter table public.lcdbo_cluster_publications enable row level security;

revoke all on table public.lcdbo_source_documents from anon;
revoke all on table public.lcdbo_source_import_batches from anon;
revoke all on table public.lcdbo_lga_source_aliases from anon;
revoke all on table public.lcdbo_lga_resource_source_rows from anon;
revoke all on table public.lcdbo_raw_materials from anon;
revoke all on table public.lcdbo_lga_raw_material_evidence from anon;
revoke all on table public.lcdbo_resource_investment_opportunities from anon;
revoke all on table public.lcdbo_anchor_product_candidates from anon;
revoke all on table public.lcdbo_anchor_product_decision_history from anon;
revoke all on table public.lcdbo_cluster_publications from anon;

grant select on table public.lcdbo_source_documents to authenticated;
grant select on table public.lcdbo_source_import_batches to authenticated;
grant select on table public.lcdbo_lga_source_aliases to authenticated;
grant select on table public.lcdbo_lga_resource_source_rows to authenticated;
grant select on table public.lcdbo_raw_materials to authenticated;
grant select on table public.lcdbo_lga_raw_material_evidence to authenticated;
grant select on table public.lcdbo_resource_investment_opportunities to authenticated;
grant select on table public.lcdbo_anchor_product_candidates to authenticated;
grant select on table public.lcdbo_anchor_product_decision_history to authenticated;
grant select on table public.lcdbo_cluster_publications to authenticated;

grant insert, update on table public.lcdbo_lga_source_aliases to authenticated;
grant insert, update on table public.lcdbo_anchor_product_candidates to authenticated;
grant insert on table public.lcdbo_anchor_product_decision_history to authenticated;
grant insert, update on table public.lcdbo_cluster_publications to authenticated;

drop policy if exists "LCDBO reviewers can read source documents" on public.lcdbo_source_documents;
create policy "LCDBO reviewers can read source documents"
  on public.lcdbo_source_documents for select
  using (
    exists (
      select 1
      from public.programmes p
      where p.slug = 'local-content-development-beyond-oil'
        and public.lcdbo_can_read_anchor_governance(p.id)
    )
  );

drop policy if exists "LCDBO reviewers can read import batches" on public.lcdbo_source_import_batches;
create policy "LCDBO reviewers can read import batches"
  on public.lcdbo_source_import_batches for select
  using (
    exists (
      select 1
      from public.programmes p
      where p.slug = 'local-content-development-beyond-oil'
        and public.lcdbo_can_read_anchor_governance(p.id)
    )
  );

drop policy if exists "LCDBO reviewers can read LGA source aliases" on public.lcdbo_lga_source_aliases;
create policy "LCDBO reviewers can read LGA source aliases"
  on public.lcdbo_lga_source_aliases for select
  using (
    exists (
      select 1
      from public.programmes p
      where p.slug = 'local-content-development-beyond-oil'
        and public.lcdbo_can_read_anchor_governance(p.id)
    )
  );

drop policy if exists "LCDBO reviewers can manage LGA source aliases" on public.lcdbo_lga_source_aliases;
create policy "LCDBO reviewers can manage LGA source aliases"
  on public.lcdbo_lga_source_aliases for all
  using (
    exists (
      select 1
      from public.programmes p
      where p.slug = 'local-content-development-beyond-oil'
        and public.lcdbo_can_govern_anchor_products(p.id)
    )
  )
  with check (
    exists (
      select 1
      from public.programmes p
      where p.slug = 'local-content-development-beyond-oil'
        and public.lcdbo_can_govern_anchor_products(p.id)
    )
  );

drop policy if exists "LCDBO reviewers can read source rows" on public.lcdbo_lga_resource_source_rows;
create policy "LCDBO reviewers can read source rows"
  on public.lcdbo_lga_resource_source_rows for select
  using (
    exists (
      select 1
      from public.programmes p
      where p.slug = 'local-content-development-beyond-oil'
        and public.lcdbo_can_read_anchor_governance(p.id)
    )
  );

drop policy if exists "LCDBO reviewers can read raw material taxonomy" on public.lcdbo_raw_materials;
create policy "LCDBO reviewers can read raw material taxonomy"
  on public.lcdbo_raw_materials for select
  using (
    exists (
      select 1
      from public.programmes p
      where p.slug = 'local-content-development-beyond-oil'
        and public.lcdbo_can_read_anchor_governance(p.id)
    )
  );

drop policy if exists "LCDBO reviewers can read material evidence" on public.lcdbo_lga_raw_material_evidence;
create policy "LCDBO reviewers can read material evidence"
  on public.lcdbo_lga_raw_material_evidence for select
  using (
    exists (
      select 1
      from public.programmes p
      where p.slug = 'local-content-development-beyond-oil'
        and public.lcdbo_can_read_anchor_governance(p.id)
    )
  );

drop policy if exists "LCDBO reviewers can read resource opportunities" on public.lcdbo_resource_investment_opportunities;
create policy "LCDBO reviewers can read resource opportunities"
  on public.lcdbo_resource_investment_opportunities for select
  using (
    public_visibility in ('opportunity_explorer', 'public_catalogue')
    or exists (
      select 1
      from public.programmes p
      where p.slug = 'local-content-development-beyond-oil'
        and public.lcdbo_can_read_anchor_governance(p.id)
    )
  );

drop policy if exists "LCDBO reviewers can read anchor candidates" on public.lcdbo_anchor_product_candidates;
create policy "LCDBO reviewers can read anchor candidates"
  on public.lcdbo_anchor_product_candidates for select
  using (public.lcdbo_can_read_anchor_governance(programme_id) or public_visibility in ('opportunity_explorer', 'public_catalogue'));

drop policy if exists "LCDBO reviewers can manage anchor candidates" on public.lcdbo_anchor_product_candidates;
create policy "LCDBO reviewers can manage anchor candidates"
  on public.lcdbo_anchor_product_candidates for all
  using (public.lcdbo_can_govern_anchor_products(programme_id))
  with check (public.lcdbo_can_govern_anchor_products(programme_id));

drop policy if exists "LCDBO reviewers can read anchor history" on public.lcdbo_anchor_product_decision_history;
create policy "LCDBO reviewers can read anchor history"
  on public.lcdbo_anchor_product_decision_history for select
  using (public.lcdbo_can_read_anchor_governance(programme_id));

drop policy if exists "LCDBO reviewers can create anchor history" on public.lcdbo_anchor_product_decision_history;
create policy "LCDBO reviewers can create anchor history"
  on public.lcdbo_anchor_product_decision_history for insert
  with check (public.lcdbo_can_govern_anchor_products(programme_id));

drop policy if exists "Public can read published cluster publications" on public.lcdbo_cluster_publications;
create policy "Public can read published cluster publications"
  on public.lcdbo_cluster_publications for select
  using (publication_status = 'published' and public_visibility = 'public_catalogue');

drop policy if exists "LCDBO readers can read cluster publications" on public.lcdbo_cluster_publications;
create policy "LCDBO readers can read cluster publications"
  on public.lcdbo_cluster_publications for select
  using (public.lcdbo_can_read_anchor_governance(programme_id));

drop policy if exists "LCDBO reviewers can manage cluster publications" on public.lcdbo_cluster_publications;
create policy "LCDBO reviewers can manage cluster publications"
  on public.lcdbo_cluster_publications for all
  using (public.lcdbo_can_govern_anchor_products(programme_id))
  with check (public.lcdbo_can_govern_anchor_products(programme_id));

drop trigger if exists set_lcdbo_source_documents_updated_at on public.lcdbo_source_documents;
create trigger set_lcdbo_source_documents_updated_at before update on public.lcdbo_source_documents
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_source_import_batches_updated_at on public.lcdbo_source_import_batches;
create trigger set_lcdbo_source_import_batches_updated_at before update on public.lcdbo_source_import_batches
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_lga_source_aliases_updated_at on public.lcdbo_lga_source_aliases;
create trigger set_lcdbo_lga_source_aliases_updated_at before update on public.lcdbo_lga_source_aliases
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_lga_resource_source_rows_updated_at on public.lcdbo_lga_resource_source_rows;
create trigger set_lcdbo_lga_resource_source_rows_updated_at before update on public.lcdbo_lga_resource_source_rows
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_raw_materials_updated_at on public.lcdbo_raw_materials;
create trigger set_lcdbo_raw_materials_updated_at before update on public.lcdbo_raw_materials
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_lga_raw_material_evidence_updated_at on public.lcdbo_lga_raw_material_evidence;
create trigger set_lcdbo_lga_raw_material_evidence_updated_at before update on public.lcdbo_lga_raw_material_evidence
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_resource_investment_opportunities_updated_at on public.lcdbo_resource_investment_opportunities;
create trigger set_lcdbo_resource_investment_opportunities_updated_at before update on public.lcdbo_resource_investment_opportunities
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_anchor_product_candidates_updated_at on public.lcdbo_anchor_product_candidates;
create trigger set_lcdbo_anchor_product_candidates_updated_at before update on public.lcdbo_anchor_product_candidates
  for each row execute function public.set_platform_foundation_updated_at();
drop trigger if exists set_lcdbo_cluster_publications_updated_at on public.lcdbo_cluster_publications;
create trigger set_lcdbo_cluster_publications_updated_at before update on public.lcdbo_cluster_publications
  for each row execute function public.set_platform_foundation_updated_at();
