begin;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ec5d4c77-762a-4dee-b11c-d188efda6ef2', true);

update public.exercise_verifications
set rationale = 'Changed evidence'
where id = 'b0bd23d4-b5f6-4090-af06-e1031fef1d2c';

rollback;