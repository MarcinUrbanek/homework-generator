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
  ('73000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'feedback-teacher@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('73000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'feedback-other-teacher@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('73000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'feedback-a-student@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('73000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'feedback-b-classmate@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('73000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'feedback-c-departed@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('73000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'feedback-d-unsubmitted@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('73000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'feedback-e-dual-role@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now());

delete from public.profile_roles
where user_id in (
  '73000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000002',
  '73000000-0000-0000-0000-000000000003',
  '73000000-0000-0000-0000-000000000004',
  '73000000-0000-0000-0000-000000000005',
  '73000000-0000-0000-0000-000000000006',
  '73000000-0000-0000-0000-000000000007'
);

insert into public.profile_roles (user_id, role)
values
  ('73000000-0000-0000-0000-000000000001', 'teacher'),
  ('73000000-0000-0000-0000-000000000002', 'teacher'),
  ('73000000-0000-0000-0000-000000000003', 'student'),
  ('73000000-0000-0000-0000-000000000004', 'student'),
  ('73000000-0000-0000-0000-000000000005', 'student'),
  ('73000000-0000-0000-0000-000000000006', 'student'),
  ('73000000-0000-0000-0000-000000000007', 'student'),
  ('73000000-0000-0000-0000-000000000007', 'teacher');

insert into public.classes (id, teacher_id, name, class_code)
values
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Matematyka 4F', 'FB01ABCD'),
  ('74000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', 'Matematyka 4G', 'FB02EFGH');

insert into public.class_memberships (class_id, student_id)
values
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003'),
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000004'),
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000005'),
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000006'),
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000007');

create temporary table feedback_exercise_fixtures (
  verification_id uuid primary key,
  approved_exercise_id uuid not null unique
);

create function pg_temp.insert_certified_feedback_exercise(
  exercise_id uuid,
  teacher_id uuid,
  answer_value integer,
  fixture_verified_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  structure jsonb;
  fixture_text text;
  fixture_answer text;
begin
  case answer_value
    when 1 then
      structure := '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":0},"right":{"kind":"number","value":1}}}'::jsonb;
      fixture_text := 'Oblicz wartość wyrażenia: (0 + 1). Podaj wynik jako jedną liczbę naturalną.';
      fixture_answer := '1';
    when 2 then
      structure := '{"version":1,"expression":{"kind":"add","left":{"kind":"number","value":1},"right":{"kind":"number","value":1}}}'::jsonb;
      fixture_text := 'Oblicz wartość wyrażenia: (1 + 1). Podaj wynik jako jedną liczbę naturalną.';
      fixture_answer := '2';
    else
      raise exception 'No independently reviewed feedback fixture exists for answer %', answer_value;
  end case;

  insert into public.exercise_verifications (
    id, teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
    grade, topic, difficulty, outcome, verified_answer, verifier_identity,
    verifier_version, verified_at, rationale, arithmetic_structure, authority_version
  )
  values (
    exercise_id, teacher_id, exercise_id::text, fixture_text,
    fixture_answer, '4', 'addition-subtraction', 'easy',
    'unique_answer', fixture_answer, 'test-verifier',
    'authority-v1', fixture_verified_at, 'Hand-calculated literal fixture; database authority checks the snapshot.',
    structure, 1
  );

  perform pg_catalog.set_config('request.jwt.claim.sub', teacher_id::text, true);
  insert into pg_temp.feedback_exercise_fixtures (verification_id, approved_exercise_id)
  select approval.verification_id, approval.exercise_id
  from public.approve_verified_exercises(array[exercise_id]) as approval;
  update public.exercises as exercise
  set approved_at = fixture_verified_at
  where exercise.verification_id = exercise_id;
end;
$$;

select pg_temp.insert_certified_feedback_exercise(
  '33000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  1,
  '2026-10-01 08:00:01+00'
);
select pg_temp.insert_certified_feedback_exercise(
  '33000000-0000-0000-0000-000000000002',
  '73000000-0000-0000-0000-000000000001',
  2,
  '2026-10-01 08:00:02+00'
);
select set_config('request.jwt.claim.sub', '', true);

alter table public.exercises disable trigger exercises_authority_insert;
insert into public.exercises (
  id, exercise_text, canonical_answer, grade, topic, difficulty,
  verification_verdict, verifier_identity, verifier_version, verified_at,
  verification_rationale, creator_id, approver_id
)
values (
  '33000000-0000-0000-0000-000000000099',
  'Legacy feedback prompt',
  'legacy expected',
  '4',
  'addition-subtraction',
  'easy',
  'unique_answer',
  'legacy-verifier',
  'old-model',
  '2026-10-01 08:00:36+00',
  'Legacy model-only result.',
  '73000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001'
);
alter table public.exercises enable trigger exercises_authority_insert;

insert into public.homework_assignments (
  id, class_id, teacher_id, title, grade, topic, difficulty, exercise_count,
  idempotency_key, request_fingerprint, created_at
)
values
  ('75000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Feedback homework', '4', 'addition-subtraction', 'easy', 2, '85000000-0000-0000-0000-000000000001', md5('75000000-0000-0000-0000-000000000001'), '2026-10-20 10:00:00+00'),
  ('75000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', null, '4', 'addition-subtraction', 'easy', 1, '85000000-0000-0000-0000-000000000002', md5('75000000-0000-0000-0000-000000000002'), '2026-10-21 10:00:00+00'),
  ('75000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Legacy feedback', '4', 'addition-subtraction', 'easy', 1, '85000000-0000-0000-0000-000000000003', md5('75000000-0000-0000-0000-000000000003'), '2026-10-19 10:00:00+00');

insert into public.homework_recipients (id, assignment_id, student_id, set_signature)
values
  ('76000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', 'a'),
  ('76000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000004', 'b'),
  ('76000000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000005', 'c'),
  ('76000000-0000-0000-0000-000000000004', '75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000006', 'd'),
  ('76000000-0000-0000-0000-000000000005', '75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000007', 'e'),
  ('76000000-0000-0000-0000-000000000006', '75000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000003', 'a2'),
  ('76000000-0000-0000-0000-000000000007', '75000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-000000000004', 'legacy');

insert into public.homework_recipient_exercises (recipient_id, exercise_id, position)
select recipient.recipient_id, fixture.approved_exercise_id, recipient.position::smallint
from (
  values
    ('76000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 1),
    ('76000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 2),
    ('76000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 1),
    ('76000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 2),
    ('76000000-0000-0000-0000-000000000003'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 1),
    ('76000000-0000-0000-0000-000000000003'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 2),
    ('76000000-0000-0000-0000-000000000004'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 1),
    ('76000000-0000-0000-0000-000000000004'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 2),
    ('76000000-0000-0000-0000-000000000005'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 1),
    ('76000000-0000-0000-0000-000000000005'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 2),
    ('76000000-0000-0000-0000-000000000006'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 1)
) as recipient(recipient_id, verification_id, position)
join pg_temp.feedback_exercise_fixtures as fixture
  on fixture.verification_id = recipient.verification_id;

insert into public.homework_recipient_exercises (recipient_id, exercise_id, position)
values ('76000000-0000-0000-0000-000000000007', '33000000-0000-0000-0000-000000000099', 1);

insert into public.homework_submissions (id, recipient_id, submitted_at, correct_count, assigned_count, passed)
values
  ('77000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '2026-10-22 10:00:00+00', 1, 2, true),
  ('77000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000002', '2026-10-22 10:01:00+00', 2, 2, true),
  ('77000000-0000-0000-0000-000000000003', '76000000-0000-0000-0000-000000000003', '2026-10-22 10:02:00+00', 0, 2, false),
  ('77000000-0000-0000-0000-000000000005', '76000000-0000-0000-0000-000000000005', '2026-10-22 10:03:00+00', 1, 2, true),
  ('77000000-0000-0000-0000-000000000007', '76000000-0000-0000-0000-000000000007', '2026-10-22 10:04:00+00', 0, 1, false);

insert into public.homework_submission_answers (
  submission_id, recipient_id, position, submitted_text, normalized_answer, is_correct
)
values
  ('77000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 1, '1', '1', true),
  ('77000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 2, '5', '5', false),
  ('77000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000002', 1, '1', '1', true),
  ('77000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000002', 2, '2', '2', true),
  ('77000000-0000-0000-0000-000000000003', '76000000-0000-0000-0000-000000000003', 1, '9', '9', false),
  ('77000000-0000-0000-0000-000000000003', '76000000-0000-0000-0000-000000000003', 2, null, null, false),
  ('77000000-0000-0000-0000-000000000005', '76000000-0000-0000-0000-000000000005', 1, '1', '1', true),
  ('77000000-0000-0000-0000-000000000005', '76000000-0000-0000-0000-000000000005', 2, '7', '7', false),
  ('77000000-0000-0000-0000-000000000007', '76000000-0000-0000-0000-000000000007', 1, '3', '3', false);

delete from public.class_memberships
where class_id = '74000000-0000-0000-0000-000000000001'
  and student_id = '73000000-0000-0000-0000-000000000005';

-- Storage boundary

select ok(
  (select relrowsecurity from pg_class where oid = 'public.homework_submission_feedback'::regclass),
  'The feedback table has row-level security enabled'
);
select ok(
  not has_table_privilege('anon', 'public.homework_submission_feedback', 'SELECT')
    and not has_table_privilege('anon', 'public.homework_submission_feedback', 'INSERT')
    and not has_table_privilege('anon', 'public.homework_submission_feedback', 'UPDATE')
    and not has_table_privilege('anon', 'public.homework_submission_feedback', 'DELETE')
    and not has_table_privilege('authenticated', 'public.homework_submission_feedback', 'SELECT')
    and not has_table_privilege('authenticated', 'public.homework_submission_feedback', 'INSERT')
    and not has_table_privilege('authenticated', 'public.homework_submission_feedback', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.homework_submission_feedback', 'DELETE'),
  'Anonymous and authenticated roles have no direct feedback table access'
);
select ok(
  has_function_privilege('authenticated', 'public.list_teacher_class_homework(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_teacher_homework_assignment(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_teacher_homework_submission(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.save_homework_submission_feedback(uuid,uuid,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.list_student_homework()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.list_teacher_class_homework(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_teacher_homework_assignment(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_teacher_homework_submission(uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.save_homework_submission_feedback(uuid,uuid,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.list_student_homework()', 'EXECUTE'),
  'Only authenticated sessions can execute the review RPC surface and the recreated student list'
);
select ok(
  not has_function_privilege('authenticated', 'public.owned_homework_assignment_summary(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.homework_submission_feedback_json(uuid)', 'EXECUTE'),
  'Internal review helpers are not directly executable'
);
select ok(
  (
    select bool_and(proc.prosecdef and proc.proconfig @> array['search_path=""'])
    from pg_proc as proc
    where proc.oid in (
      'public.list_teacher_class_homework(uuid)'::regprocedure,
      'public.get_teacher_homework_assignment(uuid)'::regprocedure,
      'public.get_teacher_homework_submission(uuid,uuid)'::regprocedure,
      'public.save_homework_submission_feedback(uuid,uuid,text)'::regprocedure,
      'public.list_student_homework()'::regprocedure,
      'public.get_student_homework(uuid)'::regprocedure
    )
  ),
  'Review and student RPCs are security definer with an empty search path'
);

-- Other teacher, student, dual-role peer and anonymous callers

set local role authenticated;

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select * from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000001')$$,
  'P0002', 'Class is unavailable', 'Another teacher cannot list this class homework'
);
select throws_ok(
  $$select public.get_teacher_homework_assignment('75000000-0000-0000-0000-000000000001')$$,
  'P0002', 'Homework is unavailable', 'Another teacher cannot read the assignment detail'
);
select throws_ok(
  $$select public.get_teacher_homework_submission('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003')$$,
  'P0002', 'Homework is unavailable', 'Another teacher cannot read a submission'
);
select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', 'Nie moja klasa')$$,
  'P0002', 'Homework is unavailable', 'Another teacher cannot save feedback'
);
select is(
  (select count(*) from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000002')),
  0::bigint,
  'A teacher sees an empty list for an owned class without homework'
);

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select * from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000001')$$,
  'P0002', 'Class is unavailable', 'A student cannot list class homework'
);
select throws_ok(
  $$select public.get_teacher_homework_assignment('75000000-0000-0000-0000-000000000001')$$,
  'P0002', 'Homework is unavailable', 'A student cannot read the teacher assignment detail'
);
select throws_ok(
  $$select public.get_teacher_homework_submission('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003')$$,
  'P0002', 'Homework is unavailable', 'A student cannot read the teacher view of their own submission'
);
select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', 'Sam sobie')$$,
  'P0002', 'Homework is unavailable', 'A student cannot save feedback'
);

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000007', true);
select throws_ok(
  $$select * from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000001')$$,
  'P0002', 'Class is unavailable', 'A dual-role member cannot list a class they do not own'
);
select throws_ok(
  $$select public.get_teacher_homework_submission('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003')$$,
  'P0002', 'Homework is unavailable', 'A dual-role member cannot read a classmate submission'
);

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select * from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000001')$$,
  'P0002', 'Class is unavailable', 'A session without a user cannot list class homework'
);
select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', 'Anonim')$$,
  'P0002', 'Homework is unavailable', 'A session without a user cannot save feedback'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Anonymous sessions cannot list class homework'
);
select throws_ok(
  $$select public.get_teacher_homework_assignment('75000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Anonymous sessions cannot read assignment detail'
);
select throws_ok(
  $$select public.get_teacher_homework_submission('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003')$$,
  '42501', null, 'Anonymous sessions cannot read a submission'
);
select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', 'Anonim')$$,
  '42501', null, 'Anonymous sessions cannot save feedback'
);
reset role;

-- Owning teacher reads

set local role authenticated;
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000001', true);

select is(
  (select array_agg(assignment_id::text order by ordinality) from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000001') with ordinality),
  array[
    '75000000-0000-0000-0000-000000000002',
    '75000000-0000-0000-0000-000000000001',
    '75000000-0000-0000-0000-000000000003'
  ],
  'The class homework list is ordered newest first'
);
select ok(
  (
    select homework.recipient_count = 5
      and homework.submitted_count = 4
      and homework.passed_count = 3
      and homework.feedback_count = 0
      and homework.exercise_count = 2
      and homework.title = 'Feedback homework'
    from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000001') as homework
    where homework.assignment_id = '75000000-0000-0000-0000-000000000001'
  ),
  'Assignment counts include departed and unsubmitted recipients'
);
select ok(
  (
    select homework.recipient_count = 1
      and homework.submitted_count = 0
      and homework.passed_count = 0
      and homework.feedback_count = 0
      and homework.title is null
    from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000001') as homework
    where homework.assignment_id = '75000000-0000-0000-0000-000000000002'
  ),
  'Pending assignments report zero submitted, passed and feedback counts'
);

select ok(
  (
    select detail #>> '{assignment,class_id}' = '74000000-0000-0000-0000-000000000001'
      and detail #>> '{assignment,class_name}' = 'Matematyka 4F'
      and jsonb_array_length(detail -> 'recipients') = 5
      and (
        select array_agg(recipient ->> 'student_email' order by ordinality)
        from jsonb_array_elements(detail -> 'recipients') with ordinality as item(recipient, ordinality)
      ) = array[
        'feedback-a-student@example.test',
        'feedback-b-classmate@example.test',
        'feedback-c-departed@example.test',
        'feedback-d-unsubmitted@example.test',
        'feedback-e-dual-role@example.test'
      ]
    from (select public.get_teacher_homework_assignment('75000000-0000-0000-0000-000000000001') as detail) as loaded
  ),
  'The assignment detail lists every recipient ordered by email'
);
select ok(
  (
    select detail #>> '{recipients,2,is_member}' = 'false'
      and detail #>> '{recipients,2,submitted}' = 'true'
      and detail #>> '{recipients,2,passed}' = 'false'
      and detail #>> '{recipients,3,is_member}' = 'true'
      and detail #>> '{recipients,3,submitted}' = 'false'
      and detail -> 'recipients' -> 3 -> 'submitted_at' = 'null'::jsonb
      and detail #>> '{recipients,0,correct_count}' = '1'
      and detail #>> '{recipients,0,has_feedback}' = 'false'
    from (select public.get_teacher_homework_assignment('75000000-0000-0000-0000-000000000001') as detail) as loaded
  ),
  'Recipient flags mark departed and unsubmitted students'
);
select ok(
  (
    select review #>> '{student,student_email}' = 'feedback-a-student@example.test'
      and review #>> '{student,is_member}' = 'true'
      and review #>> '{submission,correct_count}' = '1'
      and review #>> '{submission,assigned_count}' = '2'
      and review #>> '{submission,answers,0,prompt}' = 'Oblicz wartość wyrażenia: (0 + 1). Podaj wynik jako jedną liczbę naturalną.'
      and review #>> '{submission,answers,0,expected_answer}' = '1'
      and review #>> '{submission,answers,1,answer}' = '5'
      and review #>> '{submission,answers,1,is_correct}' = 'false'
      and review #>> '{submission,answers,1,expected_answer}' = '2'
      and review -> 'feedback' = 'null'::jsonb
    from (
      select public.get_teacher_homework_submission(
        '75000000-0000-0000-0000-000000000001',
        '73000000-0000-0000-0000-000000000003'
      ) as review
    ) as loaded
  ),
  'The teacher submission view includes prompts, answers, correctness and expected answers'
);
select ok(
  (
    select review -> 'submission' = 'null'::jsonb and review -> 'feedback' = 'null'::jsonb
    from (
      select public.get_teacher_homework_submission(
        '75000000-0000-0000-0000-000000000001',
        '73000000-0000-0000-0000-000000000006'
      ) as review
    ) as loaded
  ),
  'An unsubmitted recipient has no submission or feedback'
);
select throws_ok(
  $$select public.get_teacher_homework_submission('75000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000004')$$,
  'P0002', 'Homework is unavailable', 'A non-recipient student is unavailable'
);
select throws_ok(
  $$select public.get_teacher_homework_assignment('75000000-0000-0000-0000-000000000099')$$,
  'P0002', 'Homework is unavailable', 'An unknown assignment is unavailable'
);

-- Saving feedback

select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000006', 'Brak pracy')$$,
  'P0003', 'Feedback is not allowed', 'Unsubmitted homework cannot receive feedback'
);
select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000005', 'Po odejściu')$$,
  'P0003', 'Feedback is not allowed', 'A departed student cannot receive feedback'
);
select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', repeat('a', 2001))$$,
  '22023', 'Invalid feedback', 'Feedback longer than 2000 characters is rejected'
);
select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', null)$$,
  '22023', 'Invalid feedback', 'Null feedback is rejected'
);
select is(
  char_length(
    public.save_homework_submission_feedback(
      '75000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000003',
      '  ' || repeat('a', 2000) || E'\n'
    ) #>> '{feedback,body}'
  ),
  2000,
  'Surrounding whitespace is trimmed before the 2000-character limit'
);
select is(
  public.save_homework_submission_feedback(
    '75000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000003',
    E'  Dobra praca.\nPopraw zadanie 2.  '
  ) #>> '{feedback,body}',
  E'Dobra praca.\nPopraw zadanie 2.',
  'Saving feedback upserts the trimmed body and preserves line breaks'
);

reset role;
select is(
  (select count(*) from public.homework_submission_feedback where submission_id = '77000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Repeated saves keep one feedback row per submission'
);
update public.homework_submission_feedback
set updated_at = '2026-10-01 00:00:00+00'
where submission_id = '77000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000001', true);
select ok(
  (
    select (saved #>> '{feedback,updated_at}')::timestamptz > '2026-10-01 00:00:00+00'::timestamptz
      and saved #>> '{feedback,body}' = 'Świetnie!'
    from (
      select public.save_homework_submission_feedback(
        '75000000-0000-0000-0000-000000000001',
        '73000000-0000-0000-0000-000000000003',
        'Świetnie!'
      ) as saved
    ) as result
  ),
  'Editing feedback replaces the body and refreshes updated_at'
);
select is(
  public.save_homework_submission_feedback(
    '75000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000004',
    'Notatka dla kolegi'
  ) #>> '{feedback,body}',
  'Notatka dla kolegi',
  'The teacher can save feedback for another submitted classmate'
);
select is(
  public.save_homework_submission_feedback(
    '75000000-0000-0000-0000-000000000003',
    '73000000-0000-0000-0000-000000000004',
    'Notatka do starego zadania'
  ) #>> '{feedback,body}',
  'Notatka do starego zadania',
  'The teacher can save feedback on a legacy result-only submission'
);
select ok(
  (
    select homework.feedback_count = 2
    from public.list_teacher_class_homework('74000000-0000-0000-0000-000000000001') as homework
    where homework.assignment_id = '75000000-0000-0000-0000-000000000001'
  ),
  'The class list counts saved feedback'
);
select ok(
  (
    select detail #>> '{recipients,0,has_feedback}' = 'true'
      and detail #>> '{recipients,1,has_feedback}' = 'true'
      and detail #>> '{recipients,4,has_feedback}' = 'false'
    from (select public.get_teacher_homework_assignment('75000000-0000-0000-0000-000000000001') as detail) as loaded
  ),
  'The assignment detail marks recipients with feedback'
);
select is(
  public.get_teacher_homework_submission(
    '75000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000003'
  ) #>> '{feedback,body}',
  'Świetnie!',
  'The teacher submission view returns saved feedback'
);
select ok(
  (
    select review #>> '{submission,answers,0,expected_answer}' = 'legacy expected'
      and review #>> '{submission,answers,0,prompt}' = 'Legacy feedback prompt'
    from (
      select public.get_teacher_homework_submission(
        '75000000-0000-0000-0000-000000000003',
        '73000000-0000-0000-0000-000000000004'
      ) as review
    ) as loaded
  ),
  'The teacher sees the stored prompt and expected answer for legacy submissions'
);

-- Student visibility

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000003', true);
select ok(
  (select has_feedback from public.list_student_homework() where assignment_id = '75000000-0000-0000-0000-000000000001')
    and not (select has_feedback from public.list_student_homework() where assignment_id = '75000000-0000-0000-0000-000000000002'),
  'The student list flags only homework that has feedback'
);
select ok(
  (
    select detail ->> 'kind' = 'prompts'
      and detail #>> '{feedback,body}' = 'Świetnie!'
      and detail #>> '{feedback,updated_at}' is not null
      and not (detail::text ~* 'expected_answer|canonical_answer|Notatka|teacher_id')
    from (select public.get_student_homework('75000000-0000-0000-0000-000000000001') as detail) as loaded
  ),
  'The student detail returns only their own feedback and no expected answers'
);
select ok(
  public.get_student_homework('75000000-0000-0000-0000-000000000002') -> 'feedback' = 'null'::jsonb,
  'Pending homework has null feedback'
);

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000004', true);
select ok(
  (
    select detail #>> '{feedback,body}' = 'Notatka dla kolegi'
      and position('Świetnie' in detail::text) = 0
    from (select public.get_student_homework('75000000-0000-0000-0000-000000000001') as detail) as loaded
  ),
  'A classmate sees only their own feedback'
);
select ok(
  (
    select detail ->> 'kind' = 'result-only'
      and detail #>> '{feedback,body}' = 'Notatka do starego zadania'
      and not (detail::text ~* 'expected_answer|canonical_answer|legacy expected')
    from (select public.get_student_homework('75000000-0000-0000-0000-000000000003') as detail) as loaded
  ),
  'Result-only homework also exposes the student feedback without expected answers'
);

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000007', true);
select ok(
  (
    select not homework.has_feedback
    from public.list_student_homework() as homework
    where homework.assignment_id = '75000000-0000-0000-0000-000000000001'
  )
    and public.get_student_homework('75000000-0000-0000-0000-000000000001') -> 'feedback' = 'null'::jsonb,
  'A dual-role student never sees another student feedback'
);

-- Clearing feedback

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000001', true);
select ok(
  public.save_homework_submission_feedback(
    '75000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000004',
    E' \n\t '
  ) -> 'feedback' = 'null'::jsonb,
  'A blank body clears feedback'
);
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000004', true);
select ok(
  not (
    select homework.has_feedback
    from public.list_student_homework() as homework
    where homework.assignment_id = '75000000-0000-0000-0000-000000000001'
  )
    and public.get_student_homework('75000000-0000-0000-0000-000000000001') -> 'feedback' = 'null'::jsonb,
  'Cleared feedback disappears for the student'
);
reset role;
select is(
  (select count(*) from public.homework_submission_feedback where submission_id = '77000000-0000-0000-0000-000000000002'),
  0::bigint,
  'Clearing deletes the feedback row'
);

-- Departure

delete from public.class_memberships
where class_id = '74000000-0000-0000-0000-000000000001'
  and student_id = '73000000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000003', true);
select ok(
  not exists (
    select 1 from public.list_student_homework()
    where assignment_id = '75000000-0000-0000-0000-000000000001'
  ),
  'A departed student no longer sees homework with feedback in the list'
);
select throws_ok(
  $$select public.get_student_homework('75000000-0000-0000-0000-000000000001')$$,
  'P0002', 'Homework is unavailable', 'A departed student can no longer read their feedback'
);

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000001', true);
select ok(
  (
    select review #>> '{student,is_member}' = 'false'
      and review #>> '{feedback,body}' = 'Świetnie!'
    from (
      select public.get_teacher_homework_submission(
        '75000000-0000-0000-0000-000000000001',
        '73000000-0000-0000-0000-000000000003'
      ) as review
    ) as loaded
  ),
  'The teacher still sees existing feedback for a departed student'
);
select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', 'Po odejściu')$$,
  'P0003', 'Feedback is not allowed', 'Feedback for a departed student is read-only'
);
select throws_ok(
  $$select public.save_homework_submission_feedback('75000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', '')$$,
  'P0003', 'Feedback is not allowed', 'Feedback for a departed student cannot be cleared either'
);

reset role;
select * from finish();
rollback;
