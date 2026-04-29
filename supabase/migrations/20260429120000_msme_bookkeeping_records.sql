create table if not exists msme_bookkeeping_records (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references msmes(id) on delete cascade,
  record_type text not null check (record_type in ('income','expense')),
  amount numeric not null check (amount > 0),
  category text not null,
  record_date date not null,
  description text,
  receipt_url text,
  receipt_filename text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_msme_bookkeeping_records_msme_id on msme_bookkeeping_records(msme_id);
create index if not exists idx_msme_bookkeeping_records_record_date on msme_bookkeeping_records(record_date);
create index if not exists idx_msme_bookkeeping_records_record_type on msme_bookkeeping_records(record_type);

alter table msme_bookkeeping_records enable row level security;

drop policy if exists "msme bookkeeping own select" on msme_bookkeeping_records;
create policy "msme bookkeeping own select" on msme_bookkeeping_records
for select using (
  exists (select 1 from msmes m where m.id = msme_bookkeeping_records.msme_id and m.created_by = auth.uid())
);

drop policy if exists "msme bookkeeping own insert" on msme_bookkeeping_records;
create policy "msme bookkeeping own insert" on msme_bookkeeping_records
for insert with check (
  exists (select 1 from msmes m where m.id = msme_bookkeeping_records.msme_id and m.created_by = auth.uid())
);

drop policy if exists "msme bookkeeping own update" on msme_bookkeeping_records;
create policy "msme bookkeeping own update" on msme_bookkeeping_records
for update using (
  exists (select 1 from msmes m where m.id = msme_bookkeeping_records.msme_id and m.created_by = auth.uid())
) with check (
  exists (select 1 from msmes m where m.id = msme_bookkeeping_records.msme_id and m.created_by = auth.uid())
);

drop policy if exists "msme bookkeeping own delete" on msme_bookkeeping_records;
create policy "msme bookkeeping own delete" on msme_bookkeeping_records
for delete using (
  exists (select 1 from msmes m where m.id = msme_bookkeeping_records.msme_id and m.created_by = auth.uid())
);

-- service role bypasses rls by default; explicit admin policy for authenticated admin users when JWT claim is present

drop policy if exists "admin manage bookkeeping" on msme_bookkeeping_records;
create policy "admin manage bookkeeping" on msme_bookkeeping_records
for all using (coalesce(auth.jwt() ->> 'role', '') = 'admin')
with check (coalesce(auth.jwt() ->> 'role', '') = 'admin');
