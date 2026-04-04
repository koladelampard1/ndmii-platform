-- Demo MSME accounts mapped to seeded provider-owned MSMEs for reliable provider-side testing.
with demo_msme_accounts(email, display_name, msme_public_id) as (
  values
    ('msme.demo@ndmii.ng', 'Demo MSME User', 'NDMII-LAG-0003'),
    ('msme.eko@ndmii.ng', 'Chinedu Eze', 'NDMII-LAG-0001'),
    ('msme.arewa@ndmii.ng', 'Musa Idris', 'NDMII-KAN-0004'),
    ('msme.fct@ndmii.ng', 'Maryam Aliyu', 'NDMII-FCT-0010')
)
insert into users (email, full_name, role)
select email, display_name, 'msme'
from demo_msme_accounts
on conflict (email) do update set
  full_name = excluded.full_name,
  role = excluded.role;

with demo_accounts(email, role_name, display_name) as (
  values
    ('admin@ndmii.gov.ng', 'admin', 'Amina Bello'),
    ('reviewer@ndmii.gov.ng', 'reviewer', 'Ifeanyi Okoro'),
    ('officer@fccpc.gov.ng', 'fccpc_officer', 'Tolu Adebayo'),
    ('officer@firs.gov.ng', 'firs_officer', 'Kehinde Sani'),
    ('assoc.lagos@ndmii.ng', 'association_officer', 'Adaobi Nwosu'),
    ('msme.demo@ndmii.ng', 'msme', 'Demo MSME User'),
    ('msme.eko@ndmii.ng', 'msme', 'Chinedu Eze'),
    ('msme.arewa@ndmii.ng', 'msme', 'Musa Idris'),
    ('msme.fct@ndmii.ng', 'msme', 'Maryam Aliyu')
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

with msmes_to_map as (
  select
    m.id as msme_row_id,
    m.msme_id,
    lower(a.email) as email,
    a.display_name
  from msmes m
  join (
    values
      ('msme.demo@ndmii.ng', 'Demo MSME User', 'NDMII-LAG-0003'),
      ('msme.eko@ndmii.ng', 'Chinedu Eze', 'NDMII-LAG-0001'),
      ('msme.arewa@ndmii.ng', 'Musa Idris', 'NDMII-KAN-0004'),
      ('msme.fct@ndmii.ng', 'Maryam Aliyu', 'NDMII-FCT-0010')
  ) as a(email, display_name, msme_public_id)
    on m.msme_id = a.msme_public_id
), users_to_map as (
  select id, lower(email) as email
  from users
  where lower(email) in ('msme.demo@ndmii.ng', 'msme.eko@ndmii.ng', 'msme.arewa@ndmii.ng', 'msme.fct@ndmii.ng')
)
update msmes m
set created_by = u.id,
    contact_email = map.email,
    owner_name = coalesce(nullif(m.owner_name, ''), map.display_name)
from msmes_to_map map
join users_to_map u on u.email = map.email
where m.id = map.msme_row_id;
