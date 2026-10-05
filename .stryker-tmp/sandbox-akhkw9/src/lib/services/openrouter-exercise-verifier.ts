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
import { canonicalizeExerciseAnswerForVerification } from "@/lib/exercises/answer-normalization";
import type { ExerciseCandidate, ExerciseVerificationEvidence, ExerciseVerificationProviderErrorCode } from "@/types";
const OPENROUTER_CHAT_COMPLETIONS_URL = stryMutAct_9fa48("1024") ? "" : (stryCov_9fa48("1024"), "https://openrouter.ai/api/v1/chat/completions");
const DEFAULT_DEADLINE_MS = 20_000;
const MAX_RATIONALE_LENGTH = 500;
const CANONICAL_NATURAL_NUMBER_PATTERN = stryMutAct_9fa48("1025") ? "" : (stryCov_9fa48("1025"), "^(0|[1-9][0-9]*)$");
export const EXERCISE_VERIFIER_IDENTITY = stryMutAct_9fa48("1026") ? "" : (stryCov_9fa48("1026"), "OpenRouter");
export const EXERCISE_VERIFICATION_STRATEGY_VERSION = stryMutAct_9fa48("1027") ? "" : (stryCov_9fa48("1027"), "grade-4-independent-answer-set-v2");
export const EXERCISE_VERIFIER_LEDGER_IDENTITY = stryMutAct_9fa48("1028") ? `` : (stryCov_9fa48("1028"), `${EXERCISE_VERIFIER_IDENTITY}/${EXERCISE_VERIFICATION_STRATEGY_VERSION}`);
const providerPayloadSchema = z.object(stryMutAct_9fa48("1029") ? {} : (stryCov_9fa48("1029"), {
  validAnswers: stryMutAct_9fa48("1030") ? z.array(z.string().trim().min(1)).min(10) : (stryCov_9fa48("1030"), z.array(stryMutAct_9fa48("1032") ? z.string().min(1) : stryMutAct_9fa48("1031") ? z.string().trim().max(1) : (stryCov_9fa48("1031", "1032"), z.string().trim().min(1))).max(10)),
  rationale: stryMutAct_9fa48("1035") ? z.string().min(1).max(MAX_RATIONALE_LENGTH) : stryMutAct_9fa48("1034") ? z.string().trim().max(1).max(MAX_RATIONALE_LENGTH) : stryMutAct_9fa48("1033") ? z.string().trim().min(1).min(MAX_RATIONALE_LENGTH) : (stryCov_9fa48("1033", "1034", "1035"), z.string().trim().min(1).max(MAX_RATIONALE_LENGTH))
})).strict();
const providerEnvelopeSchema = z.looseObject(stryMutAct_9fa48("1036") ? {} : (stryCov_9fa48("1036"), {
  choices: stryMutAct_9fa48("1037") ? z.array(z.looseObject({
    message: z.looseObject({
      content: z.string()
    })
  })).max(1) : (stryCov_9fa48("1037"), z.array(z.looseObject(stryMutAct_9fa48("1038") ? {} : (stryCov_9fa48("1038"), {
    message: z.looseObject(stryMutAct_9fa48("1039") ? {} : (stryCov_9fa48("1039"), {
      content: z.string()
    }))
  }))).min(1))
}));
export class OpenRouterExerciseVerifierError extends Error {
  readonly code: ExerciseVerificationProviderErrorCode;
  constructor(code: ExerciseVerificationProviderErrorCode) {
    if (stryMutAct_9fa48("1040")) {
      {}
    } else {
      stryCov_9fa48("1040");
      super(code);
      this.name = stryMutAct_9fa48("1041") ? "" : (stryCov_9fa48("1041"), "OpenRouterExerciseVerifierError");
      this.code = code;
    }
  }
}
export interface OpenRouterExerciseVerifierConfig {
  apiKey: string;
  model: string;
}
export interface OpenRouterExerciseVerifierDependencies {
  fetch?: typeof fetch;
  deadlineMs?: number;
  now?: () => Date;
}
function buildPrompt(candidate: ExerciseCandidate): string {
  if (stryMutAct_9fa48("1042")) {
    {}
  } else {
    stryCov_9fa48("1042");
    return (stryMutAct_9fa48("1043") ? [] : (stryCov_9fa48("1043"), [stryMutAct_9fa48("1044") ? "" : (stryCov_9fa48("1044"), "Rozwiąż samodzielnie poniższe zadanie matematyczne dla klasy 4."), stryMutAct_9fa48("1045") ? "" : (stryCov_9fa48("1045"), "Wyznacz pełny zbiór poprawnych odpowiedzi bez korzystania z odpowiedzi zaproponowanej przez autora."), stryMutAct_9fa48("1046") ? "" : (stryCov_9fa48("1046"), "Jeżeli zadanie nie ma jednoznacznej odpowiedzi, zwróć zero albo wszystkie różne poprawne odpowiedzi."), stryMutAct_9fa48("1047") ? "" : (stryCov_9fa48("1047"), "Każdy element validAnswers musi być jedną niepogrupowaną liczbą naturalną zapisaną cyframi dziesiętnymi, bez zdania, etykiety, jednostki, działania ani wyjaśnienia."), stryMutAct_9fa48("1048") ? "" : (stryCov_9fa48("1048"), "Uzasadnienie napisz zwięźle po polsku i umieść wyłącznie w polu rationale."), stryMutAct_9fa48("1049") ? `` : (stryCov_9fa48("1049"), `Treść zadania: ${candidate.text}`), stryMutAct_9fa48("1050") ? `` : (stryCov_9fa48("1050"), `Temat: ${candidate.topic}. Poziom trudności: ${candidate.difficulty}.`), stryMutAct_9fa48("1051") ? "" : (stryCov_9fa48("1051"), "Zwróć wyłącznie dane zgodne z podanym schematem JSON.")])).join(stryMutAct_9fa48("1052") ? "" : (stryCov_9fa48("1052"), "\n"));
  }
}
function buildRequestBody(candidate: ExerciseCandidate, model: string) {
  if (stryMutAct_9fa48("1053")) {
    {}
  } else {
    stryCov_9fa48("1053");
    return stryMutAct_9fa48("1054") ? {} : (stryCov_9fa48("1054"), {
      model,
      stream: stryMutAct_9fa48("1055") ? true : (stryCov_9fa48("1055"), false),
      temperature: 0,
      reasoning: stryMutAct_9fa48("1056") ? {} : (stryCov_9fa48("1056"), {
        effort: stryMutAct_9fa48("1057") ? "" : (stryCov_9fa48("1057"), "low")
      }),
      messages: stryMutAct_9fa48("1058") ? [] : (stryCov_9fa48("1058"), [stryMutAct_9fa48("1059") ? {} : (stryCov_9fa48("1059"), {
        role: stryMutAct_9fa48("1060") ? "" : (stryCov_9fa48("1060"), "user"),
        content: buildPrompt(candidate)
      })]),
      response_format: stryMutAct_9fa48("1061") ? {} : (stryCov_9fa48("1061"), {
        type: stryMutAct_9fa48("1062") ? "" : (stryCov_9fa48("1062"), "json_schema"),
        json_schema: stryMutAct_9fa48("1063") ? {} : (stryCov_9fa48("1063"), {
          name: stryMutAct_9fa48("1064") ? "" : (stryCov_9fa48("1064"), "grade_4_exercise_verification"),
          strict: stryMutAct_9fa48("1065") ? false : (stryCov_9fa48("1065"), true),
          schema: stryMutAct_9fa48("1066") ? {} : (stryCov_9fa48("1066"), {
            type: stryMutAct_9fa48("1067") ? "" : (stryCov_9fa48("1067"), "object"),
            additionalProperties: stryMutAct_9fa48("1068") ? true : (stryCov_9fa48("1068"), false),
            required: stryMutAct_9fa48("1069") ? [] : (stryCov_9fa48("1069"), [stryMutAct_9fa48("1070") ? "" : (stryCov_9fa48("1070"), "validAnswers"), stryMutAct_9fa48("1071") ? "" : (stryCov_9fa48("1071"), "rationale")]),
            properties: stryMutAct_9fa48("1072") ? {} : (stryCov_9fa48("1072"), {
              validAnswers: stryMutAct_9fa48("1073") ? {} : (stryCov_9fa48("1073"), {
                type: stryMutAct_9fa48("1074") ? "" : (stryCov_9fa48("1074"), "array"),
                maxItems: 10,
                items: stryMutAct_9fa48("1075") ? {} : (stryCov_9fa48("1075"), {
                  type: stryMutAct_9fa48("1076") ? "" : (stryCov_9fa48("1076"), "string"),
                  minLength: 1,
                  pattern: CANONICAL_NATURAL_NUMBER_PATTERN
                })
              }),
              rationale: stryMutAct_9fa48("1077") ? {} : (stryCov_9fa48("1077"), {
                type: stryMutAct_9fa48("1078") ? "" : (stryCov_9fa48("1078"), "string"),
                minLength: 1,
                maxLength: MAX_RATIONALE_LENGTH
              })
            })
          })
        })
      }),
      provider: stryMutAct_9fa48("1079") ? {} : (stryCov_9fa48("1079"), {
        require_parameters: stryMutAct_9fa48("1080") ? false : (stryCov_9fa48("1080"), true)
      })
    });
  }
}
function parseProviderPayload(value: unknown) {
  if (stryMutAct_9fa48("1081")) {
    {}
  } else {
    stryCov_9fa48("1081");
    const envelope = providerEnvelopeSchema.safeParse(value);
    if (stryMutAct_9fa48("1084") ? false : stryMutAct_9fa48("1083") ? true : stryMutAct_9fa48("1082") ? envelope.success : (stryCov_9fa48("1082", "1083", "1084"), !envelope.success)) {
      if (stryMutAct_9fa48("1085")) {
        {}
      } else {
        stryCov_9fa48("1085");
        throw new OpenRouterExerciseVerifierError(stryMutAct_9fa48("1087") ? "" : (stryCov_9fa48("1087"), "PROVIDER_FAILURE"));
      }
    }
    let content: unknown;
    try {
      if (stryMutAct_9fa48("1088")) {
        {}
      } else {
        stryCov_9fa48("1088");
        content = JSON.parse(envelope.data.choices[0].message.content);
      }
    } catch {
      if (stryMutAct_9fa48("1089")) {
        {}
      } else {
        stryCov_9fa48("1089");
        throw new OpenRouterExerciseVerifierError(stryMutAct_9fa48("1091") ? "" : (stryCov_9fa48("1091"), "PROVIDER_FAILURE"));
      }
    }
    const payload = providerPayloadSchema.safeParse(content);
    if (stryMutAct_9fa48("1094") ? false : stryMutAct_9fa48("1093") ? true : stryMutAct_9fa48("1092") ? payload.success : (stryCov_9fa48("1092", "1093", "1094"), !payload.success)) {
      if (stryMutAct_9fa48("1095")) {
        {}
      } else {
        stryCov_9fa48("1095");
        throw new OpenRouterExerciseVerifierError(stryMutAct_9fa48("1097") ? "" : (stryCov_9fa48("1097"), "PROVIDER_FAILURE"));
      }
    }
    return payload.data;
  }
}
function classifyAnswers(candidate: ExerciseCandidate, validAnswers: string[], rationale: string, model: string, verifiedAt: string): ExerciseVerificationEvidence {
  if (stryMutAct_9fa48("1098")) {
    {}
  } else {
    stryCov_9fa48("1098");
    const canonicalAnswersByKey = new Map(stryMutAct_9fa48("1099") ? validAnswers.map(canonicalizeExerciseAnswerForVerification).map(answer => [answer.comparisonKey, answer] as const) : (stryCov_9fa48("1099"), validAnswers.map(canonicalizeExerciseAnswerForVerification).filter(stryMutAct_9fa48("1100") ? () => undefined : (stryCov_9fa48("1100"), ({
      canonicalAnswer
    }) => stryMutAct_9fa48("1104") ? canonicalAnswer.length <= 0 : stryMutAct_9fa48("1103") ? canonicalAnswer.length >= 0 : stryMutAct_9fa48("1102") ? false : stryMutAct_9fa48("1101") ? true : (stryCov_9fa48("1101", "1102", "1103", "1104"), canonicalAnswer.length > 0))).map(stryMutAct_9fa48("1105") ? () => undefined : (stryCov_9fa48("1105"), answer => [answer.comparisonKey, answer] as const))));
    const evidence = stryMutAct_9fa48("1106") ? {} : (stryCov_9fa48("1106"), {
      rationale,
      verifierIdentity: EXERCISE_VERIFIER_LEDGER_IDENTITY,
      verifierVersion: model,
      verifiedAt
    });
    if (stryMutAct_9fa48("1109") ? canonicalAnswersByKey.size === 1 : stryMutAct_9fa48("1108") ? false : stryMutAct_9fa48("1107") ? true : (stryCov_9fa48("1107", "1108", "1109"), canonicalAnswersByKey.size !== 1)) {
      if (stryMutAct_9fa48("1110")) {
        {}
      } else {
        stryCov_9fa48("1110");
        return stryMutAct_9fa48("1111") ? {} : (stryCov_9fa48("1111"), {
          ...evidence,
          outcome: stryMutAct_9fa48("1112") ? "" : (stryCov_9fa48("1112"), "not_unique_answer"),
          verifiedAnswer: null
        });
      }
    }
    const [verifiedAnswer] = canonicalAnswersByKey.values();
    const proposedAnswer = canonicalizeExerciseAnswerForVerification(candidate.proposedCanonicalAnswer);
    return stryMutAct_9fa48("1113") ? {} : (stryCov_9fa48("1113"), {
      ...evidence,
      outcome: (stryMutAct_9fa48("1116") ? verifiedAnswer.comparisonKey !== proposedAnswer.comparisonKey : stryMutAct_9fa48("1115") ? false : stryMutAct_9fa48("1114") ? true : (stryCov_9fa48("1114", "1115", "1116"), verifiedAnswer.comparisonKey === proposedAnswer.comparisonKey)) ? stryMutAct_9fa48("1117") ? "" : (stryCov_9fa48("1117"), "unique_answer") : stryMutAct_9fa48("1118") ? "" : (stryCov_9fa48("1118"), "answer_mismatch"),
      verifiedAnswer: verifiedAnswer.canonicalAnswer
    });
  }
}
export async function verifyOpenRouterExercise(candidate: ExerciseCandidate, config: OpenRouterExerciseVerifierConfig, dependencies: OpenRouterExerciseVerifierDependencies = {}): Promise<ExerciseVerificationEvidence> {
  if (stryMutAct_9fa48("1119")) {
    {}
  } else {
    stryCov_9fa48("1119");
    const fetchImplementation = stryMutAct_9fa48("1120") ? dependencies.fetch && fetch : (stryCov_9fa48("1120"), dependencies.fetch ?? fetch);
    const deadlineMs = stryMutAct_9fa48("1121") ? dependencies.deadlineMs && DEFAULT_DEADLINE_MS : (stryCov_9fa48("1121"), dependencies.deadlineMs ?? DEFAULT_DEADLINE_MS);
    const now = stryMutAct_9fa48("1122") ? dependencies.now && (() => new Date()) : (stryCov_9fa48("1122"), dependencies.now ?? (stryMutAct_9fa48("1123") ? () => undefined : (stryCov_9fa48("1123"), () => new Date())));
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      if (stryMutAct_9fa48("1124")) {
        {}
      } else {
        stryCov_9fa48("1124");
        if (stryMutAct_9fa48("1125")) {
          ;
        } else {
          stryCov_9fa48("1125");
          controller.abort();
        }
      }
    }, deadlineMs);
    try {
      if (stryMutAct_9fa48("1126")) {
        {}
      } else {
        stryCov_9fa48("1126");
        const response = await fetchImplementation(OPENROUTER_CHAT_COMPLETIONS_URL, stryMutAct_9fa48("1127") ? {} : (stryCov_9fa48("1127"), {
          method: stryMutAct_9fa48("1128") ? "" : (stryCov_9fa48("1128"), "POST"),
          headers: stryMutAct_9fa48("1129") ? {} : (stryCov_9fa48("1129"), {
            Authorization: stryMutAct_9fa48("1130") ? `` : (stryCov_9fa48("1130"), `Bearer ${config.apiKey}`),
            "Content-Type": stryMutAct_9fa48("1131") ? "" : (stryCov_9fa48("1131"), "application/json")
          }),
          body: JSON.stringify(buildRequestBody(candidate, config.model)),
          signal: controller.signal
        }));
        if (stryMutAct_9fa48("1134") ? false : stryMutAct_9fa48("1133") ? true : stryMutAct_9fa48("1132") ? response.ok : (stryCov_9fa48("1132", "1133", "1134"), !response.ok)) {
          if (stryMutAct_9fa48("1135")) {
            {}
          } else {
            stryCov_9fa48("1135");
            throw new OpenRouterExerciseVerifierError(stryMutAct_9fa48("1137") ? "" : (stryCov_9fa48("1137"), "PROVIDER_FAILURE"));
          }
        }
        const payload = parseProviderPayload(await response.json());
        return classifyAnswers(candidate, payload.validAnswers, payload.rationale, config.model, now().toISOString());
      }
    } catch (error) {
      if (stryMutAct_9fa48("1138")) {
        {}
      } else {
        stryCov_9fa48("1138");
        if (stryMutAct_9fa48("1141") ? controller.signal.aborted && error instanceof Error && error.name === "AbortError" : stryMutAct_9fa48("1140") ? false : stryMutAct_9fa48("1139") ? true : (stryCov_9fa48("1139", "1140", "1141"), controller.signal.aborted || (stryMutAct_9fa48("1143") ? error instanceof Error || error.name === "AbortError" : stryMutAct_9fa48("1142") ? false : (stryCov_9fa48("1142", "1143"), error instanceof Error && (stryMutAct_9fa48("1145") ? error.name !== "AbortError" : stryMutAct_9fa48("1144") ? true : (stryCov_9fa48("1144", "1145"), error.name === (stryMutAct_9fa48("1146") ? "" : (stryCov_9fa48("1146"), "AbortError")))))))) {
          if (stryMutAct_9fa48("1147")) {
            {}
          } else {
            stryCov_9fa48("1147");
            throw new OpenRouterExerciseVerifierError(stryMutAct_9fa48("1149") ? "" : (stryCov_9fa48("1149"), "PROVIDER_TIMEOUT"));
          }
        }
        if (stryMutAct_9fa48("1151") ? false : stryMutAct_9fa48("1150") ? true : (stryCov_9fa48("1150", "1151"), error instanceof OpenRouterExerciseVerifierError)) {
          if (stryMutAct_9fa48("1152")) {
            {}
          } else {
            stryCov_9fa48("1152");
            throw error;
          }
        }
        throw new OpenRouterExerciseVerifierError(stryMutAct_9fa48("1154") ? "" : (stryCov_9fa48("1154"), "PROVIDER_FAILURE"));
      }
    } finally {
      if (stryMutAct_9fa48("1155")) {
        {}
      } else {
        stryCov_9fa48("1155");
        if (stryMutAct_9fa48("1156")) {
          ;
        } else {
          stryCov_9fa48("1156");
          clearTimeout(deadline);
        }
      }
    }
  }
}