create table public.exercise_verifications (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id),
  candidate_id text not null check (btrim(candidate_id) <> ''),
  candidate_text text not null check (btrim(candidate_text) <> ''),
  proposed_canonical_answer text not null check (btrim(proposed_canonical_answer) <> ''),
  grade text not null check (btrim(grade) <> ''),
  topic text not null check (btrim(topic) <> ''),
  difficulty text not null check (btrim(difficulty) <> ''),
  outcome text not null check (outcome in ('unique_answer', 'answer_mismatch', 'not_unique_answer')),
  verified_answer text,
  verifier_identity text not null check (btrim(verifier_identity) <> ''),
  verifier_version text not null check (btrim(verifier_version) <> ''),
  verified_at timestamptz not null,
  rationale text not null check (btrim(rationale) <> ''),
  created_at timestamptz not null default now(),
  constraint exercise_verifications_teacher_candidate_unique unique (teacher_id, candidate_id),
  constraint exercise_verifications_verified_answer_check check (
    (
      outcome in ('unique_answer', 'answer_mismatch')
      and verified_answer is not null
      and btrim(verified_answer) <> ''
    )
    or (outcome = 'not_unique_answer' and verified_answer is null)
  )
);

alter table public.exercise_verifications enable row level security;

create policy "Teachers can read their own exercise verifications"
  on public.exercise_verifications
  for select
  to authenticated
  using (
    (select public.is_teacher())
    and teacher_id = (select auth.uid())
  );

revoke all on table public.exercise_verifications from anon, authenticated;
grant select on table public.exercise_verifications to authenticated;
grant select, insert on table public.exercise_verifications to service_role;

alter table public.exercises
  add column verification_id uuid,
  add constraint exercises_verification_id_foreign
    foreign key (verification_id) references public.exercise_verifications (id),
  add constraint exercises_verification_id_unique unique (verification_id);

revoke insert on table public.exercises from authenticated;

create function public.approve_verified_exercises(verification_ids uuid[])
returns table (
  verification_id uuid,
  exercise_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_teacher_id uuid := (select auth.uid());
  requested_count integer;
  distinct_count integer;
  requested_verification_id uuid;
  approved_exercise_id uuid;
begin
  if authenticated_teacher_id is null or not (select public.is_teacher()) then
    raise exception using
      errcode = '42501',
      message = 'Teacher authentication is required';
  end if;

  requested_count := coalesce(cardinality(verification_ids), 0);
  if requested_count < 1 or requested_count > 5 then
    raise exception using
      errcode = '22023',
      message = 'One to five verification IDs are required';
  end if;

  select count(distinct requested.id)
  into distinct_count
  from unnest(verification_ids) as requested(id);

  if distinct_count <> requested_count then
    raise exception using
      errcode = '22023',
      message = 'Verification IDs must be distinct and non-null';
  end if;

  if (
    select count(*)
    from public.exercise_verifications
    where id = any(verification_ids)
  ) <> requested_count then
    raise exception using
      errcode = '22023',
      message = 'Every verification record must exist';
  end if;

  if exists (
    select 1
    from public.exercise_verifications
    where id = any(verification_ids)
      and teacher_id <> authenticated_teacher_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Every verification record must belong to the authenticated teacher';
  end if;

  if exists (
    select 1
    from public.exercise_verifications
    where id = any(verification_ids)
      and outcome <> 'unique_answer'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Every verification record must have a unique answer';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested.id::text, 0)
  )
  from unnest(verification_ids) as requested(id)
  order by requested.id;

  for requested_verification_id in
    select requested.id
    from unnest(verification_ids) with ordinality as requested(id, position)
    order by requested.position
  loop
    approved_exercise_id := null;

    insert into public.exercises (
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
      approver_id,
      verification_id
    )
    select
      candidate_text,
      verified_answer,
      grade,
      topic,
      difficulty,
      outcome,
      verifier_identity,
      verifier_version,
      verified_at,
      rationale,
      authenticated_teacher_id,
      authenticated_teacher_id,
      id
    from public.exercise_verifications
    where id = requested_verification_id
    on conflict on constraint exercises_verification_id_unique do nothing
    returning id into approved_exercise_id;

    verification_id := requested_verification_id;
    created := approved_exercise_id is not null;

    if approved_exercise_id is null then
      select exercises.id
      into approved_exercise_id
      from public.exercises as exercises
      where exercises.verification_id = requested_verification_id;
    end if;

    exercise_id := approved_exercise_id;
    return next;
  end loop;
end;
$$;

revoke all on function public.approve_verified_exercises(uuid[]) from public;
grant execute on function public.approve_verified_exercises(uuid[]) to authenticated;