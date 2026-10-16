begin;

select no_plan();

create temporary table homework_answer_format_cases (
  case_name text primary key,
  answer text not null,
  accepted boolean not null,
  case_order integer not null
);
\copy homework_answer_format_cases from 'homework-answer-format-cases.csv' with (format csv, header true)
grant select on homework_answer_format_cases to authenticated;

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
  ('71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'submission-teacher@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'submission-student@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'submission-classmate@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'submission-other-class@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'submission-departed@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'submission-dual-role@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now());

delete from public.profile_roles
where user_id in (
  '71000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000003',
  '71000000-0000-0000-0000-000000000004',
  '71000000-0000-0000-0000-000000000005',
  '71000000-0000-0000-0000-000000000006'
);

insert into public.profile_roles (user_id, role)
values
  ('71000000-0000-0000-0000-000000000001', 'teacher'),
  ('71000000-0000-0000-0000-000000000002', 'student'),
  ('71000000-0000-0000-0000-000000000003', 'student'),
  ('71000000-0000-0000-0000-000000000004', 'student'),
  ('71000000-0000-0000-0000-000000000005', 'student'),
  ('71000000-0000-0000-0000-000000000006', 'student'),
  ('71000000-0000-0000-0000-000000000006', 'teacher');

insert into public.classes (id, teacher_id, name, class_code)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Matematyka 4A', 'ST01ABCD'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'Matematyka 4B', 'ST02EFGH');

insert into public.class_memberships (class_id, student_id)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000005'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000006'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000004');

create function pg_temp.insert_certified_submission_exercise(
  exercise_id uuid,
  teacher_id uuid,
  answer_value integer,
  verified_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  structure jsonb := jsonb_build_object(
    'version', 1,
    'expression',
    jsonb_build_object(
      'kind', 'add',
      'left', jsonb_build_object('kind', 'number', 'value', answer_value / 2),
      'right', jsonb_build_object('kind', 'number', 'value', answer_value - answer_value / 2)
    )
  );
  derived jsonb;
begin
  derived := public.derive_arithmetic_exercise_v1(
    '4', 'addition-subtraction', 'easy', structure
  );

  insert into public.exercise_verifications (
    id, teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
    grade, topic, difficulty, outcome, verified_answer, verifier_identity,
    verifier_version, verified_at, rationale, arithmetic_structure, authority_version
  )
  values (
    exercise_id, teacher_id, exercise_id::text, derived ->> 'exercise_text',
    derived ->> 'canonical_answer', '4', 'addition-subtraction', 'easy',
    'unique_answer', derived ->> 'canonical_answer', 'test-verifier',
    'authority-v1', verified_at, 'Independently evaluated test fixture.',
    structure, 1
  );

  insert into public.exercises (
    id, exercise_text, canonical_answer, grade, topic, difficulty,
    verification_verdict, verifier_identity, verifier_version, verified_at,
    verification_rationale, creator_id, approver_id, approved_at,
    verification_id, arithmetic_structure, authority_version
  )
  values (
    exercise_id, derived ->> 'exercise_text', derived ->> 'canonical_answer',
    '4', 'addition-subtraction', 'easy', 'unique_answer', 'test-verifier',
    'authority-v1', verified_at, 'Independently evaluated test fixture.',
    teacher_id, teacher_id, verified_at, exercise_id, structure, 1
  );
end;
$$;

do $$
declare
  exercise_number integer;
  answer_value integer;
  exercise_id uuid;
begin
  for exercise_number in 1..40 loop
    if exercise_number = 36 then
      continue;
    end if;
    exercise_id := ('30000000-0000-0000-0000-' || lpad(exercise_number::text, 12, '0'))::uuid;
    answer_value := case exercise_number
      when 35 then 2
      when 37 then 0
      else 1
    end;
    perform pg_temp.insert_certified_submission_exercise(
      exercise_id,
      '71000000-0000-0000-0000-000000000001',
      answer_value,
      '2026-10-01 08:00:00+00'::timestamptz + exercise_number * interval '1 second'
    );
  end loop;
end;
$$;

alter table public.exercises disable trigger exercises_authority_insert;
insert into public.exercises (
  id, exercise_text, canonical_answer, grade, topic, difficulty,
  verification_verdict, verifier_identity, verifier_version, verified_at,
  verification_rationale, creator_id, approver_id
)
values (
  '30000000-0000-0000-0000-000000000036',
  'Legacy free-form prompt',
  'three apples',
  '4',
  'addition-subtraction',
  'easy',
  'unique_answer',
  'legacy-verifier',
  'old-model',
  '2026-10-01 08:00:36+00',
  'Legacy model-only result.',
  '71000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001'
);
alter table public.exercises enable trigger exercises_authority_insert;

insert into public.homework_assignments (
  id,
  class_id,
  teacher_id,
  title,
  grade,
  topic,
  difficulty,
  exercise_count,
  idempotency_key,
  request_fingerprint,
  created_at
)
values
  ('90000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Zero of one', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000001', md5('90000000-0000-0000-0000-000000000001'), '2026-10-01 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'One of one', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000002', md5('90000000-0000-0000-0000-000000000002'), '2026-10-02 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'One of two', '4', 'addition-subtraction', 'easy', 2, '80000000-0000-0000-0000-000000000003', md5('90000000-0000-0000-0000-000000000003'), '2026-10-03 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'One of three', '4', 'addition-subtraction', 'easy', 3, '80000000-0000-0000-0000-000000000004', md5('90000000-0000-0000-0000-000000000004'), '2026-10-04 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000005', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Two of three', '4', 'addition-subtraction', 'easy', 3, '80000000-0000-0000-0000-000000000005', md5('90000000-0000-0000-0000-000000000005'), '2026-10-05 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000006', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Two of five', '4', 'addition-subtraction', 'easy', 5, '80000000-0000-0000-0000-000000000006', md5('90000000-0000-0000-0000-000000000006'), '2026-10-06 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000007', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Three of five', '4', 'addition-subtraction', 'easy', 5, '80000000-0000-0000-0000-000000000007', md5('90000000-0000-0000-0000-000000000007'), '2026-10-07 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000008', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'All blank', '4', 'addition-subtraction', 'easy', 2, '80000000-0000-0000-0000-000000000008', md5('90000000-0000-0000-0000-000000000008'), '2026-10-08 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000009', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Large formatted values', '4', 'addition-subtraction', 'easy', 2, '80000000-0000-0000-0000-000000000009', md5('90000000-0000-0000-0000-000000000009'), '2026-10-09 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000010', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Unsupported canonical', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000010', md5('90000000-0000-0000-0000-000000000010'), '2026-10-10 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000011', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Classmate homework', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000011', md5('90000000-0000-0000-0000-000000000011'), '2026-10-11 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000012', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Departed homework', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000012', md5('90000000-0000-0000-0000-000000000012'), '2026-10-12 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000013', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Dual-role homework', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000013', md5('90000000-0000-0000-0000-000000000013'), '2026-10-13 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000014', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Teacher-only homework', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000014', md5('90000000-0000-0000-0000-000000000014'), '2026-10-14 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000015', '72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'Other-class homework', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000015', md5('90000000-0000-0000-0000-000000000015'), '2026-10-15 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000016', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Missing assigned row', '4', 'addition-subtraction', 'easy', 2, '80000000-0000-0000-0000-000000000016', md5('90000000-0000-0000-0000-000000000016'), '2026-10-16 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000017', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Non-contiguous assigned row', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000017', md5('90000000-0000-0000-0000-000000000017'), '2026-10-17 10:00:00+00'),
  ('90000000-0000-0000-0000-000000000018', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Mixed legacy allocation', '4', 'addition-subtraction', 'easy', 2, '80000000-0000-0000-0000-000000000018', md5('90000000-0000-0000-0000-000000000018'), '2026-09-30 09:00:00+00'),
  ('90000000-0000-0000-0000-000000000019', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Submitted legacy allocation', '4', 'addition-subtraction', 'easy', 1, '80000000-0000-0000-0000-000000000019', md5('90000000-0000-0000-0000-000000000019'), '2026-09-30 09:01:00+00');

insert into public.homework_recipients (id, assignment_id, student_id, set_signature)
values
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'zero-of-one'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'one-of-one'),
  ('91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000002', 'one-of-two'),
  ('91000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000002', 'one-of-three'),
  ('91000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000002', 'two-of-three'),
  ('91000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000002', 'two-of-five'),
  ('91000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000007', '71000000-0000-0000-0000-000000000002', 'three-of-five'),
  ('91000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000008', '71000000-0000-0000-0000-000000000002', 'all-blank'),
  ('91000000-0000-0000-0000-000000000009', '90000000-0000-0000-0000-000000000009', '71000000-0000-0000-0000-000000000002', 'large-values'),
  ('91000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000002', 'unsupported'),
  ('91000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000011', '71000000-0000-0000-0000-000000000003', 'classmate'),
  ('91000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000012', '71000000-0000-0000-0000-000000000005', 'departed'),
  ('91000000-0000-0000-0000-000000000013', '90000000-0000-0000-0000-000000000013', '71000000-0000-0000-0000-000000000006', 'dual-role'),
  ('91000000-0000-0000-0000-000000000015', '90000000-0000-0000-0000-000000000015', '71000000-0000-0000-0000-000000000004', 'other-class'),
  ('91000000-0000-0000-0000-000000000016', '90000000-0000-0000-0000-000000000016', '71000000-0000-0000-0000-000000000002', 'missing-row'),
  ('91000000-0000-0000-0000-000000000017', '90000000-0000-0000-0000-000000000017', '71000000-0000-0000-0000-000000000002', 'non-contiguous'),
  ('91000000-0000-0000-0000-000000000018', '90000000-0000-0000-0000-000000000018', '71000000-0000-0000-0000-000000000002', 'mixed-legacy'),
  ('91000000-0000-0000-0000-000000000019', '90000000-0000-0000-0000-000000000019', '71000000-0000-0000-0000-000000000002', 'submitted-legacy');

with assigned(recipient_id, exercise_number, position) as (
  values
    ('91000000-0000-0000-0000-000000000001'::uuid, 1, 1),
    ('91000000-0000-0000-0000-000000000002'::uuid, 2, 1),
    ('91000000-0000-0000-0000-000000000003'::uuid, 3, 1),
    ('91000000-0000-0000-0000-000000000003'::uuid, 4, 2),
    ('91000000-0000-0000-0000-000000000004'::uuid, 5, 1),
    ('91000000-0000-0000-0000-000000000004'::uuid, 6, 2),
    ('91000000-0000-0000-0000-000000000004'::uuid, 7, 3),
    ('91000000-0000-0000-0000-000000000005'::uuid, 8, 1),
    ('91000000-0000-0000-0000-000000000005'::uuid, 9, 2),
    ('91000000-0000-0000-0000-000000000005'::uuid, 10, 3),
    ('91000000-0000-0000-0000-000000000006'::uuid, 11, 1),
    ('91000000-0000-0000-0000-000000000006'::uuid, 12, 2),
    ('91000000-0000-0000-0000-000000000006'::uuid, 13, 3),
    ('91000000-0000-0000-0000-000000000006'::uuid, 14, 4),
    ('91000000-0000-0000-0000-000000000006'::uuid, 15, 5),
    ('91000000-0000-0000-0000-000000000007'::uuid, 16, 1),
    ('91000000-0000-0000-0000-000000000007'::uuid, 17, 2),
    ('91000000-0000-0000-0000-000000000007'::uuid, 18, 3),
    ('91000000-0000-0000-0000-000000000007'::uuid, 19, 4),
    ('91000000-0000-0000-0000-000000000007'::uuid, 20, 5),
    ('91000000-0000-0000-0000-000000000008'::uuid, 21, 1),
    ('91000000-0000-0000-0000-000000000008'::uuid, 22, 2),
    ('91000000-0000-0000-0000-000000000009'::uuid, 35, 1),
    ('91000000-0000-0000-0000-000000000009'::uuid, 37, 2),
    ('91000000-0000-0000-0000-000000000010'::uuid, 36, 1),
    ('91000000-0000-0000-0000-000000000011'::uuid, 23, 1),
    ('91000000-0000-0000-0000-000000000012'::uuid, 24, 1),
    ('91000000-0000-0000-0000-000000000013'::uuid, 25, 1),
    ('91000000-0000-0000-0000-000000000015'::uuid, 26, 1),
    ('91000000-0000-0000-0000-000000000016'::uuid, 39, 1),
    ('91000000-0000-0000-0000-000000000017'::uuid, 40, 2),
    ('91000000-0000-0000-0000-000000000018'::uuid, 1, 1),
    ('91000000-0000-0000-0000-000000000018'::uuid, 36, 2),
    ('91000000-0000-0000-0000-000000000019'::uuid, 36, 1)
)
insert into public.homework_recipient_exercises (recipient_id, exercise_id, position)
select
  assigned.recipient_id,
  ('30000000-0000-0000-0000-' || lpad(assigned.exercise_number::text, 12, '0'))::uuid,
  assigned.position::smallint
from assigned;

select ok(
  to_regclass('public.homework_submissions') is not null
    and to_regclass('public.homework_submission_answers') is not null,
  'Private final submission and answer tables exist'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.homework_submissions'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.homework_submission_answers'::regclass),
  'Both submission tables have row-level security enabled'
);
select ok(
  to_regprocedure('public.list_student_homework()') is not null
    and to_regprocedure('public.get_student_homework(uuid)') is not null
    and to_regprocedure('public.submit_student_homework(uuid,jsonb)') is not null,
  'Caller-scoped student list, detail, and submit functions exist'
);
select ok(
  has_function_privilege('authenticated', 'public.list_student_homework()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_student_homework(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.submit_student_homework(uuid,jsonb)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.list_student_homework()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_student_homework(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.submit_student_homework(uuid,jsonb)', 'EXECUTE'),
  'Only authenticated sessions can execute the student RPC surface'
);
select ok(
  not has_table_privilege('anon', 'public.homework_submissions', 'SELECT')
    and not has_table_privilege('anon', 'public.homework_submissions', 'INSERT')
    and not has_table_privilege('anon', 'public.homework_submissions', 'UPDATE')
    and not has_table_privilege('anon', 'public.homework_submissions', 'DELETE')
    and not has_table_privilege('authenticated', 'public.homework_submissions', 'SELECT')
    and not has_table_privilege('authenticated', 'public.homework_submissions', 'INSERT')
    and not has_table_privilege('authenticated', 'public.homework_submissions', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.homework_submissions', 'DELETE')
    and not has_table_privilege('anon', 'public.homework_submission_answers', 'SELECT')
    and not has_table_privilege('anon', 'public.homework_submission_answers', 'INSERT')
    and not has_table_privilege('anon', 'public.homework_submission_answers', 'UPDATE')
    and not has_table_privilege('anon', 'public.homework_submission_answers', 'DELETE')
    and not has_table_privilege('authenticated', 'public.homework_submission_answers', 'SELECT')
    and not has_table_privilege('authenticated', 'public.homework_submission_answers', 'INSERT')
    and not has_table_privilege('authenticated', 'public.homework_submission_answers', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.homework_submission_answers', 'DELETE')
    and not has_table_privilege('anon', 'public.homework_recipient_exercises', 'SELECT')
    and not has_table_privilege('authenticated', 'public.homework_recipient_exercises', 'SELECT'),
  'Anonymous and authenticated roles have no direct submission or assigned-exercise access'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.list_student_homework()),
  14::bigint,
  'The student list contains only this caller’s fourteen allocated assignments'
);
select ok(
  not exists (
    select 1
    from public.list_student_homework()
    where assignment_id in (
      '90000000-0000-0000-0000-000000000011',
      '90000000-0000-0000-0000-000000000012',
      '90000000-0000-0000-0000-000000000013',
      '90000000-0000-0000-0000-000000000015'
    )
  ),
  'The list does not disclose classmates, departed students, dual-role peers, or other classes'
);
select ok(
  not (
    select to_jsonb(homework)
    ?| array['canonical_answer', 'student_email', 'recipient_id', 'exercise_id']
    from public.list_student_homework() as homework
    limit 1
  ),
  'List results expose only allowlisted assignment and class metadata'
);
select ok(
  (public.get_student_homework('90000000-0000-0000-0000-000000000001') -> 'exercises' -> 0 ->> 'prompt')
      = 'Oblicz wartość wyrażenia: (0 + 1). Podaj wynik jako jedną liczbę naturalną.'
    and not (
      public.get_student_homework('90000000-0000-0000-0000-000000000001')::text
      ~* 'canonical_answer|verified_answer|verification_rationale|student_email'
    ),
  'Detail returns the caller’s ordered prompt without canonical, verifier, or roster data'
);
select throws_ok(
  $$select public.get_student_homework('90000000-0000-0000-0000-000000000018')$$,
  'P0002',
  'Homework is unavailable',
  'A mixed legacy allocation returns no partial prompt detail'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000018',
      '[{"position":1,"answer":"1"},{"position":2,"answer":"three apples"}]'::jsonb
    )$$,
  'P0002',
  'Homework is unavailable',
  'A mixed legacy allocation cannot be scored on first submission'
);
select is(
  (select count(*) from public.exercises where id = '30000000-0000-0000-0000-000000000001'),
  0::bigint,
  'A student cannot read the canonical answer from the approved exercise pool'
);
select is(
  (select count(*) from public.exercises where id = '30000000-0000-0000-0000-000000000036'),
  0::bigint,
  'A student cannot read a quarantined exercise statement through direct table access'
);
select is(
  (select count(*) from public.exercise_verifications),
  0::bigint,
  'A student cannot read candidate statements through direct verification-table access'
);
select throws_ok(
  $$select public.get_student_homework('90000000-0000-0000-0000-000000000099')$$,
  'P0002',
  'Homework is unavailable',
  'An unknown assignment has the generic unavailable outcome'
);
select throws_ok(
  $$select public.get_student_homework('90000000-0000-0000-0000-000000000011')$$,
  'P0002',
  'Homework is unavailable',
  'A classmate assignment has the same unavailable outcome'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000011',
      '[{"position":1,"answer":"1"}]'::jsonb
    )$$,
  'P0002',
  'Homework is unavailable',
  'A caller cannot submit another student’s allocation'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000099',
      '[{"position":1,"answer":"1"}]'::jsonb
    )$$,
  'P0002',
  'Homework is unavailable',
  'An unknown assignment has the generic unavailable outcome for submit'
);
select throws_ok(
  $$select * from public.homework_submissions$$,
  '42501',
  null,
  'Authenticated users cannot read final submission rows directly'
);
select throws_ok(
  $$insert into public.homework_submissions (recipient_id, correct_count, assigned_count, passed)
    values ('91000000-0000-0000-0000-000000000001', 0, 1, false)$$,
  '42501',
  null,
  'Authenticated users cannot create final submission rows directly'
);
select throws_ok(
  $$update public.homework_submission_answers
    set submitted_text = 'changed'$$,
  '42501',
  null,
  'Authenticated users cannot update persisted answers'
);
select throws_ok(
  $$delete from public.homework_submissions$$,
  '42501',
  null,
  'Authenticated users cannot delete persisted results'
);

