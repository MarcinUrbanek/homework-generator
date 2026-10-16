create function public.is_currently_certified_exercise(p_exercise_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  exercise_record record;
  evidence_record record;
  derived jsonb;
begin
  select
    exercise.exercise_text,
    exercise.canonical_answer,
    exercise.grade,
    exercise.topic,
    exercise.difficulty,
    exercise.verification_verdict,
    exercise.verifier_identity,
    exercise.verifier_version,
    exercise.verified_at,
    exercise.verification_rationale,
    exercise.creator_id,
    exercise.approver_id,
    exercise.verification_id,
    exercise.arithmetic_structure,
    exercise.authority_version,
    verification.teacher_id,
    verification.candidate_text,
    verification.proposed_canonical_answer,
    verification.verified_answer,
    verification.outcome,
    verification.verifier_identity as evidence_verifier_identity,
    verification.verifier_version as evidence_verifier_version,
    verification.verified_at as evidence_verified_at,
    verification.rationale,
    verification.arithmetic_structure as evidence_arithmetic_structure,
    verification.authority_version as evidence_authority_version,
    verification.grade as evidence_grade,
    verification.topic as evidence_topic,
    verification.difficulty as evidence_difficulty
  into exercise_record
  from public.exercises as exercise
  join public.exercise_verifications as verification
    on verification.id = exercise.verification_id
  where exercise.id = p_exercise_id
    and exercise.verification_id is not null
    and exercise.authority_version = 1
    and exercise.arithmetic_structure is not null
    and exercise.verification_verdict = 'unique_answer'
    and verification.outcome = 'unique_answer'
    and verification.authority_version = 1
    and verification.arithmetic_structure is not null
    and verification.grade = exercise.grade
    and verification.topic = exercise.topic
    and verification.difficulty = exercise.difficulty
    and verification.candidate_text = exercise.exercise_text
    and verification.proposed_canonical_answer = exercise.canonical_answer
    and verification.verified_answer = exercise.canonical_answer
    and verification.verifier_identity = exercise.verifier_identity
    and verification.verifier_version = exercise.verifier_version
    and verification.verified_at = exercise.verified_at
    and verification.rationale = exercise.verification_rationale
    and verification.arithmetic_structure = exercise.arithmetic_structure
    and verification.authority_version = exercise.authority_version
    and verification.teacher_id = exercise.creator_id
    and verification.teacher_id = exercise.approver_id
    and exercise.creator_id = exercise.approver_id;

  if not found then
    return false;
  end if;

  begin
    derived := public.derive_arithmetic_exercise_v1(
      exercise_record.grade,
      exercise_record.topic,
      exercise_record.difficulty,
      exercise_record.arithmetic_structure
    );
  exception
    when sqlstate '22023' then
      return false;
  end;

  return derived ->> 'exercise_text' = exercise_record.exercise_text
    and derived ->> 'canonical_answer' = exercise_record.canonical_answer
    and exercise_record.candidate_text = exercise_record.exercise_text
    and exercise_record.proposed_canonical_answer = exercise_record.canonical_answer
    and exercise_record.verified_answer = exercise_record.canonical_answer
    and exercise_record.verification_id is not null
    and exercise_record.authority_version = 1
    and exercise_record.evidence_authority_version = 1
    and exercise_record.arithmetic_structure = exercise_record.evidence_arithmetic_structure
    and exercise_record.grade = exercise_record.evidence_grade
    and exercise_record.topic = exercise_record.evidence_topic
    and exercise_record.difficulty = exercise_record.evidence_difficulty
    and exercise_record.evidence_verifier_identity = exercise_record.verifier_identity
    and exercise_record.evidence_verifier_version = exercise_record.verifier_version
    and exercise_record.evidence_verified_at = exercise_record.verified_at
    and exercise_record.rationale = exercise_record.verification_rationale
    and exercise_record.outcome = 'unique_answer'
    and exercise_record.teacher_id = exercise_record.creator_id
    and exercise_record.teacher_id = exercise_record.approver_id;
end;
$$;

revoke all on function public.is_currently_certified_exercise(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.get_saved_exercises(
  p_grade text,
  p_topic text,
  p_difficulty text default null,
  p_cursor_approved_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  exercise_text text,
  canonical_answer text,
  grade text,
  topic text,
  difficulty text,
  approved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_teacher()) then
    return;
  end if;

  if p_limit not between 1 and 21 then
    raise exception 'The saved-exercise page limit must be between 1 and 21'
      using errcode = '22023';
  end if;

  if (p_cursor_approved_at is null) <> (p_cursor_id is null) then
    raise exception 'The saved-exercise cursor must include both approval time and ID'
      using errcode = '22023';
  end if;

  return query
  select
    exercise.id,
    exercise.exercise_text,
    exercise.canonical_answer,
    exercise.grade,
    exercise.topic,
    exercise.difficulty,
    exercise.approved_at
  from public.exercises as exercise
  where exercise.grade = p_grade
    and exercise.topic = p_topic
    and (p_difficulty is null or exercise.difficulty = p_difficulty)
    and (
      p_cursor_approved_at is null
      or (exercise.approved_at, exercise.id) < (p_cursor_approved_at, p_cursor_id)
    )
    and public.is_currently_certified_exercise(exercise.id)
  order by exercise.approved_at desc, exercise.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_saved_exercises(text, text, text, timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.get_saved_exercises(text, text, text, timestamptz, uuid, integer)
  to authenticated;

create or replace function public.create_homework_assignment(
  p_class_id uuid,
  p_title text,
  p_topic text,
  p_difficulty text,
  p_exercise_count integer,
  p_idempotency_key uuid,
  p_allocations jsonb
)
returns table (
  assignment_id uuid,
  assignment_title text,
  assigned_student_ids uuid[],
  excluded_student_ids uuid[],
  created_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
  normalized_title text := nullif(btrim(p_title), '');
  normalized_allocations jsonb := '[]'::jsonb;
  request_fingerprint text;
  allocation jsonb;
  exercise_value text;
  exercise_id uuid;
  exercise_ids uuid[];
  requested_student_id uuid;
  requested_student_ids uuid[] := '{}'::uuid[];
  eligible_student_ids uuid[] := '{}'::uuid[];
  excluded_ids uuid[] := '{}'::uuid[];
  used_signatures text[] := '{}'::text[];
  set_signature text;
  valid_exercise_count integer;
  recipient_id uuid;
  existing_assignment public.homework_assignments%rowtype;
  new_assignment_id uuid;
begin
  if authenticated_teacher_id is null or not (select public.is_teacher()) then
    raise exception using
      errcode = '42501',
      message = 'Teacher authentication is required';
  end if;

  if not exists (
    select 1
    from public.classes as class_record
    where class_record.id = p_class_id
      and class_record.teacher_id = authenticated_teacher_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Class ownership is required';
  end if;

  if p_title is not null and char_length(normalized_title) > 120 then
    raise exception using
      errcode = '22023',
      message = 'Assignment title cannot exceed 120 characters';
  end if;

  if p_topic is null or p_topic not in (
    'addition-subtraction',
    'multiplication-division',
    'order-of-operations',
    'word-problems'
  ) then
    raise exception using
      errcode = '22023',
      message = 'A supported Grade 4 topic is required';
  end if;

  if p_difficulty is null or p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception using
      errcode = '22023',
      message = 'A supported difficulty is required';
  end if;

  if p_exercise_count is null or p_exercise_count not between 1 and 5 then
    raise exception using
      errcode = '22023',
      message = 'Exercise count must be between one and five';
  end if;

  if p_idempotency_key is null then
    raise exception using
      errcode = '22023',
      message = 'An idempotency key is required';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'Recipient allocations must be a JSON array';
  end if;

  if jsonb_array_length(p_allocations) = 0 then
    raise exception using
      errcode = '22023',
      message = 'At least one recipient allocation is required';
  end if;

  for allocation in
    select item.value
    from jsonb_array_elements(p_allocations) as item(value)
  loop
    if jsonb_typeof(allocation) is distinct from 'object'
      or jsonb_typeof(allocation -> 'student_id') is distinct from 'string'
      or jsonb_typeof(allocation -> 'exercise_ids') is distinct from 'array' then
      raise exception using
        errcode = '22023',
        message = 'Each allocation requires a student ID and exercise ID array';
    end if;

    if (allocation ->> 'student_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using
        errcode = '22023',
        message = 'Recipient student IDs must be UUIDs';
    end if;

    requested_student_id := (allocation ->> 'student_id')::uuid;

    if requested_student_id = any(requested_student_ids) then
      raise exception using
        errcode = '22023',
        message = 'Recipient allocations cannot repeat a student';
    end if;

    requested_student_ids := array_append(requested_student_ids, requested_student_id);

    if jsonb_array_length(allocation -> 'exercise_ids') <> p_exercise_count then
      raise exception using
        errcode = '22023',
        message = 'Every recipient must receive the requested exercise count';
    end if;

    exercise_ids := '{}'::uuid[];
    for exercise_value in
      select item.value
      from jsonb_array_elements_text(allocation -> 'exercise_ids') as item(value)
    loop
      if exercise_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception using
          errcode = '22023',
          message = 'Exercise IDs must be UUIDs';
      end if;

      exercise_id := exercise_value::uuid;
      if exercise_id = any(exercise_ids) then
        raise exception using
          errcode = '22023',
          message = 'A recipient set cannot repeat an exercise';
      end if;

      exercise_ids := array_append(exercise_ids, exercise_id);
    end loop;

    normalized_allocations := normalized_allocations || jsonb_build_array(
      jsonb_build_object(
        'student_id', requested_student_id,
        'exercise_ids', to_jsonb(exercise_ids)
      )
    );
  end loop;

  select coalesce(
    jsonb_agg(item.value order by (item.value ->> 'student_id')::uuid),
    '[]'::jsonb
  )
  into normalized_allocations
  from jsonb_array_elements(normalized_allocations) as item(value);

  select coalesce(
    array_agg((item.value ->> 'student_id')::uuid order by (item.value ->> 'student_id')::uuid),
    '{}'::uuid[]
  )
  into requested_student_ids
  from jsonb_array_elements(normalized_allocations) as item(value);

  request_fingerprint := pg_catalog.md5(
    jsonb_build_object(
      'class_id', p_class_id,
      'title', normalized_title,
      'topic', p_topic,
      'difficulty', p_difficulty,
      'exercise_count', p_exercise_count,
      'student_ids', to_jsonb(requested_student_ids)
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      authenticated_teacher_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select assignment.*
  into existing_assignment
  from public.homework_assignments as assignment
  where assignment.teacher_id = authenticated_teacher_id
    and assignment.idempotency_key = p_idempotency_key
  for update;

  if found then
    if existing_assignment.request_fingerprint <> request_fingerprint then
      raise exception using
        errcode = '22023',
        message = 'The idempotency key was already used for a different assignment';
    end if;

    return query
    select
      existing_assignment.id,
      existing_assignment.title,
      coalesce(
        (
          select array_agg(recipient.student_id order by recipient.student_id)
          from public.homework_recipients as recipient
          where recipient.assignment_id = existing_assignment.id
        ),
        '{}'::uuid[]
      ),
      existing_assignment.excluded_student_ids,
      existing_assignment.created_at,
      true;
    return;
  end if;

  for allocation in
    select item.value
    from jsonb_array_elements(normalized_allocations) as item(value)
    order by (item.value ->> 'student_id')::uuid
  loop
    requested_student_id := (allocation ->> 'student_id')::uuid;

    perform 1
    from public.class_memberships as membership
    where membership.class_id = p_class_id
      and membership.student_id = requested_student_id
    for key share;

    if found then
      eligible_student_ids := array_append(eligible_student_ids, requested_student_id);
    else
      excluded_ids := array_append(excluded_ids, requested_student_id);
    end if;
  end loop;

  if cardinality(eligible_student_ids) = 0 then
    raise exception using
      errcode = 'P0002',
      message = 'No selected students remain in the class';
  end if;

  insert into public.homework_assignments (
    class_id,
    teacher_id,
    title,
    grade,
    topic,
    difficulty,
    exercise_count,
    idempotency_key,
    request_fingerprint,
    excluded_student_ids
  )
  values (
    p_class_id,
    authenticated_teacher_id,
    normalized_title,
    '4',
    p_topic,
    p_difficulty,
    p_exercise_count,
    p_idempotency_key,
    request_fingerprint,
    excluded_ids
  )
  returning id into new_assignment_id;

  for allocation in
    select item.value
    from jsonb_array_elements(normalized_allocations) as item(value)
    order by (item.value ->> 'student_id')::uuid
  loop
    requested_student_id := (allocation ->> 'student_id')::uuid;
    if not requested_student_id = any(eligible_student_ids) then
      continue;
    end if;

    select array_agg(item.value::uuid order by item.ordinality)
    into exercise_ids
    from jsonb_array_elements_text(allocation -> 'exercise_ids')
      with ordinality as item(value, ordinality);

    select count(*)
    into valid_exercise_count
    from public.exercises as exercise
    where exercise.id = any(exercise_ids)
      and exercise.grade = '4'
      and exercise.topic = p_topic
      and exercise.difficulty = p_difficulty
      and public.is_currently_certified_exercise(exercise.id);

    if valid_exercise_count <> p_exercise_count then
      raise exception using
        errcode = '22023',
        message = 'Every assigned exercise must be approved for the selected bucket';
    end if;

    select pg_catalog.array_to_string(
      array_agg(item.exercise_id::text order by item.exercise_id::text),
      ','
    )
    into set_signature
    from unnest(exercise_ids) as item(exercise_id);

    if set_signature = any(used_signatures) then
      raise exception using
        errcode = '22023',
        message = 'Every recipient must receive a distinct exercise set';
    end if;
    used_signatures := array_append(used_signatures, set_signature);

    insert into public.homework_recipients (
      assignment_id,
      student_id,
      set_signature
    )
    values (
      new_assignment_id,
      requested_student_id,
      set_signature
    )
    returning id into recipient_id;

    insert into public.homework_recipient_exercises (
      recipient_id,
      exercise_id,
      position
    )
    select
      recipient_id,
      item.exercise_id,
      item.ordinality::smallint
    from unnest(exercise_ids) with ordinality as item(exercise_id, ordinality);
  end loop;

  return query
  select
    assignment.id,
    assignment.title,
    coalesce(
      (
        select array_agg(recipient.student_id order by recipient.student_id)
        from public.homework_recipients as recipient
        where recipient.assignment_id = assignment.id
      ),
      '{}'::uuid[]
    ),
    assignment.excluded_student_ids,
    assignment.created_at,
    false
  from public.homework_assignments as assignment
  where assignment.id = new_assignment_id;
end;
$$;

create function public.homework_submission_result_only(p_submission_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'submission_id', submission.id,
    'submitted_at', submission.submitted_at,
    'correct_count', submission.correct_count,
    'assigned_count', submission.assigned_count,
    'passed', submission.passed,
    'answers',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'position', answer.position,
              'answer', answer.submitted_text,
              'is_correct', answer.is_correct
            )
            order by answer.position
          )
          from public.homework_submission_answers as answer
          where answer.submission_id = submission.id
        ),
        '[]'::jsonb
      )
  )
  from public.homework_submissions as submission
  where submission.id = p_submission_id;
$$;

revoke all on function public.homework_submission_result_only(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.get_student_homework(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_student_id uuid := (select auth.uid());
  v_recipient_id uuid;
  assignment_record public.homework_assignments%rowtype;
  membership_exists boolean;
  v_submission_id uuid;
  result jsonb;
  assigned_count integer;
  first_position smallint;
  last_position smallint;
  has_uncertified boolean;
begin
  if authenticated_student_id is null or p_assignment_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  select recipient.id
  into v_recipient_id
  from public.homework_recipients as recipient
  where recipient.assignment_id = p_assignment_id
    and recipient.student_id = authenticated_student_id
  for key share of recipient;

  if v_recipient_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  select assignment.*
  into assignment_record
  from public.homework_assignments as assignment
  where assignment.id = p_assignment_id;

  perform 1
  from public.class_memberships as membership
  where membership.class_id = assignment_record.class_id
    and membership.student_id = authenticated_student_id
  for key share;
  membership_exists := found;

  if not membership_exists then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  select submission.id
  into v_submission_id
  from public.homework_submissions as submission
  where submission.recipient_id = v_recipient_id;

  select count(*)::integer, min(assigned.position), max(assigned.position)
  into assigned_count, first_position, last_position
  from public.homework_recipient_exercises as assigned
  where assigned.recipient_id = v_recipient_id;

  select exists (
    select 1
    from public.homework_recipient_exercises as assigned
    left join public.exercises as exercise
      on exercise.id = assigned.exercise_id
    where assigned.recipient_id = v_recipient_id
      and not coalesce(public.is_currently_certified_exercise(exercise.id), false)
  )
  into has_uncertified;

  if v_submission_id is null then
    if assigned_count <> assignment_record.exercise_count
      or first_position <> 1
      or last_position <> assignment_record.exercise_count
      or has_uncertified then
      raise exception using
        errcode = 'P0002',
        message = 'Homework is unavailable';
    end if;
  elsif has_uncertified then
    select jsonb_build_object(
      'kind', 'result-only',
      'assignment',
        jsonb_build_object(
          'assignment_id', assignment_record.id,
          'class_name', class_record.name,
          'title', assignment_record.title,
          'created_at', assignment_record.created_at,
          'exercise_count', assignment_record.exercise_count
        ),
      'result', public.homework_submission_result_only(v_submission_id)
    )
    into result
    from public.classes as class_record
    where class_record.id = assignment_record.class_id;
    return result;
  end if;

  select jsonb_build_object(
    'kind', 'prompts',
    'assignment',
    jsonb_build_object(
      'assignment_id', assignment_record.id,
      'class_name', class_record.name,
      'title', assignment_record.title,
      'created_at', assignment_record.created_at,
      'exercise_count', assignment_record.exercise_count
    ),
    'exercises',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'position', assigned.position,
            'prompt', exercise.exercise_text
          )
          order by assigned.position
        )
        from public.homework_recipient_exercises as assigned
        join public.exercises as exercise
          on exercise.id = assigned.exercise_id
        where assigned.recipient_id = v_recipient_id
      ),
      '[]'::jsonb
    ),
    'submission',
    case
      when v_submission_id is null then null
      else public.homework_submission_result(v_submission_id)
    end
  )
  into result
  from public.classes as class_record
  where class_record.id = assignment_record.class_id;

  return result;
end;
$$;

revoke all on function public.get_student_homework(uuid)
  from public, anon, authenticated;
grant execute on function public.get_student_homework(uuid) to authenticated;

create or replace function public.submit_student_homework(
  p_assignment_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_student_id uuid := (select auth.uid());
  v_recipient_id uuid;
  assignment_record public.homework_assignments%rowtype;
  membership_exists boolean;
  assigned_count integer;
  first_position smallint;
  last_position smallint;
  answer_item jsonb;
  answer_position integer;
  submitted_answer text;
  normalized_answer text;
  normalized_answers text[];
  submitted_answers text[];
  canonical_answers text[];
  position_seen boolean[];
  correctness boolean[];
  existing_submission public.homework_submissions%rowtype;
  existing_answer public.homework_submission_answers%rowtype;
  canonical_answer text;
  correct_count integer := 0;
  is_correct boolean;
  new_submission_id uuid;
  result jsonb;
  answer_index integer;
  assigned_row record;
  has_uncertified boolean;
begin
  if authenticated_student_id is null or p_assignment_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  select recipient.id
  into v_recipient_id
  from public.homework_recipients as recipient
  where recipient.assignment_id = p_assignment_id
    and recipient.student_id = authenticated_student_id
  for update of recipient;

  if v_recipient_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  select assignment.*
  into assignment_record
  from public.homework_assignments as assignment
  where assignment.id = p_assignment_id;

  perform 1
  from public.class_memberships as membership
  where membership.class_id = assignment_record.class_id
    and membership.student_id = authenticated_student_id
  for key share;
  membership_exists := found;

  if not membership_exists then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  select
    count(*)::integer,
    min(assigned.position),
    max(assigned.position)
  into assigned_count, first_position, last_position
  from public.homework_recipient_exercises as assigned
  where assigned.recipient_id = v_recipient_id;

  if assigned_count <> assignment_record.exercise_count
    or first_position <> 1
    or last_position <> assignment_record.exercise_count then
    raise log 'Homework scoring unavailable for assignment %, recipient %: assigned positions do not match the immutable count',
      p_assignment_id,
      v_recipient_id;
    raise exception using
      errcode = 'P0004',
      message = 'Homework scoring is unavailable';
  end if;

  if not exists (
    select 1
    from public.homework_submissions as submission
    where submission.recipient_id = v_recipient_id
  ) then
    select exists (
      select 1
      from public.homework_recipient_exercises as assigned
      left join public.exercises as exercise
        on exercise.id = assigned.exercise_id
      where assigned.recipient_id = v_recipient_id
        and not coalesce(public.is_currently_certified_exercise(exercise.id), false)
    )
    into has_uncertified;

    if has_uncertified then
      raise exception using
        errcode = 'P0002',
        message = 'Homework is unavailable';
    end if;
  end if;

  if p_answers is null or jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'Invalid homework answers';
  end if;

  if jsonb_array_length(p_answers) <> assigned_count then
    raise exception using
      errcode = '22023',
      message = 'Invalid homework answers';
  end if;

  normalized_answers := array_fill(null::text, array[assigned_count]);
  submitted_answers := array_fill(null::text, array[assigned_count]);
  canonical_answers := array_fill(null::text, array[assigned_count]);
  position_seen := array_fill(false, array[assigned_count]);
  correctness := array_fill(false, array[assigned_count]);

  for answer_item in
    select item.value
    from jsonb_array_elements(p_answers) as item(value)
  loop
    if jsonb_typeof(answer_item) is distinct from 'object' then
      raise exception using
        errcode = '22023',
        message = 'Invalid homework answers';
    end if;

    if (select count(*) from jsonb_object_keys(answer_item)) <> 2
      or not (answer_item ? 'position')
      or not (answer_item ? 'answer')
      or jsonb_typeof(answer_item -> 'position') is distinct from 'number'
      or (answer_item ->> 'position') !~ '^[1-5]$'
      or jsonb_typeof(answer_item -> 'answer') not in ('string', 'null') then
      raise exception using
        errcode = '22023',
        message = 'Invalid homework answers';
    end if;

    answer_position := (answer_item ->> 'position')::integer;

    if answer_position > assigned_count then
      raise exception using
        errcode = '22023',
        message = 'Invalid homework answers';
    end if;

    if position_seen[answer_position] then
      raise exception using
        errcode = '22023',
        message = 'Invalid homework answers';
    end if;

    submitted_answer := answer_item ->> 'answer';
    if submitted_answer is not null and char_length(submitted_answer) > 200 then
      raise exception using
        errcode = '22023',
        message = 'Invalid homework answers';
    end if;

    begin
      normalized_answer := public.normalize_student_homework_answer(submitted_answer);
    exception
      when sqlstate '22023' then
        raise exception using
          errcode = '22023',
          message = 'Invalid homework answers';
    end;

    position_seen[answer_position] := true;
    submitted_answers[answer_position] := submitted_answer;
    normalized_answers[answer_position] := normalized_answer;
  end loop;

  for answer_index in 1..assigned_count loop
    if not position_seen[answer_index] then
      raise exception using
        errcode = '22023',
        message = 'Invalid homework answers';
    end if;
  end loop;

  select *
  into existing_submission
  from public.homework_submissions as submission
  where submission.recipient_id = v_recipient_id
  for update;

  if found then
    for answer_index in 1..assigned_count loop
      select *
      into existing_answer
      from public.homework_submission_answers as answer
      where answer.submission_id = existing_submission.id
        and answer.position = answer_index;

      if not found then
        raise log 'Homework scoring unavailable for assignment %, recipient %: persisted answer position is missing',
          p_assignment_id,
          v_recipient_id;
        raise exception using
          errcode = 'P0004',
          message = 'Homework scoring is unavailable';
      end if;

      if existing_answer.normalized_answer is distinct from normalized_answers[answer_index] then
        raise exception using
          errcode = 'P0003',
          message = 'Homework has already been submitted';
      end if;
    end loop;

    select exists (
      select 1
      from public.homework_recipient_exercises as assigned
      left join public.exercises as exercise
        on exercise.id = assigned.exercise_id
      where assigned.recipient_id = v_recipient_id
        and not coalesce(public.is_currently_certified_exercise(exercise.id), false)
    )
    into has_uncertified;

    if has_uncertified then
      result := public.homework_submission_result_only(existing_submission.id);
    else
      result := public.homework_submission_result(existing_submission.id);
    end if;
    return result || jsonb_build_object(
      'replayed', true,
      'kind', case when has_uncertified then 'result-only' else 'scored' end
    );
  end if;

  select exists (
    select 1
    from public.homework_recipient_exercises as assigned
    left join public.exercises as exercise
      on exercise.id = assigned.exercise_id
    where assigned.recipient_id = v_recipient_id
      and not coalesce(public.is_currently_certified_exercise(exercise.id), false)
  )
  into has_uncertified;

  if has_uncertified then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  for assigned_row in
    select
      assigned.position,
      exercise.canonical_answer
    from public.homework_recipient_exercises as assigned
    join public.exercises as exercise
      on exercise.id = assigned.exercise_id
    where assigned.recipient_id = v_recipient_id
    order by assigned.position
  loop
    begin
      canonical_answer := public.normalize_student_homework_answer(assigned_row.canonical_answer);
    exception
      when sqlstate '22023' then
        raise log 'Homework scoring unavailable for assignment %, assigned position %: unsupported canonical answer',
          p_assignment_id,
          assigned_row.position;
        raise exception using
          errcode = 'P0004',
          message = 'Homework scoring is unavailable';
    end;

    if canonical_answer is null then
      raise log 'Homework scoring unavailable for assignment %, assigned position %: blank canonical answer',
        p_assignment_id,
        assigned_row.position;
      raise exception using
        errcode = 'P0004',
        message = 'Homework scoring is unavailable';
    end if;

    canonical_answers[assigned_row.position] := canonical_answer;
  end loop;

  for answer_index in 1..assigned_count loop
    is_correct := normalized_answers[answer_index] is not null
      and normalized_answers[answer_index] = canonical_answers[answer_index];
    correctness[answer_index] := is_correct;
    if is_correct then
      correct_count := correct_count + 1;
    end if;
  end loop;

  begin
    insert into public.homework_submissions (
      recipient_id,
      correct_count,
      assigned_count,
      passed
    )
    values (
      v_recipient_id,
      correct_count,
      assigned_count,
      2 * correct_count >= assigned_count
    )
    returning id into new_submission_id;

    insert into public.homework_submission_answers (
      submission_id,
      recipient_id,
      position,
      submitted_text,
      normalized_answer,
      is_correct
    )
    select
      new_submission_id,
      v_recipient_id,
      position_value,
      submitted_answers[position_value],
      normalized_answers[position_value],
      correctness[position_value]
    from generate_series(1, assigned_count) as positions(position_value);
  exception
    when others then
      raise log 'Homework submission persistence failed with SQLSTATE % for assignment %, recipient %',
        sqlstate,
        p_assignment_id,
        v_recipient_id;
      raise exception using
        errcode = 'P0005',
        message = 'Homework submission could not be saved';
  end;

  result := public.homework_submission_result(new_submission_id);
  return result || jsonb_build_object('replayed', false, 'kind', 'scored');
end;
$$;

revoke all on function public.submit_student_homework(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_student_homework(uuid, jsonb)
  to authenticated;
