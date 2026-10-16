alter table public.exercise_verifications
  add column arithmetic_structure jsonb,
  add column authority_version integer;

alter table public.exercise_verifications
  drop constraint exercise_verifications_outcome_check,
  add constraint exercise_verifications_outcome_check
    check (outcome in ('unique_answer', 'answer_mismatch', 'not_unique_answer', 'unsupported_evidence')),
  drop constraint exercise_verifications_verified_answer_check,
  add constraint exercise_verifications_verified_answer_check
    check (
      (
        outcome in ('unique_answer', 'answer_mismatch')
        and verified_answer is not null
        and btrim(verified_answer) <> ''
      )
      or (outcome in ('not_unique_answer', 'unsupported_evidence') and verified_answer is null)
    );

alter table public.exercises
  add column arithmetic_structure jsonb,
  add column authority_version integer;

create function public.evaluate_arithmetic_expression_v1(expression jsonb, current_depth integer default 0)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  expression_kind text;
  object_size integer;
  left_result jsonb;
  right_result jsonb;
  value numeric;
  rendered text;
begin
  if current_depth > 4
    or pg_catalog.jsonb_typeof(expression) is distinct from 'object'
  then
    raise exception using errcode = '22023', message = 'Unsupported arithmetic structure';
  end if;

  expression_kind := expression ->> 'kind';
  select count(*)::integer
  into object_size
  from pg_catalog.jsonb_object_keys(expression);

  if expression_kind = 'number' then
    if object_size <> 2
      or pg_catalog.jsonb_typeof(expression -> 'value') is distinct from 'number'
      or (expression ->> 'value') !~ '^(0|[1-9][0-9]*)$'
    then
      raise exception using errcode = '22023', message = 'Unsupported arithmetic number';
    end if;
    value := (expression ->> 'value')::numeric;
    if value > 1000000 then
      raise exception using errcode = '22023', message = 'Arithmetic operand is out of bounds';
    end if;
    return pg_catalog.jsonb_build_object(
      'value', value,
      'operation_count', 0,
      'depth', 0,
      'operators', '[]'::jsonb,
      'operands', pg_catalog.jsonb_build_array(value),
      'rendered', value::bigint::text
    );
  end if;

  if object_size <> 3
    or expression_kind is null
    or expression_kind not in ('add', 'subtract', 'multiply', 'divide')
    or not (expression ? 'left')
    or not (expression ? 'right')
  then
    raise exception using errcode = '22023', message = 'Unsupported arithmetic operation';
  end if;

  left_result := public.evaluate_arithmetic_expression_v1(expression -> 'left', current_depth + 1);
  right_result := public.evaluate_arithmetic_expression_v1(expression -> 'right', current_depth + 1);

  case expression_kind
    when 'add' then
      value := (left_result ->> 'value')::numeric + (right_result ->> 'value')::numeric;
    when 'subtract' then
      if (left_result ->> 'value')::numeric < (right_result ->> 'value')::numeric then
        raise exception using errcode = '22023', message = 'Negative arithmetic intermediate';
      end if;
      value := (left_result ->> 'value')::numeric - (right_result ->> 'value')::numeric;
    when 'multiply' then
      value := (left_result ->> 'value')::numeric * (right_result ->> 'value')::numeric;
    when 'divide' then
      if (right_result ->> 'value')::numeric = 0
        or pg_catalog.mod(
          (left_result ->> 'value')::numeric,
          (right_result ->> 'value')::numeric
        ) <> 0
      then
        raise exception using errcode = '22023', message = 'Division must be exact and nonzero';
      end if;
      value := (left_result ->> 'value')::numeric / (right_result ->> 'value')::numeric;
  end case;

  if value < 0 or value > 1000000 or value <> pg_catalog.trunc(value) then
    raise exception using errcode = '22023', message = 'Arithmetic intermediate is out of bounds';
  end if;

  rendered := '(' || (left_result ->> 'rendered') || ' ' ||
    case expression_kind
      when 'add' then '+'
      when 'subtract' then '-'
      when 'multiply' then '×'
      else ':'
    end || ' ' || (right_result ->> 'rendered') || ')';

  return pg_catalog.jsonb_build_object(
    'value', value,
    'operation_count',
      (left_result ->> 'operation_count')::integer + (right_result ->> 'operation_count')::integer + 1,
    'depth',
      case
        when (left_result ->> 'depth')::integer > (right_result ->> 'depth')::integer
          then (left_result ->> 'depth')::integer
        else (right_result ->> 'depth')::integer
      end + 1,
    'operators',
      (left_result -> 'operators') || (right_result -> 'operators') || pg_catalog.jsonb_build_array(expression_kind),
    'operands', (left_result -> 'operands') || (right_result -> 'operands'),
    'rendered', rendered
  );
end;
$$;

