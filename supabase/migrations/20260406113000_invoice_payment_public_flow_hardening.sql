-- Sprint 4 extension: harden invoice payment simulation schema for public payment flows

alter table if exists invoices
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists invoice_payments
  add column if not exists payment_method text not null default 'card',
  add column if not exists payment_status text not null default 'initiated',
  add column if not exists amount numeric(14,2) not null default 0,
  add column if not exists paid_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table if exists invoice_events
  add column if not exists actor_role text,
  add column if not exists actor_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoice_payments_payment_status_check'
      and conrelid = 'invoice_payments'::regclass
  ) then
    alter table invoice_payments
      add constraint invoice_payments_payment_status_check
      check (payment_status in ('initiated', 'pending', 'success', 'failed', 'refunded'));
  end if;
end $$;

create index if not exists idx_invoice_payments_invoice_id on invoice_payments(invoice_id);
create index if not exists idx_invoice_payments_status on invoice_payments(payment_status);
create index if not exists idx_invoice_events_invoice_id on invoice_events(invoice_id);