select throws_ok(
  $$select public.submit_student_homework('90000000-0000-0000-0000-000000000003', null::jsonb)$$,
  '22023',
  'Invalid homework answers',
  'SQL null is not a positional answer vector'
);
select throws_ok(
  $$select public.submit_student_homework('90000000-0000-0000-0000-000000000003', '{}'::jsonb)$$,
  '22023',
  'Invalid homework answers',
  'An object is not an answer array'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":1,"answer":"1"}]'::jsonb
    )$$,
  '22023',
  'Invalid homework answers',
  'An omitted assigned position is rejected'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":1,"answer":"1"},{"position":1,"answer":"2"}]'::jsonb
    )$$,
  '22023',
  'Invalid homework answers',
  'A duplicate assigned position is rejected'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":1,"answer":"1"},{"position":3,"answer":"2"}]'::jsonb
    )$$,
  '22023',
  'Invalid homework answers',
  'An unknown or extra position is rejected'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":1,"answer":"1","correct":true},{"position":2,"answer":"2"}]'::jsonb
    )$$,
  '22023',
  'Invalid homework answers',
  'Client score and correctness fields are rejected'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":1},{"position":2,"answer":"2"}]'::jsonb
    )$$,
  '22023',
  'Invalid homework answers',
  'An answer item without the answer property is rejected'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":1,"answer":1},{"position":2,"answer":"2"}]'::jsonb
    )$$,
  '22023',
  'Invalid homework answers',
  'A non-string, non-null answer value is rejected'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":"1","answer":"1"},{"position":2,"answer":"2"}]'::jsonb
    )$$,
  '22023',
  'Invalid homework answers',
  'Positions must be numeric integers'
);
select throws_ok(
  format(
    'select public.submit_student_homework(%L, %L::jsonb)',
    '90000000-0000-0000-0000-000000000003',
    '[{"position":1,"answer":"' || repeat('1', 201) || '"},{"position":2,"answer":"2"}]'
  ),
  '22023',
  'Invalid homework answers',
  'A raw answer longer than 200 characters is rejected'
);
select throws_ok(
  format(
    'select public.submit_student_homework(%L, %L::jsonb)',
    '90000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('position', 1, 'answer', answer))::text
  ),
  '22023',
  'Invalid homework answers',
  case_name || ' is rejected as an invalid answer format'
)
from homework_answer_format_cases
where not accepted;
reset role;
select is(
  (select count(*) from public.homework_submissions),
  0::bigint,
  'Rejected answer shapes and formats leave no submission rows'
);
select is(
  (select count(*) from public.homework_submission_answers),
  0::bigint,
  'Rejected answer shapes and formats leave no partial answer rows'
);
select is(
  (select count(*) from public.homework_submissions where recipient_id = '91000000-0000-0000-0000-000000000018'),
  0::bigint,
  'Mixed legacy detail and first submit leave no submission row'
);
select is(
  (select count(*) from public.homework_submission_answers where recipient_id = '91000000-0000-0000-0000-000000000018'),
  0::bigint,
  'Mixed legacy detail and first submit leave no answer rows'
);

