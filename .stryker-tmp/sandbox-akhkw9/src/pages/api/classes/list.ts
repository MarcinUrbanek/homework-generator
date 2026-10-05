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
import { z } from "zod";
import { classApiErrorSchema, classSummarySchema } from "@/lib/classes/schemas";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, ListClassesSuccess } from "@/types";
export const prerender = stryMutAct_9fa48("1545") ? true : (stryCov_9fa48("1545"), false);
const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = stryMutAct_9fa48("1546") ? {} : (stryCov_9fa48("1546"), {
  INVALID_REQUEST: stryMutAct_9fa48("1547") ? "" : (stryCov_9fa48("1547"), "Nieprawidłowe dane żądania."),
  UNAUTHENTICATED: stryMutAct_9fa48("1548") ? "" : (stryCov_9fa48("1548"), "Zaloguj się, aby zobaczyć klasy."),
  FORBIDDEN: stryMutAct_9fa48("1549") ? "" : (stryCov_9fa48("1549"), "Lista klas jest dostępna tylko dla nauczycieli."),
  DATABASE_UNAVAILABLE: stryMutAct_9fa48("1550") ? "" : (stryCov_9fa48("1550"), "Baza danych jest chwilowo niedostępna."),
  PERSISTENCE_FAILURE: stryMutAct_9fa48("1551") ? "" : (stryCov_9fa48("1551"), "Nie udało się pobrać klas. Spróbuj ponownie później."),
  SERVICE_UNAVAILABLE: stryMutAct_9fa48("1552") ? "" : (stryCov_9fa48("1552"), "Usługa zaproszeń jest chwilowo niedostępna.")
});
type RequestClient = NonNullable<ReturnType<typeof createClient>>;
const listClassesResultSchema = z.array(z.object(stryMutAct_9fa48("1553") ? {} : (stryCov_9fa48("1553"), {
  id: z.uuid(),
  name: z.string(),
  class_code: z.string().regex(stryMutAct_9fa48("1557") ? /^[^A-Z0-9]{8}$/ : stryMutAct_9fa48("1556") ? /^[A-Z0-9]$/ : stryMutAct_9fa48("1555") ? /^[A-Z0-9]{8}/ : stryMutAct_9fa48("1554") ? /[A-Z0-9]{8}$/ : (stryCov_9fa48("1554", "1555", "1556", "1557"), /^[A-Z0-9]{8}$/)),
  created_at: z.iso.datetime(stryMutAct_9fa48("1558") ? {} : (stryCov_9fa48("1558"), {
    offset: stryMutAct_9fa48("1559") ? false : (stryCov_9fa48("1559"), true)
  }))
})).strict());
const supabaseResponseSchema = z.object(stryMutAct_9fa48("1560") ? {} : (stryCov_9fa48("1560"), {
  data: z.unknown(),
  error: z.unknown().nullable()
}));
export interface ListClassesHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  listClasses?: (client: RequestClient) => Promise<unknown>;
}
function jsonResponse(body: ClassApiError | ListClassesSuccess, status: number): Response {
  if (stryMutAct_9fa48("1561")) {
    {}
  } else {
    stryCov_9fa48("1561");
    return new Response(JSON.stringify(body), stryMutAct_9fa48("1562") ? {} : (stryCov_9fa48("1562"), {
      headers: stryMutAct_9fa48("1563") ? {} : (stryCov_9fa48("1563"), {
        "Content-Type": stryMutAct_9fa48("1564") ? "" : (stryCov_9fa48("1564"), "application/json; charset=utf-8")
      }),
      status
    }));
  }
}
function errorResponse(code: ClassApiErrorCode, status: number): Response {
  if (stryMutAct_9fa48("1565")) {
    {}
  } else {
    stryCov_9fa48("1565");
    return jsonResponse(classApiErrorSchema.parse(stryMutAct_9fa48("1566") ? {} : (stryCov_9fa48("1566"), {
      error: stryMutAct_9fa48("1567") ? {} : (stryCov_9fa48("1567"), {
        code,
        message: ERROR_MESSAGES[code]
      })
    })), status);
  }
}
function supabaseError(error: unknown): Error {
  if (stryMutAct_9fa48("1568")) {
    {}
  } else {
    stryCov_9fa48("1568");
    return error instanceof Error ? error : new Error(stryMutAct_9fa48("1569") ? "" : (stryCov_9fa48("1569"), "Supabase request failed"));
  }
}
async function listClasses(client: RequestClient): Promise<unknown> {
  if (stryMutAct_9fa48("1570")) {
    {}
  } else {
    stryCov_9fa48("1570");
    const response: unknown = await client.from(stryMutAct_9fa48("1571") ? "" : (stryCov_9fa48("1571"), "classes")).select(stryMutAct_9fa48("1572") ? "" : (stryCov_9fa48("1572"), "id,name,class_code,created_at")).order(stryMutAct_9fa48("1573") ? "" : (stryCov_9fa48("1573"), "created_at"), stryMutAct_9fa48("1574") ? {} : (stryCov_9fa48("1574"), {
      ascending: stryMutAct_9fa48("1575") ? true : (stryCov_9fa48("1575"), false)
    }));
    const {
      data,
      error
    } = supabaseResponseSchema.parse(response);
    if (stryMutAct_9fa48("1577") ? false : stryMutAct_9fa48("1576") ? true : (stryCov_9fa48("1576", "1577"), error)) throw supabaseError(error);
    return data;
  }
}
export function createListClassesHandler(dependencies: ListClassesHandlerDependencies = {}): APIRoute {
  if (stryMutAct_9fa48("1578")) {
    {}
  } else {
    stryCov_9fa48("1578");
    const authorize = stryMutAct_9fa48("1579") ? dependencies.authorize && authorizeTeacher : (stryCov_9fa48("1579"), dependencies.authorize ?? authorizeTeacher);
    const createSupabaseClient = stryMutAct_9fa48("1580") ? dependencies.createSupabaseClient && createClient : (stryCov_9fa48("1580"), dependencies.createSupabaseClient ?? createClient);
    const list = stryMutAct_9fa48("1581") ? dependencies.listClasses && listClasses : (stryCov_9fa48("1581"), dependencies.listClasses ?? listClasses);
    return async context => {
      if (stryMutAct_9fa48("1582")) {
        {}
      } else {
        stryCov_9fa48("1582");
        const supabase = createSupabaseClient(context.request.headers, context.cookies);
        const authorization = await authorize(context.locals, supabase);
        if (stryMutAct_9fa48("1585") ? authorization.status !== "unauthenticated" : stryMutAct_9fa48("1584") ? false : stryMutAct_9fa48("1583") ? true : (stryCov_9fa48("1583", "1584", "1585"), authorization.status === (stryMutAct_9fa48("1586") ? "" : (stryCov_9fa48("1586"), "unauthenticated")))) return errorResponse(stryMutAct_9fa48("1587") ? "" : (stryCov_9fa48("1587"), "UNAUTHENTICATED"), 401);
        if (stryMutAct_9fa48("1590") ? authorization.status === "authorized-teacher" : stryMutAct_9fa48("1589") ? false : stryMutAct_9fa48("1588") ? true : (stryCov_9fa48("1588", "1589", "1590"), authorization.status !== (stryMutAct_9fa48("1591") ? "" : (stryCov_9fa48("1591"), "authorized-teacher")))) return errorResponse(stryMutAct_9fa48("1592") ? "" : (stryCov_9fa48("1592"), "FORBIDDEN"), 403);
        if (stryMutAct_9fa48("1595") ? false : stryMutAct_9fa48("1594") ? true : stryMutAct_9fa48("1593") ? supabase : (stryCov_9fa48("1593", "1594", "1595"), !supabase)) return errorResponse(stryMutAct_9fa48("1596") ? "" : (stryCov_9fa48("1596"), "DATABASE_UNAVAILABLE"), 503);
        try {
          if (stryMutAct_9fa48("1597")) {
            {}
          } else {
            stryCov_9fa48("1597");
            const rows = listClassesResultSchema.safeParse(await list(supabase));
            if (stryMutAct_9fa48("1600") ? false : stryMutAct_9fa48("1599") ? true : stryMutAct_9fa48("1598") ? rows.success : (stryCov_9fa48("1598", "1599", "1600"), !rows.success)) return errorResponse(stryMutAct_9fa48("1601") ? "" : (stryCov_9fa48("1601"), "PERSISTENCE_FAILURE"), 500);
            const classes = classSummarySchema.array().safeParse(rows.data.map(stryMutAct_9fa48("1602") ? () => undefined : (stryCov_9fa48("1602"), row => stryMutAct_9fa48("1603") ? {} : (stryCov_9fa48("1603"), {
              id: row.id,
              name: row.name,
              classCode: row.class_code,
              createdAt: row.created_at
            }))));
            if (stryMutAct_9fa48("1606") ? false : stryMutAct_9fa48("1605") ? true : stryMutAct_9fa48("1604") ? classes.success : (stryCov_9fa48("1604", "1605", "1606"), !classes.success)) return errorResponse(stryMutAct_9fa48("1607") ? "" : (stryCov_9fa48("1607"), "PERSISTENCE_FAILURE"), 500);
            return jsonResponse(stryMutAct_9fa48("1608") ? {} : (stryCov_9fa48("1608"), {
              classes: classes.data
            }), 200);
          }
        } catch {
          if (stryMutAct_9fa48("1609")) {
            {}
          } else {
            stryCov_9fa48("1609");
            return errorResponse(stryMutAct_9fa48("1610") ? "" : (stryCov_9fa48("1610"), "PERSISTENCE_FAILURE"), 500);
          }
        }
      }
    };
  }
}
export const GET = createListClassesHandler();