create function public.derive_arithmetic_exercise_v1(
  exercise_grade text,
  exercise_topic text,
  exercise_difficulty text,
  structure jsonb
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  evaluated jsonb;
  expression jsonb;
  operation_count integer;
  maximum_operand numeric;
  operator_name text;
  has_additive boolean := false;
  has_multiplicative boolean := false;
  crosses_tens boolean;
  left_value numeric;
  right_value numeric;
  arithmetic_kind text;
  within_bucket boolean;
begin
  if exercise_grade <> '4'
    or exercise_topic not in ('addition-subtraction', 'multiplication-division', 'order-of-operations')
    or exercise_difficulty not in ('easy', 'medium', 'hard')
    or pg_catalog.jsonb_typeof(structure) is distinct from 'object'
  then
    raise exception using errcode = '22023', message = 'Unsupported exercise authority version or metadata';
  end if;

  if (
    select count(*)
    from pg_catalog.jsonb_object_keys(structure)
  ) <> 2
    or pg_catalog.jsonb_typeof(structure -> 'version') is distinct from 'number'
    or structure ->> 'version' is distinct from '1'
    or not (structure ? 'expression')
  then
    raise exception using errcode = '22023', message = 'Unsupported exercise authority version or metadata';
  end if;

  expression := structure -> 'expression';
  evaluated := public.evaluate_arithmetic_expression_v1(expression);
  operation_count := (evaluated ->> 'operation_count')::integer;
  arithmetic_kind := expression ->> 'kind';

  case exercise_topic
    when 'addition-subtraction' then
      maximum_operand := case exercise_difficulty
        when 'easy' then 100
        when 'medium' then 10000
        else 1000000
      end;
      if exercise_difficulty in ('easy', 'medium') and operation_count <> 1 then
        raise exception using errcode = '22023', message = 'Operation count is outside the topic bucket';
      end if;
      if exercise_difficulty = 'hard' and operation_count <> 2 then
        raise exception using errcode = '22023', message = 'Operation count is outside the topic bucket';
      end if;
      if exists (
        select 1 from pg_catalog.jsonb_array_elements_text(evaluated -> 'operators') as operators(value)
        where operators.value not in ('add', 'subtract')
      ) then
        raise exception using errcode = '22023', message = 'Operator is outside the topic bucket';
      end if;
      if exercise_difficulty in ('easy', 'medium') then
        left_value := (expression -> 'left' ->> 'value')::numeric;
        right_value := (expression -> 'right' ->> 'value')::numeric;
        if pg_catalog.jsonb_typeof(expression -> 'left') <> 'object'
          or pg_catalog.jsonb_typeof(expression -> 'right') <> 'object'
          or expression -> 'left' ->> 'kind' <> 'number'
          or expression -> 'right' ->> 'kind' <> 'number'
        then
          raise exception using errcode = '22023', message = 'Operand shape is outside the topic bucket';
        end if;
        if arithmetic_kind = 'add' then
          crosses_tens := pg_catalog.mod(left_value, 10) + pg_catalog.mod(right_value, 10) >= 10;
        else
          crosses_tens := pg_catalog.mod(left_value, 10) < pg_catalog.mod(right_value, 10);
        end if;
        if (exercise_difficulty = 'easy' and crosses_tens)
          or (exercise_difficulty = 'medium' and not crosses_tens)
        then
          raise exception using errcode = '22023', message = 'Tens crossing is outside the topic bucket';
        end if;
      end if;
    when 'multiplication-division' then
      maximum_operand := case exercise_difficulty
        when 'easy' then 100
        when 'medium' then 8991
        else 1000000
      end;
      if operation_count <> 1
        or arithmetic_kind not in ('multiply', 'divide')
        or expression -> 'left' ->> 'kind' <> 'number'
        or expression -> 'right' ->> 'kind' <> 'number'
      then
        raise exception using errcode = '22023', message = 'Operation shape is outside the topic bucket';
      end if;
      left_value := (expression -> 'left' ->> 'value')::numeric;
      right_value := (expression -> 'right' ->> 'value')::numeric;
      if exercise_difficulty = 'easy' then
        within_bucket := case arithmetic_kind
          when 'multiply' then left_value <= 10 and right_value <= 10
          else left_value <= 100 and right_value <= 10
        end;
      elsif exercise_difficulty = 'medium' then
        within_bucket := case arithmetic_kind
          when 'multiply' then
            (left_value <= 999 and right_value <= 9) or (right_value <= 999 and left_value <= 9)
          else left_value <= 8991 and right_value <= 9 and (evaluated ->> 'value')::numeric <= 999
        end;
      else
        within_bucket := case arithmetic_kind
          when 'multiply' then left_value >= 10 and right_value >= 10
          else left_value >= 100 and right_value >= 1 and right_value <= 9
        end;
      end if;
      if not within_bucket then
        raise exception using errcode = '22023', message = 'Parameters are outside the topic bucket';
      end if;
    when 'order-of-operations' then
      maximum_operand := case exercise_difficulty
        when 'easy' then 100
        when 'medium' then 1000
        else 10000
      end;
      if (exercise_difficulty = 'easy' and operation_count <> 2)
        or (exercise_difficulty = 'medium' and operation_count <> 3)
        or (exercise_difficulty = 'hard' and operation_count <> 4)
      then
        raise exception using errcode = '22023', message = 'Operation count is outside the topic bucket';
      end if;
      for operator_name in
        select operators.value
        from pg_catalog.jsonb_array_elements_text(evaluated -> 'operators') as operators(value)
      loop
        has_additive := has_additive or operator_name in ('add', 'subtract');
        has_multiplicative := has_multiplicative or operator_name in ('multiply', 'divide');
      end loop;
      if exercise_difficulty = 'easy' then
        if arithmetic_kind not in ('add', 'subtract')
          or not (
            expression -> 'left' ->> 'kind' in ('multiply', 'divide')
            or expression -> 'right' ->> 'kind' in ('multiply', 'divide')
          )
        then
          raise exception using errcode = '22023', message = 'Precedence is outside the topic bucket';
        end if;
      elsif not has_additive or not has_multiplicative then
        raise exception using errcode = '22023', message = 'Operation families are outside the topic bucket';
      end if;
  end case;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(evaluated -> 'operands') as operands(value)
    where operands.value::numeric > maximum_operand
  )
    or (evaluated ->> 'depth')::integer > 4
    or operation_count > 4
  then
    raise exception using errcode = '22023', message = 'Exercise parameters are out of bounds';
  end if;

  return pg_catalog.jsonb_build_object(
    'exercise_text',
      'Oblicz wartość wyrażenia: ' || (evaluated ->> 'rendered') ||
      '. Podaj wynik jako jedną liczbę naturalną.',
    'canonical_answer', (evaluated ->> 'value')::numeric::bigint::text
  );
