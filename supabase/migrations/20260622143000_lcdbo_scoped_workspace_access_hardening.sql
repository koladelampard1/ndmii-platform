-- LCDBO Scoped Workspace Access Hardening.
-- Additive role support for low-privilege workspace identities and scoped
-- LCDBO read access through existing role_assignments.

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
    check (role in (
      'public',
      'msme',
      'association_officer',
      'reviewer',
      'boi_executive',
      'programme_officer',
      'assessment_officer',
      'field_officer',
      'data_analyst',
      'auditor',
      'workspace_user',
      'fccpc_officer',
      'nrs_officer',
      'firs_officer',
      'admin',
      'super_admin'
    ));
end $$;

create or replace function public.lcdbo_can_view_delivery_programme(target_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and (
        u.role in ('admin', 'super_admin', 'programme_officer', 'assessment_officer', 'field_officer', 'data_analyst', 'auditor')
        or exists (
          select 1
          from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin', 'assessment_officer', 'field_officer', 'data_analyst', 'auditor', 'observer')
            and (
              ra.scope_type = 'global'
              or (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
            )
        )
      )
  )
$$;

revoke all on function public.lcdbo_can_view_delivery_programme(uuid) from public;
grant execute on function public.lcdbo_can_view_delivery_programme(uuid) to authenticated;

create or replace function public.lcdbo_can_view_intelligence(target_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and (
        u.role in ('admin', 'super_admin', 'programme_officer', 'boi_executive', 'auditor', 'data_analyst')
        or exists (
          select 1
          from public.role_assignments ra
          where ra.user_id = u.id
            and ra.status = 'active'
            and (ra.expires_at is null or ra.expires_at > now())
            and ra.role in ('admin', 'super_admin', 'programme_officer', 'institution_admin', 'observer', 'auditor', 'data_analyst')
            and (
              ra.scope_type = 'global'
              or (ra.scope_type = 'programme' and ra.scope_id = target_programme_id)
            )
        )
      )
  )
$$;

revoke all on function public.lcdbo_can_view_intelligence(uuid) from public;
grant execute on function public.lcdbo_can_view_intelligence(uuid) to authenticated;
