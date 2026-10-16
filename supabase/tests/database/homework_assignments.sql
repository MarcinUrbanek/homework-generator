begin;

select no_plan();

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
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'assignment-teacher-one@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'assignment-teacher-two@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'Roster-One@Example.Test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'roster-two@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'roster-departed@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    'authenticated',
    'authenticated',
    'roster-other-class@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

delete from public.profile_roles
where user_id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006'
);

insert into public.profile_roles (user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', 'teacher'),
  ('10000000-0000-0000-0000-000000000002', 'teacher'),
  ('10000000-0000-0000-0000-000000000003', 'student'),
  ('10000000-0000-0000-0000-000000000004', 'student'),
  ('10000000-0000-0000-0000-000000000005', 'student'),
  ('10000000-0000-0000-0000-000000000006', 'student');

insert into public.classes (id, teacher_id, name, class_code)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Matematyka 4A',
    'AB12CD34'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Matematyka 4B',
    'EF56GH78'
  );

insert into public.class_memberships (class_id, student_id, joined_at)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    '2026-10-01 09:00:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004',
    '2026-10-01 09:01:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000005',
    '2026-10-01 09:02:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000006',
    '2026-10-01 09:03:00+00'
  );

create function pg_temp.insert_certified_assignment_exercise(
  exercise_id uuid,
  teacher_id uuid,
  exercise_difficulty text,
  structure jsonb,
  approved_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived jsonb := public.derive_arithmetic_exercise_v1(
    '4', 'addition-subtraction', exercise_difficulty, structure
  );
begin
  insert into public.exercise_verifications (
    id, teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
    grade, topic, difficulty, outcome, verified_answer, verifier_identity,
    verifier_version, verified_at, rationale, arithmetic_structure, authority_version
  )
  values (
    exercise_id, teacher_id, exercise_id::text, derived ->> 'exercise_text',
    derived ->> 'canonical_answer', '4', 'addition-subtraction', exercise_difficulty,
    'unique_answer', derived ->> 'canonical_answer', 'test-verifier', 'authority-v1',
    approved_at, 'Independently evaluated test fixture.', structure, 1
  );

  insert into public.exercises (
    id, exercise_text, canonical_answer, grade, topic, difficulty,
    verification_verdict, verifier_identity, verifier_version, verified_at,
    verification_rationale, creator_id, approver_id, approved_at,
    verification_id, arithmetic_structure, authority_version
  )
  values (
    exercise_id, derived ->> 'exercise_text', derived ->> 'canonical_answer',
    '4', 'addition-subtraction', exercise_difficulty, 'unique_answer',
    'test-verifier', 'authority-v1', approved_at,
    'Independently evaluated test fixture.', teacher_id, teacher_id, approved_at,
    exercise_id, structure, 1
  );
end;
$$;

select pg_temp.insert_certified_assignment_exercise(
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'easy',
  '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":2},"right":{"kind":"number","value":2}}}',
  '2026-10-01 09:00:00+00'
);
select pg_temp.insert_certified_assignment_exercise(
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'easy',
  '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":1},"right":{"kind":"number","value":3}}}',
  '2026-10-01 09:01:00+00'
);
select pg_temp.insert_certified_assignment_exercise(
  '30000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'easy',
  '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":2},"right":{"kind":"number","value":3}}}',
  '2026-10-01 09:02:00+00'
);
select pg_temp.insert_certified_assignment_exercise(
  '30000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000002',
  'easy',
  '{"version":1,"expression":{"kind":"subtract","left":{"kind":"number","value":8},"right":{"kind":"number","value":3}}}',
  '2026-10-01 09:03:00+00'
);
select pg_temp.insert_certified_assignment_exercise(
  '30000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  'easy',
  '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":3},"right":{"kind":"number","value":4}}}',
  '2026-10-01 09:04:00+00'
);
select pg_temp.insert_certified_assignment_exercise(
  '30000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000001',
  'easy',
  '{"version":1,"expression":{"kind":"subtract","left":{"kind":"number","value":9},"right":{"kind":"number","value":3}}}',
  '2026-10-01 09:05:00+00'
);
select pg_temp.insert_certified_assignment_exercise(
  '30000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000001',
  'medium',
  '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":5},"right":{"kind":"number","value":8}}}',
  '2026-10-01 09:07:00+00'
);

alter table public.exercises disable trigger exercises_authority_insert;
insert into public.exercises (
  id, exercise_text, canonical_answer, grade, topic, difficulty,
  verification_verdict, verifier_identity, verifier_version, verified_at,
  verification_rationale, creator_id, approver_id, approved_at
)
values
  (
    '30000000-0000-0000-0000-000000000007',
    'Ile boków ma trójkąt?',
    '3',
    '4',
    'word-problems',
    'easy',
    'unique_answer',
    'legacy-verifier',
    'old-model',
    '2026-10-01 08:06:00+00',
    'Legacy model-only result.',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '2026-10-01 09:06:00+00'
  ),
  (
    '30000000-0000-0000-0000-000000000009',
    'Legacy addition prompt',
    '6',
    '4',
    'addition-subtraction',
    'easy',
    'unique_answer',
    'legacy-verifier',
    'old-model',
    '2026-10-01 08:08:00+00',
    'Legacy model-only result.',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '2026-10-01 09:08:00+00'
  );
alter table public.exercises enable trigger exercises_authority_insert;

insert into public.homework_assignments (
  id, class_id, teacher_id, title, grade, topic, difficulty, exercise_count,
  idempotency_key, request_fingerprint, created_at
)
values (
  '90000000-0000-0000-0000-000000000019',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Legacy replay',
  '4',
  'addition-subtraction',
  'easy',
  1,
  '90000000-0000-0000-0000-000000000019',
  md5(
    jsonb_build_object(
      'class_id', '20000000-0000-0000-0000-000000000001'::uuid,
      'title', 'Legacy replay',
      'topic', 'addition-subtraction',
      'difficulty', 'easy',
      'exercise_count', 1,
      'student_ids', to_jsonb(array['10000000-0000-0000-0000-000000000003'::uuid])
    )::text
  ),
  '2026-09-30 09:00:00+00'
);
insert into public.homework_recipients (id, assignment_id, student_id, set_signature)
values (
  '91000000-0000-0000-0000-000000000019',
  '90000000-0000-0000-0000-000000000019',
  '10000000-0000-0000-0000-000000000003',
  'legacy-replay'
);
insert into public.homework_recipient_exercises (recipient_id, exercise_id, position)
values (
  '91000000-0000-0000-0000-000000000019',
  '30000000-0000-0000-0000-000000000009',
  1
);

select ok(
  to_regclass('public.homework_assignments') is not null,
  'The assignment batch table exists'
);
select ok(
  to_regclass('public.homework_recipients') is not null,
  'The assignment recipient table exists'
);
select ok(
  to_regclass('public.homework_recipient_exercises') is not null,
  'The ordered assigned-exercise table exists'
);
select ok(
  to_regprocedure('public.list_class_homework_roster(uuid)') is not null,
  'The owner-checked roster function exists'
);
select ok(
  to_regprocedure('public.create_homework_assignment(uuid,text,text,text,integer,uuid,jsonb)') is not null,
  'The atomic assignment function exists'
);
select ok(
  to_regprocedure('public.get_homework_assignment_replay(uuid,text,text,text,integer,uuid,uuid[])') is not null,
  'The assignment replay lookup exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.list_class_homework_roster(uuid)',
    'EXECUTE'
  ),
  'Authenticated sessions can call the roster function'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_homework_assignment(uuid,text,text,text,integer,uuid,jsonb)',
    'EXECUTE'
  ),
  'Authenticated sessions can call the assignment function'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_homework_assignment_replay(uuid,text,text,text,integer,uuid,uuid[])',
    'EXECUTE'
  ),
  'Authenticated sessions can call the assignment replay lookup'
);
select ok(
  not has_table_privilege('authenticated', 'public.homework_assignments', 'SELECT')
    and not has_table_privilege('authenticated', 'public.homework_assignments', 'INSERT')
    and not has_table_privilege('authenticated', 'public.homework_assignments', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.homework_assignments', 'DELETE'),
  'Authenticated users have no direct assignment-table privileges'
);
select ok(
  not has_table_privilege('authenticated', 'public.homework_recipients', 'SELECT')
    and not has_table_privilege('authenticated', 'public.homework_recipients', 'INSERT')
    and not has_table_privilege('authenticated', 'public.homework_recipients', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.homework_recipients', 'DELETE'),
  'Authenticated users have no direct recipient-table privileges'
);
select ok(
  not has_table_privilege('authenticated', 'public.homework_recipient_exercises', 'SELECT')
    and not has_table_privilege('authenticated', 'public.homework_recipient_exercises', 'INSERT')
    and not has_table_privilege('authenticated', 'public.homework_recipient_exercises', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.homework_recipient_exercises', 'DELETE'),
  'Authenticated users have no direct assigned-exercise privileges'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (
    select string_agg(student_id::text || ':' || student_email, ',' order by joined_at, student_id)
    from public.list_class_homework_roster('20000000-0000-0000-0000-000000000001')
  ),
  '10000000-0000-0000-0000-000000000003:roster-one@example.test,10000000-0000-0000-0000-000000000004:roster-two@example.test,10000000-0000-0000-0000-000000000005:roster-departed@example.test',
  'The owning teacher receives normalized emails for only current class members in stable order'
);
select is(
  (select count(*) from public.get_saved_exercises('4', 'addition-subtraction', 'easy')),
  6::bigint,
  'A teacher assignment can draw from the shared approved exercise pool'
);
select throws_ok(
  $$select * from public.list_class_homework_roster('20000000-0000-0000-0000-000000000002')$$,
  '42501',
  'Class ownership is required',
  'A teacher cannot retrieve another teacher roster'
);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select * from public.list_class_homework_roster('20000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Teacher authentication is required',
  'A student cannot retrieve roster emails'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$select * from public.list_class_homework_roster('20000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Class ownership is required',
  'A second teacher cannot retrieve the first teacher roster'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*) from public.get_saved_exercises('4', 'addition-subtraction', 'easy')),
  0::bigint,
  'A student cannot read canonical answers from the shared exercise pool'
);
select is(
  (select count(*) from public.exercises where id = '30000000-0000-0000-0000-000000000009'),
  0::bigint,
  'A student cannot directly retrieve the statement of a quarantined exercise'
);
select throws_ok(
  $$select * from public.homework_assignments$$,
  '42501',
  null,
  'A student cannot read assignment rows'
);
select throws_ok(
  $$select * from public.homework_recipients$$,
  '42501',
  null,
  'A student cannot read another recipient snapshot'
);
select throws_ok(
  $$select * from public.homework_recipient_exercises$$,
  '42501',
  null,
  'A student cannot read assigned exercise references'
);
select throws_ok(
  $$select public.get_student_homework('90000000-0000-0000-0000-000000000019')$$,
  'P0002',
  'Homework is unavailable',
  'A replayed legacy allocation remains unavailable to its pending student'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000019',
      '[{"position":1,"answer":"6"}]'::jsonb
    )$$,
  'P0002',
  'Homework is unavailable',
  'A replayed legacy allocation cannot be scored for the first time'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000001',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]}]'::jsonb
    )$$,
  '42501',
  'Teacher authentication is required',
  'A student cannot create an assignment'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000002', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000002',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]}]'::jsonb
    )$$,
  '42501',
  'Class ownership is required',
  'A teacher cannot create an assignment for another teacher class'
);

