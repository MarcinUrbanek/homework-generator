begin;

select plan(20);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'teacher-one@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
    'teacher-two@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
    'student@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()
  );

delete from public.profile_roles
where user_id = '00000000-0000-0000-0000-000000000003'
  and role = 'teacher';
insert into public.profile_roles (user_id, role)
values ('00000000-0000-0000-0000-000000000003', 'student');

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercises'
      and column_name = 'arithmetic_structure'
      and is_nullable = 'YES'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercise_verifications'
      and column_name = 'authority_version'
      and is_nullable = 'YES'
  ),
  'Authority columns are nullable so retained historical rows stay uncertified'
);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      '', '4', '4', 'addition-subtraction', 'easy', 'unique_answer', 'verifier', '1', now(),
      'One answer.', '00000000-0000-0000-0000-000000000001',
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
      '2 + 2 = ?', '4', '4', 'addition-subtraction', 'easy', 'multiple_answers', 'verifier', '1', now(),
      'One answer.', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  null,
  'Only successful unique-answer verification can be stored'
);

select throws_ok(
  $$insert into public.exercise_verifications (
      teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
      grade, topic, difficulty, outcome, verified_answer, verifier_identity,
      verifier_version, verified_at, rationale
    ) values (
      '00000000-0000-0000-0000-000000000001', 'missing-structure',
      'Oblicz wartość wyrażenia: (2 + 2). Podaj wynik jako jedną liczbę naturalną.',
      '4', '4', 'addition-subtraction', 'easy', 'unique_answer', '4',
      'ArithmeticAuthority', 'arithmetic-authority-v1', now(), 'Forged without structure.'
    )$$,
  '23514',
  null,
  'Successful evidence cannot omit its arithmetic structure'
);

set local role service_role;

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      '2 + 2 = ?', '4', '4', 'addition-subtraction', 'easy', 'unique_answer', 'ArithmeticAuthority',
      'arithmetic-authority-v1', now(), 'One answer.',
      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  null,
  'Service-role pool writes cannot omit authoritative ledger evidence'
);

insert into public.exercise_verifications (
  id, teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
  grade, topic, difficulty, outcome, verified_answer, verifier_identity,
  verifier_version, verified_at, rationale, arithmetic_structure, authority_version
)
values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'persistence-valid',
  'Oblicz wartość wyrażenia: (2 + 2). Podaj wynik jako jedną liczbę naturalną.',
  '4',
  '4',
  'addition-subtraction',
  'easy',
  'unique_answer',
  '4',
  'ArithmeticAuthority',
  'arithmetic-authority-v1',
  '2026-09-23 12:00:00+00',
  'Struktura oblicza wartość 4.',
  '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":2},"right":{"kind":"number","value":2}}}'::jsonb,
  1
);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id, verification_id,
      arithmetic_structure, authority_version
    ) values (
      'Oblicz wartość wyrażenia: (2 + 2). Podaj wynik jako jedną liczbę naturalną.',
      '5', '4', 'addition-subtraction', 'easy', 'unique_answer', 'ArithmeticAuthority',
      'arithmetic-authority-v1', '2026-09-23 12:00:00+00', 'Struktura oblicza wartość 4.',
      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000101',
      '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":2},"right":{"kind":"number","value":2}}}'::jsonb,
      1
    )$$,
  '23514',
  null,
  'A pool write with a forged answer is rejected'
);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id, verification_id,
      arithmetic_structure, authority_version
    ) values (
      'Different prompt', '4', '4', 'addition-subtraction', 'easy', 'unique_answer', 'ArithmeticAuthority',
      'arithmetic-authority-v1', '2026-09-23 12:00:00+00', 'Struktura oblicza wartość 4.',
      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000101',
      '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":2},"right":{"kind":"number","value":2}}}'::jsonb,
      1
    )$$,
  '23514',
  null,
  'A pool write with edited text is rejected'
);

