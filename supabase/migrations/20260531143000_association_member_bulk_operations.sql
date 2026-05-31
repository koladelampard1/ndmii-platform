-- Associations Phase 4B: governed bulk lifecycle operations.
-- Member transitions remain enforced per row. This table stores operation summaries only.

create table if not exists public.association_member_bulk_operations (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  requested_by uuid references public.users(id) on delete set null,
  target_mode text not null check (target_mode in ('selected', 'filtered')),
  filter_snapshot jsonb not null default '{}'::jsonb,
  total_targeted integer not null default 0 check (total_targeted >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'completed_with_errors', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_association_member_bulk_operations_created_at
  on public.association_member_bulk_operations(created_at desc);
create index if not exists idx_association_member_bulk_operations_requested_by
  on public.association_member_bulk_operations(requested_by, created_at desc);
create index if not exists idx_association_member_bulk_operations_status
  on public.association_member_bulk_operations(status, created_at desc);

alter table public.association_member_bulk_operations enable row level security;

drop policy if exists "Association member bulk operation administrators read" on public.association_member_bulk_operations;
create policy "Association member bulk operation administrators read"
on public.association_member_bulk_operations for select
using (public.association_member_current_role() = 'admin');

drop policy if exists "Association member bulk operation administrators insert" on public.association_member_bulk_operations;
create policy "Association member bulk operation administrators insert"
on public.association_member_bulk_operations for insert
with check (public.association_member_current_role() = 'admin');

drop policy if exists "Association member bulk operation administrators update" on public.association_member_bulk_operations;
create policy "Association member bulk operation administrators update"
on public.association_member_bulk_operations for update
using (public.association_member_current_role() = 'admin')
with check (public.association_member_current_role() = 'admin');
