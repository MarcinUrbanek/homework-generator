create table public.profile_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.profile_roles enable row level security;

create policy "Users can read their own profile roles"
  on public.profile_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.profile_roles to authenticated;

insert into public.profile_roles (user_id, role)
select id, role
from public.profiles;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);

  insert into public.profile_roles (user_id, role)
  values (new.id, 'teacher');

  return new;
end;
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_roles
    where user_id = (select auth.uid())
      and role = 'teacher'
  );
$$;

alter table public.profiles drop column role;