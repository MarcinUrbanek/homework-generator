begin;

select plan(21);

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
  ('50000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'membership-teacher@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'membership-student@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'membership-other@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'membership-second-teacher@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now());

delete from public.profile_roles
where user_id in (
  '50000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000003',
  '50000000-0000-0000-0000-000000000004'
);

insert into public.profile_roles (user_id, role)
values
  ('50000000-0000-0000-0000-000000000001', 'teacher'),
  ('50000000-0000-0000-0000-000000000002', 'teacher'),
  ('50000000-0000-0000-0000-000000000003', 'student'),
  ('50000000-0000-0000-0000-000000000004', 'teacher');

insert into public.classes (id, teacher_id, name, class_code)
values (
  '60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'Matematyka 4A',
  'AB12CD34'
), (
  '60000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000004',
  'Historia 4A',
  'EF56GH78'
);

update public.profiles
set display_name = 'Ada Teacher'
where id = '50000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'display_name'
      and is_nullable = 'YES'
  ),
  'Existing profiles allow a nullable teacher display name'
);

select ok(
  to_regclass('public.class_memberships') is not null,
  'Class membership persistence exists'
);

select is(
  (
    select class_name || '|' || teacher_display_name || '|' || already_member::text
    from public.preview_class_by_code(' ab12cd34 ')
  ),
  'Matematyka 4A|Ada Teacher|false',
  'Code preview normalizes input and returns a privacy-safe class summary'
);

select is(
  (select count(*) from public.class_memberships where student_id = '50000000-0000-0000-0000-000000000002'),
  0::bigint,
  'Preview does not create a membership'
);
select is(
  (select count(*) from public.preview_class_by_code('UNKNOWN1')),
  0::bigint,
  'An unknown code reveals no class summary'
);

select is(
  (select already_member from public.accept_class_by_code(' ab12cd34 ')),
  false,
  'First code acceptance creates a new membership'
);
select is(
  (select string_agg(role, ',' order by role) from public.profile_roles where user_id = '50000000-0000-0000-0000-000000000002'),
  'student,teacher',
  'Joining grants student role without removing teacher role'
);
select is(
  (select already_member from public.accept_class_by_code('AB12CD34')),
  true,
  'A same-class code retry returns the existing membership'
);
select is(
  (select count(*) from public.class_memberships where class_id = '60000000-0000-0000-0000-000000000001' and student_id = '50000000-0000-0000-0000-000000000002'),
  1::bigint,
  'A class and account have at most one membership'
);
select is(
  (select already_member from public.accept_class_by_code('EF56GH78')),
  false,
  'A student can join a second class'
);

select is(
  (select count(*) from public.list_my_class_memberships()),
  2::bigint,
  'Joined-class reads return the caller memberships across classes'
);
select is(
  (select teacher_display_name from public.preview_class_by_code('EF56GH78')),
  null,
  'A teacher without a display name remains joinable with a class-only preview'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

select is(
  public.set_teacher_display_name('  Ada Updated  '),
  'Ada Updated',
  'Teacher display-name updates trim surrounding whitespace'
);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
select is(
  (select teacher_display_name from public.preview_class_by_code('AB12CD34')),
  'Ada Updated',
  'Join previews show the teacher display-name update'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*) from public.list_my_class_memberships()),
  0::bigint,
  'A different student cannot list another account memberships'
);
select is(
  (select count(*) from public.class_memberships),
  0::bigint,
  'Membership row-level security hides other students memberships'
);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000004', true);
select is(
  (select count(*) from public.class_memberships),
  0::bigint,
  'A teacher cannot read student membership rows'
);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.set_teacher_display_name('Student name')$$,
  '42501',
  'Teacher authentication is required',
  'A student cannot update a teacher display name'
);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.set_teacher_display_name('   ')$$,
  '22023',
  'Display name must contain between 1 and 80 characters',
  'Blank display names are rejected'
);
select throws_ok(
  format('select public.set_teacher_display_name(%L)', repeat('x', 81)),
  '22023',
  'Display name must contain between 1 and 80 characters',
  'Display names over the documented bound are rejected'
);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select * from public.accept_class_by_code('UNKNOWN1')$$,
  'P0002',
  'Class code is unavailable',
  'An unknown class code cannot be accepted'
);

select * from finish();
rollback;