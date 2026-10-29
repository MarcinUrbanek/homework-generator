create table public.homework_submission_feedback (
  submission_id uuid primary key references public.homework_submissions (id) on delete cascade,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint homework_submission_feedback_body_check check (
    btrim(body) <> ''
    and char_length(body) <= 2000
  )
);

alter table public.homework_submission_feedback enable row level security;

revoke all on table public.homework_submission_feedback from public, anon, authenticated;
grant all on table public.homework_submission_feedback to service_role;

create function public.homework_submission_feedback_json(p_submission_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'body', feedback.body,
    'updated_at', feedback.updated_at
  )
  from public.homework_submission_feedback as feedback
  where feedback.submission_id = p_submission_id;
$$;

revoke all on function public.homework_submission_feedback_json(uuid)
  from public, anon, authenticated, service_role;

-- Returns the assignment summary only when the caller is a teacher who owns its class.
create function public.owned_homework_assignment_summary(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
  result jsonb;
begin
  if authenticated_teacher_id is null
    or p_assignment_id is null
    or not (select public.is_teacher()) then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  select jsonb_build_object(
    'assignment_id', assignment.id,
    'class_id', assignment.class_id,
    'class_name', class_record.name,
    'title', assignment.title,
    'grade', assignment.grade,
    'topic', assignment.topic,
    'difficulty', assignment.difficulty,
    'exercise_count', assignment.exercise_count,
    'created_at', assignment.created_at
  )
  into result
  from public.homework_assignments as assignment
  join public.classes as class_record
    on class_record.id = assignment.class_id
  where assignment.id = p_assignment_id
    and class_record.teacher_id = authenticated_teacher_id;

  if result is null then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  return result;
end;
$$;

revoke all on function public.owned_homework_assignment_summary(uuid)
  from public, anon, authenticated, service_role;

create function public.list_teacher_class_homework(p_class_id uuid)
returns table (
  assignment_id uuid,
  title text,
  grade text,
  topic text,
  difficulty text,
  exercise_count integer,
  created_at timestamptz,
  recipient_count integer,
  submitted_count integer,
  passed_count integer,
  feedback_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
begin
  if authenticated_teacher_id is null
    or p_class_id is null
    or not (select public.is_teacher()) then
    raise exception using
      errcode = 'P0002',
      message = 'Class is unavailable';
  end if;

  if not exists (
    select 1
    from public.classes as class_record
    where class_record.id = p_class_id
      and class_record.teacher_id = authenticated_teacher_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Class is unavailable';
  end if;

  return query
  select
    assignment.id,
    assignment.title,
    assignment.grade,
    assignment.topic,
    assignment.difficulty,
    assignment.exercise_count,
    assignment.created_at,
    count(recipient.id)::integer,
    count(submission.id)::integer,
    count(submission.id) filter (where submission.passed)::integer,
    count(feedback.submission_id)::integer
  from public.homework_assignments as assignment
  left join public.homework_recipients as recipient
    on recipient.assignment_id = assignment.id
  left join public.homework_submissions as submission
    on submission.recipient_id = recipient.id
  left join public.homework_submission_feedback as feedback
    on feedback.submission_id = submission.id
  where assignment.class_id = p_class_id
  group by assignment.id
  order by assignment.created_at desc, assignment.id;
end;
$$;

revoke all on function public.list_teacher_class_homework(uuid)
  from public, anon, authenticated;
grant execute on function public.list_teacher_class_homework(uuid) to authenticated;

create function public.get_teacher_homework_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  assignment_summary jsonb := public.owned_homework_assignment_summary(p_assignment_id);
begin
  return jsonb_build_object(
    'assignment', assignment_summary,
    'recipients',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'student_id', recipient.student_id,
            'student_email', lower(btrim(auth_user.email)),
            'is_member', exists (
              select 1
              from public.class_memberships as membership
              where membership.class_id = (assignment_summary ->> 'class_id')::uuid
                and membership.student_id = recipient.student_id
            ),
            'submitted', submission.id is not null,
            'submitted_at', submission.submitted_at,
            'correct_count', submission.correct_count,
            'passed', submission.passed,
            'has_feedback', feedback.submission_id is not null
          )
          order by lower(btrim(auth_user.email)), recipient.student_id
        )
        from public.homework_recipients as recipient
        join auth.users as auth_user
          on auth_user.id = recipient.student_id
        left join public.homework_submissions as submission
          on submission.recipient_id = recipient.id
        left join public.homework_submission_feedback as feedback
          on feedback.submission_id = submission.id
        where recipient.assignment_id = p_assignment_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_teacher_homework_assignment(uuid)
  from public, anon, authenticated;
grant execute on function public.get_teacher_homework_assignment(uuid) to authenticated;

create function public.get_teacher_homework_submission(
  p_assignment_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  assignment_summary jsonb := public.owned_homework_assignment_summary(p_assignment_id);
  v_recipient_id uuid;
  v_submission_id uuid;
  student_summary jsonb;
begin
  select
    recipient.id,
    jsonb_build_object(
      'student_id', recipient.student_id,
      'student_email', lower(btrim(auth_user.email)),
      'is_member', exists (
        select 1
        from public.class_memberships as membership
        where membership.class_id = (assignment_summary ->> 'class_id')::uuid
          and membership.student_id = recipient.student_id
      )
    )
  into v_recipient_id, student_summary
  from public.homework_recipients as recipient
  join auth.users as auth_user
    on auth_user.id = recipient.student_id
  where recipient.assignment_id = p_assignment_id
    and recipient.student_id = p_student_id;

  if v_recipient_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  select submission.id
  into v_submission_id
  from public.homework_submissions as submission
  where submission.recipient_id = v_recipient_id;

  return jsonb_build_object(
    'assignment', assignment_summary,
    'student', student_summary,
    'submission',
    (
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
                'prompt', exercise.exercise_text,
                'answer', answer.submitted_text,
                'is_correct', answer.is_correct,
                'expected_answer', exercise.canonical_answer
              )
              order by answer.position
            )
            from public.homework_submission_answers as answer
            join public.homework_recipient_exercises as assigned
              on assigned.recipient_id = answer.recipient_id
              and assigned.position = answer.position
            join public.exercises as exercise
              on exercise.id = assigned.exercise_id
            where answer.submission_id = submission.id
          ),
          '[]'::jsonb
        )
      )
      from public.homework_submissions as submission
      where submission.id = v_submission_id
    ),
    'feedback', public.homework_submission_feedback_json(v_submission_id)
  );
