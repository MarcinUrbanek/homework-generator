// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { z } from "zod";
import { EXERCISE_APPROVAL_ERROR_CODES, EXERCISE_DIFFICULTIES, EXERCISE_GENERATION_ERROR_CODES, EXERCISE_TOPIC_SLUGS, EXERCISE_VERIFICATION_ERROR_CODES, EXERCISE_VERIFICATION_PROVIDER_ERROR_CODES, SAVED_EXERCISE_ERROR_CODES } from "@/types";
export const exerciseTopicSlugSchema = z.enum(EXERCISE_TOPIC_SLUGS);
export const exerciseDifficultySchema = z.enum(EXERCISE_DIFFICULTIES);
const validExerciseCountSchema = z.union(stryMutAct_9fa48("525") ? [] : (stryCov_9fa48("525"), [z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]));
export const exerciseGenerationRequestSchema = z.object(stryMutAct_9fa48("526") ? {} : (stryCov_9fa48("526"), {
  grade: z.literal(4),
  topic: exerciseTopicSlugSchema,
  difficulty: exerciseDifficultySchema
})).strict();
export const exerciseCandidateSchema = exerciseGenerationRequestSchema.extend(stryMutAct_9fa48("527") ? {} : (stryCov_9fa48("527"), {
  id: stryMutAct_9fa48("529") ? z.string().min(1) : stryMutAct_9fa48("528") ? z.string().trim().max(1) : (stryCov_9fa48("528", "529"), z.string().trim().min(1)),
  text: stryMutAct_9fa48("531") ? z.string().min(1) : stryMutAct_9fa48("530") ? z.string().trim().max(1) : (stryCov_9fa48("530", "531"), z.string().trim().min(1)),
  proposedCanonicalAnswer: stryMutAct_9fa48("533") ? z.string().min(1) : stryMutAct_9fa48("532") ? z.string().trim().max(1) : (stryCov_9fa48("532", "533"), z.string().trim().min(1)),
  approvalStatus: z.literal(stryMutAct_9fa48("534") ? "" : (stryCov_9fa48("534"), "unverified"))
}));
export const exerciseGenerationSuccessMetadataSchema = z.object(stryMutAct_9fa48("535") ? {} : (stryCov_9fa48("535"), {
  requestedCount: z.literal(5),
  validCount: validExerciseCountSchema,
  partial_batch: z.literal(stryMutAct_9fa48("536") ? false : (stryCov_9fa48("536"), true)).optional()
})).strict().superRefine((metadata, context) => {
  if (stryMutAct_9fa48("537")) {
    {}
  } else {
    stryCov_9fa48("537");
    const isPartial = stryMutAct_9fa48("541") ? metadata.validCount >= metadata.requestedCount : stryMutAct_9fa48("540") ? metadata.validCount <= metadata.requestedCount : stryMutAct_9fa48("539") ? false : stryMutAct_9fa48("538") ? true : (stryCov_9fa48("538", "539", "540", "541"), metadata.validCount < metadata.requestedCount);
    if (stryMutAct_9fa48("544") ? isPartial === (metadata.partial_batch === true) : stryMutAct_9fa48("543") ? false : stryMutAct_9fa48("542") ? true : (stryCov_9fa48("542", "543", "544"), isPartial !== (stryMutAct_9fa48("547") ? metadata.partial_batch !== true : stryMutAct_9fa48("546") ? false : stryMutAct_9fa48("545") ? true : (stryCov_9fa48("545", "546", "547"), metadata.partial_batch === (stryMutAct_9fa48("548") ? false : (stryCov_9fa48("548"), true)))))) {
      if (stryMutAct_9fa48("549")) {
        {}
      } else {
        stryCov_9fa48("549");
        context.addIssue(stryMutAct_9fa48("551") ? {} : (stryCov_9fa48("551"), {
          code: stryMutAct_9fa48("552") ? "" : (stryCov_9fa48("552"), "custom"),
          path: stryMutAct_9fa48("553") ? [] : (stryCov_9fa48("553"), [stryMutAct_9fa48("554") ? "" : (stryCov_9fa48("554"), "partial_batch")]),
          message: stryMutAct_9fa48("555") ? "" : (stryCov_9fa48("555"), "partial_batch must be present only for an incomplete batch")
        }));
      }
    }
  }
});
export const exerciseGenerationSuccessSchema = z.object(stryMutAct_9fa48("556") ? {} : (stryCov_9fa48("556"), {
  requestedCount: z.literal(5),
  validCount: validExerciseCountSchema,
  partial_batch: z.literal(stryMutAct_9fa48("557") ? false : (stryCov_9fa48("557"), true)).optional(),
  candidates: stryMutAct_9fa48("559") ? z.array(exerciseCandidateSchema).max(1).max(5) : stryMutAct_9fa48("558") ? z.array(exerciseCandidateSchema).min(1).min(5) : (stryCov_9fa48("558", "559"), z.array(exerciseCandidateSchema).min(1).max(5))
})).strict().superRefine((response, context) => {
  if (stryMutAct_9fa48("560")) {
    {}
  } else {
    stryCov_9fa48("560");
    if (stryMutAct_9fa48("563") ? response.candidates.length === response.validCount : stryMutAct_9fa48("562") ? false : stryMutAct_9fa48("561") ? true : (stryCov_9fa48("561", "562", "563"), response.candidates.length !== response.validCount)) {
      if (stryMutAct_9fa48("564")) {
        {}
      } else {
        stryCov_9fa48("564");
        context.addIssue(stryMutAct_9fa48("566") ? {} : (stryCov_9fa48("566"), {
          code: stryMutAct_9fa48("567") ? "" : (stryCov_9fa48("567"), "custom"),
          path: stryMutAct_9fa48("568") ? [] : (stryCov_9fa48("568"), [stryMutAct_9fa48("569") ? "" : (stryCov_9fa48("569"), "validCount")]),
          message: stryMutAct_9fa48("570") ? "" : (stryCov_9fa48("570"), "validCount must match the number of candidates")
        }));
      }
    }
    const isPartial = stryMutAct_9fa48("574") ? response.validCount >= response.requestedCount : stryMutAct_9fa48("573") ? response.validCount <= response.requestedCount : stryMutAct_9fa48("572") ? false : stryMutAct_9fa48("571") ? true : (stryCov_9fa48("571", "572", "573", "574"), response.validCount < response.requestedCount);
    if (stryMutAct_9fa48("577") ? isPartial === (response.partial_batch === true) : stryMutAct_9fa48("576") ? false : stryMutAct_9fa48("575") ? true : (stryCov_9fa48("575", "576", "577"), isPartial !== (stryMutAct_9fa48("580") ? response.partial_batch !== true : stryMutAct_9fa48("579") ? false : stryMutAct_9fa48("578") ? true : (stryCov_9fa48("578", "579", "580"), response.partial_batch === (stryMutAct_9fa48("581") ? false : (stryCov_9fa48("581"), true)))))) {
      if (stryMutAct_9fa48("582")) {
        {}
      } else {
        stryCov_9fa48("582");
        context.addIssue(stryMutAct_9fa48("584") ? {} : (stryCov_9fa48("584"), {
          code: stryMutAct_9fa48("585") ? "" : (stryCov_9fa48("585"), "custom"),
          path: stryMutAct_9fa48("586") ? [] : (stryCov_9fa48("586"), [stryMutAct_9fa48("587") ? "" : (stryCov_9fa48("587"), "partial_batch")]),
          message: stryMutAct_9fa48("588") ? "" : (stryCov_9fa48("588"), "partial_batch must be present only for an incomplete batch")
        }));
      }
    }
  }
});
export const exerciseGenerationErrorSchema = z.object(stryMutAct_9fa48("589") ? {} : (stryCov_9fa48("589"), {
  error: z.object(stryMutAct_9fa48("590") ? {} : (stryCov_9fa48("590"), {
    code: z.enum(EXERCISE_GENERATION_ERROR_CODES),
    message: stryMutAct_9fa48("592") ? z.string().min(1) : stryMutAct_9fa48("591") ? z.string().trim().max(1) : (stryCov_9fa48("591", "592"), z.string().trim().min(1))
  })).strict()
})).strict();
const uuidSchema = z.uuid();
const nonEmptyStringSchema = stryMutAct_9fa48("594") ? z.string().min(1) : stryMutAct_9fa48("593") ? z.string().trim().max(1) : (stryCov_9fa48("593", "594"), z.string().trim().min(1));
export const exerciseVerificationRequestSchema = z.object(stryMutAct_9fa48("595") ? {} : (stryCov_9fa48("595"), {
  candidates: stryMutAct_9fa48("597") ? z.array(exerciseCandidateSchema).max(1).max(5) : stryMutAct_9fa48("596") ? z.array(exerciseCandidateSchema).min(1).min(5) : (stryCov_9fa48("596", "597"), z.array(exerciseCandidateSchema).min(1).max(5))
})).strict().superRefine(({
  candidates
}, context) => {
  if (stryMutAct_9fa48("598")) {
    {}
  } else {
    stryCov_9fa48("598");
    const candidateIds = candidates.map(stryMutAct_9fa48("599") ? () => undefined : (stryCov_9fa48("599"), ({
      id
    }) => id));
    if (stryMutAct_9fa48("602") ? new Set(candidateIds).size === candidateIds.length : stryMutAct_9fa48("601") ? false : stryMutAct_9fa48("600") ? true : (stryCov_9fa48("600", "601", "602"), new Set(candidateIds).size !== candidateIds.length)) {
      if (stryMutAct_9fa48("603")) {
        {}
      } else {
        stryCov_9fa48("603");
        context.addIssue(stryMutAct_9fa48("605") ? {} : (stryCov_9fa48("605"), {
          code: stryMutAct_9fa48("606") ? "" : (stryCov_9fa48("606"), "custom"),
          path: stryMutAct_9fa48("607") ? [] : (stryCov_9fa48("607"), [stryMutAct_9fa48("608") ? "" : (stryCov_9fa48("608"), "candidates")]),
          message: stryMutAct_9fa48("609") ? "" : (stryCov_9fa48("609"), "Candidate IDs must be distinct")
        }));
      }
    }
  }
});
const persistedExerciseVerificationBaseSchema = z.object(stryMutAct_9fa48("610") ? {} : (stryCov_9fa48("610"), {
  verificationId: uuidSchema,
  candidateId: nonEmptyStringSchema,
  rationale: nonEmptyStringSchema,
  verifierIdentity: nonEmptyStringSchema,
  verifierVersion: nonEmptyStringSchema,
  verifiedAt: z.iso.datetime(stryMutAct_9fa48("611") ? {} : (stryCov_9fa48("611"), {
    offset: stryMutAct_9fa48("612") ? false : (stryCov_9fa48("612"), true)
  }))
}));
export const persistedExerciseVerificationSchema = z.discriminatedUnion(stryMutAct_9fa48("613") ? "" : (stryCov_9fa48("613"), "outcome"), stryMutAct_9fa48("614") ? [] : (stryCov_9fa48("614"), [persistedExerciseVerificationBaseSchema.extend(stryMutAct_9fa48("615") ? {} : (stryCov_9fa48("615"), {
  outcome: z.literal(stryMutAct_9fa48("616") ? "" : (stryCov_9fa48("616"), "unique_answer")),
  verifiedAnswer: nonEmptyStringSchema
})).strict(), persistedExerciseVerificationBaseSchema.extend(stryMutAct_9fa48("617") ? {} : (stryCov_9fa48("617"), {
  outcome: z.literal(stryMutAct_9fa48("618") ? "" : (stryCov_9fa48("618"), "answer_mismatch")),
  verifiedAnswer: nonEmptyStringSchema
})).strict(), persistedExerciseVerificationBaseSchema.extend(stryMutAct_9fa48("619") ? {} : (stryCov_9fa48("619"), {
  outcome: z.literal(stryMutAct_9fa48("620") ? "" : (stryCov_9fa48("620"), "not_unique_answer")),
  verifiedAnswer: z.null()
})).strict()]));
export const indeterminateExerciseVerificationSchema = z.object(stryMutAct_9fa48("621") ? {} : (stryCov_9fa48("621"), {
  candidateId: nonEmptyStringSchema,
  outcome: z.literal(stryMutAct_9fa48("622") ? "" : (stryCov_9fa48("622"), "indeterminate")),
  error: z.object(stryMutAct_9fa48("623") ? {} : (stryCov_9fa48("623"), {
    code: z.enum(EXERCISE_VERIFICATION_PROVIDER_ERROR_CODES),
    message: nonEmptyStringSchema
  })).strict()
})).strict();
export const exerciseVerificationResultSchema = z.discriminatedUnion(stryMutAct_9fa48("624") ? "" : (stryCov_9fa48("624"), "outcome"), stryMutAct_9fa48("625") ? [] : (stryCov_9fa48("625"), [...persistedExerciseVerificationSchema.options, indeterminateExerciseVerificationSchema]));
export const exerciseVerificationSuccessSchema = z.object(stryMutAct_9fa48("626") ? {} : (stryCov_9fa48("626"), {
  results: stryMutAct_9fa48("628") ? z.array(exerciseVerificationResultSchema).max(1).max(5) : stryMutAct_9fa48("627") ? z.array(exerciseVerificationResultSchema).min(1).min(5) : (stryCov_9fa48("627", "628"), z.array(exerciseVerificationResultSchema).min(1).max(5))
})).strict().superRefine(({
  results
}, context) => {
  if (stryMutAct_9fa48("629")) {
    {}
  } else {
    stryCov_9fa48("629");
    const candidateIds = results.map(stryMutAct_9fa48("630") ? () => undefined : (stryCov_9fa48("630"), ({
      candidateId
    }) => candidateId));
    if (stryMutAct_9fa48("633") ? new Set(candidateIds).size === candidateIds.length : stryMutAct_9fa48("632") ? false : stryMutAct_9fa48("631") ? true : (stryCov_9fa48("631", "632", "633"), new Set(candidateIds).size !== candidateIds.length)) {
      if (stryMutAct_9fa48("634")) {
        {}
      } else {
        stryCov_9fa48("634");
        context.addIssue(stryMutAct_9fa48("636") ? {} : (stryCov_9fa48("636"), {
          code: stryMutAct_9fa48("637") ? "" : (stryCov_9fa48("637"), "custom"),
          path: stryMutAct_9fa48("638") ? [] : (stryCov_9fa48("638"), [stryMutAct_9fa48("639") ? "" : (stryCov_9fa48("639"), "results")]),
          message: stryMutAct_9fa48("640") ? "" : (stryCov_9fa48("640"), "Verification result candidate IDs must be distinct")
        }));
      }
    }
  }
});
export const exerciseVerificationErrorSchema = z.object(stryMutAct_9fa48("641") ? {} : (stryCov_9fa48("641"), {
  error: z.object(stryMutAct_9fa48("642") ? {} : (stryCov_9fa48("642"), {
    code: z.enum(EXERCISE_VERIFICATION_ERROR_CODES),
    message: nonEmptyStringSchema
  })).strict()
})).strict();
export const exerciseApprovalRequestSchema = z.object(stryMutAct_9fa48("643") ? {} : (stryCov_9fa48("643"), {
  verificationIds: stryMutAct_9fa48("645") ? z.array(uuidSchema).max(1).max(5) : stryMutAct_9fa48("644") ? z.array(uuidSchema).min(1).min(5) : (stryCov_9fa48("644", "645"), z.array(uuidSchema).min(1).max(5))
})).strict().superRefine(({
  verificationIds
}, context) => {
  if (stryMutAct_9fa48("646")) {
    {}
  } else {
    stryCov_9fa48("646");
    if (stryMutAct_9fa48("649") ? new Set(verificationIds).size === verificationIds.length : stryMutAct_9fa48("648") ? false : stryMutAct_9fa48("647") ? true : (stryCov_9fa48("647", "648", "649"), new Set(verificationIds).size !== verificationIds.length)) {
      if (stryMutAct_9fa48("650")) {
        {}
      } else {
        stryCov_9fa48("650");
        context.addIssue(stryMutAct_9fa48("652") ? {} : (stryCov_9fa48("652"), {
          code: stryMutAct_9fa48("653") ? "" : (stryCov_9fa48("653"), "custom"),
          path: stryMutAct_9fa48("654") ? [] : (stryCov_9fa48("654"), [stryMutAct_9fa48("655") ? "" : (stryCov_9fa48("655"), "verificationIds")]),
          message: stryMutAct_9fa48("656") ? "" : (stryCov_9fa48("656"), "Verification IDs must be distinct")
        }));
      }
    }
  }
});
export const exerciseApprovalMappingSchema = z.object(stryMutAct_9fa48("657") ? {} : (stryCov_9fa48("657"), {
  verificationId: uuidSchema,
  exerciseId: uuidSchema,
  created: z.boolean()
})).strict();
export const exerciseApprovalSuccessSchema = z.object(stryMutAct_9fa48("658") ? {} : (stryCov_9fa48("658"), {
  mappings: stryMutAct_9fa48("660") ? z.array(exerciseApprovalMappingSchema).max(1).max(5) : stryMutAct_9fa48("659") ? z.array(exerciseApprovalMappingSchema).min(1).min(5) : (stryCov_9fa48("659", "660"), z.array(exerciseApprovalMappingSchema).min(1).max(5))
})).strict();
export const exerciseApprovalErrorSchema = z.object(stryMutAct_9fa48("661") ? {} : (stryCov_9fa48("661"), {
  error: z.object(stryMutAct_9fa48("662") ? {} : (stryCov_9fa48("662"), {
    code: z.enum(EXERCISE_APPROVAL_ERROR_CODES),
    message: nonEmptyStringSchema
  })).strict()
})).strict();
export const exerciseVerificationLedgerRowSchema = z.object(stryMutAct_9fa48("663") ? {} : (stryCov_9fa48("663"), {
  id: uuidSchema,
  teacher_id: uuidSchema,
  candidate_id: nonEmptyStringSchema,
  candidate_text: nonEmptyStringSchema,
  proposed_canonical_answer: nonEmptyStringSchema,
  grade: z.literal(stryMutAct_9fa48("664") ? "" : (stryCov_9fa48("664"), "4")),
  topic: exerciseTopicSlugSchema,
  difficulty: exerciseDifficultySchema,
  outcome: z.enum(stryMutAct_9fa48("665") ? [] : (stryCov_9fa48("665"), [stryMutAct_9fa48("666") ? "" : (stryCov_9fa48("666"), "unique_answer"), stryMutAct_9fa48("667") ? "" : (stryCov_9fa48("667"), "answer_mismatch"), stryMutAct_9fa48("668") ? "" : (stryCov_9fa48("668"), "not_unique_answer")])),
  verified_answer: nonEmptyStringSchema.nullable(),
  verifier_identity: nonEmptyStringSchema,
  verifier_version: nonEmptyStringSchema,
  verified_at: z.iso.datetime(stryMutAct_9fa48("669") ? {} : (stryCov_9fa48("669"), {
    offset: stryMutAct_9fa48("670") ? false : (stryCov_9fa48("670"), true)
  })),
  rationale: nonEmptyStringSchema
})).strict().superRefine((row, context) => {
  if (stryMutAct_9fa48("671")) {
    {}
  } else {
    stryCov_9fa48("671");
    const requiresAnswer = stryMutAct_9fa48("674") ? row.outcome === "unique_answer" && row.outcome === "answer_mismatch" : stryMutAct_9fa48("673") ? false : stryMutAct_9fa48("672") ? true : (stryCov_9fa48("672", "673", "674"), (stryMutAct_9fa48("676") ? row.outcome !== "unique_answer" : stryMutAct_9fa48("675") ? false : (stryCov_9fa48("675", "676"), row.outcome === (stryMutAct_9fa48("677") ? "" : (stryCov_9fa48("677"), "unique_answer")))) || (stryMutAct_9fa48("679") ? row.outcome !== "answer_mismatch" : stryMutAct_9fa48("678") ? false : (stryCov_9fa48("678", "679"), row.outcome === (stryMutAct_9fa48("680") ? "" : (stryCov_9fa48("680"), "answer_mismatch")))));
    if (stryMutAct_9fa48("683") ? requiresAnswer === (row.verified_answer !== null) : stryMutAct_9fa48("682") ? false : stryMutAct_9fa48("681") ? true : (stryCov_9fa48("681", "682", "683"), requiresAnswer !== (stryMutAct_9fa48("686") ? row.verified_answer === null : stryMutAct_9fa48("685") ? false : stryMutAct_9fa48("684") ? true : (stryCov_9fa48("684", "685", "686"), row.verified_answer !== null)))) {
      if (stryMutAct_9fa48("687")) {
        {}
      } else {
        stryCov_9fa48("687");
        context.addIssue(stryMutAct_9fa48("689") ? {} : (stryCov_9fa48("689"), {
          code: stryMutAct_9fa48("690") ? "" : (stryCov_9fa48("690"), "custom"),
          path: stryMutAct_9fa48("691") ? [] : (stryCov_9fa48("691"), [stryMutAct_9fa48("692") ? "" : (stryCov_9fa48("692"), "verified_answer")]),
          message: stryMutAct_9fa48("693") ? "" : (stryCov_9fa48("693"), "Verified answer must match the verification outcome")
        }));
      }
    }
  }
});
export const exerciseApprovalRpcRowSchema = z.object(stryMutAct_9fa48("694") ? {} : (stryCov_9fa48("694"), {
  verification_id: uuidSchema,
  exercise_id: uuidSchema,
  created: z.boolean()
})).strict();
export const savedExerciseFiltersSchema = z.object(stryMutAct_9fa48("695") ? {} : (stryCov_9fa48("695"), {
  grade: z.literal(4),
  topic: exerciseTopicSlugSchema,
  difficulty: exerciseDifficultySchema.optional()
})).strict();
export const savedExerciseCursorSchema = savedExerciseFiltersSchema.extend(stryMutAct_9fa48("696") ? {} : (stryCov_9fa48("696"), {
  approvedAt: z.iso.datetime(stryMutAct_9fa48("697") ? {} : (stryCov_9fa48("697"), {
    offset: stryMutAct_9fa48("698") ? false : (stryCov_9fa48("698"), true)
  })),
  id: uuidSchema
})).strict();
export const savedExerciseRetrievalRowSchema = z.object(stryMutAct_9fa48("699") ? {} : (stryCov_9fa48("699"), {
  id: uuidSchema,
  exercise_text: nonEmptyStringSchema,
  canonical_answer: nonEmptyStringSchema,
  grade: z.literal(stryMutAct_9fa48("700") ? "" : (stryCov_9fa48("700"), "4")),
  topic: exerciseTopicSlugSchema,
  difficulty: exerciseDifficultySchema,
  approved_at: z.iso.datetime(stryMutAct_9fa48("701") ? {} : (stryCov_9fa48("701"), {
    offset: stryMutAct_9fa48("702") ? false : (stryCov_9fa48("702"), true)
  }))
})).strict();
export const savedExerciseSuccessSchema = z.object(stryMutAct_9fa48("703") ? {} : (stryCov_9fa48("703"), {
  exercises: stryMutAct_9fa48("704") ? z.array(savedExerciseFiltersSchema.extend({
    difficulty: exerciseDifficultySchema,
    id: uuidSchema,
    text: nonEmptyStringSchema,
    canonicalAnswer: nonEmptyStringSchema,
    approvedAt: z.iso.datetime({
      offset: true
    })
  })).min(20) : (stryCov_9fa48("704"), z.array(savedExerciseFiltersSchema.extend(stryMutAct_9fa48("705") ? {} : (stryCov_9fa48("705"), {
    difficulty: exerciseDifficultySchema,
    id: uuidSchema,
    text: nonEmptyStringSchema,
    canonicalAnswer: nonEmptyStringSchema,
    approvedAt: z.iso.datetime(stryMutAct_9fa48("706") ? {} : (stryCov_9fa48("706"), {
      offset: stryMutAct_9fa48("707") ? false : (stryCov_9fa48("707"), true)
    }))
  }))).max(20)),
  nextCursor: nonEmptyStringSchema.nullable()
})).strict();
export const savedExerciseErrorSchema = z.object(stryMutAct_9fa48("708") ? {} : (stryCov_9fa48("708"), {
  error: z.object(stryMutAct_9fa48("709") ? {} : (stryCov_9fa48("709"), {
    code: z.enum(SAVED_EXERCISE_ERROR_CODES),
    message: nonEmptyStringSchema
  })).strict()
})).strict();