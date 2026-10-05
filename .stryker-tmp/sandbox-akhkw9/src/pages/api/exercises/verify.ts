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
import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY, OPENROUTER_VERIFIER_MODEL } from "astro:env/server";
import { exerciseVerificationLedgerRowSchema, exerciseVerificationErrorSchema, exerciseVerificationRequestSchema, exerciseVerificationSuccessSchema } from "@/lib/exercises/schemas";
import { OpenRouterExerciseVerifierError, verifyOpenRouterExercise } from "@/lib/services/openrouter-exercise-verifier";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient, createServiceClient } from "@/lib/supabase";
import type { ExerciseCandidate, ExerciseVerificationError, ExerciseVerificationErrorCode, ExerciseVerificationEvidence, ExerciseVerificationResult, ExerciseVerificationSuccess } from "@/types";
export const prerender = stryMutAct_9fa48("1987") ? true : (stryCov_9fa48("1987"), false);
const LEDGER_COLUMNS = (stryMutAct_9fa48("1988") ? [] : (stryCov_9fa48("1988"), [stryMutAct_9fa48("1989") ? "" : (stryCov_9fa48("1989"), "id"), stryMutAct_9fa48("1990") ? "" : (stryCov_9fa48("1990"), "teacher_id"), stryMutAct_9fa48("1991") ? "" : (stryCov_9fa48("1991"), "candidate_id"), stryMutAct_9fa48("1992") ? "" : (stryCov_9fa48("1992"), "candidate_text"), stryMutAct_9fa48("1993") ? "" : (stryCov_9fa48("1993"), "proposed_canonical_answer"), stryMutAct_9fa48("1994") ? "" : (stryCov_9fa48("1994"), "grade"), stryMutAct_9fa48("1995") ? "" : (stryCov_9fa48("1995"), "topic"), stryMutAct_9fa48("1996") ? "" : (stryCov_9fa48("1996"), "difficulty"), stryMutAct_9fa48("1997") ? "" : (stryCov_9fa48("1997"), "outcome"), stryMutAct_9fa48("1998") ? "" : (stryCov_9fa48("1998"), "verified_answer"), stryMutAct_9fa48("1999") ? "" : (stryCov_9fa48("1999"), "verifier_identity"), stryMutAct_9fa48("2000") ? "" : (stryCov_9fa48("2000"), "verifier_version"), stryMutAct_9fa48("2001") ? "" : (stryCov_9fa48("2001"), "verified_at"), stryMutAct_9fa48("2002") ? "" : (stryCov_9fa48("2002"), "rationale")])).join(stryMutAct_9fa48("2003") ? "" : (stryCov_9fa48("2003"), ","));
const ERROR_MESSAGES: Record<ExerciseVerificationErrorCode, string> = stryMutAct_9fa48("2004") ? {} : (stryCov_9fa48("2004"), {
  INVALID_REQUEST: stryMutAct_9fa48("2005") ? "" : (stryCov_9fa48("2005"), "Nieprawidłowe dane żądania weryfikacji."),
  UNAUTHENTICATED: stryMutAct_9fa48("2006") ? "" : (stryCov_9fa48("2006"), "Zaloguj się, aby zweryfikować zadania."),
  FORBIDDEN: stryMutAct_9fa48("2007") ? "" : (stryCov_9fa48("2007"), "Weryfikacja zadań jest dostępna tylko dla nauczycieli."),
  VERIFIER_NOT_CONFIGURED: stryMutAct_9fa48("2008") ? "" : (stryCov_9fa48("2008"), "Weryfikacja zadań nie jest skonfigurowana."),
  CANDIDATE_CONFLICT: stryMutAct_9fa48("2009") ? "" : (stryCov_9fa48("2009"), "Identyfikator kandydata został już użyty dla innej treści."),
  PERSISTENCE_FAILURE: stryMutAct_9fa48("2010") ? "" : (stryCov_9fa48("2010"), "Nie udało się zapisać wyniku weryfikacji. Spróbuj ponownie później.")
});
type RequestClient = ReturnType<typeof createClient>;
type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;
type LedgerRow = ReturnType<typeof exerciseVerificationLedgerRowSchema.parse>;
class VerificationPersistenceError extends Error {}
class CandidateConflictError extends Error {}
export interface ExerciseVerifyHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  verify?: typeof verifyOpenRouterExercise;
  createSupabaseClient?: (headers: Headers, cookies: Parameters<typeof createClient>[1]) => RequestClient;
  createWriterClient?: () => ServiceClient | null;
  loadExisting?: (client: ServiceClient, teacherId: string, candidateIds: string[]) => Promise<LedgerRow[]>;
  record?: (client: ServiceClient, teacherId: string, candidate: ExerciseCandidate, evidence: ExerciseVerificationEvidence) => Promise<LedgerRow>;
  providerConfig?: {
    apiKey?: string;
    model?: string;
  };
}
function jsonResponse(body: ExerciseVerificationError | ExerciseVerificationSuccess, status: number): Response {
  if (stryMutAct_9fa48("2011")) {
    {}
  } else {
    stryCov_9fa48("2011");
    return new Response(JSON.stringify(body), stryMutAct_9fa48("2012") ? {} : (stryCov_9fa48("2012"), {
      status,
      headers: stryMutAct_9fa48("2013") ? {} : (stryCov_9fa48("2013"), {
        "Content-Type": stryMutAct_9fa48("2014") ? "" : (stryCov_9fa48("2014"), "application/json; charset=utf-8")
      })
    }));
  }
}
function errorResponse(code: ExerciseVerificationErrorCode, status: number, message = ERROR_MESSAGES[code]): Response {
  if (stryMutAct_9fa48("2015")) {
    {}
  } else {
    stryCov_9fa48("2015");
    return jsonResponse(exerciseVerificationErrorSchema.parse(stryMutAct_9fa48("2016") ? {} : (stryCov_9fa48("2016"), {
      error: stryMutAct_9fa48("2017") ? {} : (stryCov_9fa48("2017"), {
        code,
        message
      })
    })), status);
  }
}
async function loadExistingVerifications(client: ServiceClient, teacherId: string, candidateIds: string[]): Promise<LedgerRow[]> {
  if (stryMutAct_9fa48("2018")) {
    {}
  } else {
    stryCov_9fa48("2018");
    const {
      data,
      error
    } = await client.from(stryMutAct_9fa48("2019") ? "" : (stryCov_9fa48("2019"), "exercise_verifications")).select(LEDGER_COLUMNS).eq(stryMutAct_9fa48("2020") ? "" : (stryCov_9fa48("2020"), "teacher_id"), teacherId).in(stryMutAct_9fa48("2021") ? "" : (stryCov_9fa48("2021"), "candidate_id"), candidateIds);
    if (stryMutAct_9fa48("2023") ? false : stryMutAct_9fa48("2022") ? true : (stryCov_9fa48("2022", "2023"), error)) {
      if (stryMutAct_9fa48("2024")) {
        {}
      } else {
        stryCov_9fa48("2024");
        if (stryMutAct_9fa48("2025")) {
          ;
        } else {
          stryCov_9fa48("2025");
          throw new VerificationPersistenceError();
        }
      }
    }
    const rows = exerciseVerificationLedgerRowSchema.array().safeParse(data);
    if (stryMutAct_9fa48("2028") ? false : stryMutAct_9fa48("2027") ? true : stryMutAct_9fa48("2026") ? rows.success : (stryCov_9fa48("2026", "2027", "2028"), !rows.success)) {
      if (stryMutAct_9fa48("2029")) {
        {}
      } else {
        stryCov_9fa48("2029");
        if (stryMutAct_9fa48("2030")) {
          ;
        } else {
          stryCov_9fa48("2030");
          throw new VerificationPersistenceError();
        }
      }
    }
    return rows.data;
  }
}
async function recordVerification(client: ServiceClient, teacherId: string, candidate: ExerciseCandidate, evidence: ExerciseVerificationEvidence): Promise<LedgerRow> {
  if (stryMutAct_9fa48("2031")) {
    {}
  } else {
    stryCov_9fa48("2031");
    const {
      data,
      error
    } = await client.from(stryMutAct_9fa48("2032") ? "" : (stryCov_9fa48("2032"), "exercise_verifications")).insert(stryMutAct_9fa48("2033") ? {} : (stryCov_9fa48("2033"), {
      teacher_id: teacherId,
      candidate_id: candidate.id,
      candidate_text: candidate.text,
      proposed_canonical_answer: candidate.proposedCanonicalAnswer,
      grade: String(candidate.grade),
      topic: candidate.topic,
      difficulty: candidate.difficulty,
      outcome: evidence.outcome,
      verified_answer: evidence.verifiedAnswer,
      verifier_identity: evidence.verifierIdentity,
      verifier_version: evidence.verifierVersion,
      verified_at: evidence.verifiedAt,
      rationale: evidence.rationale
    })).select(LEDGER_COLUMNS).single();
    if (stryMutAct_9fa48("2035") ? false : stryMutAct_9fa48("2034") ? true : (stryCov_9fa48("2034", "2035"), error)) {
      if (stryMutAct_9fa48("2036")) {
        {}
      } else {
        stryCov_9fa48("2036");
        if (stryMutAct_9fa48("2039") ? error.code !== "23505" : stryMutAct_9fa48("2038") ? false : stryMutAct_9fa48("2037") ? true : (stryCov_9fa48("2037", "2038", "2039"), error.code === (stryMutAct_9fa48("2040") ? "" : (stryCov_9fa48("2040"), "23505")))) {
          if (stryMutAct_9fa48("2041")) {
            {}
          } else {
            stryCov_9fa48("2041");
            const existing = await loadExistingVerifications(client, teacherId, stryMutAct_9fa48("2042") ? [] : (stryCov_9fa48("2042"), [candidate.id]));
            if (stryMutAct_9fa48("2045") ? existing.length !== 1 : stryMutAct_9fa48("2044") ? false : stryMutAct_9fa48("2043") ? true : (stryCov_9fa48("2043", "2044", "2045"), existing.length === 1)) {
              if (stryMutAct_9fa48("2046")) {
                {}
              } else {
                stryCov_9fa48("2046");
                return existing[0];
              }
            }
          }
        }
        if (stryMutAct_9fa48("2047")) {
          ;
        } else {
          stryCov_9fa48("2047");
          throw new VerificationPersistenceError();
        }
      }
    }
    const row = exerciseVerificationLedgerRowSchema.safeParse(data);
    if (stryMutAct_9fa48("2050") ? false : stryMutAct_9fa48("2049") ? true : stryMutAct_9fa48("2048") ? row.success : (stryCov_9fa48("2048", "2049", "2050"), !row.success)) {
      if (stryMutAct_9fa48("2051")) {
        {}
      } else {
        stryCov_9fa48("2051");
        if (stryMutAct_9fa48("2052")) {
          ;
        } else {
          stryCov_9fa48("2052");
          throw new VerificationPersistenceError();
        }
      }
    }
    return row.data;
  }
}
function snapshotMatches(row: LedgerRow, candidate: ExerciseCandidate): boolean {
  if (stryMutAct_9fa48("2053")) {
    {}
  } else {
    stryCov_9fa48("2053");
    return stryMutAct_9fa48("2056") ? row.candidate_id === candidate.id && row.candidate_text === candidate.text && row.proposed_canonical_answer === candidate.proposedCanonicalAnswer && row.grade === String(candidate.grade) && row.topic === candidate.topic || row.difficulty === candidate.difficulty : stryMutAct_9fa48("2055") ? false : stryMutAct_9fa48("2054") ? true : (stryCov_9fa48("2054", "2055", "2056"), (stryMutAct_9fa48("2058") ? row.candidate_id === candidate.id && row.candidate_text === candidate.text && row.proposed_canonical_answer === candidate.proposedCanonicalAnswer && row.grade === String(candidate.grade) || row.topic === candidate.topic : stryMutAct_9fa48("2057") ? true : (stryCov_9fa48("2057", "2058"), (stryMutAct_9fa48("2060") ? row.candidate_id === candidate.id && row.candidate_text === candidate.text && row.proposed_canonical_answer === candidate.proposedCanonicalAnswer || row.grade === String(candidate.grade) : stryMutAct_9fa48("2059") ? true : (stryCov_9fa48("2059", "2060"), (stryMutAct_9fa48("2062") ? row.candidate_id === candidate.id && row.candidate_text === candidate.text || row.proposed_canonical_answer === candidate.proposedCanonicalAnswer : stryMutAct_9fa48("2061") ? true : (stryCov_9fa48("2061", "2062"), (stryMutAct_9fa48("2064") ? row.candidate_id === candidate.id || row.candidate_text === candidate.text : stryMutAct_9fa48("2063") ? true : (stryCov_9fa48("2063", "2064"), (stryMutAct_9fa48("2066") ? row.candidate_id !== candidate.id : stryMutAct_9fa48("2065") ? true : (stryCov_9fa48("2065", "2066"), row.candidate_id === candidate.id)) && (stryMutAct_9fa48("2068") ? row.candidate_text !== candidate.text : stryMutAct_9fa48("2067") ? true : (stryCov_9fa48("2067", "2068"), row.candidate_text === candidate.text)))) && (stryMutAct_9fa48("2070") ? row.proposed_canonical_answer !== candidate.proposedCanonicalAnswer : stryMutAct_9fa48("2069") ? true : (stryCov_9fa48("2069", "2070"), row.proposed_canonical_answer === candidate.proposedCanonicalAnswer)))) && (stryMutAct_9fa48("2072") ? row.grade !== String(candidate.grade) : stryMutAct_9fa48("2071") ? true : (stryCov_9fa48("2071", "2072"), row.grade === String(candidate.grade))))) && (stryMutAct_9fa48("2074") ? row.topic !== candidate.topic : stryMutAct_9fa48("2073") ? true : (stryCov_9fa48("2073", "2074"), row.topic === candidate.topic)))) && (stryMutAct_9fa48("2076") ? row.difficulty !== candidate.difficulty : stryMutAct_9fa48("2075") ? true : (stryCov_9fa48("2075", "2076"), row.difficulty === candidate.difficulty)));
  }
}
function resultFromRow(row: LedgerRow): ExerciseVerificationResult {
  if (stryMutAct_9fa48("2077")) {
    {}
  } else {
    stryCov_9fa48("2077");
    const base = stryMutAct_9fa48("2078") ? {} : (stryCov_9fa48("2078"), {
      verificationId: row.id,
      candidateId: row.candidate_id,
      rationale: row.rationale,
      verifierIdentity: row.verifier_identity,
      verifierVersion: row.verifier_version,
      verifiedAt: row.verified_at
    });
    if (stryMutAct_9fa48("2081") ? row.outcome !== "not_unique_answer" : stryMutAct_9fa48("2080") ? false : stryMutAct_9fa48("2079") ? true : (stryCov_9fa48("2079", "2080", "2081"), row.outcome === (stryMutAct_9fa48("2082") ? "" : (stryCov_9fa48("2082"), "not_unique_answer")))) {
      if (stryMutAct_9fa48("2083")) {
        {}
      } else {
        stryCov_9fa48("2083");
        return stryMutAct_9fa48("2084") ? {} : (stryCov_9fa48("2084"), {
          ...base,
          outcome: row.outcome,
          verifiedAnswer: null
        });
      }
    }
    if (stryMutAct_9fa48("2087") ? row.verified_answer !== null : stryMutAct_9fa48("2086") ? false : stryMutAct_9fa48("2085") ? true : (stryCov_9fa48("2085", "2086", "2087"), row.verified_answer === null)) {
      if (stryMutAct_9fa48("2088")) {
        {}
      } else {
        stryCov_9fa48("2088");
        if (stryMutAct_9fa48("2089")) {
          ;
        } else {
          stryCov_9fa48("2089");
          throw new VerificationPersistenceError();
        }
      }
    }
    return stryMutAct_9fa48("2090") ? {} : (stryCov_9fa48("2090"), {
      ...base,
      outcome: row.outcome,
      verifiedAnswer: row.verified_answer
    });
  }
}
export function createExerciseVerifyHandler(dependencies: ExerciseVerifyHandlerDependencies = {}): APIRoute {
  if (stryMutAct_9fa48("2091")) {
    {}
  } else {
    stryCov_9fa48("2091");
    const authorize = stryMutAct_9fa48("2092") ? dependencies.authorize && authorizeTeacher : (stryCov_9fa48("2092"), dependencies.authorize ?? authorizeTeacher);
    const verify = stryMutAct_9fa48("2093") ? dependencies.verify && verifyOpenRouterExercise : (stryCov_9fa48("2093"), dependencies.verify ?? verifyOpenRouterExercise);
    const createSupabaseClient = stryMutAct_9fa48("2094") ? dependencies.createSupabaseClient && createClient : (stryCov_9fa48("2094"), dependencies.createSupabaseClient ?? createClient);
    const createWriterClient = stryMutAct_9fa48("2095") ? dependencies.createWriterClient && createServiceClient : (stryCov_9fa48("2095"), dependencies.createWriterClient ?? createServiceClient);
    const loadExisting = stryMutAct_9fa48("2096") ? dependencies.loadExisting && loadExistingVerifications : (stryCov_9fa48("2096"), dependencies.loadExisting ?? loadExistingVerifications);
    const record = stryMutAct_9fa48("2097") ? dependencies.record && recordVerification : (stryCov_9fa48("2097"), dependencies.record ?? recordVerification);
    const providerConfig = stryMutAct_9fa48("2098") ? dependencies.providerConfig && {
      apiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_VERIFIER_MODEL
    } : (stryCov_9fa48("2098"), dependencies.providerConfig ?? (stryMutAct_9fa48("2099") ? {} : (stryCov_9fa48("2099"), {
      apiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_VERIFIER_MODEL
    })));
    return async context => {
      if (stryMutAct_9fa48("2100")) {
        {}
      } else {
        stryCov_9fa48("2100");
        let requestValue: unknown;
        try {
          if (stryMutAct_9fa48("2101")) {
            {}
          } else {
            stryCov_9fa48("2101");
            requestValue = await context.request.json();
          }
        } catch {
          if (stryMutAct_9fa48("2102")) {
            {}
          } else {
            stryCov_9fa48("2102");
            return errorResponse(stryMutAct_9fa48("2103") ? "" : (stryCov_9fa48("2103"), "INVALID_REQUEST"), 400);
          }
        }
        const parsedRequest = exerciseVerificationRequestSchema.safeParse(requestValue);
        if (stryMutAct_9fa48("2106") ? false : stryMutAct_9fa48("2105") ? true : stryMutAct_9fa48("2104") ? parsedRequest.success : (stryCov_9fa48("2104", "2105", "2106"), !parsedRequest.success)) {
          if (stryMutAct_9fa48("2107")) {
            {}
          } else {
            stryCov_9fa48("2107");
            return errorResponse(stryMutAct_9fa48("2108") ? "" : (stryCov_9fa48("2108"), "INVALID_REQUEST"), 400);
          }
        }
        const supabase = createSupabaseClient(context.request.headers, context.cookies);
        const authorization = await authorize(context.locals, supabase);
        if (stryMutAct_9fa48("2111") ? authorization.status !== "unauthenticated" : stryMutAct_9fa48("2110") ? false : stryMutAct_9fa48("2109") ? true : (stryCov_9fa48("2109", "2110", "2111"), authorization.status === (stryMutAct_9fa48("2112") ? "" : (stryCov_9fa48("2112"), "unauthenticated")))) {
          if (stryMutAct_9fa48("2113")) {
            {}
          } else {
            stryCov_9fa48("2113");
            return errorResponse(stryMutAct_9fa48("2114") ? "" : (stryCov_9fa48("2114"), "UNAUTHENTICATED"), 401);
          }
        }
        if (stryMutAct_9fa48("2117") ? authorization.status !== "non-teacher" : stryMutAct_9fa48("2116") ? false : stryMutAct_9fa48("2115") ? true : (stryCov_9fa48("2115", "2116", "2117"), authorization.status === (stryMutAct_9fa48("2118") ? "" : (stryCov_9fa48("2118"), "non-teacher")))) {
          if (stryMutAct_9fa48("2119")) {
            {}
          } else {
            stryCov_9fa48("2119");
            return errorResponse(stryMutAct_9fa48("2120") ? "" : (stryCov_9fa48("2120"), "FORBIDDEN"), 403);
          }
        }
        if (stryMutAct_9fa48("2123") ? authorization.status === "profile-unavailable" && !context.locals.user : stryMutAct_9fa48("2122") ? false : stryMutAct_9fa48("2121") ? true : (stryCov_9fa48("2121", "2122", "2123"), (stryMutAct_9fa48("2125") ? authorization.status !== "profile-unavailable" : stryMutAct_9fa48("2124") ? false : (stryCov_9fa48("2124", "2125"), authorization.status === (stryMutAct_9fa48("2126") ? "" : (stryCov_9fa48("2126"), "profile-unavailable")))) || (stryMutAct_9fa48("2127") ? context.locals.user : (stryCov_9fa48("2127"), !context.locals.user)))) {
          if (stryMutAct_9fa48("2128")) {
            {}
          } else {
            stryCov_9fa48("2128");
            return errorResponse(stryMutAct_9fa48("2129") ? "" : (stryCov_9fa48("2129"), "FORBIDDEN"), 403, stryMutAct_9fa48("2130") ? "" : (stryCov_9fa48("2130"), "Nie można potwierdzić uprawnień nauczyciela."));
          }
        }
        const writer = createWriterClient();
        const apiKey = providerConfig.apiKey;
        const model = providerConfig.model;
        if (stryMutAct_9fa48("2133") ? (!apiKey || !model) && !writer : stryMutAct_9fa48("2132") ? false : stryMutAct_9fa48("2131") ? true : (stryCov_9fa48("2131", "2132", "2133"), (stryMutAct_9fa48("2135") ? !apiKey && !model : stryMutAct_9fa48("2134") ? false : (stryCov_9fa48("2134", "2135"), (stryMutAct_9fa48("2136") ? apiKey : (stryCov_9fa48("2136"), !apiKey)) || (stryMutAct_9fa48("2137") ? model : (stryCov_9fa48("2137"), !model)))) || (stryMutAct_9fa48("2138") ? writer : (stryCov_9fa48("2138"), !writer)))) {
          if (stryMutAct_9fa48("2139")) {
            {}
          } else {
            stryCov_9fa48("2139");
            return errorResponse(stryMutAct_9fa48("2140") ? "" : (stryCov_9fa48("2140"), "VERIFIER_NOT_CONFIGURED"), 503);
          }
        }
        const {
          candidates
        } = parsedRequest.data;
        const teacherId = context.locals.user.id;
        try {
          if (stryMutAct_9fa48("2141")) {
            {}
          } else {
            stryCov_9fa48("2141");
            const existingRows = await loadExisting(writer, teacherId, candidates.map(stryMutAct_9fa48("2142") ? () => undefined : (stryCov_9fa48("2142"), ({
              id
            }) => id)));
            if (stryMutAct_9fa48("2145") ? existingRows.every(row => row.teacher_id !== teacherId) : stryMutAct_9fa48("2144") ? false : stryMutAct_9fa48("2143") ? true : (stryCov_9fa48("2143", "2144", "2145"), existingRows.some(stryMutAct_9fa48("2146") ? () => undefined : (stryCov_9fa48("2146"), row => stryMutAct_9fa48("2149") ? row.teacher_id === teacherId : stryMutAct_9fa48("2148") ? false : stryMutAct_9fa48("2147") ? true : (stryCov_9fa48("2147", "2148", "2149"), row.teacher_id !== teacherId))))) {
              if (stryMutAct_9fa48("2150")) {
                {}
              } else {
                stryCov_9fa48("2150");
                if (stryMutAct_9fa48("2151")) {
                  ;
                } else {
                  stryCov_9fa48("2151");
                  throw new VerificationPersistenceError();
                }
              }
            }
            const existingByCandidateId = new Map(existingRows.map(stryMutAct_9fa48("2152") ? () => undefined : (stryCov_9fa48("2152"), row => stryMutAct_9fa48("2153") ? [] : (stryCov_9fa48("2153"), [row.candidate_id, row]))));
            for (const candidate of candidates) {
              if (stryMutAct_9fa48("2154")) {
                {}
              } else {
                stryCov_9fa48("2154");
                const existing = existingByCandidateId.get(candidate.id);
                if (stryMutAct_9fa48("2157") ? existing || !snapshotMatches(existing, candidate) : stryMutAct_9fa48("2156") ? false : stryMutAct_9fa48("2155") ? true : (stryCov_9fa48("2155", "2156", "2157"), existing && (stryMutAct_9fa48("2158") ? snapshotMatches(existing, candidate) : (stryCov_9fa48("2158"), !snapshotMatches(existing, candidate))))) {
                  if (stryMutAct_9fa48("2159")) {
                    {}
                  } else {
                    stryCov_9fa48("2159");
                    return errorResponse(stryMutAct_9fa48("2160") ? "" : (stryCov_9fa48("2160"), "CANDIDATE_CONFLICT"), 409);
                  }
                }
              }
            }
            const results = await Promise.all(candidates.map(async (candidate): Promise<ExerciseVerificationResult> => {
              if (stryMutAct_9fa48("2161")) {
                {}
              } else {
                stryCov_9fa48("2161");
                const existing = existingByCandidateId.get(candidate.id);
                if (stryMutAct_9fa48("2163") ? false : stryMutAct_9fa48("2162") ? true : (stryCov_9fa48("2162", "2163"), existing)) {
                  if (stryMutAct_9fa48("2164")) {
                    {}
                  } else {
                    stryCov_9fa48("2164");
                    return resultFromRow(existing);
                  }
                }
                try {
                  if (stryMutAct_9fa48("2165")) {
                    {}
                  } else {
                    stryCov_9fa48("2165");
                    const evidence = await verify(candidate, stryMutAct_9fa48("2166") ? {} : (stryCov_9fa48("2166"), {
                      apiKey,
                      model
                    }));
                    const row = await record(writer, teacherId, candidate, evidence);
                    if (stryMutAct_9fa48("2169") ? false : stryMutAct_9fa48("2168") ? true : stryMutAct_9fa48("2167") ? snapshotMatches(row, candidate) : (stryCov_9fa48("2167", "2168", "2169"), !snapshotMatches(row, candidate))) {
                      if (stryMutAct_9fa48("2170")) {
                        {}
                      } else {
                        stryCov_9fa48("2170");
                        if (stryMutAct_9fa48("2171")) {
                          ;
                        } else {
                          stryCov_9fa48("2171");
                          throw new CandidateConflictError();
                        }
                      }
                    }
                    return resultFromRow(row);
                  }
                } catch (error) {
                  if (stryMutAct_9fa48("2172")) {
                    {}
                  } else {
                    stryCov_9fa48("2172");
                    if (stryMutAct_9fa48("2174") ? false : stryMutAct_9fa48("2173") ? true : (stryCov_9fa48("2173", "2174"), error instanceof OpenRouterExerciseVerifierError)) {
                      if (stryMutAct_9fa48("2175")) {
                        {}
                      } else {
                        stryCov_9fa48("2175");
                        return stryMutAct_9fa48("2176") ? {} : (stryCov_9fa48("2176"), {
                          candidateId: candidate.id,
                          outcome: stryMutAct_9fa48("2177") ? "" : (stryCov_9fa48("2177"), "indeterminate"),
                          error: stryMutAct_9fa48("2178") ? {} : (stryCov_9fa48("2178"), {
                            code: error.code,
                            message: (stryMutAct_9fa48("2181") ? error.code !== "PROVIDER_TIMEOUT" : stryMutAct_9fa48("2180") ? false : stryMutAct_9fa48("2179") ? true : (stryCov_9fa48("2179", "2180", "2181"), error.code === (stryMutAct_9fa48("2182") ? "" : (stryCov_9fa48("2182"), "PROVIDER_TIMEOUT")))) ? stryMutAct_9fa48("2183") ? "" : (stryCov_9fa48("2183"), "Weryfikator nie odpowiedział na czas. Spróbuj ponownie.") : stryMutAct_9fa48("2184") ? "" : (stryCov_9fa48("2184"), "Nie udało się zweryfikować zadania. Spróbuj ponownie później.")
                          })
                        });
                      }
                    }
                    if (stryMutAct_9fa48("2186") ? false : stryMutAct_9fa48("2185") ? true : (stryCov_9fa48("2185", "2186"), error instanceof CandidateConflictError)) {
                      if (stryMutAct_9fa48("2187")) {
                        {}
                      } else {
                        stryCov_9fa48("2187");
                        throw error;
                      }
                    }
                    return stryMutAct_9fa48("2188") ? {} : (stryCov_9fa48("2188"), {
                      candidateId: candidate.id,
                      outcome: stryMutAct_9fa48("2189") ? "" : (stryCov_9fa48("2189"), "indeterminate"),
                      error: stryMutAct_9fa48("2190") ? {} : (stryCov_9fa48("2190"), {
                        code: stryMutAct_9fa48("2191") ? "" : (stryCov_9fa48("2191"), "PROVIDER_FAILURE"),
                        message: stryMutAct_9fa48("2192") ? "" : (stryCov_9fa48("2192"), "Nie udało się zapisać wyniku weryfikacji. Spróbuj ponownie później.")
                      })
                    });
                  }
                }
              }
            }));
            const response = exerciseVerificationSuccessSchema.parse(stryMutAct_9fa48("2193") ? {} : (stryCov_9fa48("2193"), {
              results
            }));
            return jsonResponse(response, 200);
          }
        } catch (error) {
          if (stryMutAct_9fa48("2194")) {
            {}
          } else {
            stryCov_9fa48("2194");
            if (stryMutAct_9fa48("2196") ? false : stryMutAct_9fa48("2195") ? true : (stryCov_9fa48("2195", "2196"), error instanceof CandidateConflictError)) {
              if (stryMutAct_9fa48("2197")) {
                {}
              } else {
                stryCov_9fa48("2197");
                return errorResponse(stryMutAct_9fa48("2198") ? "" : (stryCov_9fa48("2198"), "CANDIDATE_CONFLICT"), 409);
              }
            }
            return errorResponse(stryMutAct_9fa48("2199") ? "" : (stryCov_9fa48("2199"), "PERSISTENCE_FAILURE"), 500);
          }
        }
      }
    };
  }
}
export const POST = createExerciseVerifyHandler();