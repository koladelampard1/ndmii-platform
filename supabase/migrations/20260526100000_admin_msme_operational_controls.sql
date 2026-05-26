alter table public.msmes
  add column if not exists operational_review_requested boolean not null default false,
  add column if not exists operational_escalated boolean not null default false,
  add column if not exists latest_admin_action text,
  add column if not exists latest_admin_action_at timestamptz,
  add column if not exists latest_admin_action_by uuid references public.users(id) on delete set null;

create table if not exists public.admin_internal_notes (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  author_role text not null,
  note_body text not null check (length(trim(note_body)) > 0),
  visibility text not null default 'admin_internal' check (visibility = 'admin_internal'),
  created_at timestamptz not null default now()
);

create index if not exists admin_internal_notes_msme_created_idx
  on public.admin_internal_notes(msme_id, created_at desc);

alter table public.admin_internal_notes enable row level security;

drop policy if exists "Regulator admins can read internal notes" on public.admin_internal_notes;
create policy "Regulator admins can read internal notes"
on public.admin_internal_notes
for select
using (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role in ('admin', 'reviewer', 'fccpc_officer', 'firs_officer')
  )
);

drop policy if exists "Server workflows insert internal notes" on public.admin_internal_notes;
create policy "Server workflows insert internal notes"
on public.admin_internal_notes
for insert
with check (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role in ('admin', 'reviewer')
  )
);
