-- Read-only pre-deployment audit. Run against the actual DBIN database and
-- compare with supabase/migrations before applying the engagement migration.
select current_database() as database_name, current_setting('server_version') as postgres_version;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('users', 'msmes', 'institutions', 'institution_members',
                     'role_assignments', 'programmes', 'programme_enrolments',
                     'impact_programmes', 'impact_user_programme_assignments',
                     'institution_engagements')
order by table_name, ordinal_position;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('users', 'msmes', 'institutions', 'institution_members',
                    'role_assignments', 'impact_programmes', 'impact_assessments',
                    'institution_engagements', 'institution_engagement_events')
order by c.relname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('users', 'msmes', 'institutions', 'institution_members',
                    'impact_programmes', 'impact_assessments',
                    'institution_engagements', 'institution_engagement_events')
order by tablename, policyname;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.institutions'::regclass, 'public.institution_members'::regclass)
order by table_name, conname;
