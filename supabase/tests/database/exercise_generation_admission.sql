begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('b1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admission-one@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('b1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'admission-two@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now()),
  ('b1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'admission-student@example.test', 'not-used-by-tests', now(), '{}', '{}', now(), now());

delete from public.profile_roles
where user_id = 'b1000000-0000-0000-0000-000000000003' and role = 'teacher';
insert into public.profile_roles (user_id, role)
values ('b1000000-0000-0000-0000-000000000003', 'student');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.exercise_generation_admission_state'::regclass)
  and not exists (
    select 1 from pg_policy where polrelid = 'public.exercise_generation_admission_state'::regclass
  ),
  'Admission state uses intentional default-deny RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.exercise_generation_admission_state', 'SELECT')
  and not has_table_privilege('authenticated', 'public.exercise_generation_admission_state', 'INSERT')
  and not has_table_privilege('authenticated', 'public.exercise_generation_admission_state', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.exercise_generation_admission_state', 'DELETE')
  and not has_table_privilege('anon', 'public.exercise_generation_admission_state', 'INSERT'),
  'Clients have no direct admission-state grants'
);

select ok(
  has_function_privilege('authenticated', 'public.admit_exercise_generation()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.release_exercise_generation(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admit_exercise_generation()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.release_exercise_generation(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.admit_exercise_generation()', 'EXECUTE')
  and not exists (
    select 1
    from pg_proc as procedure
    cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) as privilege
    where procedure.oid in (
      'public.admit_exercise_generation()'::regprocedure,
      'public.release_exercise_generation(uuid)'::regprocedure
    )
      and privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
  ),
  'RPC execution is authenticated-only, with no PUBLIC grant'
);

select ok(
  (select bool_and(prosecdef and proconfig = array['search_path=""'])
   from pg_proc where oid in (
     'public.admit_exercise_generation()'::regprocedure,
     'public.release_exercise_generation(uuid)'::regprocedure
   )),
  'Both RPCs are security definers with an empty fixed search path'
);

select throws_ok(
  $$insert into public.exercise_generation_admission_state (teacher_id, admitted_at)
    values ('b1000000-0000-0000-0000-000000000001', array_fill(now(), array[11]))$$,
  '23514', null, 'State cannot hold more than ten admissions'
);
select throws_ok(
  $$insert into public.exercise_generation_admission_state (teacher_id, reservation_id)
    values ('b1000000-0000-0000-0000-000000000001', gen_random_uuid())$$,
  '23514', null, 'Reservation token requires its expiry'
);
select throws_ok(
  $$insert into public.exercise_generation_admission_state (teacher_id, reservation_expires_at)
    values ('b1000000-0000-0000-0000-000000000001', now())$$,
  '23514', null, 'Reservation expiry requires its token'
);
select throws_ok(
  $$insert into public.exercise_generation_admission_state (teacher_id, admitted_at)
    values ('b1000000-0000-0000-0000-000000000001', null)$$,
  '23502', null, 'Admission timestamps cannot be null'
);
select throws_ok(
  $$insert into public.exercise_generation_admission_state (teacher_id, admitted_at)
    values ('b1000000-0000-0000-0000-000000000001', array[null]::timestamptz[])$$,
  '23514', null, 'Individual admission timestamps cannot be null'
);

create temporary table admission_results (name text primary key, result jsonb not null);
grant select, insert on admission_results to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
insert into admission_results values ('first', public.admit_exercise_generation());
select is((select result->>'status' from admission_results where name = 'first'), 'admitted', 'First request is admitted');
select lives_ok(
  $$select (result->>'reservation_id')::uuid from admission_results where name = 'first'$$,
  'Admission returns a UUID token'
);
select ok(
  (select result = jsonb_build_object('status', 'admitted', 'reservation_id', result->'reservation_id')
    and jsonb_typeof(result->'reservation_id') = 'string'
   from admission_results where name = 'first'),
  'Admission returns only the documented status and token fields'
);
insert into admission_results values ('blocked', public.admit_exercise_generation());
select is((select result->>'status' from admission_results where name = 'blocked'), 'in-progress', 'Unexpired reservation blocks a repeated request');
select ok(
  (select (result->>'retry_after_seconds')::integer between 1 and 120 from admission_results where name = 'blocked'),
  'Reservation retry timing is positive whole seconds'
);
select ok(
  (select result = jsonb_build_object('status', 'in-progress', 'retry_after_seconds', result->'retry_after_seconds')
    and jsonb_typeof(result->'retry_after_seconds') = 'number'
   from admission_results where name = 'blocked'),
  'Reservation denial returns only the documented status and numeric retry fields'
);

