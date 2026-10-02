begin;

select plan(12);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('40000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'role-teacher@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('40000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'role-dual@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('40000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'role-student@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now());

delete from public.profile_roles
where user_id = '40000000-0000-0000-0000-000000000003'
  and role = 'teacher';

insert into public.profile_roles (user_id, role)
values
  ('40000000-0000-0000-0000-000000000002', 'student'),
  ('40000000-0000-0000-0000-000000000003', 'student');

select ok(to_regclass('public.profile_roles') is not null, 'Profile roles relation exists');

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ),
  'The obsolete profile role column is removed after migration'
);

select is(
  (select string_agg(role, ',' order by role) from public.profile_roles where user_id = '40000000-0000-0000-0000-000000000001'),
  'teacher',
  'A migrated teacher-only account retains teacher access'
);

select is(
  (select string_agg(role, ',' order by role) from public.profile_roles where user_id = '40000000-0000-0000-0000-000000000003'),
  'student',
  'A migrated student-only account retains student access'
);

select is(
  (select string_agg(role, ',' order by role) from public.profile_roles where user_id = '40000000-0000-0000-0000-000000000002'),
  'student,teacher',
  'An account can hold both roles'
);

select throws_ok(
  $$insert into public.profile_roles (user_id, role) values ('40000000-0000-0000-0000-000000000001', 'administrator')$$,
  '23514',
  null,
  'Profile roles reject unsupported values'
);

select throws_ok(
  $$insert into public.profile_roles (user_id, role) values ('40000000-0000-0000-0000-000000000001', 'teacher')$$,
  '23505',
  null,
  'A user can have each role only once'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

select ok((select public.is_teacher()), 'Teacher-only account is recognized as a teacher');
select is((select count(*) from public.profile_roles), 1::bigint, 'Users can read only their own roles');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);

select ok((select public.is_teacher()), 'Dual-role account retains teacher access');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);

select ok(not (select public.is_teacher()), 'Student-only account is not a teacher');
select throws_ok(
  $$insert into public.profile_roles (user_id, role) values ('40000000-0000-0000-0000-000000000003', 'teacher')$$,
  '42501',
  null,
  'Authenticated users cannot grant themselves roles'
);

select * from finish();
rollback;