select is(
  (
    select assignment_title
    from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001',
      '  Fractions review  ',
      'addition-subtraction',
      'easy',
      1,
      '90000000-0000-0000-0000-000000000003',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]},{"student_id":"10000000-0000-0000-0000-000000000004","exercise_ids":["30000000-0000-0000-0000-000000000002"]}]'::jsonb
    )
  ),
  'Fractions review',
  'A valid assignment trims its optional title'
);
select is(
  (
    select assigned_student_ids
    from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001',
      'Fractions review',
      'addition-subtraction',
      'easy',
      1,
      '90000000-0000-0000-0000-000000000003',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]},{"student_id":"10000000-0000-0000-0000-000000000004","exercise_ids":["30000000-0000-0000-0000-000000000002"]}]'::jsonb
    )
  ),
  array[
    '10000000-0000-0000-0000-000000000003'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid
  ],
  'The assignment result identifies every still-enrolled recipient'
);
select is(
  (
    select replayed
    from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001',
      'Fractions review',
      'addition-subtraction',
      'easy',
      1,
      '90000000-0000-0000-0000-000000000003',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]},{"student_id":"10000000-0000-0000-0000-000000000004","exercise_ids":["30000000-0000-0000-0000-000000000002"]}]'::jsonb
    )
  ),
  true,
  'A matching request retry returns the original assignment'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001',
      'Changed title',
      'addition-subtraction',
      'easy',
      1,
      '90000000-0000-0000-0000-000000000003',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]},{"student_id":"10000000-0000-0000-0000-000000000004","exercise_ids":["30000000-0000-0000-0000-000000000002"]}]'::jsonb
    )$$,
  '22023',
  'The idempotency key was already used for a different assignment',
  'A retry cannot reuse an idempotency key with a changed payload'
);
select is(
  (
    select replayed
    from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001',
      'Legacy replay',
      'addition-subtraction',
      'easy',
      1,
      '90000000-0000-0000-0000-000000000019',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000009"]}]'::jsonb
    )
  ),
  true,
  'An existing assignment replay preserves its legacy allocation without validating it as new work'
);

