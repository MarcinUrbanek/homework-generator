begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000031', 'authenticated', 'authenticated',
   'teacher-one@example.test', 'not-used', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000032', 'authenticated', 'authenticated',
   'teacher-two@example.test', 'not-used', now(), '{}', '{}', now(), now());

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000031',
  true
);

insert into public.exercises (
  exercise_text, canonical_answer, grade, topic, difficulty,
  verification_verdict, verifier_identity, verifier_version, verified_at,
  verification_rationale, creator_id, approver_id
)
values (
  'RLS check', '4', '1', 'addition', 'easy',
  'unique_answer', 'manual-verifier', '1', now(), 'One answer.',
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000031'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000032',
  true
);

-- Expected: DELETE 0
delete from public.exercises
where exercise_text = 'RLS check';

-- Expected: 1
select count(*) as expected_one
from public.exercises
where exercise_text = 'RLS check';

rollback;