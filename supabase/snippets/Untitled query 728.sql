WITH affected_recipients AS (
  SELECT
    recipient.id,
    bool_or(NOT COALESCE(public.is_currently_certified_exercise(exercise.id), false)) AS has_uncertified,
    bool_or(submission.id IS NOT NULL) AS has_submission
  FROM public.homework_recipients AS recipient
  JOIN public.homework_recipient_exercises AS assigned
    ON assigned.recipient_id = recipient.id
  JOIN public.exercises AS exercise
    ON exercise.id = assigned.exercise_id
  LEFT JOIN public.homework_submissions AS submission
    ON submission.recipient_id = recipient.id
  GROUP BY recipient.id
)
SELECT
  (SELECT count(*)
   FROM public.exercise_verifications
   WHERE authority_version IS DISTINCT FROM 1 OR arithmetic_structure IS NULL)
    AS uncertified_verification_rows,
  (SELECT count(*)
   FROM public.exercises
   WHERE NOT COALESCE(public.is_currently_certified_exercise(id), false))
    AS uncertified_pool_rows,
  count(*) FILTER (WHERE has_uncertified AND NOT has_submission)
    AS pending_affected_recipients,
  count(*) FILTER (WHERE has_uncertified AND has_submission)
    AS submitted_affected_recipients
FROM affected_recipients;