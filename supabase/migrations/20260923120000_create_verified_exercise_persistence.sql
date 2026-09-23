create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'teacher' check (role in ('teacher', 'student')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

grant select on table public.profiles to authenticated;

insert into public.profiles (id, role)
select id, 'teacher'
from auth.users
on conflict (id) do nothing;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'teacher');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'teacher'
  );
$$;

revoke all on function public.is_teacher() from public;
grant execute on function public.is_teacher() to authenticated;

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  exercise_text text not null check (btrim(exercise_text) <> ''),
  canonical_answer text not null check (btrim(canonical_answer) <> ''),
  grade text not null check (btrim(grade) <> ''),
  topic text not null check (btrim(topic) <> ''),
  difficulty text not null check (btrim(difficulty) <> ''),
  verification_verdict text not null check (verification_verdict = 'unique_answer'),
  verifier_identity text not null check (btrim(verifier_identity) <> ''),
  verifier_version text not null check (btrim(verifier_version) <> ''),
  verified_at timestamptz not null,
  verification_rationale text not null check (btrim(verification_rationale) <> ''),
  creator_id uuid not null references auth.users (id),
  approver_id uuid not null references auth.users (id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "Teachers can read approved exercises"
  on public.exercises
  for select
  to authenticated
  using ((select public.is_teacher()));

create policy "Teachers can insert their approved exercises"
  on public.exercises
  for insert
  to authenticated
  with check (
    (select public.is_teacher())
    and creator_id = (select auth.uid())
    and approver_id = (select auth.uid())
  );

create policy "Creators can delete their exercises"
  on public.exercises
  for delete
  to authenticated
  using (
    (select public.is_teacher())
    and creator_id = (select auth.uid())
  );

grant select, insert, delete on table public.exercises to authenticated;