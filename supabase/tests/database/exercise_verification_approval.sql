create temporary table dblink_extension_state (was_installed boolean not null);

insert into dblink_extension_state
select exists (select 1 from pg_extension where extname = 'dblink');

create extension if not exists dblink with schema extensions;

begin;

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
    'approval-teacher-one@example.test',
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
    'approval-teacher-two@example.test',
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
    'approval-student@example.test',
    'not-used-by-tests',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

update public.profiles
set role = 'student'
where id = '10000000-0000-0000-0000-000000000003';

insert into public.exercise_verifications (
  id,
  teacher_id,
  candidate_id,
  candidate_text,
  proposed_canonical_answer,
  grade,
  topic,
  difficulty,
  outcome,
  verified_answer,
  verifier_identity,
  verifier_version,
  verified_at,
  rationale
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'candidate-a',
    'Ile to jest 2 + 2?',
    '4',
    '4',
    'addition-subtraction',
    'easy',
    'unique_answer',
    '4',
    'openrouter-strategy-v1',
    'model-a',
    '2026-09-29 10:00:00+00',
    'Jedyną poprawną odpowiedzią jest 4.'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'candidate-b',
    'Ile to jest 3 razy 3?',
    '9',
    '4',
    'multiplication-division',
    'medium',
    'unique_answer',
    '9',
    'openrouter-strategy-v1',
    'model-a',
    '2026-09-29 10:01:00+00',
    'Jedyną poprawną odpowiedzią jest 9.'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'candidate-c',
    'Oblicz 12 - 5.',
    '7',
    '4',
    'addition-subtraction',
    'hard',
    'unique_answer',
    '7',
    'openrouter-strategy-v1',
    'model-a',
    '2026-09-29 10:02:00+00',
    'Jedyną poprawną odpowiedzią jest 7.'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'candidate-mismatch',
    'Ile to jest 2 + 3?',
    '6',
    '4',
    'addition-subtraction',
    'easy',
    'answer_mismatch',
    '5',
    'openrouter-strategy-v1',
    'model-a',
    '2026-09-29 10:03:00+00',
    'Poprawną odpowiedzią jest 5, a nie 6.'
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'candidate-not-unique',
    'Podaj liczbę większą od 2.',
    '3',
    '4',
    'word-problems',
    'easy',
    'not_unique_answer',
    null,
    'openrouter-strategy-v1',
    'model-a',
    '2026-09-29 10:04:00+00',
    'Zadanie dopuszcza wiele poprawnych odpowiedzi.'
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000002',
    'candidate-other-owner',
    'Ile to jest 8 + 1?',
    '9',
    '4',
    'addition-subtraction',
    'easy',
    'unique_answer',
    '9',
    'openrouter-strategy-v1',
    'model-a',
    '2026-09-29 10:05:00+00',
    'Jedyną poprawną odpowiedzią jest 9.'
  ),
  (
    '20000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000001',
    'candidate-concurrent-a',
    'Ile to jest 10 + 1?',
    '11',
    '4',
    'addition-subtraction',
    'easy',
    'unique_answer',
    '11',
    'openrouter-strategy-v1',
    'model-a',
    '2026-09-29 10:06:00+00',
    'Jedyną poprawną odpowiedzią jest 11.'
  ),
  (
    '20000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000001',
    'candidate-concurrent-b',
    'Ile to jest 10 + 2?',
    '12',
    '4',
    'addition-subtraction',
    'easy',
    'unique_answer',
    '12',
    'openrouter-strategy-v1',
    'model-a',
    '2026-09-29 10:07:00+00',
    'Jedyną poprawną odpowiedzią jest 12.'
  );

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
  approver_id
)
values (
  '30000000-0000-0000-0000-000000000001',
  'Legacy exercise without provenance',
  'legacy answer',
  '4',
  'word-problems',
  'easy',
  'unique_answer',
  'legacy-verifier',
  'legacy-model',
  '2026-09-23 12:00:00+00',
  'Legacy evidence remains valid.',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001'
);

