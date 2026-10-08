create table public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  title text,
  grade text not null check (grade = '4'),
  topic text not null check (
    topic in (
      'addition-subtraction',
      'multiplication-division',
      'order-of-operations',
      'word-problems'
    )
  ),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  exercise_count integer not null check (exercise_count between 1 and 5),
  idempotency_key uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{32}$'),
  excluded_student_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  constraint homework_assignments_title_check check (
    title is null
    or (
      title = btrim(title)
      and title <> ''
      and char_length(title) <= 120
    )
  ),
  constraint homework_assignments_teacher_idempotency_key_unique
    unique (teacher_id, idempotency_key)
);

create table public.homework_recipients (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.homework_assignments (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  set_signature text not null check (set_signature <> ''),
  constraint homework_recipients_assignment_student_unique
    unique (assignment_id, student_id),
  constraint homework_recipients_assignment_signature_unique
    unique (assignment_id, set_signature)
);

create table public.homework_recipient_exercises (
  recipient_id uuid not null references public.homework_recipients (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position smallint not null check (position between 1 and 5),
  primary key (recipient_id, position),
  constraint homework_recipient_exercises_recipient_exercise_unique
    unique (recipient_id, exercise_id)
);

alter table public.homework_assignments enable row level security;
alter table public.homework_recipients enable row level security;
alter table public.homework_recipient_exercises enable row level security;

revoke all on table public.homework_assignments from public, anon, authenticated;
revoke all on table public.homework_recipients from public, anon, authenticated;
revoke all on table public.homework_recipient_exercises from public, anon, authenticated;
grant all on table public.homework_assignments to service_role;
grant all on table public.homework_recipients to service_role;
grant all on table public.homework_recipient_exercises to service_role;

create index homework_assignments_teacher_created_at_index
  on public.homework_assignments (teacher_id, created_at desc);

create index homework_assignments_class_created_at_index
  on public.homework_assignments (class_id, created_at desc);

create index homework_recipients_student_assignment_index
  on public.homework_recipients (student_id, assignment_id);

create function public.list_class_homework_roster(p_class_id uuid)
returns table (
  student_id uuid,
  student_email text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
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

  return query
  select
    membership.student_id,
    lower(btrim(auth_user.email)),
    membership.joined_at
  from public.class_memberships as membership
  join auth.users as auth_user
    on auth_user.id = membership.student_id
  where membership.class_id = p_class_id
  order by membership.joined_at, membership.student_id;
end;
$$;

revoke all on function public.list_class_homework_roster(uuid) from public, anon;
grant execute on function public.list_class_homework_roster(uuid) to authenticated;

create function public.create_homework_assignment(
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

  request_fingerprint := pg_catalog.md5(
    jsonb_build_object(
      'class_id', p_class_id,
      'title', normalized_title,
      'topic', p_topic,
      'difficulty', p_difficulty,
      'exercise_count', p_exercise_count,
      'allocations', normalized_allocations
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
      and exercise.verification_verdict = 'unique_answer';

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

revoke all on function public.create_homework_assignment(uuid, text, text, text, integer, uuid, jsonb)
  from public, anon;
grant execute on function public.create_homework_assignment(uuid, text, text, text, integer, uuid, jsonb)
  to authenticated;