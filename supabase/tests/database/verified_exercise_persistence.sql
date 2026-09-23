begin;

select plan(18);

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
  (
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'teacher-one@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'teacher-two@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'student@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

update public.profiles
set role = 'student'
where id = '00000000-0000-0000-0000-000000000003';

select is(
  (select role from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'teacher',
  'New Auth users receive a teacher profile'
);

select throws_ok(
  $$insert into public.profiles (id, role) values ('00000000-0000-0000-0000-000000000099', 'administrator')$$,
  '23514',
  null,
  'Profiles reject unsupported roles'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercises'
      and column_name in (
        'exercise_text',
        'canonical_answer',
        'grade',
        'topic',
        'difficulty',
        'verification_verdict',
        'verifier_identity',
        'verifier_version',
        'verified_at',
        'verification_rationale',
        'creator_id',
        'approver_id'
      )
      and is_nullable = 'YES'
  ),
  'Exercise content, metadata, verification evidence, and ownership are required'
);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      '', '4', '1', 'addition', 'easy', 'unique_answer', 'verifier', '1', now(),
      'One answer was found.', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  null,
  'Exercise text cannot be blank'
);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      '2 + 2 = ?', '4', '1', 'addition', 'easy', 'multiple_answers', 'verifier', '1', now(),
      'One answer was found.', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  null,
  'Only successful unique-answer verification can be stored'
);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      '2 + 2 = ?', '4', '1', 'addition', 'easy', 'unique_answer', 'verifier', null, now(),
      'One answer was found.', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23502',
  null,
  'Verification evidence cannot be incomplete'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      '2 + 2 = ?', '4', '1', 'addition', 'easy', 'unique_answer', 'verifier', '1', now(),
      'One answer was found.', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  'A teacher can store complete verified evidence'
);

select is(
  (select count(*) from public.exercises where exercise_text = '2 + 2 = ?'),
  1::bigint,
  'The accepted exercise has a stable stored record'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select ok(
  exists (select 1 from public.exercises where exercise_text = '2 + 2 = ?'),
  'A second teacher can read an exercise created by another teacher'
);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      '3 + 3 = ?', '6', '1', 'addition', 'easy', 'unique_answer', 'verifier', '1', now(),
      'One answer was found.', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '42501',
  null,
  'A teacher cannot create an exercise for another creator or approver'
);

delete from public.exercises where exercise_text = '2 + 2 = ?';

select is(
  (select count(*) from public.exercises where exercise_text = '2 + 2 = ?'),
  1::bigint,
  'A non-creator teacher cannot delete the exercise'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);

select ok(
  not exists (select 1 from public.exercises where exercise_text = '2 + 2 = ?'),
  'A student cannot read canonical answers from the exercise pool'
);

select ok(
  not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'A signed-in user cannot read another profile'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      '3 + 3 = ?', '6', '1', 'addition', 'easy', 'unique_answer', 'verifier', '2', now(),
      'The correction has one answer.', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  'A correction can be stored as a freshly verified exercise'
);

select is(
  (select count(*) from public.exercises where exercise_text = '3 + 3 = ?'),
  1::bigint,
  'The correction has its own approved record'
);

update public.exercises
set canonical_answer = 'changed'
where exercise_text = '3 + 3 = ?';

select is(
  (select canonical_answer from public.exercises where exercise_text = '3 + 3 = ?'),
  '6',
  'Direct updates cannot alter verification-backed exercises'
);

delete from public.exercises where exercise_text = '2 + 2 = ?';

select is(
  (select count(*) from public.exercises where exercise_text = '2 + 2 = ?'),
  0::bigint,
  'The creator can delete their own exercise'
);

select ok(
  (select public.is_teacher()),
  'The creator retains teacher access while managing their exercises'
);

select * from finish();
rollback;