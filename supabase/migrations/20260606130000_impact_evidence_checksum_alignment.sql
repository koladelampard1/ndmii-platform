-- Align early Evidence Phase 1 environments that used sha256_hash with the
-- canonical checksum_sha256 column used by the application contract.

alter table public.impact_evidence_files
  add column if not exists checksum_sha256 text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'impact_evidence_files'
      and column_name = 'sha256_hash'
  ) then
    execute '
      update public.impact_evidence_files
      set checksum_sha256 = coalesce(checksum_sha256, sha256_hash)
      where sha256_hash is not null
    ';
  end if;
end $$;

alter table public.impact_evidence_files
  drop constraint if exists impact_evidence_files_sha256_check;

alter table public.impact_evidence_files
  add constraint impact_evidence_files_sha256_check
  check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$');

drop index if exists public.idx_impact_evidence_files_sha256;

create index idx_impact_evidence_files_sha256
  on public.impact_evidence_files(checksum_sha256);