commit;

begin;

select plan(44);

select ok(
  to_regclass('public.exercise_verifications') is not null,
  'The verification ledger exists'
);

select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercises'
      and column_name = 'verification_id'
  ),
  'YES',
  'Legacy exercises may omit verification provenance'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.exercises'::regclass
      and conname in ('exercises_verification_id_foreign', 'exercises_verification_id_unique')
      and contype in ('f', 'u')
  ),
  2::bigint,
  'Exercise provenance is foreign-keyed and unique'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercise_verifications'
      and column_name in (
        'teacher_id',
        'candidate_id',
        'candidate_text',
        'proposed_canonical_answer',
        'grade',
        'topic',
        'difficulty',
        'outcome',
        'verifier_identity',
        'verifier_version',
        'verified_at',
        'rationale'
      )
      and is_nullable = 'YES'
  ),
  'Verification snapshots and evidence are required'
);

select throws_ok(
  $$insert into public.exercise_verifications (
      teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
      grade, topic, difficulty, outcome, verified_answer, verifier_identity,
      verifier_version, verified_at, rationale
    ) values (
      '10000000-0000-0000-0000-000000000001', 'blank-text', '', '4',
      '4', 'addition-subtraction', 'easy', 'unique_answer', '4', 'verifier',
      'model', now(), 'One answer.'
    )$$,
  '23514',
  null,
  'Candidate text cannot be blank'
);

select throws_ok(
  $$insert into public.exercise_verifications (
      teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
      grade, topic, difficulty, outcome, verified_answer, verifier_identity,
      verifier_version, verified_at, rationale
    ) values (
      '10000000-0000-0000-0000-000000000001', 'unsupported-outcome', 'Text', '4',
      '4', 'addition-subtraction', 'easy', 'indeterminate', null, 'verifier',
      'model', now(), 'Provider failed.'
    )$$,
  '23514',
  null,
  'Transient technical outcomes cannot enter the ledger'
);

select throws_ok(
  $$insert into public.exercise_verifications (
      teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
      grade, topic, difficulty, outcome, verified_answer, verifier_identity,
      verifier_version, verified_at, rationale
    ) values (
      '10000000-0000-0000-0000-000000000001', 'missing-answer', 'Text', '4',
      '4', 'addition-subtraction', 'easy', 'unique_answer', null, 'verifier',
      'model', now(), 'One answer.'
    )$$,
  '23514',
  null,
  'A unique-answer result requires its verified answer'
);

select throws_ok(
  $$insert into public.exercise_verifications (
      teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
      grade, topic, difficulty, outcome, verified_answer, verifier_identity,
      verifier_version, verified_at, rationale
    ) values (
      '10000000-0000-0000-0000-000000000001', 'unexpected-answer', 'Text', '4',
      '4', 'word-problems', 'easy', 'not_unique_answer', '4', 'verifier',
      'model', now(), 'Many answers.'
    )$$,
  '23514',
  null,
  'A non-unique result cannot claim one verified answer'
);

select throws_ok(
  $$insert into public.exercise_verifications (
      teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
      grade, topic, difficulty, outcome, verified_answer, verifier_identity,
      verifier_version, verified_at, rationale
    ) values (
      '10000000-0000-0000-0000-000000000001', 'candidate-a', 'Different text', '5',
      '4', 'addition-subtraction', 'easy', 'answer_mismatch', '4', 'verifier',
      'model', now(), 'Different snapshot.'
    )$$,
  '23505',
  null,
  'A teacher and candidate ID identify one immutable result'
);

select ok(
  has_table_privilege('authenticated', 'public.exercise_verifications', 'SELECT'),
  'Authenticated users receive ledger read access'
);

select ok(
  not has_table_privilege('authenticated', 'public.exercise_verifications', 'INSERT'),
  'Authenticated users receive no ledger insert grant'
);

