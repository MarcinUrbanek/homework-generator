create or replace function public.evaluate_arithmetic_expression_v1(expression jsonb, current_depth integer default 0)
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

create or replace function public.derive_arithmetic_exercise_v1(
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
