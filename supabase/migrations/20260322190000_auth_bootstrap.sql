alter table if exists users
  add column if not exists auth_user_id uuid unique;

insert into users (email, full_name, role)
values ('msme.demo@ndmii.ng', 'Demo MSME User', 'msme')
on conflict (email) do nothing;

with demo_accounts(email, role_name, display_name) as (
  values
    ('admin@ndmii.gov.ng', 'admin', 'Amina Bello'),
    ('reviewer@ndmii.gov.ng', 'reviewer', 'Ifeanyi Okoro'),
    ('officer@fccpc.gov.ng', 'fccpc_officer', 'Tolu Adebayo'),
    ('officer@firs.gov.ng', 'firs_officer', 'Kehinde Sani'),
    ('assoc.lagos@ndmii.ng', 'association_officer', 'Adaobi Nwosu'),
    ('msme.demo@ndmii.ng', 'msme', 'Demo MSME User')
), inserted_auth as (
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    d.email,
    crypt('Demo@123456', gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', d.display_name, 'role', d.role_name),
    now(),
    now(),
    '',
    ''
  from demo_accounts d
  where not exists (select 1 from auth.users au where au.email = d.email)
  returning id, email
), linked_users as (
  select id, email from inserted_auth
  union all
  select au.id, au.email from auth.users au join demo_accounts d on d.email = au.email
)
update users u
set auth_user_id = lu.id
from linked_users lu
where u.email = lu.email
  and u.auth_user_id is distinct from lu.id;
