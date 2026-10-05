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
import { GRADE_4_EXERCISE_CATALOG } from "@/lib/exercises/catalog";
import type { ExerciseCandidate, ExerciseGenerationRequest } from "@/types";
const OPENROUTER_CHAT_COMPLETIONS_URL = stryMutAct_9fa48("840") ? "" : (stryCov_9fa48("840"), "https://openrouter.ai/api/v1/chat/completions");
const REQUESTED_COUNT = 5;
const DEFAULT_DEADLINE_MS = 30_000;
const CANONICAL_NATURAL_NUMBER_PATTERN = stryMutAct_9fa48("841") ? "" : (stryCov_9fa48("841"), "^(0|[1-9][0-9]*)$");
const providerCandidateSchema = z.object(stryMutAct_9fa48("842") ? {} : (stryCov_9fa48("842"), {
  text: stryMutAct_9fa48("844") ? z.string().min(1) : stryMutAct_9fa48("843") ? z.string().trim().max(1) : (stryCov_9fa48("843", "844"), z.string().trim().min(1)),
  proposedCanonicalAnswer: stryMutAct_9fa48("846") ? z.string().min(1) : stryMutAct_9fa48("845") ? z.string().trim().max(1) : (stryCov_9fa48("845", "846"), z.string().trim().min(1))
})).strict();
const providerPayloadSchema = z.object(stryMutAct_9fa48("847") ? {} : (stryCov_9fa48("847"), {
  exercises: stryMutAct_9fa48("848") ? z.array(z.unknown()).min(REQUESTED_COUNT) : (stryCov_9fa48("848"), z.array(z.unknown()).max(REQUESTED_COUNT))
})).strict();
const providerEnvelopeSchema = z.looseObject(stryMutAct_9fa48("849") ? {} : (stryCov_9fa48("849"), {
  choices: stryMutAct_9fa48("850") ? z.array(z.looseObject({
    message: z.looseObject({
      content: z.string()
    })
  })).max(1) : (stryCov_9fa48("850"), z.array(z.looseObject(stryMutAct_9fa48("851") ? {} : (stryCov_9fa48("851"), {
    message: z.looseObject(stryMutAct_9fa48("852") ? {} : (stryCov_9fa48("852"), {
      content: z.string()
    }))
  }))).min(1))
}));
export type OpenRouterExerciseGeneratorErrorCode = "PROVIDER_FAILURE" | "PROVIDER_TIMEOUT";
export class OpenRouterExerciseGeneratorError extends Error {
  readonly code: OpenRouterExerciseGeneratorErrorCode;
  constructor(code: OpenRouterExerciseGeneratorErrorCode) {
    if (stryMutAct_9fa48("853")) {
      {}
    } else {
      stryCov_9fa48("853");
      super(code);
      this.name = stryMutAct_9fa48("854") ? "" : (stryCov_9fa48("854"), "OpenRouterExerciseGeneratorError");
      this.code = code;
    }
  }
}
export interface OpenRouterExerciseGeneratorConfig {
  apiKey: string;
  model: string;
}
export interface OpenRouterExerciseGeneratorDependencies {
  fetch?: typeof fetch;
  deadlineMs?: number;
  createId?: () => string;
}
function buildPrompt(request: ExerciseGenerationRequest): string {
  if (stryMutAct_9fa48("855")) {
    {}
  } else {
    stryCov_9fa48("855");
    const topic = GRADE_4_EXERCISE_CATALOG.find(stryMutAct_9fa48("856") ? () => undefined : (stryCov_9fa48("856"), ({
      slug
    }) => stryMutAct_9fa48("859") ? slug !== request.topic : stryMutAct_9fa48("858") ? false : stryMutAct_9fa48("857") ? true : (stryCov_9fa48("857", "858", "859"), slug === request.topic)));
    if (stryMutAct_9fa48("862") ? false : stryMutAct_9fa48("861") ? true : stryMutAct_9fa48("860") ? topic : (stryCov_9fa48("860", "861", "862"), !topic)) {
      if (stryMutAct_9fa48("863")) {
        {}
      } else {
        stryCov_9fa48("863");
        throw new OpenRouterExerciseGeneratorError(stryMutAct_9fa48("865") ? "" : (stryCov_9fa48("865"), "PROVIDER_FAILURE"));
      }
    }
    return (stryMutAct_9fa48("866") ? [] : (stryCov_9fa48("866"), [stryMutAct_9fa48("867") ? "" : (stryCov_9fa48("867"), "Wygeneruj dokładnie 5 różnych zadań matematycznych w języku polskim."), stryMutAct_9fa48("868") ? `` : (stryCov_9fa48("868"), `Poziom: klasa ${request.grade}.`), stryMutAct_9fa48("869") ? `` : (stryCov_9fa48("869"), `Temat: ${topic.label}.`), stryMutAct_9fa48("870") ? `` : (stryCov_9fa48("870"), `Kryterium trudności: ${topic.guidance[request.difficulty]}`), stryMutAct_9fa48("871") ? "" : (stryCov_9fa48("871"), "Każde zadanie musi mieć niepustą treść i jedną proponowaną odpowiedź kanoniczną."), stryMutAct_9fa48("872") ? "" : (stryCov_9fa48("872"), "Odpowiedź kanoniczna musi być jedną niepogrupowaną liczbą naturalną zapisaną cyframi dziesiętnymi, bez zdania, etykiety, jednostki, działania ani wyjaśnienia."), stryMutAct_9fa48("873") ? "" : (stryCov_9fa48("873"), "Zwróć wyłącznie dane zgodne z podanym schematem JSON.")])).join(stryMutAct_9fa48("874") ? "" : (stryCov_9fa48("874"), "\n"));
  }
}
function buildRequestBody(request: ExerciseGenerationRequest, model: string) {
  if (stryMutAct_9fa48("875")) {
    {}
  } else {
    stryCov_9fa48("875");
    return stryMutAct_9fa48("876") ? {} : (stryCov_9fa48("876"), {
      model,
      stream: stryMutAct_9fa48("877") ? true : (stryCov_9fa48("877"), false),
      reasoning: stryMutAct_9fa48("878") ? {} : (stryCov_9fa48("878"), {
        effort: stryMutAct_9fa48("879") ? "" : (stryCov_9fa48("879"), "low")
      }),
      messages: stryMutAct_9fa48("880") ? [] : (stryCov_9fa48("880"), [stryMutAct_9fa48("881") ? {} : (stryCov_9fa48("881"), {
        role: stryMutAct_9fa48("882") ? "" : (stryCov_9fa48("882"), "user"),
        content: buildPrompt(request)
      })]),
      response_format: stryMutAct_9fa48("883") ? {} : (stryCov_9fa48("883"), {
        type: stryMutAct_9fa48("884") ? "" : (stryCov_9fa48("884"), "json_schema"),
        json_schema: stryMutAct_9fa48("885") ? {} : (stryCov_9fa48("885"), {
          name: stryMutAct_9fa48("886") ? "" : (stryCov_9fa48("886"), "grade_4_polish_exercises"),
          strict: stryMutAct_9fa48("887") ? false : (stryCov_9fa48("887"), true),
          schema: stryMutAct_9fa48("888") ? {} : (stryCov_9fa48("888"), {
            type: stryMutAct_9fa48("889") ? "" : (stryCov_9fa48("889"), "object"),
            additionalProperties: stryMutAct_9fa48("890") ? true : (stryCov_9fa48("890"), false),
            required: stryMutAct_9fa48("891") ? [] : (stryCov_9fa48("891"), [stryMutAct_9fa48("892") ? "" : (stryCov_9fa48("892"), "exercises")]),
            properties: stryMutAct_9fa48("893") ? {} : (stryCov_9fa48("893"), {
              exercises: stryMutAct_9fa48("894") ? {} : (stryCov_9fa48("894"), {
                type: stryMutAct_9fa48("895") ? "" : (stryCov_9fa48("895"), "array"),
                minItems: REQUESTED_COUNT,
                maxItems: REQUESTED_COUNT,
                items: stryMutAct_9fa48("896") ? {} : (stryCov_9fa48("896"), {
                  type: stryMutAct_9fa48("897") ? "" : (stryCov_9fa48("897"), "object"),
                  additionalProperties: stryMutAct_9fa48("898") ? true : (stryCov_9fa48("898"), false),
                  required: stryMutAct_9fa48("899") ? [] : (stryCov_9fa48("899"), [stryMutAct_9fa48("900") ? "" : (stryCov_9fa48("900"), "text"), stryMutAct_9fa48("901") ? "" : (stryCov_9fa48("901"), "proposedCanonicalAnswer")]),
                  properties: stryMutAct_9fa48("902") ? {} : (stryCov_9fa48("902"), {
                    text: stryMutAct_9fa48("903") ? {} : (stryCov_9fa48("903"), {
                      type: stryMutAct_9fa48("904") ? "" : (stryCov_9fa48("904"), "string"),
                      minLength: 1
                    }),
                    proposedCanonicalAnswer: stryMutAct_9fa48("905") ? {} : (stryCov_9fa48("905"), {
                      type: stryMutAct_9fa48("906") ? "" : (stryCov_9fa48("906"), "string"),
                      minLength: 1,
                      pattern: CANONICAL_NATURAL_NUMBER_PATTERN
                    })
                  })
                })
              })
            })
          })
        })
      }),
      provider: stryMutAct_9fa48("907") ? {} : (stryCov_9fa48("907"), {
        require_parameters: stryMutAct_9fa48("908") ? false : (stryCov_9fa48("908"), true)
      })
    });
  }
}
function normalizeForComparison(value: string): string {
  if (stryMutAct_9fa48("909")) {
    {}
  } else {
    stryCov_9fa48("909");
    return stryMutAct_9fa48("911") ? value.replace(/\s+/g, " ").toLocaleLowerCase("pl-PL") : stryMutAct_9fa48("910") ? value.trim().replace(/\s+/g, " ").toLocaleUpperCase("pl-PL") : (stryCov_9fa48("910", "911"), value.trim().replace(stryMutAct_9fa48("913") ? /\S+/g : stryMutAct_9fa48("912") ? /\s/g : (stryCov_9fa48("912", "913"), /\s+/g), stryMutAct_9fa48("914") ? "" : (stryCov_9fa48("914"), " ")).toLocaleLowerCase(stryMutAct_9fa48("915") ? "" : (stryCov_9fa48("915"), "pl-PL")));
  }
}
function parseCandidates(envelopeValue: unknown, request: ExerciseGenerationRequest, createId: () => string): ExerciseCandidate[] {
  if (stryMutAct_9fa48("916")) {
    {}
  } else {
    stryCov_9fa48("916");
    const envelope = providerEnvelopeSchema.safeParse(envelopeValue);
    if (stryMutAct_9fa48("919") ? false : stryMutAct_9fa48("918") ? true : stryMutAct_9fa48("917") ? envelope.success : (stryCov_9fa48("917", "918", "919"), !envelope.success)) {
      if (stryMutAct_9fa48("920")) {
        {}
      } else {
        stryCov_9fa48("920");
        throw new OpenRouterExerciseGeneratorError(stryMutAct_9fa48("922") ? "" : (stryCov_9fa48("922"), "PROVIDER_FAILURE"));
      }
    }
    let contentValue: unknown;
    try {
      if (stryMutAct_9fa48("923")) {
        {}
      } else {
        stryCov_9fa48("923");
        contentValue = JSON.parse(envelope.data.choices[0].message.content);
      }
    } catch {
      if (stryMutAct_9fa48("924")) {
        {}
      } else {
        stryCov_9fa48("924");
        throw new OpenRouterExerciseGeneratorError(stryMutAct_9fa48("926") ? "" : (stryCov_9fa48("926"), "PROVIDER_FAILURE"));
      }
    }
    const payload = providerPayloadSchema.safeParse(contentValue);
    if (stryMutAct_9fa48("929") ? false : stryMutAct_9fa48("928") ? true : stryMutAct_9fa48("927") ? payload.success : (stryCov_9fa48("927", "928", "929"), !payload.success)) {
      if (stryMutAct_9fa48("930")) {
        {}
      } else {
        stryCov_9fa48("930");
        throw new OpenRouterExerciseGeneratorError(stryMutAct_9fa48("932") ? "" : (stryCov_9fa48("932"), "PROVIDER_FAILURE"));
      }
    }
    const seenTexts = new Set<string>();
    const candidates: ExerciseCandidate[] = stryMutAct_9fa48("933") ? ["Stryker was here"] : (stryCov_9fa48("933"), []);
    for (const value of payload.data.exercises) {
      if (stryMutAct_9fa48("934")) {
        {}
      } else {
        stryCov_9fa48("934");
        const candidate = providerCandidateSchema.safeParse(value);
        if (stryMutAct_9fa48("937") ? false : stryMutAct_9fa48("936") ? true : stryMutAct_9fa48("935") ? candidate.success : (stryCov_9fa48("935", "936", "937"), !candidate.success)) {
          if (stryMutAct_9fa48("938")) {
            {}
          } else {
            stryCov_9fa48("938");
            continue;
          }
        }
        const comparisonText = normalizeForComparison(candidate.data.text);
        if (stryMutAct_9fa48("940") ? false : stryMutAct_9fa48("939") ? true : (stryCov_9fa48("939", "940"), seenTexts.has(comparisonText))) {
          if (stryMutAct_9fa48("941")) {
            {}
          } else {
            stryCov_9fa48("941");
            continue;
          }
        }
        if (stryMutAct_9fa48("942")) {
          ;
        } else {
          stryCov_9fa48("942");
          seenTexts.add(comparisonText);
        }
        candidates.push(stryMutAct_9fa48("944") ? {} : (stryCov_9fa48("944"), {
          id: createId(),
          text: candidate.data.text,
          proposedCanonicalAnswer: candidate.data.proposedCanonicalAnswer,
          ...request,
          approvalStatus: stryMutAct_9fa48("945") ? "" : (stryCov_9fa48("945"), "unverified")
        }));
      }
    }
    return candidates;
  }
}
async function makeAttempt(request: ExerciseGenerationRequest, config: OpenRouterExerciseGeneratorConfig, fetchImplementation: typeof fetch, deadlineMs: number, createId: () => string): Promise<{
  candidates?: ExerciseCandidate[];
  retryableFailure?: true;
}> {
  if (stryMutAct_9fa48("946")) {
    {}
  } else {
    stryCov_9fa48("946");
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      if (stryMutAct_9fa48("947")) {
        {}
      } else {
        stryCov_9fa48("947");
        if (stryMutAct_9fa48("948")) {
          ;
        } else {
          stryCov_9fa48("948");
          controller.abort();
        }
      }
    }, deadlineMs);
    try {
      if (stryMutAct_9fa48("949")) {
        {}
      } else {
        stryCov_9fa48("949");
        const response = await fetchImplementation(OPENROUTER_CHAT_COMPLETIONS_URL, stryMutAct_9fa48("950") ? {} : (stryCov_9fa48("950"), {
          method: stryMutAct_9fa48("951") ? "" : (stryCov_9fa48("951"), "POST"),
          headers: stryMutAct_9fa48("952") ? {} : (stryCov_9fa48("952"), {
            Authorization: stryMutAct_9fa48("953") ? `` : (stryCov_9fa48("953"), `Bearer ${config.apiKey}`),
            "Content-Type": stryMutAct_9fa48("954") ? "" : (stryCov_9fa48("954"), "application/json")
          }),
          body: JSON.stringify(buildRequestBody(request, config.model)),
          signal: controller.signal
        }));
        if (stryMutAct_9fa48("957") ? false : stryMutAct_9fa48("956") ? true : stryMutAct_9fa48("955") ? response.ok : (stryCov_9fa48("955", "956", "957"), !response.ok)) {
          if (stryMutAct_9fa48("958")) {
            {}
          } else {
            stryCov_9fa48("958");
            if (stryMutAct_9fa48("961") ? response.status === 429 && response.status >= 500 : stryMutAct_9fa48("960") ? false : stryMutAct_9fa48("959") ? true : (stryCov_9fa48("959", "960", "961"), (stryMutAct_9fa48("963") ? response.status !== 429 : stryMutAct_9fa48("962") ? false : (stryCov_9fa48("962", "963"), response.status === 429)) || (stryMutAct_9fa48("966") ? response.status < 500 : stryMutAct_9fa48("965") ? response.status > 500 : stryMutAct_9fa48("964") ? false : (stryCov_9fa48("964", "965", "966"), response.status >= 500)))) {
              if (stryMutAct_9fa48("967")) {
                {}
              } else {
                stryCov_9fa48("967");
                return stryMutAct_9fa48("968") ? {} : (stryCov_9fa48("968"), {
                  retryableFailure: stryMutAct_9fa48("969") ? false : (stryCov_9fa48("969"), true)
                });
              }
            }
            throw new OpenRouterExerciseGeneratorError(stryMutAct_9fa48("971") ? "" : (stryCov_9fa48("971"), "PROVIDER_FAILURE"));
          }
        }
        const candidates = parseCandidates(await response.json(), request, createId);
        return (stryMutAct_9fa48("974") ? candidates.length !== 0 : stryMutAct_9fa48("973") ? false : stryMutAct_9fa48("972") ? true : (stryCov_9fa48("972", "973", "974"), candidates.length === 0)) ? stryMutAct_9fa48("975") ? {} : (stryCov_9fa48("975"), {
          retryableFailure: stryMutAct_9fa48("976") ? false : (stryCov_9fa48("976"), true)
        }) : stryMutAct_9fa48("977") ? {} : (stryCov_9fa48("977"), {
          candidates
        });
      }
    } catch (error) {
      if (stryMutAct_9fa48("978")) {
        {}
      } else {
        stryCov_9fa48("978");
        if (stryMutAct_9fa48("981") ? controller.signal.aborted && error instanceof Error && error.name === "AbortError" : stryMutAct_9fa48("980") ? false : stryMutAct_9fa48("979") ? true : (stryCov_9fa48("979", "980", "981"), controller.signal.aborted || (stryMutAct_9fa48("983") ? error instanceof Error || error.name === "AbortError" : stryMutAct_9fa48("982") ? false : (stryCov_9fa48("982", "983"), error instanceof Error && (stryMutAct_9fa48("985") ? error.name !== "AbortError" : stryMutAct_9fa48("984") ? true : (stryCov_9fa48("984", "985"), error.name === (stryMutAct_9fa48("986") ? "" : (stryCov_9fa48("986"), "AbortError")))))))) {
          if (stryMutAct_9fa48("987")) {
            {}
          } else {
            stryCov_9fa48("987");
            throw new OpenRouterExerciseGeneratorError(stryMutAct_9fa48("989") ? "" : (stryCov_9fa48("989"), "PROVIDER_TIMEOUT"));
          }
        }
        if (stryMutAct_9fa48("991") ? false : stryMutAct_9fa48("990") ? true : (stryCov_9fa48("990", "991"), error instanceof OpenRouterExerciseGeneratorError)) {
          if (stryMutAct_9fa48("992")) {
            {}
          } else {
            stryCov_9fa48("992");
            throw error;
          }
        }
        throw new OpenRouterExerciseGeneratorError(stryMutAct_9fa48("994") ? "" : (stryCov_9fa48("994"), "PROVIDER_FAILURE"));
      }
    } finally {
      if (stryMutAct_9fa48("995")) {
        {}
      } else {
        stryCov_9fa48("995");
        if (stryMutAct_9fa48("996")) {
          ;
        } else {
          stryCov_9fa48("996");
          clearTimeout(deadline);
        }
      }
    }
  }
}
export async function generateOpenRouterExercises(request: ExerciseGenerationRequest, config: OpenRouterExerciseGeneratorConfig, dependencies: OpenRouterExerciseGeneratorDependencies = {}): Promise<ExerciseCandidate[]> {
  if (stryMutAct_9fa48("997")) {
    {}
  } else {
    stryCov_9fa48("997");
    const fetchImplementation = stryMutAct_9fa48("998") ? dependencies.fetch && fetch : (stryCov_9fa48("998"), dependencies.fetch ?? fetch);
    const deadlineMs = stryMutAct_9fa48("999") ? dependencies.deadlineMs && DEFAULT_DEADLINE_MS : (stryCov_9fa48("999"), dependencies.deadlineMs ?? DEFAULT_DEADLINE_MS);
    const createId = stryMutAct_9fa48("1000") ? dependencies.createId && (() => crypto.randomUUID()) : (stryCov_9fa48("1000"), dependencies.createId ?? (stryMutAct_9fa48("1001") ? () => undefined : (stryCov_9fa48("1001"), () => crypto.randomUUID())));
    let lastErrorCode: OpenRouterExerciseGeneratorErrorCode = stryMutAct_9fa48("1002") ? "" : (stryCov_9fa48("1002"), "PROVIDER_FAILURE");
    for (let attempt = 0; stryMutAct_9fa48("1005") ? attempt >= 2 : stryMutAct_9fa48("1004") ? attempt <= 2 : stryMutAct_9fa48("1003") ? false : (stryCov_9fa48("1003", "1004", "1005"), attempt < 2); stryMutAct_9fa48("1006") ? attempt -= 1 : (stryCov_9fa48("1006"), attempt += 1)) {
      if (stryMutAct_9fa48("1007")) {
        {}
      } else {
        stryCov_9fa48("1007");
        try {
          if (stryMutAct_9fa48("1008")) {
            {}
          } else {
            stryCov_9fa48("1008");
            const result = await makeAttempt(request, config, fetchImplementation, deadlineMs, createId);
            if (stryMutAct_9fa48("1010") ? false : stryMutAct_9fa48("1009") ? true : (stryCov_9fa48("1009", "1010"), result.candidates)) {
              if (stryMutAct_9fa48("1011")) {
                {}
              } else {
                stryCov_9fa48("1011");
                return result.candidates;
              }
            }
            lastErrorCode = stryMutAct_9fa48("1012") ? "" : (stryCov_9fa48("1012"), "PROVIDER_FAILURE");
          }
        } catch (error) {
          if (stryMutAct_9fa48("1013")) {
            {}
          } else {
            stryCov_9fa48("1013");
            if (stryMutAct_9fa48("1016") ? false : stryMutAct_9fa48("1015") ? true : stryMutAct_9fa48("1014") ? error instanceof OpenRouterExerciseGeneratorError : (stryCov_9fa48("1014", "1015", "1016"), !(error instanceof OpenRouterExerciseGeneratorError))) {
              if (stryMutAct_9fa48("1017")) {
                {}
              } else {
                stryCov_9fa48("1017");
                throw error;
              }
            }
            lastErrorCode = error.code;
            if (stryMutAct_9fa48("1020") ? error.code === "PROVIDER_TIMEOUT" : stryMutAct_9fa48("1019") ? false : stryMutAct_9fa48("1018") ? true : (stryCov_9fa48("1018", "1019", "1020"), error.code !== (stryMutAct_9fa48("1021") ? "" : (stryCov_9fa48("1021"), "PROVIDER_TIMEOUT")))) {
              if (stryMutAct_9fa48("1022")) {
                {}
              } else {
                stryCov_9fa48("1022");
                throw error;
              }
            }
          }
        }
      }
    }
    if (stryMutAct_9fa48("1023")) {
      ;
    } else {
      stryCov_9fa48("1023");
      throw new OpenRouterExerciseGeneratorError(lastErrorCode);
    }
  }
}