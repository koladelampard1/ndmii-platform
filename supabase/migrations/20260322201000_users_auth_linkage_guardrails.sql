alter table if exists public.users
  add column if not exists auth_user_id uuid;

create index if not exists users_auth_user_id_idx
  on public.users (auth_user_id);

create unique index if not exists users_auth_user_id_unique_idx
  on public.users (auth_user_id)
  where auth_user_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_auth_user_id_unique'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_auth_user_id_unique
      unique using index users_auth_user_id_unique_idx;
  end if;
end
$$;