set local role service_role;
insert into public.homework_submissions (
  id, recipient_id, submitted_at, correct_count, assigned_count, passed
)
values (
  '92000000-0000-0000-0000-000000000019',
  '91000000-0000-0000-0000-000000000019',
  '2026-09-30 10:00:00+00',
  0,
  1,
  false
);
insert into public.homework_submission_answers (
  submission_id, recipient_id, position, submitted_text, normalized_answer, is_correct
)
values (
  '92000000-0000-0000-0000-000000000019',
  '91000000-0000-0000-0000-000000000019',
  1,
  '5',
  '5',
  false
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);

select ok(
  (
    select (result ->> 'correct_count')::integer = 0
      and (result ->> 'assigned_count')::integer = 1
      and result ->> 'passed' = 'false'
      and result ->> 'replayed' = 'false'
      and nullif(result ->> 'submission_id', '') is not null
      and nullif(result ->> 'submitted_at', '') is not null
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000001',
      '[{"position":1,"answer":"2"}]'::jsonb
    ) as result
  ),
  'Zero of one fails and returns its persisted first-submission result'
);
select ok(
  (
    select (result ->> 'correct_count')::integer = 1
      and (result ->> 'assigned_count')::integer = 1
      and result ->> 'passed' = 'true'
      and result #>> '{answers,0,answer}' = '0001'
      and result #>> '{answers,0,normalized_answer}' = '1'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000002',
      '[{"position":1,"answer":"0001"}]'::jsonb
    ) as result
  ),
  'One of one passes and preserves leading-zero text while normalizing it'
);
select ok(
  (
    select (result ->> 'correct_count')::integer = 1
      and (result ->> 'assigned_count')::integer = 2
      and result ->> 'passed' = 'true'
      and result ->> 'replayed' = 'false'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":1,"answer":"0001"},{"position":2,"answer":"2"}]'::jsonb
    ) as result
  ),
  'One of two passes exactly at the 50 percent threshold'
);
select is(
  (
    select result ->> 'submission_id'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":2,"answer":"0002"},{"position":1,"answer":" 1 "}]'::jsonb
    ) as result
  ),
  public.get_student_homework('90000000-0000-0000-0000-000000000003')
    -> 'submission' ->> 'submission_id',
  'An equivalent reordered and reformatted retry returns the original submission'
);
select ok(
  (
    select result ->> 'replayed' = 'true'
      and result #>> '{answers,0,answer}' = '0001'
      and result #>> '{answers,1,answer}' = '2'
      and result #>> '{answers,0,is_correct}' = 'true'
      and result #>> '{answers,1,is_correct}' = 'false'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":2,"answer":"0002"},{"position":1,"answer":" 1 "}]'::jsonb
    ) as result
  ),
  'Equivalent retries replay the original ordered raw answers'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000003',
      '[{"position":1,"answer":"2"},{"position":2,"answer":"2"}]'::jsonb
    )$$,
  'P0003',
  'Homework has already been submitted',
  'A changed answer vector conflicts without replacing the final result'
);
reset role;
select is(
  (
    select string_agg(position::text || ':' || submitted_text, ',' order by position)
    from public.homework_submission_answers
    where recipient_id = '91000000-0000-0000-0000-000000000003'
  ),
  '1:0001,2:2',
  'A replay conflict leaves the original answer rows immutable'
);

