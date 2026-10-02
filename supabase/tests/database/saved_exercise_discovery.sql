begin;

select plan(14);

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
    '40000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'discovery-teacher-one@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'discovery-teacher-two@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'discovery-student@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

update public.profiles
set role = 'student'
where id = '40000000-0000-0000-0000-000000000003';

set local role service_role;

insert into public.exercises (
  id,
  exercise_text,
  canonical_answer,
  grade,
  topic,
  difficulty,
  verification_verdict,
  verifier_identity,
  verifier_version,
  verified_at,
  verification_rationale,
  creator_id,
  approver_id,
  approved_at
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    'Ile to jest 2 + 2?',
    '4',
    '4',
    'addition-subtraction',
    'easy',
    'unique_answer',
    'test-verifier',
    'test-model',
    '2026-10-01 09:00:00+00',
    'Jedna poprawna odpowiedź.',
    '40000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '2026-10-01 10:00:00+00'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'Ile to jest 5 + 3?',
    '8',
    '4',
    'addition-subtraction',
    'medium',
    'unique_answer',
    'test-verifier',
    'test-model',
    '2026-10-01 09:01:00+00',
    'Jedna poprawna odpowiedź.',
    '40000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '2026-10-01 10:00:00+00'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    'Ile to jest 12 - 5?',
    '7',
    '4',
    'addition-subtraction',
    'hard',
    'unique_answer',
    'test-verifier',
    'test-model',
    '2026-10-01 09:02:00+00',
    'Jedna poprawna odpowiedź.',
    '40000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '2026-10-01 11:00:00+00'
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    'Ile boków ma trójkąt?',
    '3',
    '4',
    'word-problems',
    'easy',
    'unique_answer',
    'test-verifier',
    'test-model',
    '2026-10-01 09:03:00+00',
    'Jedna poprawna odpowiedź.',
    '40000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    '2026-10-01 12:00:00+00'
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    'Ile to jest 10 + 15?',
    '25',
    '5',
    'addition-subtraction',
    'easy',
    'unique_answer',
    'test-verifier',
    'test-model',
    '2026-10-01 09:04:00+00',
    'Jedna poprawna odpowiedź.',
    '40000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '2026-10-01 13:00:00+00'
  );

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

select ok(
  to_regprocedure('public.get_saved_exercises(text,text,text,timestamptz,uuid,integer)') is not null,
  'The saved-exercise retrieval function exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_saved_exercises(text,text,text,timestamptz,uuid,integer)',
    'EXECUTE'
  ),
  'Authenticated sessions may execute the saved-exercise retrieval function'
);

select is(
  (
    select array_agg(id order by approved_at desc, id desc)
    from public.get_saved_exercises('4', 'addition-subtraction')
  ),
  array[
    '50000000-0000-0000-0000-000000000003'::uuid,
    '50000000-0000-0000-0000-000000000002'::uuid,
    '50000000-0000-0000-0000-000000000001'::uuid
  ],
  'Grade and topic filtering returns newest-first results with ID tie-breaking'
);

select is(
  (select count(*) from public.get_saved_exercises('5', 'addition-subtraction')),
  1::bigint,
  'Grade filtering excludes the Grade 4 pool'
);

select is(
  (
    select array_agg(id order by approved_at desc, id desc)
    from public.get_saved_exercises('4', 'addition-subtraction', 'medium')
  ),
  array['50000000-0000-0000-0000-000000000002'::uuid],
  'An optional difficulty filter refines the topic pool'
);

select is(
  (select count(*) from public.get_saved_exercises('4', 'addition-subtraction', 'hard')),
  1::bigint,
  'Each difficulty can be queried independently'
);

select is(
  (
    select array_agg(id order by approved_at desc, id desc)
    from public.get_saved_exercises(
      '4',
      'addition-subtraction',
      null,
      '2026-10-01 11:00:00+00',
      '50000000-0000-0000-0000-000000000003',
      21
    )
  ),
  array[
    '50000000-0000-0000-0000-000000000002'::uuid,
    '50000000-0000-0000-0000-000000000001'::uuid
  ],
  'A cursor returns the next non-overlapping page'
);

select is(
  (select count(*) from public.get_saved_exercises('4', 'addition-subtraction', null, null, null, 2)),
  2::bigint,
  'The function respects a bounded page size'
);

select throws_ok(
  $$select * from public.get_saved_exercises('4', 'addition-subtraction', null, null, null, 0)$$,
  '22023',
  null,
  'The function rejects a page size below the lower bound'
);

select throws_ok(
  $$select * from public.get_saved_exercises('4', 'addition-subtraction', null, null, null, 22)$$,
  '22023',
  null,
  'The function rejects a page size above the upper bound'
);

select throws_ok(
  $$select * from public.get_saved_exercises(
      '4', 'addition-subtraction', null, '2026-10-01 11:00:00+00', null, 20
    )$$,
  '22023',
  null,
  'The function rejects a cursor without an ID boundary'
);

select throws_ok(
  $$select * from public.get_saved_exercises(
      '4', 'addition-subtraction', null, null, '50000000-0000-0000-0000-000000000003', 20
    )$$,
  '22023',
  null,
  'The function rejects a cursor without an approval-time boundary'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.get_saved_exercises('4', 'addition-subtraction')),
  3::bigint,
  'A second teacher sees the shared approved pool'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*) from public.get_saved_exercises('4', 'addition-subtraction')),
  0::bigint,
  'A student cannot read canonical answers from the pool'
);

reset role;

select * from finish();
rollback;