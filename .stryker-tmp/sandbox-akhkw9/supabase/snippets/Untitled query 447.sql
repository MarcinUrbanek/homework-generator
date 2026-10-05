begin;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ec5d4c77-762a-4dee-b11c-d188efda6ef2', true);

insert into public.exercise_verifications (
  teacher_id,
  candidate_id,
  candidate_text,
  proposed_canonical_answer,
  grade,
  topic,
  difficulty,
  outcome,
  verified_answer,
  verifier_identity,
  verifier_version,
  verified_at,
  rationale
) values (
  'ec5d4c77-762a-4dee-b11c-d188efda6ef2',
  'forged-browser-record',
  'Forged exercise',
  '1',
  '4',
  'addition-subtraction',
  'easy',
  'unique_answer',
  '1',
  'browser',
  'fake',
  now(),
  'Forged evidence'
);

rollback;