set local role service_role;
select throws_ok(
  $$insert into public.homework_submission_answers (
      submission_id, recipient_id, position, submitted_text, normalized_answer, is_correct
    )
    values (
      (select id from public.homework_submissions where recipient_id = '91000000-0000-0000-0000-000000000001'),
      '91000000-0000-0000-0000-000000000003',
      2,
      '1',
      '1',
      true
    )$$,
  '23503',
  null,
  'A submission answer cannot be attached to another recipient'
);
select throws_ok(
  $$insert into public.homework_submission_answers (
      submission_id, recipient_id, position, submitted_text, normalized_answer, is_correct
    )
    values (
      (select id from public.homework_submissions where recipient_id = '91000000-0000-0000-0000-000000000003'),
      '91000000-0000-0000-0000-000000000003',
      3,
      '1',
      '1',
      true
    )$$,
  '23503',
  null,
  'A submission answer must reference an assigned recipient position'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);

select ok(
  (
    select (result ->> 'correct_count')::integer = 1
      and (result ->> 'assigned_count')::integer = 3
      and result ->> 'passed' = 'false'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000004',
      '[{"position":1,"answer":"1"},{"position":2,"answer":"2"},{"position":3,"answer":"3"}]'::jsonb
    ) as result
  ),
  'One of three fails below the exact pass threshold'
);
select ok(
  (
    select (result ->> 'correct_count')::integer = 2
      and (result ->> 'assigned_count')::integer = 3
      and result ->> 'passed' = 'true'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000005',
      '[{"position":1,"answer":"1"},{"position":2,"answer":"0001"},{"position":3,"answer":"2"}]'::jsonb
    ) as result
  ),
  'Two of three passes'
);
select ok(
  (
    select (result ->> 'correct_count')::integer = 2
      and (result ->> 'assigned_count')::integer = 5
      and result ->> 'passed' = 'false'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000006',
      '[{"position":1,"answer":"1"},{"position":2,"answer":"1"},{"position":3,"answer":"2"},{"position":4,"answer":"2"},{"position":5,"answer":"2"}]'::jsonb
    ) as result
  ),
  'Two of five fails below the exact pass threshold'
);
select ok(
  (
    select (result ->> 'correct_count')::integer = 3
      and (result ->> 'assigned_count')::integer = 5
      and result ->> 'passed' = 'true'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000007',
      '[{"position":1,"answer":"1"},{"position":2,"answer":"1"},{"position":3,"answer":"1"},{"position":4,"answer":"2"},{"position":5,"answer":"2"}]'::jsonb
    ) as result
  ),
  'Three of five passes'
);
select ok(
  (
    select (result ->> 'correct_count')::integer = 0
      and (result ->> 'assigned_count')::integer = 2
      and result ->> 'passed' = 'false'
      and result #>> '{answers,0,answer}' is null
      and result #>> '{answers,0,is_correct}' = 'false'
      and result #>> '{answers,1,answer}' = E' \t\n '
      and result #>> '{answers,1,is_correct}' = 'false'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000008',
      '[{"position":1,"answer":null},{"position":2,"answer":" \t\n "}]'::jsonb
    ) as result
  ),
  'Null and whitespace-only answers are preserved as incorrect blanks'
);
select ok(
  (
    select (result ->> 'correct_count')::integer = 1
      and (result ->> 'assigned_count')::integer = 2
      and result ->> 'passed' = 'true'
      and result #>> '{answers,0,normalized_answer}' = '1234567890123456789012345678901234567890'
      and result #>> '{answers,1,normalized_answer}' = '0'
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000009',
      (
        select jsonb_agg(
          jsonb_build_object('position', position, 'answer', answer)
          order by position
        )
        from (
          select
            case_order as position,
            answer
          from homework_answer_format_cases
          where accepted
        ) as accepted_cases
      )
    ) as result
  ),
  'Grouped large string integers, outer whitespace, leading zeros, and zero normalize without numeric conversion'
);
select is(
  (select assignment_id::text from public.list_student_homework() limit 1),
  '90000000-0000-0000-0000-000000000017',
  'Pending assignments sort before submitted homework'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000016',
      '[{"position":1,"answer":"1"},{"position":2,"answer":"1"}]'::jsonb
    )$$,
  'P0004',
  'Homework scoring is unavailable',
  'An assigned-row count mismatch is not used to derive a denominator'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000017',
      '[{"position":1,"answer":"1"}]'::jsonb
    )$$,
  'P0004',
  'Homework scoring is unavailable',
  'Non-contiguous assigned positions are rejected'
);

