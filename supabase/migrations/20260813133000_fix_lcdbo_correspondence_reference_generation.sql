-- LCDBO Correspondence Management reference-generation correction.
-- Additive patch for 20260813120000_lcdbo_correspondence_management.sql.
--
-- Fixes PL/pgSQL ambiguity between the local reference-year variable and the
-- lcdbo_correspondence_reference_counters.reference_year column while
-- preserving the approved issuer/year/direction sequence partitioning.

create or replace function public.generate_lcdbo_correspondence_reference(
  target_issuer text,
  target_direction text,
  registered_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_programme_id uuid;
  target_reference_year integer;
  next_sequence integer;
begin
  if target_issuer not in ('JNT', 'RMRDC', 'RFNL') then
    raise exception 'Invalid LCDBO correspondence issuer.';
  end if;

  if target_direction not in ('IN', 'OUT') then
    raise exception 'Invalid LCDBO correspondence direction.';
  end if;

  select p.id into target_programme_id
  from public.programmes as p
  where p.slug = 'local-content-development-beyond-oil'
  limit 1;

  if target_programme_id is null then
    raise exception 'LCDBO programme is not configured.';
  end if;

  target_reference_year := extract(year from registered_at)::integer;

  insert into public.lcdbo_correspondence_reference_counters as c (
    programme_id,
    issuer,
    direction,
    reference_year,
    last_sequence
  )
  values (
    target_programme_id,
    target_issuer,
    target_direction,
    target_reference_year,
    1
  )
  on conflict (programme_id, issuer, direction, reference_year)
  do update set
    last_sequence = c.last_sequence + 1,
    updated_at = now()
  returning c.last_sequence into next_sequence;

  return format(
    'LCDBO/%s/%s/%s/%s',
    target_issuer,
    target_reference_year,
    target_direction,
    lpad(next_sequence::text, 6, '0')
  );
end;
$$;

revoke all on function public.generate_lcdbo_correspondence_reference(text, text, timestamptz) from public;
grant execute on function public.generate_lcdbo_correspondence_reference(text, text, timestamptz) to authenticated;