select ok(
  not has_table_privilege('authenticated', 'public.exercise_verifications', 'UPDATE'),
  'Authenticated users receive no ledger update grant'
);

select ok(
  not has_table_privilege('authenticated', 'public.exercise_verifications', 'DELETE'),
  'Authenticated users receive no ledger delete grant'
);

select ok(
  not exists (
    select 1
    from pg_proc as procedure
    cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) as privilege
    where procedure.oid = 'public.approve_verified_exercises(uuid[])'::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'The approval function has no public execution grant'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.approve_verified_exercises(uuid[])',
    'EXECUTE'
  ),
  'Authenticated sessions may execute the approval function'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*) from public.exercise_verifications),
  7::bigint,
  'A teacher can read only their own verification results'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.exercise_verifications),
  1::bigint,
  'Another teacher cannot read the first teacher results'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*) from public.exercise_verifications),
  0::bigint,
  'A student cannot read verification evidence'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$insert into public.exercise_verifications (
      teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
      grade, topic, difficulty, outcome, verified_answer, verifier_identity,
      verifier_version, verified_at, rationale
    ) values (
      '10000000-0000-0000-0000-000000000001', 'browser-authored', 'Text', '4',
      '4', 'addition-subtraction', 'easy', 'unique_answer', '4', 'verifier',
      'model', now(), 'One answer.'
    )$$,
  '42501',
  null,
  'An authenticated browser cannot manufacture verification evidence'
);

select throws_ok(
  $$update public.exercise_verifications set rationale = 'Changed' where candidate_id = 'candidate-a'$$,
  '42501',
  null,
  'An authenticated browser cannot alter verification evidence'
);

select throws_ok(
  $$delete from public.exercise_verifications where candidate_id = 'candidate-a'$$,
  '42501',
  null,
  'An authenticated browser cannot delete verification evidence'
);

reset role;
set local role service_role;

