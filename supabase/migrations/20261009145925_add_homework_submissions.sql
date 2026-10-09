create function public.normalize_student_homework_answer(p_answer text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  trimmed_answer text;
  digits_answer text;
  normalized_answer text;
begin
  if p_answer is null then
    return null;
  end if;

  -- Keep this ASCII whitespace set identical in the application validator.
  trimmed_answer := pg_catalog.btrim(
    p_answer,
    ' ' || pg_catalog.chr(9) || pg_catalog.chr(10) || pg_catalog.chr(11)
      || pg_catalog.chr(12) || pg_catalog.chr(13)
  );

  if trimmed_answer = '' then
    return null;
  end if;

  if trimmed_answer !~ '^[0-9]+$'
    and trimmed_answer !~ '^[0-9]{1,3}( [0-9]{3})+$' then
    raise exception using
      errcode = '22023',
      message = 'Invalid homework answers';
  end if;

  digits_answer := pg_catalog.replace(trimmed_answer, ' ', '');
  normalized_answer := pg_catalog.regexp_replace(digits_answer, '^0+', '');

  return coalesce(nullif(normalized_answer, ''), '0');
end;
$$;

revoke all on function public.normalize_student_homework_answer(text)
  from public, anon, authenticated;
grant execute on function public.normalize_student_homework_answer(text)
  to service_role;

create table public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.homework_recipients (id) on delete cascade,
  submitted_at timestamptz not null default statement_timestamp(),
  correct_count integer not null check (correct_count >= 0),
  assigned_count integer not null check (assigned_count between 1 and 5),
  passed boolean not null,
  constraint homework_submissions_recipient_unique unique (recipient_id),
  constraint homework_submissions_id_recipient_unique unique (id, recipient_id),
  constraint homework_submissions_result_check check (
    correct_count <= assigned_count
    and passed = (2 * correct_count >= assigned_count)
  )
);

create table public.homework_submission_answers (
  submission_id uuid not null,
  recipient_id uuid not null,
  position smallint not null check (position between 1 and 5),
  submitted_text text,
  normalized_answer text,
  is_correct boolean not null,
  primary key (submission_id, position),
  constraint homework_submission_answers_submission_recipient_fk
    foreign key (submission_id, recipient_id)
    references public.homework_submissions (id, recipient_id)
    on delete cascade,
  constraint homework_submission_answers_assigned_position_fk
    foreign key (recipient_id, position)
    references public.homework_recipient_exercises (recipient_id, position)
    on delete cascade,
  constraint homework_submission_answers_text_length_check check (
    submitted_text is null or char_length(submitted_text) <= 200
  ),
  constraint homework_submission_answers_normalized_format_check check (
    normalized_answer is null or normalized_answer ~ '^(0|[1-9][0-9]*)$'
  ),
  constraint homework_submission_answers_normalized_match_check check (
    normalized_answer is not distinct from
      public.normalize_student_homework_answer(submitted_text)
  ),
  constraint homework_submission_answers_blank_incorrect_check check (
    normalized_answer is not null or not is_correct
  )
);

alter table public.homework_submissions enable row level security;
alter table public.homework_submission_answers enable row level security;

revoke all on table public.homework_submissions from public, anon, authenticated;
revoke all on table public.homework_submission_answers from public, anon, authenticated;
grant all on table public.homework_submissions to service_role;
grant all on table public.homework_submission_answers to service_role;

create function public.homework_submission_result(p_submission_id uuid)
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
              'normalized_answer', answer.normalized_answer,
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

revoke all on function public.homework_submission_result(uuid)
  from public, anon, authenticated, service_role;

create function public.list_student_homework()
returns table (
  assignment_id uuid,
  class_name text,
  assignment_title text,
  created_at timestamptz,
  exercise_count integer,
  submitted boolean,
  submitted_at timestamptz,
  correct_count integer,
  passed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_student_id uuid := (select auth.uid());
begin
  if authenticated_student_id is null then
    return;
  end if;

  return query
  select
    assignment.id,
    class_record.name,
    assignment.title,
    assignment.created_at,
    assignment.exercise_count,
    submission.id is not null,
    submission.submitted_at,
    submission.correct_count,
    submission.passed
  from public.homework_recipients as recipient
  join public.homework_assignments as assignment
    on assignment.id = recipient.assignment_id
  join public.classes as class_record
    on class_record.id = assignment.class_id
  join public.class_memberships as membership
    on membership.class_id = assignment.class_id
    and membership.student_id = authenticated_student_id
  left join public.homework_submissions as submission
    on submission.recipient_id = recipient.id
  where recipient.student_id = authenticated_student_id
  order by submission.id is not null, assignment.created_at desc, assignment.id;
end;
$$;

revoke all on function public.list_student_homework()
  from public, anon, authenticated;
grant execute on function public.list_student_homework() to authenticated;

create function public.get_student_homework(p_assignment_id uuid)
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

  select jsonb_build_object(
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

create function public.submit_student_homework(
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

    result := public.homework_submission_result(existing_submission.id);
    return result || jsonb_build_object('replayed', true);
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
  return result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.submit_student_homework(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_student_homework(uuid, jsonb)
  to authenticated;