reset role;
select pg_temp.insert_certified_submission_exercise(
  '30000000-0000-0000-0000-000000000099',
  '71000000-0000-0000-0000-000000000001',
  42,
  now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);

select ok(
  (
    select detail -> 'submission' ->> 'correct_count' = '2'
      and detail -> 'submission' ->> 'assigned_count' = '3'
      and jsonb_array_length(detail -> 'exercises') = 3
    from (
      select public.get_student_homework('90000000-0000-0000-0000-000000000005') as detail
    ) as saved
  ),
  'A saved result and assigned exercise set survive later pool additions'
);
select ok(
  (
    public.get_student_homework('90000000-0000-0000-0000-000000000005') #>> '{submission,answers,0,answer}' = '1'
  )
    and position(
      '@example.test' in public.get_student_homework('90000000-0000-0000-0000-000000000005')::text
    ) = 0
    and not (
      public.get_student_homework('90000000-0000-0000-0000-000000000005')::text
      ~* 'canonical_answer|verified_answer|verification_rationale|student_email'
    ),
  'Saved-result reads expose only this student’s answers and correctness'
);
select ok(
  (
    select detail ->> 'kind' = 'result-only'
      and detail -> 'assignment' ->> 'assignment_id' = '90000000-0000-0000-0000-000000000019'
      and detail -> 'result' ->> 'correct_count' = '0'
      and detail -> 'result' ->> 'assigned_count' = '1'
      and detail -> 'result' ->> 'passed' = 'false'
      and detail #>> '{result,answers,0,position}' = '1'
      and detail #>> '{result,answers,0,answer}' = '5'
      and detail #>> '{result,answers,0,is_correct}' = 'false'
      and not (detail ? 'exercises')
      and not (detail::text ~* 'legacy free-form prompt|canonical_answer|normalized_answer|authority|verification')
    from (
      select public.get_student_homework('90000000-0000-0000-0000-000000000019') as detail
    ) as saved
  ),
  'Submitted legacy homework returns only persisted result data without prompts or authority internals'
);
select ok(
  (
    select result ->> 'kind' = 'result-only'
      and result ->> 'replayed' = 'true'
      and result ->> 'submission_id' = '92000000-0000-0000-0000-000000000019'
      and result #>> '{answers,0,answer}' = '5'
      and result #>> '{answers,0,is_correct}' = 'false'
      and not (result::text ~* 'legacy free-form prompt|canonical_answer|normalized_answer|authority|verification')
    from public.submit_student_homework(
      '90000000-0000-0000-0000-000000000019',
      '[{"position":1,"answer":"5"}]'::jsonb
    ) as result
  ),
  'An equivalent retry of submitted legacy homework returns its unchanged prompt-free result'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000019',
      '[{"position":1,"answer":"6"}]'::jsonb
    )$$,
  'P0003',
  'Homework has already been submitted',
  'A changed retry of submitted legacy homework conflicts'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000018',
      '[{"position":1,"answer":"1"},{"position":2,"answer":"three apples"}]'::jsonb
    )$$,
  'P0002',
  'Homework is unavailable',
  'Pending mixed legacy homework remains unavailable before finalization'
);
reset role;
select is(
  (select count(*) from public.homework_submissions where recipient_id = '91000000-0000-0000-0000-000000000018'),
  0::bigint,
  'Pending mixed legacy homework leaves no submission row'
);
select is(
  (select count(*) from public.homework_submission_answers where recipient_id = '91000000-0000-0000-0000-000000000018'),
  0::bigint,
  'Pending mixed legacy homework leaves no answer rows'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$select public.get_student_homework('90000000-0000-0000-0000-000000000011')$$,
  'P0002',
  'Homework is unavailable',
  'Teacher status alone does not grant student homework access'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
select ok(
  public.get_student_homework('90000000-0000-0000-0000-000000000011') -> 'assignment' ->> 'assignment_id'
    = '90000000-0000-0000-0000-000000000011',
  'A classmate can read only their own recipient allocation'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000004', true);
select ok(
  public.get_student_homework('90000000-0000-0000-0000-000000000015') -> 'assignment' ->> 'class_name'
    = 'Matematyka 4B',
  'A current member can read their own allocation in another class'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000005', true);
select ok(
  public.get_student_homework('90000000-0000-0000-0000-000000000012') -> 'assignment' ->> 'assignment_id'
    = '90000000-0000-0000-0000-000000000012',
  'A current member can read their own pending allocation before departure'
);
select ok(
  (public.submit_student_homework(
    '90000000-0000-0000-0000-000000000012',
    '[{"position":1,"answer":"1"}]'::jsonb
  ) ->> 'passed') = 'true',
  'A current member can persist a final result before departure'
);

reset role;
delete from public.class_memberships
where class_id = '72000000-0000-0000-0000-000000000001'
  and student_id = '71000000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$select public.get_student_homework('90000000-0000-0000-0000-000000000012')$$,
  'P0002',
  'Homework is unavailable',
  'A departed member cannot read a previously saved result'
);
select throws_ok(
  $$select public.submit_student_homework(
      '90000000-0000-0000-0000-000000000012',
      '[{"position":1,"answer":"0001"}]'::jsonb
    )$$,
  'P0002',
  'Homework is unavailable',
  'A departed member cannot replay a previously saved result'
);
select ok(
  not exists (
    select 1
    from public.list_student_homework()
    where assignment_id = '90000000-0000-0000-0000-000000000012'
  ),
  'A departed member no longer sees the saved assignment in the list'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000006', true);
select ok(
  (public.submit_student_homework(
    '90000000-0000-0000-0000-000000000013',
    '[{"position":1,"answer":"1"}]'::jsonb
  ) ->> 'passed') = 'true',
  'A dual-role account can use its own current student allocation'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.list_student_homework()$$,
  '42501',
  null,
  'Anonymous sessions cannot list student homework'
);
select throws_ok(
  $$select public.get_student_homework('90000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'Anonymous sessions cannot read homework detail'
);
select throws_ok(
  $$select public.submit_student_homework('90000000-0000-0000-0000-000000000001', '[{"position":1,"answer":"1"}]'::jsonb)$$,
  '42501',
  null,
  'Anonymous sessions cannot submit homework'
);

reset role;
select is(
  (select count(*) from public.homework_submissions),
  12::bigint,
  'Only the nine scoring fixtures, departed member, dual-role member, and retained legacy result exist'
);
select is(
  (select count(*) from public.homework_submission_answers),
  27::bigint,
  'Every successful submission and retained legacy result has one answer per assigned position'
);

select * from finish();
rollback;
