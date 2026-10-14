create table public.exercise_generation_admission_state (
  teacher_id uuid primary key references auth.users (id) on delete cascade,
  admitted_at timestamptz[] not null default '{}'::timestamptz[],
  reservation_id uuid,
  reservation_expires_at timestamptz,
  constraint exercise_generation_admission_count_check check (
    cardinality(admitted_at) <= 10
    and array_position(admitted_at, null) is null
    and (cardinality(admitted_at) = 0 or array_ndims(admitted_at) = 1)
  ),
  constraint exercise_generation_reservation_pair_check check (
    (reservation_id is null) = (reservation_expires_at is null)
  )
);

alter table public.exercise_generation_admission_state enable row level security;

-- Admission state has no supported direct client operations: RLS default-denies.
revoke all on table public.exercise_generation_admission_state from public, anon, authenticated;

create function public.admit_exercise_generation()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
  admission_state public.exercise_generation_admission_state%rowtype;
  decision_time timestamptz;
  recent_admissions timestamptz[];
  blocking_deadline timestamptz;
  new_reservation_id uuid;
begin
  if authenticated_teacher_id is null or not (select public.is_teacher()) then
    raise exception using
      errcode = '42501',
      message = 'Teacher authentication is required';
  end if;

  -- The unique key serializes concurrent creation too, including an absent row.
  insert into public.exercise_generation_admission_state (teacher_id)
  values (authenticated_teacher_id)
  on conflict (teacher_id) do nothing;

  select state.*
  into strict admission_state
  from public.exercise_generation_admission_state as state
  where state.teacher_id = authenticated_teacher_id
  for update;

  decision_time := pg_catalog.clock_timestamp();

  select coalesce(pg_catalog.array_agg(admitted order by admitted), '{}'::timestamptz[])
  into recent_admissions
  from pg_catalog.unnest(admission_state.admitted_at) as timestamps(admitted)
  where admitted > decision_time - interval '60 minutes';

  if pg_catalog.cardinality(recent_admissions) >= 10 then
    blocking_deadline := greatest(
      recent_admissions[1] + interval '60 minutes',
      admission_state.reservation_expires_at
    );
  elsif admission_state.reservation_expires_at > decision_time then
    blocking_deadline := admission_state.reservation_expires_at;
  end if;

  if blocking_deadline is not null then
    update public.exercise_generation_admission_state
    set admitted_at = recent_admissions
    where teacher_id = authenticated_teacher_id;

    return pg_catalog.jsonb_build_object(
      'status', case when pg_catalog.cardinality(recent_admissions) >= 10
        then 'quota-exceeded' else 'in-progress' end,
      'retry_after_seconds', greatest(
        1, pg_catalog.ceil(extract(epoch from blocking_deadline - decision_time))::integer
      )
    );
  end if;

  new_reservation_id := pg_catalog.gen_random_uuid();
  update public.exercise_generation_admission_state
  set
    admitted_at = pg_catalog.array_append(recent_admissions, decision_time),
    reservation_id = new_reservation_id,
    reservation_expires_at = decision_time + interval '120 seconds'
  where teacher_id = authenticated_teacher_id;

  return pg_catalog.jsonb_build_object(
    'status', 'admitted',
    'reservation_id', new_reservation_id
  );
end;
$$;

revoke all on function public.admit_exercise_generation() from public, anon, service_role;
grant execute on function public.admit_exercise_generation() to authenticated;

create function public.release_exercise_generation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
begin
  if authenticated_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required';
  end if;

  update public.exercise_generation_admission_state
  set reservation_id = null, reservation_expires_at = null
  where teacher_id = authenticated_user_id
    and reservation_id = p_reservation_id;

  return found;
end;
$$;

revoke all on function public.release_exercise_generation(uuid) from public, anon, service_role;
grant execute on function public.release_exercise_generation(uuid) to authenticated;
