create index exercises_grade_topic_approved_at_id_idx
  on public.exercises (grade, topic, approved_at desc, id desc);

create index exercises_grade_topic_difficulty_approved_at_id_idx
  on public.exercises (grade, topic, difficulty, approved_at desc, id desc);

create function public.get_saved_exercises(
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
security invoker
set search_path = ''
as $$
begin
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
  order by exercise.approved_at desc, exercise.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_saved_exercises(text, text, text, timestamptz, uuid, integer) from public;
grant execute on function public.get_saved_exercises(text, text, text, timestamptz, uuid, integer) to authenticated;