import { ArithmeticAuthorityError, renderArithmeticExercise } from "@/lib/exercises/arithmetic-authority";
import type { ExerciseCandidate, ExerciseVerificationEvidence } from "@/types";

const VERIFIER_IDENTITY = "ArithmeticAuthority";
const VERIFIER_VERSION = "arithmetic-authority-v1";

function authorityVersionFor(structure: unknown): number | null {
  if (typeof structure !== "object" || structure === null || !("version" in structure)) {
    return null;
  }

  return structure.version === 1 ? 1 : null;
}

function unsupportedEvidence(candidate: ExerciseCandidate, verifiedAt: string): ExerciseVerificationEvidence {
  return {
    outcome: "unsupported_evidence",
    verifiedAnswer: null,
    rationale: "Nie można potwierdzić zadania w aktualnym, obsługiwanym formacie arytmetycznym.",
    verifierIdentity: VERIFIER_IDENTITY,
    verifierVersion: VERIFIER_VERSION,
    verifiedAt,
    arithmeticStructure: candidate.arithmeticStructure ?? null,
    authorityVersion: authorityVersionFor(candidate.arithmeticStructure),
  };
}

export function verifyArithmeticExercise(
  candidate: ExerciseCandidate,
  now: () => Date = () => new Date(),
): ExerciseVerificationEvidence {
  const verifiedAt = now().toISOString();
  if (candidate.arithmeticStructure === undefined || candidate.arithmeticStructure === null) {
    return unsupportedEvidence(candidate, verifiedAt);
  }

  let rendered: ReturnType<typeof renderArithmeticExercise>;
  try {
    rendered = renderArithmeticExercise(candidate, candidate.arithmeticStructure);
  } catch (error) {
    if (error instanceof ArithmeticAuthorityError) {
      return unsupportedEvidence(candidate, verifiedAt);
    }
    throw error;
  }

  const base = {
    rationale:
      rendered.proposedCanonicalAnswer === candidate.proposedCanonicalAnswer
        ? "Treść, metadane i odpowiedź odpowiadają niezależnie obliczonej strukturze arytmetycznej."
        : "Obliczona odpowiedź różni się od odpowiedzi zaproponowanej przez autora.",
    verifierIdentity: VERIFIER_IDENTITY,
    verifierVersion: VERIFIER_VERSION,
    verifiedAt,
    arithmeticStructure: rendered.arithmeticStructure,
    authorityVersion: rendered.arithmeticStructure.version,
  };

  if (rendered.text !== candidate.text) {
    return unsupportedEvidence(candidate, verifiedAt);
  }

  if (rendered.proposedCanonicalAnswer !== candidate.proposedCanonicalAnswer) {
    return { ...base, outcome: "answer_mismatch", verifiedAnswer: rendered.proposedCanonicalAnswer };
  }

  return { ...base, outcome: "unique_answer", verifiedAnswer: rendered.proposedCanonicalAnswer };
}