insert into public.exercises (
  id, exercise_text, canonical_answer, grade, topic, difficulty,
  verification_verdict, verifier_identity, verifier_version, verified_at,
  verification_rationale, creator_id, approver_id, verification_id,
  arithmetic_structure, authority_version
)
values (
  '00000000-0000-0000-0000-000000000201',
  'Oblicz wartość wyrażenia: (2 + 2). Podaj wynik jako jedną liczbę naturalną.',
  '4', '4', 'addition-subtraction', 'easy', 'unique_answer', 'ArithmeticAuthority',
  'arithmetic-authority-v1', '2026-09-23 12:00:00+00', 'Struktura oblicza wartość 4.',
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":2},"right":{"kind":"number","value":2}}}'::jsonb,
  1
);

select is(
  (select count(*) from public.exercises where verification_id = '00000000-0000-0000-0000-000000000101'),
  1::bigint,
  'A trusted direct write with current owned evidence is accepted'
);

select is(
  (select authority_version from public.exercises where verification_id = '00000000-0000-0000-0000-000000000101'),
  1,
  'The pool row preserves the certified authority version'
);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id, verification_id,
      arithmetic_structure, authority_version
    ) values (
      'Oblicz wartość wyrażenia: (2 + 2). Podaj wynik jako jedną liczbę naturalną.',
      '4', '4', 'addition-subtraction', 'easy', 'unique_answer', 'ArithmeticAuthority',
      'arithmetic-authority-v1', '2026-09-23 12:00:00+00', 'Struktura oblicza wartość 4.',
      '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000101',
      '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":2},"right":{"kind":"number","value":2}}}'::jsonb,
      1
    )$$,
  '23514',
  null,
  'A valid ledger link cannot be promoted for a different owner'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select ok(
  exists (select 1 from public.exercises where id = '00000000-0000-0000-0000-000000000201'),
  'Another teacher can read a certified exercise'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select ok(
  not exists (select 1 from public.exercises where id = '00000000-0000-0000-0000-000000000201'),
  'A student cannot read canonical answers from the pool'
);
select ok(
  not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'A signed-in user cannot read another profile'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      '3 + 3 = ?', '6', '4', 'addition-subtraction', 'easy', 'unique_answer', 'verifier', '1', now(),
      'One answer.', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '42501',
  null,
  'Authenticated sessions cannot bypass the approval function'
);

delete from public.exercises where id = '00000000-0000-0000-0000-000000000201';
select is(
  (select count(*) from public.exercises where id = '00000000-0000-0000-0000-000000000201'),
  1::bigint,
  'A non-creator teacher cannot delete the exercise'
);

reset role;
set local role service_role;

select throws_ok(
  $$update public.exercises set canonical_answer = '5' where id = '00000000-0000-0000-0000-000000000201'$$,
  '42501',
  null,
  'Service-role writes cannot mutate a certified answer'
);

select throws_ok(
  $$update public.exercise_verifications set rationale = 'Changed' where id = '00000000-0000-0000-0000-000000000101'$$,
  '42501',
  null,
  'Service-role writes cannot mutate evidence'
);

reset role;
alter table public.exercises disable trigger exercises_authority_insert;
insert into public.exercises (
  exercise_text, canonical_answer, grade, topic, difficulty,
  verification_verdict, verifier_identity, verifier_version, verified_at,
  verification_rationale, creator_id, approver_id
)
values (
  'Legacy exercise without provenance', 'legacy answer', '4', 'word-problems', 'easy',
  'unique_answer', 'legacy-verifier', 'legacy-model', now(), 'Retained historical row.',
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
);
alter table public.exercises enable trigger exercises_authority_insert;

set local role service_role;
select throws_ok(
  $$update public.exercises
    set verification_id = '00000000-0000-0000-0000-000000000101',
        arithmetic_structure = '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":2},"right":{"kind":"number","value":2}}}'::jsonb,
        authority_version = 1
    where exercise_text = 'Legacy exercise without provenance'$$,
  '42501',
  null,
  'Historical rows cannot be relabeled as certified in place'
);

reset role;
select throws_ok(
  $$delete from public.exercise_verifications where id = '00000000-0000-0000-0000-000000000101'$$,
  '23503',
  null,
  'Referenced evidence remains protected by the foreign key'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
delete from public.exercises where id = '00000000-0000-0000-0000-000000000201';
select is(
  (select count(*) from public.exercises where id = '00000000-0000-0000-0000-000000000201'),
  0::bigint,
  'The creator can delete their own certified pool row'
);

select * from finish();
rollback;