reset role;

select is(
  (
    select title || '|' || grade || '|' || topic || '|' || difficulty || '|' || exercise_count::text
    from public.homework_assignments
    where idempotency_key = '90000000-0000-0000-0000-000000000003'
  ),
  'Fractions review|4|addition-subtraction|easy|1',
  'The assignment stores its normalized title and selected approved bucket'
);
select is(
  (
    select string_agg(
      recipient.student_id::text || ':' || assigned.position::text || ':' || assigned.exercise_id::text,
      ','
      order by recipient.student_id, assigned.position
    )
    from public.homework_recipients as recipient
    join public.homework_recipient_exercises as assigned
      on assigned.recipient_id = recipient.id
    join public.homework_assignments as assignment
      on assignment.id = recipient.assignment_id
    where assignment.idempotency_key = '90000000-0000-0000-0000-000000000003'
  ),
  '10000000-0000-0000-0000-000000000003:1:30000000-0000-0000-0000-000000000001,10000000-0000-0000-0000-000000000004:1:30000000-0000-0000-0000-000000000002',
  'Each recipient stores the exact ordered approved exercise reference'
);
select is(
  (
    select count(*)
    from public.homework_assignments
    where idempotency_key = '90000000-0000-0000-0000-000000000003'
  ),
  1::bigint,
  'An idempotent retry creates no duplicate assignment'
);
select is(
  (
    select count(*)
    from public.homework_recipients
    where assignment_id = '90000000-0000-0000-0000-000000000019'
  ),
  1::bigint,
  'Replaying quarantined historical work creates no new recipient allocations'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (
    select assignment_title
    from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001',
      '   ',
      'addition-subtraction',
      'easy',
      1,
      '90000000-0000-0000-0000-000000000004',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000003"]}]'::jsonb
    )
  ),
  null::text,
  'A blank optional title is normalized to null'
);
select throws_ok(
  format(
    'select * from public.create_homework_assignment(%L, %L, %L, %L, 1, %L, %L::jsonb)',
    '20000000-0000-0000-0000-000000000001',
    repeat('x', 121),
    'addition-subtraction',
    'easy',
    '90000000-0000-0000-0000-000000000005',
    '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]}]'
  ),
  '22023',
  'Assignment title cannot exceed 120 characters',
  'Titles above 120 characters are rejected'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 0,
      '90000000-0000-0000-0000-000000000006',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":[]}]'::jsonb
    )$$,
  '22023',
  'Exercise count must be between one and five',
  'Zero exercises per recipient are rejected'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 6,
      '90000000-0000-0000-0000-000000000007',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":[]}]'::jsonb
    )$$,
  '22023',
  'Exercise count must be between one and five',
  'More than five exercises per recipient are rejected'
);
select is(
  (
    select replayed
    from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 5,
      '90000000-0000-0000-0000-000000000008',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001","30000000-0000-0000-0000-000000000002","30000000-0000-0000-0000-000000000003","30000000-0000-0000-0000-000000000004","30000000-0000-0000-0000-000000000005"]}]'::jsonb
    )
  ),
  false,
  'A five-exercise set can be assigned to one recipient'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000009',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000007"]}]'::jsonb
    )$$,
  '22023',
  'Every assigned exercise must be approved for the selected bucket',
  'An approved exercise from a different topic is rejected'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000010',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000008"]}]'::jsonb
    )$$,
  '22023',
  'Every assigned exercise must be approved for the selected bucket',
  'An approved exercise from a different difficulty is rejected'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000011',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["39999999-0000-0000-0000-000000000999"]}]'::jsonb
    )$$,
  '22023',
  'Every assigned exercise must be approved for the selected bucket',
  'A missing or unapproved exercise ID is rejected'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000020',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000009"]}]'::jsonb
    )$$,
  '22023',
  'Every assigned exercise must be approved for the selected bucket',
  'A same-bucket legacy exercise is rejected for a new assignment'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 2,
      '90000000-0000-0000-0000-000000000012',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001","30000000-0000-0000-0000-000000000001"]}]'::jsonb
    )$$,
  '22023',
  'A recipient set cannot repeat an exercise',
  'Repeated exercise IDs within one set are rejected'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000013',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]},{"student_id":"10000000-0000-0000-0000-000000000004","exercise_ids":["30000000-0000-0000-0000-000000000001"]}]'::jsonb
    )$$,
  '22023',
  'Every recipient must receive a distinct exercise set',
  'Two recipients cannot receive an identical set signature'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000014',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]},{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000002"]}]'::jsonb
    )$$,
  '22023',
  'Recipient allocations cannot repeat a student',
  'An allocation cannot repeat a recipient'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000015',
      '[]'::jsonb
    )$$,
  '22023',
  'At least one recipient allocation is required',
  'An empty recipient selection is rejected'
);

