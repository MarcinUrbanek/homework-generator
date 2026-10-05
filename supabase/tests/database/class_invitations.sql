begin;

select plan(43);

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
  ('40000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'class-teacher-one@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('40000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'class-teacher-two@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('40000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'class-student@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('40000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'class-dual-role@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now());

delete from public.profile_roles
where user_id in (
  '40000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000004'
);

insert into public.profile_roles (user_id, role)
values
  ('40000000-0000-0000-0000-000000000001', 'teacher'),
  ('40000000-0000-0000-0000-000000000002', 'teacher'),
  ('40000000-0000-0000-0000-000000000003', 'student'),
  ('40000000-0000-0000-0000-000000000004', 'teacher'),
  ('40000000-0000-0000-0000-000000000004', 'student');

select ok(to_regclass('public.classes') is not null, 'The classes table exists');
select ok(to_regclass('public.class_invitations') is not null, 'The class invitations table exists');
select ok(
  not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'class_memberships'
  ),
  'This phase creates no class membership table'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'class_invitations'
      and column_name in ('token', 'plaintext_token')
  ),
  'Invitation records contain no plaintext token column'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

create temporary table teacher_one_class as
select * from public.create_class('  Matematyka 4A  ');

select is(
  (select name from public.classes where id = (select class_id from teacher_one_class)),
  'Matematyka 4A',
  'Class names are trimmed before storage'
);
select matches(
  (select class_code from teacher_one_class),
  '^[A-Z0-9]{8}$',
  'A class receives an eight-character generated code'
);
select throws_ok(
  $$select * from public.create_class('  ')$$,
  '22023',
  'Class name is required',
  'Blank class names are rejected'
);
select is(
  (select count(*) from public.classes),
  1::bigint,
  'A teacher can read their own class'
);

create temporary table prepared_invitations as
select *
from public.prepare_class_invitations(
  (select class_id from teacher_one_class),
  array[' Ala@Example.test ', 'bob@example.test', 'ala@example.test'],
  array[
    repeat('a', 64),
    repeat('b', 64),
    repeat('c', 64)
  ]
);

select is(
  (select count(*) from prepared_invitations),
  2::bigint,
  'Preparation deduplicates normalized recipient emails'
);
select is(
  (select string_agg(recipient_email || ':' || preparation, ',' order by recipient_email) from prepared_invitations),
  'ala@example.test:created,bob@example.test:created',
  'Preparation returns the persistence outcome for each unique recipient'
);

reset role;
set local role service_role;

select is(
  (select count(*) from public.class_invitations),
  2::bigint,
  'Each normalized email produces one invitation row'
);
select is(
  (select normalized_email from public.class_invitations where normalized_email = 'ala@example.test'),
  'ala@example.test',
  'Recipient email storage is lowercase and trimmed'
);
select is(
  (select token_digest from public.class_invitations where normalized_email = 'ala@example.test'),
  repeat('a', 64),
  'Only the supplied token digest is persisted'
);
select ok(
  (select expires_at from public.class_invitations where normalized_email = 'ala@example.test') between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour',
  'Prepared invitations expire after seven days'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

create temporary table refreshed_invitation as
select *
from public.prepare_class_invitations(
  (select class_id from teacher_one_class),
  array['ala@example.test'],
  array[repeat('d', 64)]
);

select is(
  (select preparation from refreshed_invitation),
  'refreshed',
  'Repreparing an active address refreshes its invitation'
);
select is(
  (select invitation_id from refreshed_invitation),
  (select invitation_id from prepared_invitations where recipient_email = 'ala@example.test'),
  'Refreshing preserves the invitation row identity'
);

reset role;
set local role service_role;

select is(
  (select token_digest from public.class_invitations where normalized_email = 'ala@example.test'),
  repeat('d', 64),
  'Refreshing rotates the stored token digest'
);
select is(
  (select delivery_state from public.class_invitations where normalized_email = 'ala@example.test'),
  'pending',
  'Refreshing resets delivery state to pending'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

select throws_ok(
  format(
    'select * from public.prepare_class_invitations(%L::uuid, array[%s], array[%s])',
    (select class_id from teacher_one_class),
    array_to_string(array_fill(quote_literal('address@example.test'), array[51]), ','),
    array_to_string(array_fill(quote_literal(repeat('e', 64)), array[51]), ',')
  ),
  '22023',
  'One to 50 invitations are required',
  'Preparation rejects a batch over fifty addresses'
);
select throws_ok(
  $$select * from public.prepare_class_invitations(
      (select class_id from teacher_one_class),
      array['invalid@example.test'],
      array['not-a-digest']
    )$$,
  '22023',
  'Invitation emails and token digests must be valid',
  'Preparation rejects values that are not token digests'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);

select is((select count(*) from public.classes), 0::bigint, 'Another teacher cannot read a different teacher class');
select throws_ok(
  $$select * from public.prepare_class_invitations(
      (select class_id from teacher_one_class),
      array['other@example.test'],
      array[repeat('f', 64)]
    )$$,
  '42501',
  'Class ownership is required',
  'Another teacher cannot prepare invitations for a class they do not own'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$select * from public.create_class('Klasa ucznia')$$,
  '42501',
  'Teacher authentication is required',
  'A student-only account cannot create a class'
);
select throws_ok(
  $$select * from public.prepare_class_invitations(
      (select class_id from teacher_one_class),
      array['student@example.test'],
      array[repeat('e', 64)]
    )$$,
  '42501',
  'Teacher authentication is required',
  'A student-only account cannot prepare invitations'
);

reset role;
set local role service_role;

select is(
  (select count(*) from public.class_invitations),
  2::bigint,
  'Rejected student preparation leaves invitation rows unchanged'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);

select lives_ok(
  $$select * from public.create_class('Klasa z dwiema rolami')$$,
  'A dual-role account retains teacher class creation'
);

reset role;
select ok(has_table_privilege('authenticated', 'public.classes', 'SELECT'), 'Authenticated users may select classes through RLS');
select ok(not has_table_privilege('authenticated', 'public.classes', 'INSERT'), 'Authenticated users cannot insert classes directly');
select ok(not has_table_privilege('authenticated', 'public.classes', 'UPDATE'), 'Authenticated users cannot update classes directly');
select ok(not has_table_privilege('authenticated', 'public.classes', 'DELETE'), 'Authenticated users cannot delete classes directly');
select ok(not has_table_privilege('authenticated', 'public.class_invitations', 'SELECT'), 'Authenticated users cannot read invitation token digests directly');
select ok(not has_table_privilege('authenticated', 'public.class_invitations', 'INSERT'), 'Authenticated users cannot insert invitations directly');
select ok(not has_table_privilege('authenticated', 'public.class_invitations', 'UPDATE'), 'Authenticated users cannot update invitations directly');
select ok(not has_table_privilege('authenticated', 'public.class_invitations', 'DELETE'), 'Authenticated users cannot delete invitations directly');
select ok(has_function_privilege('authenticated', 'public.create_class(text)', 'EXECUTE'), 'Authenticated users may call class creation');
select ok(has_function_privilege('authenticated', 'public.prepare_class_invitations(uuid, text[], text[])', 'EXECUTE'), 'Authenticated users may call invitation preparation');
select ok(not has_function_privilege('authenticated', 'public.record_class_invitation_delivery(uuid, text, text, text)', 'EXECUTE'), 'Authenticated users cannot record delivery outcomes');
select ok(has_function_privilege('service_role', 'public.record_class_invitation_delivery(uuid, text, text, text)', 'EXECUTE'), 'The service role can record delivery outcomes');

set local role service_role;
select ok(
  public.record_class_invitation_delivery(
    (select id from public.class_invitations where normalized_email = 'ala@example.test'),
    repeat('d', 64),
    'sent',
    'provider-message-1'
  ),
  'Delivery recording updates the current invitation token only'
);
select is(
  (select delivery_state from public.class_invitations where normalized_email = 'ala@example.test'),
  'sent',
  'Successful delivery is recorded'
);
select ok(
  not public.record_class_invitation_delivery(
    (select id from public.class_invitations where normalized_email = 'ala@example.test'),
    repeat('a', 64),
    'failed',
    null
  ),
  'A stale delivery result cannot overwrite a rotated invitation'
);
select ok(
  public.record_class_invitation_delivery(
    (select id from public.class_invitations where normalized_email = 'ala@example.test'),
    repeat('d', 64),
    'failed',
    null
  ),
  'A failed delivery result is accepted for the current invitation token'
);
select is(
  (select delivery_state from public.class_invitations where normalized_email = 'ala@example.test'),
  'failed',
  'A failed delivery result is persisted'
);

select * from finish();
rollback;