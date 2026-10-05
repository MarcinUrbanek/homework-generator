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
import { exerciseApprovalErrorSchema, exerciseApprovalRequestSchema, exerciseApprovalRpcRowSchema, exerciseApprovalSuccessSchema } from "@/lib/exercises/schemas";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { ExerciseApprovalError, ExerciseApprovalErrorCode, ExerciseApprovalSuccess } from "@/types";
export const prerender = stryMutAct_9fa48("1611") ? true : (stryCov_9fa48("1611"), false);
const ERROR_MESSAGES: Record<ExerciseApprovalErrorCode, string> = stryMutAct_9fa48("1612") ? {} : (stryCov_9fa48("1612"), {
  INVALID_REQUEST: stryMutAct_9fa48("1613") ? "" : (stryCov_9fa48("1613"), "Nieprawidłowe dane żądania zatwierdzenia."),
  UNAUTHENTICATED: stryMutAct_9fa48("1614") ? "" : (stryCov_9fa48("1614"), "Zaloguj się, aby zatwierdzić zadania."),
  FORBIDDEN: stryMutAct_9fa48("1615") ? "" : (stryCov_9fa48("1615"), "Zatwierdzanie zadań jest dostępne tylko dla nauczycieli."),
  INVALID_SELECTION: stryMutAct_9fa48("1616") ? "" : (stryCov_9fa48("1616"), "Wybrane zadania nie mogą zostać zatwierdzone."),
  DATABASE_UNAVAILABLE: stryMutAct_9fa48("1617") ? "" : (stryCov_9fa48("1617"), "Baza danych jest chwilowo niedostępna. Spróbuj ponownie później."),
  PERSISTENCE_FAILURE: stryMutAct_9fa48("1618") ? "" : (stryCov_9fa48("1618"), "Nie udało się zapisać zatwierdzonych zadań. Spróbuj ponownie później.")
});
type RequestClient = NonNullable<ReturnType<typeof createClient>>;
interface ApprovalFailure {
  code?: string;
}
export interface ExerciseApproveHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: (headers: Headers, cookies: Parameters<typeof createClient>[1]) => ReturnType<typeof createClient>;
  approve?: (client: RequestClient, verificationIds: string[]) => Promise<unknown>;
}
function jsonResponse(body: ExerciseApprovalError | ExerciseApprovalSuccess, status: number): Response {
  if (stryMutAct_9fa48("1619")) {
    {}
  } else {
    stryCov_9fa48("1619");
    return new Response(JSON.stringify(body), stryMutAct_9fa48("1620") ? {} : (stryCov_9fa48("1620"), {
      status,
      headers: stryMutAct_9fa48("1621") ? {} : (stryCov_9fa48("1621"), {
        "Content-Type": stryMutAct_9fa48("1622") ? "" : (stryCov_9fa48("1622"), "application/json; charset=utf-8")
      })
    }));
  }
}
function errorResponse(code: ExerciseApprovalErrorCode, status: number, message = ERROR_MESSAGES[code]): Response {
  if (stryMutAct_9fa48("1623")) {
    {}
  } else {
    stryCov_9fa48("1623");
    return jsonResponse(exerciseApprovalErrorSchema.parse(stryMutAct_9fa48("1624") ? {} : (stryCov_9fa48("1624"), {
      error: stryMutAct_9fa48("1625") ? {} : (stryCov_9fa48("1625"), {
        code,
        message
      })
    })), status);
  }
}
async function approveVerifiedExercises(client: RequestClient, verificationIds: string[]): Promise<unknown> {
  if (stryMutAct_9fa48("1626")) {
    {}
  } else {
    stryCov_9fa48("1626");
    const result = (await client.rpc("approve_verified_exercises", {
      verification_ids: verificationIds
    })) as {
      data: unknown;
      error: ApprovalFailure | null;
    };
    if (stryMutAct_9fa48("1628") ? false : stryMutAct_9fa48("1627") ? true : (stryCov_9fa48("1627", "1628"), result.error)) {
      if (stryMutAct_9fa48("1629")) {
        {}
      } else {
        stryCov_9fa48("1629");
        throw Object.assign(new Error(stryMutAct_9fa48("1630") ? "" : (stryCov_9fa48("1630"), "Exercise approval failed")), stryMutAct_9fa48("1631") ? {} : (stryCov_9fa48("1631"), {
          code: result.error.code
        }));
      }
    }
    return result.data;
  }
}
function isDatabaseUnavailable(error: ApprovalFailure): boolean {
  if (stryMutAct_9fa48("1632")) {
    {}
  } else {
    stryCov_9fa48("1632");
    return stryMutAct_9fa48("1635") ? error.code?.startsWith("08") === true && ["PGRST000", "PGRST001", "PGRST002"].includes(error.code ?? "") : stryMutAct_9fa48("1634") ? false : stryMutAct_9fa48("1633") ? true : (stryCov_9fa48("1633", "1634", "1635"), (stryMutAct_9fa48("1637") ? error.code?.startsWith("08") !== true : stryMutAct_9fa48("1636") ? false : (stryCov_9fa48("1636", "1637"), (stryMutAct_9fa48("1639") ? error.code.startsWith("08") : stryMutAct_9fa48("1638") ? error.code?.endsWith("08") : (stryCov_9fa48("1638", "1639"), error.code?.startsWith(stryMutAct_9fa48("1640") ? "" : (stryCov_9fa48("1640"), "08")))) === (stryMutAct_9fa48("1641") ? false : (stryCov_9fa48("1641"), true)))) || (stryMutAct_9fa48("1642") ? [] : (stryCov_9fa48("1642"), [stryMutAct_9fa48("1643") ? "" : (stryCov_9fa48("1643"), "PGRST000"), stryMutAct_9fa48("1644") ? "" : (stryCov_9fa48("1644"), "PGRST001"), stryMutAct_9fa48("1645") ? "" : (stryCov_9fa48("1645"), "PGRST002")])).includes(stryMutAct_9fa48("1646") ? error.code && "" : (stryCov_9fa48("1646"), error.code ?? (stryMutAct_9fa48("1647") ? "Stryker was here!" : (stryCov_9fa48("1647"), "")))));
  }
}
export function createExerciseApproveHandler(dependencies: ExerciseApproveHandlerDependencies = {}): APIRoute {
  if (stryMutAct_9fa48("1648")) {
    {}
  } else {
    stryCov_9fa48("1648");
    const authorize = stryMutAct_9fa48("1649") ? dependencies.authorize && authorizeTeacher : (stryCov_9fa48("1649"), dependencies.authorize ?? authorizeTeacher);
    const createSupabaseClient = stryMutAct_9fa48("1650") ? dependencies.createSupabaseClient && createClient : (stryCov_9fa48("1650"), dependencies.createSupabaseClient ?? createClient);
    const approve = stryMutAct_9fa48("1651") ? dependencies.approve && approveVerifiedExercises : (stryCov_9fa48("1651"), dependencies.approve ?? approveVerifiedExercises);
    return async context => {
      if (stryMutAct_9fa48("1652")) {
        {}
      } else {
        stryCov_9fa48("1652");
        let requestValue: unknown;
        try {
          if (stryMutAct_9fa48("1653")) {
            {}
          } else {
            stryCov_9fa48("1653");
            requestValue = await context.request.json();
          }
        } catch {
          if (stryMutAct_9fa48("1654")) {
            {}
          } else {
            stryCov_9fa48("1654");
            return errorResponse(stryMutAct_9fa48("1655") ? "" : (stryCov_9fa48("1655"), "INVALID_REQUEST"), 400);
          }
        }
        const parsedRequest = exerciseApprovalRequestSchema.safeParse(requestValue);
        if (stryMutAct_9fa48("1658") ? false : stryMutAct_9fa48("1657") ? true : stryMutAct_9fa48("1656") ? parsedRequest.success : (stryCov_9fa48("1656", "1657", "1658"), !parsedRequest.success)) {
          if (stryMutAct_9fa48("1659")) {
            {}
          } else {
            stryCov_9fa48("1659");
            return errorResponse(stryMutAct_9fa48("1660") ? "" : (stryCov_9fa48("1660"), "INVALID_REQUEST"), 400);
          }
        }
        const supabase = createSupabaseClient(context.request.headers, context.cookies);
        const authorization = await authorize(context.locals, supabase);
        if (stryMutAct_9fa48("1663") ? authorization.status !== "unauthenticated" : stryMutAct_9fa48("1662") ? false : stryMutAct_9fa48("1661") ? true : (stryCov_9fa48("1661", "1662", "1663"), authorization.status === (stryMutAct_9fa48("1664") ? "" : (stryCov_9fa48("1664"), "unauthenticated")))) {
          if (stryMutAct_9fa48("1665")) {
            {}
          } else {
            stryCov_9fa48("1665");
            return errorResponse(stryMutAct_9fa48("1666") ? "" : (stryCov_9fa48("1666"), "UNAUTHENTICATED"), 401);
          }
        }
        if (stryMutAct_9fa48("1669") ? authorization.status !== "non-teacher" : stryMutAct_9fa48("1668") ? false : stryMutAct_9fa48("1667") ? true : (stryCov_9fa48("1667", "1668", "1669"), authorization.status === (stryMutAct_9fa48("1670") ? "" : (stryCov_9fa48("1670"), "non-teacher")))) {
          if (stryMutAct_9fa48("1671")) {
            {}
          } else {
            stryCov_9fa48("1671");
            return errorResponse(stryMutAct_9fa48("1672") ? "" : (stryCov_9fa48("1672"), "FORBIDDEN"), 403);
          }
        }
        if (stryMutAct_9fa48("1675") ? authorization.status !== "profile-unavailable" : stryMutAct_9fa48("1674") ? false : stryMutAct_9fa48("1673") ? true : (stryCov_9fa48("1673", "1674", "1675"), authorization.status === (stryMutAct_9fa48("1676") ? "" : (stryCov_9fa48("1676"), "profile-unavailable")))) {
          if (stryMutAct_9fa48("1677")) {
            {}
          } else {
            stryCov_9fa48("1677");
            return errorResponse(stryMutAct_9fa48("1678") ? "" : (stryCov_9fa48("1678"), "FORBIDDEN"), 403, stryMutAct_9fa48("1679") ? "" : (stryCov_9fa48("1679"), "Nie można potwierdzić uprawnień nauczyciela."));
          }
        }
        if (stryMutAct_9fa48("1682") ? false : stryMutAct_9fa48("1681") ? true : stryMutAct_9fa48("1680") ? supabase : (stryCov_9fa48("1680", "1681", "1682"), !supabase)) {
          if (stryMutAct_9fa48("1683")) {
            {}
          } else {
            stryCov_9fa48("1683");
            return errorResponse(stryMutAct_9fa48("1684") ? "" : (stryCov_9fa48("1684"), "DATABASE_UNAVAILABLE"), 503);
          }
        }
        try {
          if (stryMutAct_9fa48("1685")) {
            {}
          } else {
            stryCov_9fa48("1685");
            const rpcRows = exerciseApprovalRpcRowSchema.array().parse(await approve(supabase, parsedRequest.data.verificationIds));
            if (stryMutAct_9fa48("1688") ? rpcRows.length !== parsedRequest.data.verificationIds.length && rpcRows.some((row, index) => row.verification_id !== parsedRequest.data.verificationIds[index]) : stryMutAct_9fa48("1687") ? false : stryMutAct_9fa48("1686") ? true : (stryCov_9fa48("1686", "1687", "1688"), (stryMutAct_9fa48("1690") ? rpcRows.length === parsedRequest.data.verificationIds.length : stryMutAct_9fa48("1689") ? false : (stryCov_9fa48("1689", "1690"), rpcRows.length !== parsedRequest.data.verificationIds.length)) || (stryMutAct_9fa48("1691") ? rpcRows.every((row, index) => row.verification_id !== parsedRequest.data.verificationIds[index]) : (stryCov_9fa48("1691"), rpcRows.some(stryMutAct_9fa48("1692") ? () => undefined : (stryCov_9fa48("1692"), (row, index) => stryMutAct_9fa48("1695") ? row.verification_id === parsedRequest.data.verificationIds[index] : stryMutAct_9fa48("1694") ? false : stryMutAct_9fa48("1693") ? true : (stryCov_9fa48("1693", "1694", "1695"), row.verification_id !== parsedRequest.data.verificationIds[index]))))))) {
              if (stryMutAct_9fa48("1696")) {
                {}
              } else {
                stryCov_9fa48("1696");
                return errorResponse(stryMutAct_9fa48("1697") ? "" : (stryCov_9fa48("1697"), "PERSISTENCE_FAILURE"), 500);
              }
            }
            const response = exerciseApprovalSuccessSchema.parse(stryMutAct_9fa48("1698") ? {} : (stryCov_9fa48("1698"), {
              mappings: rpcRows.map(stryMutAct_9fa48("1699") ? () => undefined : (stryCov_9fa48("1699"), row => stryMutAct_9fa48("1700") ? {} : (stryCov_9fa48("1700"), {
                verificationId: row.verification_id,
                exerciseId: row.exercise_id,
                created: row.created
              })))
            }));
            return jsonResponse(response, 200);
          }
        } catch (error) {
          if (stryMutAct_9fa48("1701")) {
            {}
          } else {
            stryCov_9fa48("1701");
            const failure = (stryMutAct_9fa48("1704") ? typeof error === "object" || error !== null : stryMutAct_9fa48("1703") ? false : stryMutAct_9fa48("1702") ? true : (stryCov_9fa48("1702", "1703", "1704"), (stryMutAct_9fa48("1706") ? typeof error !== "object" : stryMutAct_9fa48("1705") ? true : (stryCov_9fa48("1705", "1706"), typeof error === (stryMutAct_9fa48("1707") ? "" : (stryCov_9fa48("1707"), "object")))) && (stryMutAct_9fa48("1709") ? error === null : stryMutAct_9fa48("1708") ? true : (stryCov_9fa48("1708", "1709"), error !== null)))) ? error as ApprovalFailure : {};
            if (stryMutAct_9fa48("1712") ? failure.code !== "22023" : stryMutAct_9fa48("1711") ? false : stryMutAct_9fa48("1710") ? true : (stryCov_9fa48("1710", "1711", "1712"), failure.code === (stryMutAct_9fa48("1713") ? "" : (stryCov_9fa48("1713"), "22023")))) {
              if (stryMutAct_9fa48("1714")) {
                {}
              } else {
                stryCov_9fa48("1714");
                return errorResponse(stryMutAct_9fa48("1715") ? "" : (stryCov_9fa48("1715"), "INVALID_SELECTION"), 422);
              }
            }
            if (stryMutAct_9fa48("1718") ? failure.code !== "42501" : stryMutAct_9fa48("1717") ? false : stryMutAct_9fa48("1716") ? true : (stryCov_9fa48("1716", "1717", "1718"), failure.code === (stryMutAct_9fa48("1719") ? "" : (stryCov_9fa48("1719"), "42501")))) {
              if (stryMutAct_9fa48("1720")) {
                {}
              } else {
                stryCov_9fa48("1720");
                return errorResponse(stryMutAct_9fa48("1721") ? "" : (stryCov_9fa48("1721"), "FORBIDDEN"), 403);
              }
            }
            if (stryMutAct_9fa48("1723") ? false : stryMutAct_9fa48("1722") ? true : (stryCov_9fa48("1722", "1723"), isDatabaseUnavailable(failure))) {
              if (stryMutAct_9fa48("1724")) {
                {}
              } else {
                stryCov_9fa48("1724");
                return errorResponse(stryMutAct_9fa48("1725") ? "" : (stryCov_9fa48("1725"), "DATABASE_UNAVAILABLE"), 503);
              }
            }
            return errorResponse(stryMutAct_9fa48("1726") ? "" : (stryCov_9fa48("1726"), "PERSISTENCE_FAILURE"), 500);
          }
        }
      }
    };
  }
}
export const POST = createExerciseApproveHandler();