end;
$$;

create function public.validate_exercise_verification_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived jsonb;
begin
  if new.outcome = 'not_unique_answer' then
    raise exception using
      errcode = '23514',
      message = 'New evidence must use unsupported_evidence rather than model-only ambiguity';
  end if;

  if new.outcome not in ('unique_answer', 'answer_mismatch') then
    return new;
  end if;

  if new.authority_version is distinct from 1 or new.arithmetic_structure is null then
    raise exception using errcode = '23514', message = 'Successful evidence requires arithmetic authority v1';
  end if;

  begin
    derived := public.derive_arithmetic_exercise_v1(new.grade, new.topic, new.difficulty, new.arithmetic_structure);
  exception when others then
    raise exception using errcode = '23514', message = 'Successful evidence has an unsupported arithmetic structure';
  end;

  if derived ->> 'exercise_text' is distinct from new.candidate_text
    or derived ->> 'canonical_answer' is distinct from new.verified_answer
    or (
      new.outcome = 'unique_answer'
      and new.proposed_canonical_answer is distinct from derived ->> 'canonical_answer'
    )
    or (
      new.outcome = 'answer_mismatch'
      and new.proposed_canonical_answer = derived ->> 'canonical_answer'
    )
  then
    raise exception using errcode = '23514', message = 'Verification evidence does not match its arithmetic snapshot';
  end if;

  return new;
end;
$$;

create trigger exercise_verifications_authority_insert
  before insert on public.exercise_verifications
  for each row execute function public.validate_exercise_verification_authority();

create function public.prevent_exercise_verification_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'Exercise verification evidence is immutable';
end;
$$;

create trigger exercise_verifications_immutable
  before update on public.exercise_verifications
  for each row execute function public.prevent_exercise_verification_mutation();

create function public.validate_exercise_pool_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence public.exercise_verifications%rowtype;
  derived jsonb;
