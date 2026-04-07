-- Quote workflow hardening: add decline status and workflow timestamps for provider quote operations.

alter table if exists provider_quotes
  add column if not exists reviewed_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_provider_quotes_updated_at on provider_quotes(updated_at desc);

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'provider_quotes'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status in%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('alter table provider_quotes drop constraint %I', constraint_name);
  END IF;

  alter table provider_quotes
    add constraint provider_quotes_status_check
    check (status in ('new', 'in_review', 'quoted', 'converted', 'closed', 'declined'));
END $$;