select throws_ok($$select * from public.exercise_generation_admission_state$$, '42501', null, 'Clients cannot read private admission state');
select throws_ok(
  $$insert into public.exercise_generation_admission_state (teacher_id) values ('b1000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Clients cannot insert quota state'
);
select throws_ok($$update public.exercise_generation_admission_state set admitted_at = '{}'$$, '42501', null, 'Clients cannot reset quota state');
select throws_ok($$delete from public.exercise_generation_admission_state$$, '42501', null, 'Clients cannot delete quota state');
select throws_ok($$select public.release_exercise_generation('not-a-uuid')$$, '22P02', null, 'Malformed release token is rejected by the UUID contract');
select ok(not public.release_exercise_generation(null), 'Null release token is a harmless no-op');
select ok(not public.release_exercise_generation('b2000000-0000-0000-0000-000000000001'), 'Unknown release token is a harmless no-op');

reset role;
select is(
  (select cardinality(admitted_at) from public.exercise_generation_admission_state where teacher_id = 'b1000000-0000-0000-0000-000000000001'),
  1, 'Reservation denials do not charge quota'
);
select ok(
  (select reservation_id = (result->>'reservation_id')::uuid
    and reservation_expires_at = admitted_at[1] + interval '120 seconds'
   from public.exercise_generation_admission_state
   cross join admission_results
   where teacher_id = 'b1000000-0000-0000-0000-000000000001' and name = 'first'),
  'Denial does not replace or renew the exact 120-second lease'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', true);
select ok(
  not public.release_exercise_generation((select (result->>'reservation_id')::uuid from admission_results where name = 'first')),
  'Another teacher cannot release the owner token'
);
insert into admission_results values ('other', public.admit_exercise_generation());
select is((select result->>'status' from admission_results where name = 'other'), 'admitted', 'Another teacher has an independent allowance and lease');
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
select ok(
  public.release_exercise_generation((select (result->>'reservation_id')::uuid from admission_results where name = 'first')),
  'Failure cleanup releases the matching reservation'
);
select ok(
  not public.release_exercise_generation((select (result->>'reservation_id')::uuid from admission_results where name = 'first')),
  'Already released token is a harmless no-op'
);
reset role;
select is(
  (select cardinality(admitted_at) from public.exercise_generation_admission_state where teacher_id = 'b1000000-0000-0000-0000-000000000001'),
  1, 'Provider failure cleanup does not refund the charged admission'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
do $$
declare
  response jsonb;
begin
  for attempt in 2..10 loop
    response := public.admit_exercise_generation();
    insert into admission_results values ('sequential-' || attempt, response);
    perform public.release_exercise_generation((response->>'reservation_id')::uuid);
  end loop;
end;
$$;
select is(
  (select count(*) from admission_results where name like 'sequential-%' and result->>'status' = 'admitted'),
  9::bigint, 'Sequential released requests through the tenth are admitted'
);
select is(
  (select result->>'status' from admission_results where name = 'sequential-10'),
  'admitted', 'The tenth admission is allowed'
);
insert into admission_results values ('eleventh', public.admit_exercise_generation());
select is((select result->>'status' from admission_results where name = 'eleventh'), 'quota-exceeded', 'The eleventh request is denied');
select ok(
  (select (result->>'retry_after_seconds')::integer between 1 and 3600 from admission_results where name = 'eleventh'),
  'Quota retry timing is positive whole seconds'
);
select ok(
  (select result = jsonb_build_object('status', 'quota-exceeded', 'retry_after_seconds', result->'retry_after_seconds')
    and jsonb_typeof(result->'retry_after_seconds') = 'number'
   from admission_results where name = 'eleventh'),
  'Quota denial returns only the documented status and numeric retry fields'
);
reset role;
select is(
  (select cardinality(admitted_at) from public.exercise_generation_admission_state where teacher_id = 'b1000000-0000-0000-0000-000000000001'),
  10, 'Quota denial leaves exactly ten charges'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.admit_exercise_generation()$$, '42501', null, 'Anonymous admission is denied');
select throws_ok($$select public.release_exercise_generation(null)$$, '42501', null, 'Anonymous release is denied');
reset role;
set local role authenticated;
select throws_ok($$select public.admit_exercise_generation()$$, '42501', null, 'Authenticated role without a user is denied inside admission');
select throws_ok($$select public.release_exercise_generation(null)$$, '42501', null, 'Authenticated role without a user is denied inside release');
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000003', true);
select throws_ok($$select public.admit_exercise_generation()$$, '42501', null, 'Student admission is denied');
reset role;
select ok(
  not exists (select 1 from public.exercise_generation_admission_state where teacher_id = 'b1000000-0000-0000-0000-000000000003'),
  'Unauthorized admission creates no state or charge'
);

delete from public.profile_roles
where user_id = 'b1000000-0000-0000-0000-000000000002' and role = 'teacher';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', true);
select throws_ok($$select public.admit_exercise_generation()$$, '42501', null, 'Admission revalidates a revoked teacher role');
select ok(
  public.release_exercise_generation((select (result->>'reservation_id')::uuid from admission_results where name = 'other')),
  'Role revocation does not prevent cleanup of an acquired lease'
);
reset role;

-- Intercept only the database clock in the actual function definition, locally
-- inside this rollback-only transaction. Identical decision logic sees exact
-- equality, even on a slow runner; no production RPC accepts time overrides.
create function pg_temp.admission_boundary(
  p_age interval, p_lease_remaining interval, p_count integer,
  p_last_age interval default null
)
returns jsonb
language plpgsql
as $$
declare
  frozen_time timestamptz := '2035-01-02 03:04:05+00';
  original_definition text := pg_get_functiondef('public.admit_exercise_generation()'::regprocedure);
  frozen_definition text;
  response jsonb;
  saved_state jsonb;
  old_token uuid := 'b2000000-0000-0000-0000-000000000002';
begin
  frozen_definition := replace(
    original_definition, 'pg_catalog.clock_timestamp()',
    format('%L::timestamptz', frozen_time)
  );
  if frozen_definition = original_definition
    or (length(original_definition) - length(replace(original_definition, 'pg_catalog.clock_timestamp()', '')))
      / length('pg_catalog.clock_timestamp()') <> 1 then
    raise exception 'Expected exactly one database decision clock';
  end if;
  execute frozen_definition;
  delete from public.exercise_generation_admission_state
  where teacher_id = 'b1000000-0000-0000-0000-000000000001';
  insert into public.exercise_generation_admission_state (
    teacher_id, admitted_at, reservation_id, reservation_expires_at
  ) values (
    'b1000000-0000-0000-0000-000000000001',
    array_fill(frozen_time - p_age, array[p_count]),
    case when p_lease_remaining is not null then old_token end,
    case when p_lease_remaining is not null then frozen_time + p_lease_remaining end
  );
  if p_last_age is not null then
    update public.exercise_generation_admission_state
    set admitted_at[p_count] = frozen_time - p_last_age
    where teacher_id = 'b1000000-0000-0000-0000-000000000001';
  end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
  response := public.admit_exercise_generation();
  execute 'reset role';
  select jsonb_build_object(
    'count', cardinality(admitted_at),
    'token', reservation_id,
    'expiry', reservation_expires_at,
    'decision_is_exact', admitted_at[cardinality(admitted_at)] = frozen_time
  )
  into saved_state
  from public.exercise_generation_admission_state
  where teacher_id = 'b1000000-0000-0000-0000-000000000001';
  execute original_definition;
  return jsonb_build_object('response', response, 'state', saved_state);
exception when others then
  -- The exception subtransaction restores both the function and privileged role.
  raise;
end;
$$;

create temporary table boundary_results as
select 'hour-exact' as name, pg_temp.admission_boundary(interval '60 minutes', null, 10) as result
union all
select 'hour-inside', pg_temp.admission_boundary(interval '60 minutes' - interval '1 microsecond', null, 10)
union all
select 'lease-exact', pg_temp.admission_boundary(interval '120 seconds', interval '0 seconds', 1)
union all
select 'lease-before', pg_temp.admission_boundary(interval '120 seconds' - interval '1 microsecond', interval '1 microsecond', 1)
union all
select 'both-lease-later', pg_temp.admission_boundary(interval '60 minutes' - interval '0.5 seconds', interval '120 seconds', 10)
union all
select 'both-quota-later', pg_temp.admission_boundary(interval '60 minutes' - interval '180.25 seconds', interval '120 seconds', 10)
union all
select 'lease-prunes', pg_temp.admission_boundary(interval '60 minutes', interval '120 seconds', 10)
union all
select 'oldest-last', pg_temp.admission_boundary(interval '5 minutes', null, 10, interval '55 minutes');

select is((select result#>>'{response,status}' from boundary_results where name = 'hour-exact'), 'admitted', 'Exactly 60-minute-old charges expire');
select is((select (result#>>'{state,count}')::integer from boundary_results where name = 'hour-exact'), 1, 'Exact hour expiry prunes old charges and records only the new one');
select ok((select (result#>>'{state,decision_is_exact}')::boolean from boundary_results where name = 'hour-exact'), 'Hour boundary really executes at the exact fixture decision time');
select is((select result#>>'{response,status}' from boundary_results where name = 'hour-inside'), 'quota-exceeded', 'One microsecond inside the hour still counts');
select is((select (result#>>'{response,retry_after_seconds}')::integer from boundary_results where name = 'hour-inside'), 1, 'Subsecond quota retry rounds up to one');
select is((select result#>>'{response,status}' from boundary_results where name = 'lease-exact'), 'admitted', 'Exactly 120-second-old lease is replaceable');
select ok((select (result#>>'{state,decision_is_exact}')::boolean from boundary_results where name = 'lease-exact'), 'Lease boundary really executes at exact expiry');
select is((select (result#>>'{state,count}')::integer from boundary_results where name = 'lease-exact'), 2, 'Replacing an expired lease adds one charge without refunding the old one');
select is((select result#>>'{response,status}' from boundary_results where name = 'lease-before'), 'in-progress', 'One microsecond before lease expiry remains blocked');
select is((select (result#>>'{response,retry_after_seconds}')::integer from boundary_results where name = 'lease-before'), 1, 'Subsecond lease retry rounds up to one');
select is((select (result#>>'{state,count}')::integer from boundary_results where name = 'lease-before'), 1, 'Lease rejection adds no charge');
select is((select result#>>'{state,token}' from boundary_results where name = 'lease-before'), 'b2000000-0000-0000-0000-000000000002', 'Lease rejection retains the existing token');
select is((select result#>>'{response,status}' from boundary_results where name = 'both-lease-later'), 'quota-exceeded', 'Quota denial takes precedence when both blockers exist');
select is((select (result#>>'{response,retry_after_seconds}')::integer from boundary_results where name = 'both-lease-later'), 120, 'Combined denial uses the later reservation deadline');
select is((select (result#>>'{response,retry_after_seconds}')::integer from boundary_results where name = 'both-quota-later'), 181, 'Combined denial uses the later quota deadline and ceiling');
select is(
  (select (result#>>'{state,expiry}')::timestamptz from boundary_results where name = 'lease-before'),
  '2035-01-02 03:04:05.000001+00'::timestamptz,
  'Exact just-before rejection does not renew its lease'
);
select is(
  (select (result#>>'{state,count}')::integer from boundary_results where name = 'both-lease-later'),
  10, 'Combined denial does not charge an eleventh admission'
);
select is(
  (select (result#>>'{state,expiry}')::timestamptz from boundary_results where name = 'both-lease-later'),
  '2035-01-02 03:06:05+00'::timestamptz,
  'Combined quota denial does not renew the existing lease'
);
select is(
  (select result#>>'{response,status}' from boundary_results where name = 'lease-prunes'),
  'in-progress', 'Expired quota does not hide a still-active reservation'
);
select is(
  (select (result#>>'{state,count}')::integer from boundary_results where name = 'lease-prunes'),
  0, 'Even a rejected reservation call prunes exactly expired timestamps without charging'
);
select is(
  (select (result#>>'{response,retry_after_seconds}')::integer from boundary_results where name = 'oldest-last'),
  300, 'Quota readiness uses the oldest counted admission even when the array is unsorted'
);

-- Restore the real clock before testing token fencing and remote sessions.
select ok(
  position('pg_catalog.clock_timestamp()' in pg_get_functiondef('public.admit_exercise_generation()'::regprocedure)) > 0,
  'Boundary fixtures restore the production database clock'
);
update public.exercise_generation_admission_state
set admitted_at = array[clock_timestamp() - interval '120 seconds'],
    reservation_id = 'b2000000-0000-0000-0000-000000000002',
    reservation_expires_at = clock_timestamp() - interval '1 second'
where teacher_id = 'b1000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
insert into admission_results values ('replacement', public.admit_exercise_generation());
select is((select result->>'status' from admission_results where name = 'replacement'), 'admitted', 'Expired reservation obtains a replacement');
select ok(not public.release_exercise_generation('b2000000-0000-0000-0000-000000000002'), 'Old completion cannot clear a replacement token');
reset role;
select ok(
  (select reservation_id = (result->>'reservation_id')::uuid
   from public.exercise_generation_admission_state cross join admission_results
   where teacher_id = 'b1000000-0000-0000-0000-000000000001' and name = 'replacement'),
  'Replacement token remains persisted after old-token release'
);

delete from auth.users where id = 'b1000000-0000-0000-0000-000000000002';
select ok(
  not exists (select 1 from public.exercise_generation_admission_state where teacher_id = 'b1000000-0000-0000-0000-000000000002'),
  'Deleting an owner cascades admission state'
);

-- The controller commits isolated fixtures before opening A/B. All race errors
-- become TAP failures only after disconnect/rollback, scoped fixture deletion,
-- and restoration of the pre-test extension state.
create function pg_temp.admission_races(p_cleanup_probe boolean default false)
returns setof text
language plpgsql
as $$
declare
  was_installed boolean := exists (select 1 from pg_extension where extname = 'dblink');
  fixture_ids uuid[] := array[gen_random_uuid(), gen_random_uuid()];
  connection_string text := format(
    'hostaddr=%s port=%s dbname=%I user=postgres password=postgres connect_timeout=5',
    inet_server_addr(), inet_server_port(), current_database()
  );
  connection_prefix text := 'admission_' || replace(gen_random_uuid()::text, '-', '');
  controller text := connection_prefix || '_control';
  caller_a text := connection_prefix || '_a';
  caller_b text := connection_prefix || '_b';
  connected text;
  race integer;
  backend_a integer;
  backend_b integer;
  deadline timestamptz;
  lock_observed boolean;
  response_a jsonb;
  response_b jsonb;
  released boolean;
  charge_count integer;
  stored_token uuid;
  live_token boolean;
  failure_message text;
  cleanup_message text;
  connections_clean boolean := false;
  completed_races jsonb[] := '{}'::jsonb[];
  race_result jsonb;
begin
  create extension if not exists dblink with schema extensions;
  begin
    perform extensions.dblink_connect(controller, connection_string);
    perform extensions.dblink_exec(controller, 'set statement_timeout = ''10s''');
    perform extensions.dblink_exec(controller, format(
      $fixture$
        insert into auth.users (
          id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) values
          (%L, 'authenticated', 'authenticated', %L, 'not-used-by-tests', now(), '{}', '{}', now(), now()),
          (%L, 'authenticated', 'authenticated', %L, 'not-used-by-tests', now(), '{}', '{}', now(), now())
      $fixture$,
      fixture_ids[1], fixture_ids[1]::text || '@admission-race.test',
      fixture_ids[2], fixture_ids[2]::text || '@admission-race.test'
    ));
    perform extensions.dblink_exec(controller, format(
      'insert into public.exercise_generation_admission_state (teacher_id, admitted_at) values (%L, array_fill(clock_timestamp(), array[9]))',
      fixture_ids[1]
    ));

    for race in 1..2 loop
      perform extensions.dblink_connect(caller_a, connection_string);
      perform extensions.dblink_connect(caller_b, connection_string);
      select pid into backend_a
      from extensions.dblink(caller_a, 'select pg_backend_pid()') as result(pid integer);
      select pid into backend_b
      from extensions.dblink(caller_b, 'select pg_backend_pid()') as result(pid integer);
      foreach connected in array array[caller_a, caller_b] loop
        perform extensions.dblink_exec(connected, 'begin isolation level read committed');
        perform extensions.dblink_exec(connected, 'set local statement_timeout = ''10s''');
        perform extensions.dblink_exec(connected, 'set local lock_timeout = ''8s''');
        perform extensions.dblink_exec(connected, 'set local role authenticated');
        perform extensions.dblink_exec(connected, format(
          'set local "request.jwt.claim.sub" = %L', fixture_ids[race]::text
        ));
      end loop;

      select response into response_a
      from extensions.dblink(caller_a, 'select public.admit_exercise_generation()') as result(response jsonb);
      if response_a->>'status' is distinct from 'admitted' then
        raise exception 'Race %: A did not admit: %', race, response_a;
      end if;
      if race = 1 then
        select result.was_released into released
        from extensions.dblink(caller_a, format(
          'select public.release_exercise_generation(%L::uuid)', response_a->>'reservation_id'
        )) as result(was_released boolean);
        if released is distinct from true then
          raise exception 'Last-unit race: A could not release its uncommitted lease';
        end if;
      end if;

      perform extensions.dblink_send_query(caller_b, 'select public.admit_exercise_generation()');
      deadline := clock_timestamp() + interval '5 seconds';
      lock_observed := false;
      loop
        perform pg_stat_clear_snapshot();
        select exists (
          select 1 from pg_locks
          where pid = backend_b and not granted
            and backend_a = any(pg_blocking_pids(backend_b))
        ) into lock_observed;
        exit when lock_observed;
        if clock_timestamp() >= deadline then
          raise exception 'Race %: no non-granted B lock blocked by A within five seconds', race;
        end if;
        perform pg_sleep(0.01);
      end loop;
      if p_cleanup_probe then
        raise exception 'Deliberate race cleanup probe';
      end if;

      perform extensions.dblink_exec(caller_a, 'commit');
      deadline := clock_timestamp() + interval '5 seconds';
      while extensions.dblink_is_busy(caller_b) = 1 loop
        if clock_timestamp() >= deadline then
          raise exception 'Race %: B did not finish within five seconds after commit', race;
        end if;
        perform pg_sleep(0.01);
      end loop;
      select response into response_b
      from extensions.dblink_get_result(caller_b) as result(response jsonb);
      perform * from extensions.dblink_get_result(caller_b) as result(response jsonb);
      perform extensions.dblink_exec(caller_b, 'commit');

      select result.charges, result.token, result.unexpired
      into charge_count, stored_token, live_token
      from extensions.dblink(controller, format(
        'select cardinality(admitted_at), reservation_id, reservation_expires_at > clock_timestamp()
         from public.exercise_generation_admission_state where teacher_id = %L', fixture_ids[race]
      )) as result(charges integer, token uuid, unexpired boolean);

      completed_races := array_append(completed_races, jsonb_build_object(
        'race', race, 'lock_observed', lock_observed,
        'a', response_a, 'b', response_b, 'charges', charge_count,
        'token', stored_token, 'unexpired', live_token
      ));
      perform extensions.dblink_disconnect(caller_a);
      perform extensions.dblink_disconnect(caller_b);
    end loop;
  exception when others then
    failure_message := sqlstate || ': ' || sqlerrm;
  end;

  -- Disconnect rolls back even an aborted/in-flight race transaction. Each
  -- cleanup action has its own exception scope, so one error cannot skip others.
  foreach connected in array array[caller_b, caller_a] loop
    begin
      if connected = any(coalesce(extensions.dblink_get_connections(), '{}'::text[])) then
        perform extensions.dblink_disconnect(connected);
      end if;
    exception when others then
      cleanup_message := concat_ws('; ', cleanup_message, 'disconnect: ' || sqlerrm);
    end;
  end loop;
  begin
    if not (controller = any(coalesce(extensions.dblink_get_connections(), '{}'::text[]))) then
      perform extensions.dblink_connect(controller, connection_string);
      perform extensions.dblink_exec(controller, 'set statement_timeout = ''10s''');
    end if;
    perform extensions.dblink_exec(controller, format(
      'delete from auth.users where id in (%L, %L)', fixture_ids[1], fixture_ids[2]
    ));
    select remaining into charge_count
    from extensions.dblink(controller, format(
      'select count(*)::integer from auth.users where id in (%L, %L)', fixture_ids[1], fixture_ids[2]
    )) as result(remaining integer);
    if charge_count <> 0 then
      raise exception 'Committed race users survived cleanup';
    end if;
  exception when others then
    cleanup_message := concat_ws('; ', cleanup_message, 'fixtures: ' || sqlerrm);
  end;
  begin
    if controller = any(coalesce(extensions.dblink_get_connections(), '{}'::text[])) then
      perform extensions.dblink_disconnect(controller);
    end if;
  exception when others then
    cleanup_message := concat_ws('; ', cleanup_message, 'controller: ' || sqlerrm);
  end;
  begin
    connections_clean := not (
      controller = any(coalesce(extensions.dblink_get_connections(), '{}'::text[]))
      or caller_a = any(coalesce(extensions.dblink_get_connections(), '{}'::text[]))
      or caller_b = any(coalesce(extensions.dblink_get_connections(), '{}'::text[]))
    );
  exception when others then
    cleanup_message := concat_ws('; ', cleanup_message, 'connection inspection: ' || sqlerrm);
  end;
  begin
    if not was_installed then
      drop extension dblink;
    end if;
  exception when others then
    cleanup_message := concat_ws('; ', cleanup_message, 'extension: ' || sqlerrm);
  end;

  -- Evaluate assertions only after cleanup: even an assertion error cannot
  -- strand committed users, remote transactions, or a test-only extension.
  foreach race_result in array completed_races loop
    race := (race_result->>'race')::integer;
    return next ok((race_result->>'lock_observed')::boolean, case when race = 1
      then 'Last-unit race proves B waits on A with a non-granted lock'
      else 'First-ever row creation proves B waits on A with a non-granted lock' end);
    return next is(race_result#>>'{b,status}',
      case when race = 1 then 'quota-exceeded' else 'in-progress' end,
      case when race = 1 then 'Concurrent last-unit loser quota-denies after A releases'
        else 'Concurrent first-row loser reservation-denies' end);
    return next ok(
      (race_result#>>'{b,retry_after_seconds}')::integer > 0,
      'Concurrent denial supplies positive integral retry timing'
    );
    return next is((race_result->>'charges')::integer, case when race = 1 then 10 else 1 end,
      case when race = 1 then 'Last-unit race persists exactly ten charges'
        else 'First-row race persists exactly one charge' end);
    return next ok(
      case when race = 1 then race_result->>'token' is null
        else race_result->>'token' = race_result#>>'{a,reservation_id}'
          and (race_result->>'unexpired')::boolean end,
      case when race = 1 then 'Last-unit winner release persists without a lease or refund'
        else 'First-row race retains exactly the winner unexpired token' end);
  end loop;
  if p_cleanup_probe then
    return next is(
      failure_message, 'P0001: Deliberate race cleanup probe',
      'Cleanup probe reaches a genuine waiting race before its deliberate error'
    );
  elsif failure_message is not null then
    return next fail('Synchronized admission races failed: ' || failure_message);
  end if;
  return next ok(cleanup_message is null and connections_clean, 'Committed race fixtures and connections are cleaned up');
  if cleanup_message is not null then
    return next diag(cleanup_message);
  end if;
  return next is(
    exists (select 1 from pg_extension where extname = 'dblink'), was_installed,
    'Race tests restore the pre-test dblink extension state'
  );
end;
$$;

select * from pg_temp.admission_races();
select * from pg_temp.admission_races(true);

select * from finish();
rollback;