begin
  if new.verification_id is null then
    raise exception using errcode = '23514', message = 'New pool entries require an authoritative verification link';
  end if;

  select verification.*
  into evidence
  from public.exercise_verifications as verification
  where verification.id = new.verification_id;

  if not found
    or evidence.outcome <> 'unique_answer'
    or evidence.authority_version is distinct from 1
    or evidence.arithmetic_structure is null
    or evidence.teacher_id <> new.creator_id
    or evidence.teacher_id <> new.approver_id
    or new.creator_id <> new.approver_id
    or not exists (
      select 1
      from public.profile_roles as roles
      where roles.user_id = evidence.teacher_id
        and roles.role = 'teacher'
    )
  then
    raise exception using errcode = '23514', message = 'Pool entry must link to current owned authoritative evidence';
  end if;

  begin
    derived := public.derive_arithmetic_exercise_v1(
      evidence.grade,
      evidence.topic,
      evidence.difficulty,
      evidence.arithmetic_structure
    );
  exception when others then
    raise exception using errcode = '23514', message = 'Pool evidence has an unsupported arithmetic structure';
  end;

  if derived ->> 'exercise_text' is distinct from evidence.candidate_text
    or derived ->> 'canonical_answer' is distinct from evidence.proposed_canonical_answer
    or evidence.verified_answer is distinct from derived ->> 'canonical_answer'
    or new.exercise_text is distinct from evidence.candidate_text
    or new.canonical_answer is distinct from derived ->> 'canonical_answer'
    or new.grade is distinct from evidence.grade
    or new.topic is distinct from evidence.topic
    or new.difficulty is distinct from evidence.difficulty
    or new.verification_verdict is distinct from 'unique_answer'
    or new.verifier_identity is distinct from evidence.verifier_identity
    or new.verifier_version is distinct from evidence.verifier_version
    or new.verified_at is distinct from evidence.verified_at
    or new.verification_rationale is distinct from evidence.rationale
    or new.arithmetic_structure is distinct from evidence.arithmetic_structure
    or new.authority_version is distinct from evidence.authority_version
  then
    raise exception using errcode = '23514', message = 'Pool entry does not match its certified snapshot';
  end if;

  return new;
end;
$$;

create trigger exercises_authority_insert
  before insert on public.exercises
  for each row execute function public.validate_exercise_pool_authority();

create function public.prevent_exercise_authority_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.verification_id is null and old.arithmetic_structure is null and old.authority_version is null then
    if new.verification_id is not null or new.arithmetic_structure is not null or new.authority_version is not null then
      raise exception using errcode = '42501', message = 'Historical pool entries cannot be relabeled as certified';
    end if;
    return new;
  end if;

  if new.exercise_text is distinct from old.exercise_text
    or new.canonical_answer is distinct from old.canonical_answer
    or new.grade is distinct from old.grade
    or new.topic is distinct from old.topic
    or new.difficulty is distinct from old.difficulty
    or new.verification_verdict is distinct from old.verification_verdict
    or new.verifier_identity is distinct from old.verifier_identity
    or new.verifier_version is distinct from old.verifier_version
    or new.verified_at is distinct from old.verified_at
    or new.verification_rationale is distinct from old.verification_rationale
    or new.creator_id is distinct from old.creator_id
    or new.approver_id is distinct from old.approver_id
    or new.verification_id is distinct from old.verification_id
    or new.arithmetic_structure is distinct from old.arithmetic_structure
    or new.authority_version is distinct from old.authority_version
  then
    raise exception using errcode = '42501', message = 'Certified exercise evidence is immutable';
  end if;

  return new;
end;
$$;

create trigger exercises_authority_immutable
  before update on public.exercises
  for each row execute function public.prevent_exercise_authority_mutation();

create or replace function public.approve_verified_exercises(verification_ids uuid[])
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
  evidence public.exercise_verifications%rowtype;
  derived jsonb;
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

  for evidence in
    select verification.*
    from public.exercise_verifications as verification
    where verification.id = any(verification_ids)
  loop
    if evidence.outcome <> 'unique_answer'
      or evidence.authority_version is distinct from 1
      or evidence.arithmetic_structure is null
    then
      raise exception using
        errcode = '22023',
        message = 'Every verification record must have current arithmetic authority';
    end if;

    begin
      derived := public.derive_arithmetic_exercise_v1(
        evidence.grade,
        evidence.topic,
        evidence.difficulty,
        evidence.arithmetic_structure
      );
    exception when others then
      raise exception using errcode = '22023', message = 'Verification evidence is not authoritative';
    end;

    if derived ->> 'exercise_text' is distinct from evidence.candidate_text
      or derived ->> 'canonical_answer' is distinct from evidence.proposed_canonical_answer
      or derived ->> 'canonical_answer' is distinct from evidence.verified_answer
    then
      raise exception using errcode = '22023', message = 'Verification snapshot is stale or inconsistent';
    end if;
  end loop;

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
      verification_id,
      arithmetic_structure,
      authority_version
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
      id,
      arithmetic_structure,
      authority_version
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

revoke all on function public.evaluate_arithmetic_expression_v1(jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function public.derive_arithmetic_exercise_v1(text, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.validate_exercise_verification_authority() from public, anon, authenticated, service_role;
revoke all on function public.prevent_exercise_verification_mutation() from public, anon, authenticated, service_role;
revoke all on function public.validate_exercise_pool_authority() from public, anon, authenticated, service_role;
revoke all on function public.prevent_exercise_authority_mutation() from public, anon, authenticated, service_role;
revoke all on function public.approve_verified_exercises(uuid[]) from public;
grant execute on function public.approve_verified_exercises(uuid[]) to authenticated;
