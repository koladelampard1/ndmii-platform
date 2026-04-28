do $$
begin
  if to_regclass('public.finance_readiness_assessments') is null then
    raise notice 'finance_readiness_assessments table does not exist; skipping band/readiness_band alignment.';
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_readiness_assessments'
      and column_name = 'band'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_readiness_assessments'
      and column_name = 'readiness_band'
  ) then
    alter table public.finance_readiness_assessments
      add column readiness_band text;

    update public.finance_readiness_assessments
    set readiness_band = band
    where readiness_band is null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_readiness_assessments'
      and column_name = 'readiness_band'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_readiness_assessments'
      and column_name = 'band'
  ) then
    alter table public.finance_readiness_assessments
      add column band text;

    update public.finance_readiness_assessments
    set band = readiness_band
    where band is null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_readiness_assessments'
      and column_name = 'readiness_band'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_readiness_assessments'
      and column_name = 'band'
  ) then
    update public.finance_readiness_assessments
    set readiness_band = coalesce(readiness_band, band),
        band = coalesce(band, readiness_band)
    where readiness_band is null
       or band is null;
  end if;
end
$$;
