-- Corrective hardening for DBIN auth roles, complaint references, and association status values.
-- This migration intentionally does not add msmes.ndmii_id.

alter table if exists complaints
  add column if not exists related_reference text;

update associations
set status = lower(trim(status))
where status is not null
  and status <> lower(trim(status));

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'users'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.users drop constraint %I', constraint_record.conname);
  end loop;

  alter table public.users
    add constraint users_role_check
    check (
      role in (
        'public',
        'msme',
        'association_officer',
        'reviewer',
        'fccpc_officer',
        'firs_officer',
        'nrs_officer',
        'admin'
      )
    );
end $$;

create index if not exists idx_complaints_related_reference
  on complaints(related_reference)
  where related_reference is not null;

create index if not exists idx_associations_status
  on associations(status)
  where status is not null;
