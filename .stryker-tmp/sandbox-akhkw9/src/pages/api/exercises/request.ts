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
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";
import { exerciseGenerationRequestSchema } from "@/lib/exercises/schemas";
import { generateOpenRouterExercises, OpenRouterExerciseGeneratorError } from "@/lib/services/openrouter-exercise-generator";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { ExerciseGenerationError, ExerciseGenerationErrorCode, ExerciseGenerationSuccess } from "@/types";
export const prerender = stryMutAct_9fa48("1727") ? true : (stryCov_9fa48("1727"), false);
const ERROR_MESSAGES: Record<ExerciseGenerationErrorCode, string> = stryMutAct_9fa48("1728") ? {} : (stryCov_9fa48("1728"), {
  INVALID_REQUEST: stryMutAct_9fa48("1729") ? "" : (stryCov_9fa48("1729"), "Nieprawidłowe dane żądania."),
  UNAUTHENTICATED: stryMutAct_9fa48("1730") ? "" : (stryCov_9fa48("1730"), "Zaloguj się, aby wygenerować zadania."),
  FORBIDDEN: stryMutAct_9fa48("1731") ? "" : (stryCov_9fa48("1731"), "Generowanie zadań jest dostępne tylko dla nauczycieli."),
  PROVIDER_NOT_CONFIGURED: stryMutAct_9fa48("1732") ? "" : (stryCov_9fa48("1732"), "Generator zadań nie jest skonfigurowany."),
  PROVIDER_FAILURE: stryMutAct_9fa48("1733") ? "" : (stryCov_9fa48("1733"), "Nie udało się wygenerować zadań. Spróbuj ponownie później."),
  PROVIDER_TIMEOUT: stryMutAct_9fa48("1734") ? "" : (stryCov_9fa48("1734"), "Generator zadań nie odpowiedział na czas. Spróbuj ponownie.")
});
type AuthorizationFunction = typeof authorizeTeacher;
type GenerationFunction = typeof generateOpenRouterExercises;
type ClientFactory = typeof createClient;
export interface ExerciseRequestHandlerDependencies {
  authorize?: AuthorizationFunction;
  generate?: GenerationFunction;
  createSupabaseClient?: ClientFactory;
  providerConfig?: {
    apiKey?: string;
    model?: string;
  };
}
function jsonResponse(body: ExerciseGenerationError | ExerciseGenerationSuccess, status: number): Response {
  if (stryMutAct_9fa48("1735")) {
    {}
  } else {
    stryCov_9fa48("1735");
    return new Response(JSON.stringify(body), stryMutAct_9fa48("1736") ? {} : (stryCov_9fa48("1736"), {
      status,
      headers: stryMutAct_9fa48("1737") ? {} : (stryCov_9fa48("1737"), {
        "Content-Type": stryMutAct_9fa48("1738") ? "" : (stryCov_9fa48("1738"), "application/json; charset=utf-8")
      })
    }));
  }
}
function errorResponse(code: ExerciseGenerationErrorCode, status: number, message = ERROR_MESSAGES[code]): Response {
  if (stryMutAct_9fa48("1739")) {
    {}
  } else {
    stryCov_9fa48("1739");
    return jsonResponse(stryMutAct_9fa48("1740") ? {} : (stryCov_9fa48("1740"), {
      error: stryMutAct_9fa48("1741") ? {} : (stryCov_9fa48("1741"), {
        code,
        message
      })
    }), status);
  }
}
export function createExerciseRequestHandler(dependencies: ExerciseRequestHandlerDependencies = {}): APIRoute {
  if (stryMutAct_9fa48("1742")) {
    {}
  } else {
    stryCov_9fa48("1742");
    const authorize = stryMutAct_9fa48("1743") ? dependencies.authorize && authorizeTeacher : (stryCov_9fa48("1743"), dependencies.authorize ?? authorizeTeacher);
    const generate = stryMutAct_9fa48("1744") ? dependencies.generate && generateOpenRouterExercises : (stryCov_9fa48("1744"), dependencies.generate ?? generateOpenRouterExercises);
    const createSupabaseClient = stryMutAct_9fa48("1745") ? dependencies.createSupabaseClient && createClient : (stryCov_9fa48("1745"), dependencies.createSupabaseClient ?? createClient);
    const providerConfig = stryMutAct_9fa48("1746") ? dependencies.providerConfig && {
      apiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL
    } : (stryCov_9fa48("1746"), dependencies.providerConfig ?? (stryMutAct_9fa48("1747") ? {} : (stryCov_9fa48("1747"), {
      apiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL
    })));
    return async context => {
      if (stryMutAct_9fa48("1748")) {
        {}
      } else {
        stryCov_9fa48("1748");
        let requestValue: unknown;
        try {
          if (stryMutAct_9fa48("1749")) {
            {}
          } else {
            stryCov_9fa48("1749");
            requestValue = await context.request.json();
          }
        } catch {
          if (stryMutAct_9fa48("1750")) {
            {}
          } else {
            stryCov_9fa48("1750");
            return errorResponse(stryMutAct_9fa48("1751") ? "" : (stryCov_9fa48("1751"), "INVALID_REQUEST"), 400);
          }
        }
        const parsedRequest = exerciseGenerationRequestSchema.safeParse(requestValue);
        if (stryMutAct_9fa48("1754") ? false : stryMutAct_9fa48("1753") ? true : stryMutAct_9fa48("1752") ? parsedRequest.success : (stryCov_9fa48("1752", "1753", "1754"), !parsedRequest.success)) {
          if (stryMutAct_9fa48("1755")) {
            {}
          } else {
            stryCov_9fa48("1755");
            return errorResponse(stryMutAct_9fa48("1756") ? "" : (stryCov_9fa48("1756"), "INVALID_REQUEST"), 400);
          }
        }
        const supabase = createSupabaseClient(context.request.headers, context.cookies);
        const authorization = await authorize(context.locals, supabase);
        if (stryMutAct_9fa48("1759") ? authorization.status !== "unauthenticated" : stryMutAct_9fa48("1758") ? false : stryMutAct_9fa48("1757") ? true : (stryCov_9fa48("1757", "1758", "1759"), authorization.status === (stryMutAct_9fa48("1760") ? "" : (stryCov_9fa48("1760"), "unauthenticated")))) {
          if (stryMutAct_9fa48("1761")) {
            {}
          } else {
            stryCov_9fa48("1761");
            return errorResponse(stryMutAct_9fa48("1762") ? "" : (stryCov_9fa48("1762"), "UNAUTHENTICATED"), 401);
          }
        }
        if (stryMutAct_9fa48("1765") ? authorization.status !== "non-teacher" : stryMutAct_9fa48("1764") ? false : stryMutAct_9fa48("1763") ? true : (stryCov_9fa48("1763", "1764", "1765"), authorization.status === (stryMutAct_9fa48("1766") ? "" : (stryCov_9fa48("1766"), "non-teacher")))) {
          if (stryMutAct_9fa48("1767")) {
            {}
          } else {
            stryCov_9fa48("1767");
            return errorResponse(stryMutAct_9fa48("1768") ? "" : (stryCov_9fa48("1768"), "FORBIDDEN"), 403);
          }
        }
        if (stryMutAct_9fa48("1771") ? authorization.status !== "profile-unavailable" : stryMutAct_9fa48("1770") ? false : stryMutAct_9fa48("1769") ? true : (stryCov_9fa48("1769", "1770", "1771"), authorization.status === (stryMutAct_9fa48("1772") ? "" : (stryCov_9fa48("1772"), "profile-unavailable")))) {
          if (stryMutAct_9fa48("1773")) {
            {}
          } else {
            stryCov_9fa48("1773");
            return errorResponse(stryMutAct_9fa48("1774") ? "" : (stryCov_9fa48("1774"), "FORBIDDEN"), 403, stryMutAct_9fa48("1775") ? "" : (stryCov_9fa48("1775"), "Nie można potwierdzić uprawnień nauczyciela."));
          }
        }
        if (stryMutAct_9fa48("1778") ? !providerConfig.apiKey && !providerConfig.model : stryMutAct_9fa48("1777") ? false : stryMutAct_9fa48("1776") ? true : (stryCov_9fa48("1776", "1777", "1778"), (stryMutAct_9fa48("1779") ? providerConfig.apiKey : (stryCov_9fa48("1779"), !providerConfig.apiKey)) || (stryMutAct_9fa48("1780") ? providerConfig.model : (stryCov_9fa48("1780"), !providerConfig.model)))) {
          if (stryMutAct_9fa48("1781")) {
            {}
          } else {
            stryCov_9fa48("1781");
            return errorResponse(stryMutAct_9fa48("1782") ? "" : (stryCov_9fa48("1782"), "PROVIDER_NOT_CONFIGURED"), 503);
          }
        }
        try {
          if (stryMutAct_9fa48("1783")) {
            {}
          } else {
            stryCov_9fa48("1783");
            const candidates = await generate(parsedRequest.data, stryMutAct_9fa48("1784") ? {} : (stryCov_9fa48("1784"), {
              apiKey: providerConfig.apiKey,
              model: providerConfig.model
            }));
            if (stryMutAct_9fa48("1787") ? candidates.length < 1 && candidates.length > 5 : stryMutAct_9fa48("1786") ? false : stryMutAct_9fa48("1785") ? true : (stryCov_9fa48("1785", "1786", "1787"), (stryMutAct_9fa48("1790") ? candidates.length >= 1 : stryMutAct_9fa48("1789") ? candidates.length <= 1 : stryMutAct_9fa48("1788") ? false : (stryCov_9fa48("1788", "1789", "1790"), candidates.length < 1)) || (stryMutAct_9fa48("1793") ? candidates.length <= 5 : stryMutAct_9fa48("1792") ? candidates.length >= 5 : stryMutAct_9fa48("1791") ? false : (stryCov_9fa48("1791", "1792", "1793"), candidates.length > 5)))) {
              if (stryMutAct_9fa48("1794")) {
                {}
              } else {
                stryCov_9fa48("1794");
                return errorResponse(stryMutAct_9fa48("1795") ? "" : (stryCov_9fa48("1795"), "PROVIDER_FAILURE"), 502);
              }
            }
            const validCount = candidates.length as 1 | 2 | 3 | 4 | 5;
            const response: ExerciseGenerationSuccess = stryMutAct_9fa48("1796") ? {} : (stryCov_9fa48("1796"), {
              requestedCount: 5,
              validCount,
              candidates,
              ...((stryMutAct_9fa48("1800") ? validCount >= 5 : stryMutAct_9fa48("1799") ? validCount <= 5 : stryMutAct_9fa48("1798") ? false : stryMutAct_9fa48("1797") ? true : (stryCov_9fa48("1797", "1798", "1799", "1800"), validCount < 5)) ? stryMutAct_9fa48("1801") ? {} : (stryCov_9fa48("1801"), {
                partial_batch: true as const
              }) : {})
            });
            return jsonResponse(response, 200);
          }
        } catch (error) {
          if (stryMutAct_9fa48("1802")) {
            {}
          } else {
            stryCov_9fa48("1802");
            if (stryMutAct_9fa48("1805") ? error instanceof OpenRouterExerciseGeneratorError || error.code === "PROVIDER_TIMEOUT" : stryMutAct_9fa48("1804") ? false : stryMutAct_9fa48("1803") ? true : (stryCov_9fa48("1803", "1804", "1805"), error instanceof OpenRouterExerciseGeneratorError && (stryMutAct_9fa48("1807") ? error.code !== "PROVIDER_TIMEOUT" : stryMutAct_9fa48("1806") ? true : (stryCov_9fa48("1806", "1807"), error.code === (stryMutAct_9fa48("1808") ? "" : (stryCov_9fa48("1808"), "PROVIDER_TIMEOUT")))))) {
              if (stryMutAct_9fa48("1809")) {
                {}
              } else {
                stryCov_9fa48("1809");
                return errorResponse(stryMutAct_9fa48("1810") ? "" : (stryCov_9fa48("1810"), "PROVIDER_TIMEOUT"), 504);
              }
            }
            return errorResponse(stryMutAct_9fa48("1811") ? "" : (stryCov_9fa48("1811"), "PROVIDER_FAILURE"), 502);
          }
        }
      }
    };
  }
}
export const POST = createExerciseRequestHandler();