select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000016',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]},{"student_id":"10000000-0000-0000-0000-000000000004","exercise_ids":["39999999-0000-0000-0000-000000000999"]}]'::jsonb
    )$$,
  '22023',
  'Every assigned exercise must be approved for the selected bucket',
  'An invalid later recipient rolls back earlier valid rows atomically'
);

reset role;

select is(
  (
    select count(*)
    from public.homework_assignments
    where idempotency_key = '90000000-0000-0000-0000-000000000016'
  ),
  0::bigint,
  'A failed multi-recipient assignment leaves no batch row'
);
select is(
  (
    select count(*)
    from public.homework_recipients as recipient
    join public.homework_assignments as assignment
      on assignment.id = recipient.assignment_id
    where assignment.idempotency_key = '90000000-0000-0000-0000-000000000016'
  ),
  0::bigint,
  'A failed multi-recipient assignment leaves no recipient rows'
);

delete from public.class_memberships
where class_id = '20000000-0000-0000-0000-000000000001'
  and student_id = '10000000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (
    select assigned_student_ids::text || '|' || excluded_student_ids::text
    from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000017',
      '[{"student_id":"10000000-0000-0000-0000-000000000003","exercise_ids":["30000000-0000-0000-0000-000000000001"]},{"student_id":"10000000-0000-0000-0000-000000000004","exercise_ids":["30000000-0000-0000-0000-000000000002"]},{"student_id":"10000000-0000-0000-0000-000000000005","exercise_ids":["30000000-0000-0000-0000-000000000003"]}]'::jsonb
    )
  ),
  '{10000000-0000-0000-0000-000000000003,10000000-0000-0000-0000-000000000004}|{10000000-0000-0000-0000-000000000005}',
  'Departed selected students are excluded while remaining recipients are assigned'
);
select is(
  (
    select replayed
    from public.get_homework_assignment_replay(
      '20000000-0000-0000-0000-000000000001',
      null,
      'addition-subtraction',
      'easy',
      1,
      '90000000-0000-0000-0000-000000000017',
      array[
        '10000000-0000-0000-0000-000000000003'::uuid,
        '10000000-0000-0000-0000-000000000004'::uuid,
        '10000000-0000-0000-0000-000000000005'::uuid
      ]
    )
  ),
  true,
  'A departed selected student does not break assignment replay'
);
select throws_ok(
  $$select * from public.create_homework_assignment(
      '20000000-0000-0000-0000-000000000001', null, 'addition-subtraction', 'easy', 1,
      '90000000-0000-0000-0000-000000000018',
      '[{"student_id":"10000000-0000-0000-0000-000000000005","exercise_ids":["30000000-0000-0000-0000-000000000003"]}]'::jsonb
    )$$,
  'P0002',
  'No selected students remain in the class',
  'An all-departed selection is rejected'
);

