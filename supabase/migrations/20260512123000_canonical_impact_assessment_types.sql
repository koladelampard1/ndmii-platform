-- Canonicalize accepted impact assessment types for new writes.
-- Additive and non-destructive: existing legacy rows are not rewritten.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'impact_assessments_type_check'
      and conrelid = 'public.impact_assessments'::regclass
  ) then
    alter table public.impact_assessments
      drop constraint impact_assessments_type_check;
  end if;

  alter table public.impact_assessments
    add constraint impact_assessments_type_check
    check (
      assessment_type in (
        'baseline',
        'credit_readiness',
        'business_maturity',
        'impact',
        'compliance',
        'post_funding_monitoring',
        'field_verification'
      )
    ) not valid;
end $$;