end;
$$;

revoke all on function public.get_teacher_homework_submission(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_teacher_homework_submission(uuid, uuid) to authenticated;

create function public.save_homework_submission_feedback(
  p_assignment_id uuid,
  p_student_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
  assignment_summary jsonb := public.owned_homework_assignment_summary(p_assignment_id);
  normalized_body text;
  v_recipient_id uuid;
  v_submission_id uuid;
  saved_feedback jsonb;
begin
  if p_body is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid feedback';
  end if;

  normalized_body := btrim(
    p_body,
    ' ' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13)
  );

  if char_length(normalized_body) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'Invalid feedback';
  end if;

  select recipient.id
  into v_recipient_id
  from public.homework_recipients as recipient
  where recipient.assignment_id = p_assignment_id
    and recipient.student_id = p_student_id
  for key share of recipient;

  if v_recipient_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Homework is unavailable';
  end if;

  -- Lock the membership so a concurrent removal cannot leave feedback for a departed student.
  perform 1
  from public.class_memberships as membership
  where membership.class_id = (assignment_summary ->> 'class_id')::uuid
    and membership.student_id = p_student_id
  for key share;

  if not found then
    raise exception using
      errcode = 'P0003',
      message = 'Feedback is not allowed';
  end if;

  select submission.id
  into v_submission_id
  from public.homework_submissions as submission
  where submission.recipient_id = v_recipient_id;

  if v_submission_id is null then
    raise exception using
      errcode = 'P0003',
      message = 'Feedback is not allowed';
  end if;

  if normalized_body = '' then
    delete from public.homework_submission_feedback as feedback
    where feedback.submission_id = v_submission_id;

    return jsonb_build_object('feedback', null);
  end if;

  insert into public.homework_submission_feedback as feedback (
    submission_id,
    teacher_id,
    body
  )
  values (
    v_submission_id,
    authenticated_teacher_id,
    normalized_body
  )
  on conflict (submission_id) do update
  set
    body = excluded.body,
    teacher_id = excluded.teacher_id,
    updated_at = statement_timestamp()
  returning jsonb_build_object(
    'body', feedback.body,
    'updated_at', feedback.updated_at
  )
  into saved_feedback;

  return jsonb_build_object('feedback', saved_feedback);
end;
$$;

revoke all on function public.save_homework_submission_feedback(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.save_homework_submission_feedback(uuid, uuid, text) to authenticated;

drop function public.list_student_homework();

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
  passed boolean,
  has_feedback boolean
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
    submission.passed,
    feedback.submission_id is not null
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
  left join public.homework_submission_feedback as feedback
    on feedback.submission_id = submission.id
  where recipient.student_id = authenticated_student_id
  order by submission.id is not null, assignment.created_at desc, assignment.id;
end;
$$;

revoke all on function public.list_student_homework()
  from public, anon, authenticated;
grant execute on function public.list_student_homework() to authenticated;

-- Rebuilt from 20261016140000_protect_uncertified_homework_consumers.sql with a top-level feedback field.
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
      'result', public.homework_submission_result_only(v_submission_id),
      'feedback', public.homework_submission_feedback_json(v_submission_id)
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
    end,
    'feedback',
    case
      when v_submission_id is null then null
      else public.homework_submission_feedback_json(v_submission_id)
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