reset role;

select is(
  (
    select excluded_student_ids::text || '|' || count(*)::text
    from public.homework_assignments as assignment
    join public.homework_recipients as recipient
      on recipient.assignment_id = assignment.id
    where assignment.idempotency_key = '90000000-0000-0000-0000-000000000017'
    group by assignment.excluded_student_ids
  ),
  '{10000000-0000-0000-0000-000000000005}|2',
  'The committed snapshot contains only eligible recipients and preserves excluded IDs'
);
select is(
  (
    select count(*)
    from public.homework_assignments
    where idempotency_key = '90000000-0000-0000-0000-000000000018'
  ),
  0::bigint,
  'An all-departed selection creates no assignment rows'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$update public.homework_assignments
    set title = 'Changed'
    where idempotency_key = '90000000-0000-0000-0000-000000000003'$$,
  '42501',
  null,
  'Teachers cannot update immutable assignment records directly'
);
select throws_ok(
  $$delete from public.homework_recipients
    where assignment_id in (
      select id from public.homework_assignments
      where idempotency_key = '90000000-0000-0000-0000-000000000003'
    )$$,
  '42501',
  null,
  'Teachers cannot delete immutable recipient snapshots directly'
);
select throws_ok(
  $$delete from public.exercises
    where id = '30000000-0000-0000-0000-000000000001'$$,
  '23503',
  null,
  'An assigned approved exercise cannot be deleted'
);

reset role;

select is(
  (
    select canonical_answer
    from public.exercises
    where id = '30000000-0000-0000-0000-000000000001'
  ),
  '4',
  'The assigned exercise grading source remains unchanged'
);

select * from finish();
rollback;