select lives_ok(
  $$insert into public.exercise_verifications (
      id, teacher_id, candidate_id, candidate_text, proposed_canonical_answer,
      grade, topic, difficulty, outcome, verified_answer, verifier_identity,
      verifier_version, verified_at, rationale
    ) values (
      '20000000-0000-0000-0000-000000000009',
      '10000000-0000-0000-0000-000000000001', 'service-authored',
      'Ile to jest 6 + 6?', '12', '4', 'addition-subtraction', 'easy',
      'unique_answer', '12', 'openrouter-strategy-v1', 'model-a',
      '2026-09-29 10:08:00+00', 'Jedyną poprawną odpowiedzią jest 12.'
    )$$,
  'The server service role can author a settled verification result'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select ok(
  exists (select 1 from public.exercise_verifications where candidate_id = 'service-authored'),
  'The owning teacher can read a service-authored result'
);

select throws_ok(
  $$insert into public.exercises (
      exercise_text, canonical_answer, grade, topic, difficulty,
      verification_verdict, verifier_identity, verifier_version, verified_at,
      verification_rationale, creator_id, approver_id
    ) values (
      'Browser promotion', '4', '4', 'addition-subtraction', 'easy',
      'unique_answer', 'verifier', 'model', now(), 'One answer.',
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001'
    )$$,
  '42501',
  null,
  'Authenticated sessions cannot bypass the approval function'
);

select throws_ok(
  $$select public.approve_verified_exercises(array[
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000006'
    ]::uuid[])$$,
  '42501',
  null,
  'Approval rejects a mixed-owner selection'
);

select throws_ok(
  $$select public.approve_verified_exercises(array[
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000004'
    ]::uuid[])$$,
  '22023',
  null,
  'Approval rejects a content-failure selection'
);

select throws_ok(
  $$select public.approve_verified_exercises(array[
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001'
    ]::uuid[])$$,
  '22023',
  null,
  'Approval rejects duplicate verification IDs'
);

select throws_ok(
  $$select public.approve_verified_exercises(array[
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000007',
      '20000000-0000-0000-0000-000000000008',
      '20000000-0000-0000-0000-000000000009'
    ]::uuid[])$$,
  '22023',
  null,
  'Approval rejects more than five verification IDs'
);

select is(
  (
    select count(*)
    from public.exercises
    where verification_id = '20000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'A selection with one invalid record inserts no valid prefix'
);

create temporary table first_approval as
select *
from public.approve_verified_exercises(array[
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001'
]::uuid[]);

select is(
  (
    select string_agg(verification_id::text || ':' || created::text, ',' order by ctid)
    from first_approval
  ),
  '20000000-0000-0000-0000-000000000002:true,20000000-0000-0000-0000-000000000001:true',
  'A successful subset returns ordered newly-created mappings'
);

select is(
  (
    select count(*)
    from public.exercises
    where verification_id in (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002'
    )
  ),
  2::bigint,
  'A successful subset promotes every selected result'
);

select is(
  (
    select exercise_text || '|' || canonical_answer
    from public.exercises
    where verification_id = '20000000-0000-0000-0000-000000000001'
  ),
  'Ile to jest 2 + 2?|4',
  'Promotion copies the candidate text and verified answer exactly'
);

select is(
  (
    select grade || '|' || topic || '|' || difficulty
    from public.exercises
    where verification_id = '20000000-0000-0000-0000-000000000001'
  ),
  '4|addition-subtraction|easy',
  'Promotion copies candidate metadata exactly'
);

select is(
  (
    select
      verification_verdict || '|' || verifier_identity || '|' || verifier_version || '|' ||
      verified_at::text || '|' || verification_rationale
    from public.exercises
    where verification_id = '20000000-0000-0000-0000-000000000001'
  ),
  'unique_answer|openrouter-strategy-v1|model-a|2026-09-29 10:00:00+00|Jedyną poprawną odpowiedzią jest 4.',
  'Promotion preserves verifier evidence exactly'
);

select is(
  (
    select creator_id::text || '|' || approver_id::text || '|' || verification_id::text
    from public.exercises
    where verification_id = '20000000-0000-0000-0000-000000000001'
  ),
  '10000000-0000-0000-0000-000000000001|10000000-0000-0000-0000-000000000001|20000000-0000-0000-0000-000000000001',
  'Promotion records teacher ownership and exact provenance'
);

create temporary table replay_approval as
select *
from public.approve_verified_exercises(array[
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001'
]::uuid[]);

select is(
  (
    select string_agg(
      (replay.exercise_id = first.exercise_id)::text || ':' || replay.created::text,
      ','
      order by replay.ctid
    )
    from replay_approval as replay
    join first_approval as first using (verification_id)
  ),
  'true:false,true:false',
  'An identical replay returns the original exercise mappings'
);

create temporary table overlap_approval as
select *
from public.approve_verified_exercises(array[
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003'
]::uuid[]);

select is(
  (
    select string_agg(verification_id::text || ':' || created::text, ',' order by ctid)
    from overlap_approval
  ),
  '20000000-0000-0000-0000-000000000002:false,20000000-0000-0000-0000-000000000003:true',
  'An overlapping call reuses old mappings and creates only missing ones'
);

select is(
  (
    select count(*)
    from public.exercises
    where verification_id in (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000003'
    )
  ),
  3::bigint,
  'Repeated and overlapping calls keep one exercise per verification'
);

select ok(
  exists (
    select 1
    from public.exercises
    where id = '30000000-0000-0000-0000-000000000001'
      and verification_id is null
  ),
  'A legacy F-01 exercise remains valid without provenance'
);

update public.exercises
set canonical_answer = 'changed'
where verification_id = '20000000-0000-0000-0000-000000000001';

select is(
  (
    select canonical_answer
    from public.exercises
    where verification_id = '20000000-0000-0000-0000-000000000001'
  ),
  '4',
  'Approved exercises retain the F-01 no-update behavior'
);

reset role;

create temporary table concurrent_approval_results (
  caller text primary key,
  created_count bigint not null
);

do $$
declare
  first_created_count bigint;
  connection_string text := format(
    'hostaddr=%s port=%s dbname=%I user=postgres password=postgres',
    inet_server_addr(),
    inet_server_port(),
    current_database()
  );
begin
  perform extensions.dblink_connect('approval_a', connection_string);
  perform extensions.dblink_connect('approval_b', connection_string);
  perform extensions.dblink_exec('approval_a', 'begin');
  perform extensions.dblink_exec('approval_b', 'begin');
  perform extensions.dblink_exec('approval_a', 'set local role authenticated');
  perform extensions.dblink_exec('approval_b', 'set local role authenticated');
  perform extensions.dblink_exec(
    'approval_a',
    'set local "request.jwt.claim.sub" = ''10000000-0000-0000-0000-000000000001'''
  );
  perform extensions.dblink_exec(
    'approval_b',
    'set local "request.jwt.claim.sub" = ''10000000-0000-0000-0000-000000000001'''
  );
  perform extensions.dblink_send_query(
    'approval_a',
    $query$
      select count(*) filter (where created)
      from public.approve_verified_exercises(array[
        '20000000-0000-0000-0000-000000000007',
        '20000000-0000-0000-0000-000000000008'
      ]::uuid[])
    $query$
  );

  select result.created_count
  into first_created_count
  from extensions.dblink_get_result('approval_a') as result(created_count bigint);
  perform *
  from extensions.dblink_get_result('approval_a') as result(created_count bigint);

  insert into concurrent_approval_results values ('a', first_created_count);

  perform extensions.dblink_send_query(
    'approval_b',
    $query$
      select count(*) filter (where created)
      from public.approve_verified_exercises(array[
        '20000000-0000-0000-0000-000000000008'
      ]::uuid[])
    $query$
  );
end;
$$;

select is(
  extensions.dblink_is_busy('approval_b'),
  1,
  'An overlapping concurrent approval waits on the shared verification lock'
);

do $$
declare
  second_created_count bigint;
begin
  perform extensions.dblink_exec('approval_a', 'commit');

  select result.created_count
  into second_created_count
  from extensions.dblink_get_result('approval_b') as result(created_count bigint);
  perform *
  from extensions.dblink_get_result('approval_b') as result(created_count bigint);

  insert into concurrent_approval_results values ('b', second_created_count);

  perform extensions.dblink_exec('approval_b', 'commit');
  perform extensions.dblink_disconnect('approval_a');
  perform extensions.dblink_disconnect('approval_b');
end;
$$;

select is(
  (
    select string_agg(caller || ':' || created_count::text, ',' order by caller)
    from concurrent_approval_results
  ),
  'a:2,b:0',
  'Concurrent overlap creates mappings once and reports replay accurately'
);

select is(
  (
    select count(*)
    from public.exercises
    where verification_id in (
      '20000000-0000-0000-0000-000000000007',
      '20000000-0000-0000-0000-000000000008'
    )
  ),
  2::bigint,
  'Concurrent overlap leaves one exercise per verification'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (
    select string_agg(created::text, ',' order by verification_id)
    from public.approve_verified_exercises(array[
      '20000000-0000-0000-0000-000000000007',
      '20000000-0000-0000-0000-000000000008'
    ]::uuid[])
  ),
  'false,false',
  'A later replay reuses both concurrently created mappings'
);

select * from finish();

rollback;

begin;

delete from public.exercises
where creator_id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002'
);

delete from public.exercise_verifications
where teacher_id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002'
);

delete from auth.users
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

commit;

do $$
begin
  if not (select was_installed from dblink_extension_state) then
    drop extension dblink;
  end if;
end;
$$;