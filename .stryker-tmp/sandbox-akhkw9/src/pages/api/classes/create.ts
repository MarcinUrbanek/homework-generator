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
import { classApiErrorSchema, classSummarySchema, createClassRequestSchema } from "@/lib/classes/schemas";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, CreateClassSuccess } from "@/types";
export const prerender = stryMutAct_9fa48("1365") ? true : (stryCov_9fa48("1365"), false);
const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = stryMutAct_9fa48("1366") ? {} : (stryCov_9fa48("1366"), {
  INVALID_REQUEST: stryMutAct_9fa48("1367") ? "" : (stryCov_9fa48("1367"), "Nieprawidłowa nazwa klasy."),
  UNAUTHENTICATED: stryMutAct_9fa48("1368") ? "" : (stryCov_9fa48("1368"), "Zaloguj się, aby utworzyć klasę."),
  FORBIDDEN: stryMutAct_9fa48("1369") ? "" : (stryCov_9fa48("1369"), "Tworzenie klas jest dostępne tylko dla nauczycieli."),
  DATABASE_UNAVAILABLE: stryMutAct_9fa48("1370") ? "" : (stryCov_9fa48("1370"), "Baza danych jest chwilowo niedostępna."),
  PERSISTENCE_FAILURE: stryMutAct_9fa48("1371") ? "" : (stryCov_9fa48("1371"), "Nie udało się utworzyć klasy. Spróbuj ponownie później."),
  SERVICE_UNAVAILABLE: stryMutAct_9fa48("1372") ? "" : (stryCov_9fa48("1372"), "Usługa zaproszeń jest chwilowo niedostępna.")
});
type RequestClient = NonNullable<ReturnType<typeof createClient>>;
const createClassResultSchema = z.array(z.object(stryMutAct_9fa48("1373") ? {} : (stryCov_9fa48("1373"), {
  class_id: z.uuid(),
  class_code: z.string().regex(stryMutAct_9fa48("1377") ? /^[^A-Z0-9]{8}$/ : stryMutAct_9fa48("1376") ? /^[A-Z0-9]$/ : stryMutAct_9fa48("1375") ? /^[A-Z0-9]{8}/ : stryMutAct_9fa48("1374") ? /[A-Z0-9]{8}$/ : (stryCov_9fa48("1374", "1375", "1376", "1377"), /^[A-Z0-9]{8}$/))
})).strict());
const supabaseResponseSchema = z.object(stryMutAct_9fa48("1378") ? {} : (stryCov_9fa48("1378"), {
  data: z.unknown(),
  error: z.unknown().nullable()
}));
export interface CreateClassHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  createClass?: (client: RequestClient, name: string) => Promise<unknown>;
}
function jsonResponse(body: ClassApiError | CreateClassSuccess, status: number): Response {
  if (stryMutAct_9fa48("1379")) {
    {}
  } else {
    stryCov_9fa48("1379");
    return new Response(JSON.stringify(body), stryMutAct_9fa48("1380") ? {} : (stryCov_9fa48("1380"), {
      headers: stryMutAct_9fa48("1381") ? {} : (stryCov_9fa48("1381"), {
        "Content-Type": stryMutAct_9fa48("1382") ? "" : (stryCov_9fa48("1382"), "application/json; charset=utf-8")
      }),
      status
    }));
  }
}
function errorResponse(code: ClassApiErrorCode, status: number, message = ERROR_MESSAGES[code]): Response {
  if (stryMutAct_9fa48("1383")) {
    {}
  } else {
    stryCov_9fa48("1383");
    return jsonResponse(classApiErrorSchema.parse(stryMutAct_9fa48("1384") ? {} : (stryCov_9fa48("1384"), {
      error: stryMutAct_9fa48("1385") ? {} : (stryCov_9fa48("1385"), {
        code,
        message
      })
    })), status);
  }
}
function supabaseError(error: unknown): Error {
  if (stryMutAct_9fa48("1386")) {
    {}
  } else {
    stryCov_9fa48("1386");
    return error instanceof Error ? error : new Error(stryMutAct_9fa48("1387") ? "" : (stryCov_9fa48("1387"), "Supabase request failed"));
  }
}
async function createClass(client: RequestClient, name: string): Promise<unknown> {
  if (stryMutAct_9fa48("1388")) {
    {}
  } else {
    stryCov_9fa48("1388");
    const response: unknown = await client.rpc(stryMutAct_9fa48("1389") ? "" : (stryCov_9fa48("1389"), "create_class"), stryMutAct_9fa48("1390") ? {} : (stryCov_9fa48("1390"), {
      p_name: name
    }));
    const {
      data,
      error
    } = supabaseResponseSchema.parse(response);
    if (stryMutAct_9fa48("1392") ? false : stryMutAct_9fa48("1391") ? true : (stryCov_9fa48("1391", "1392"), error)) {
      if (stryMutAct_9fa48("1393")) {
        {}
      } else {
        stryCov_9fa48("1393");
        throw supabaseError(error);
      }
    }
    return data;
  }
}
export function createCreateClassHandler(dependencies: CreateClassHandlerDependencies = {}): APIRoute {
  if (stryMutAct_9fa48("1394")) {
    {}
  } else {
    stryCov_9fa48("1394");
    const authorize = stryMutAct_9fa48("1395") ? dependencies.authorize && authorizeTeacher : (stryCov_9fa48("1395"), dependencies.authorize ?? authorizeTeacher);
    const createSupabaseClient = stryMutAct_9fa48("1396") ? dependencies.createSupabaseClient && createClient : (stryCov_9fa48("1396"), dependencies.createSupabaseClient ?? createClient);
    const create = stryMutAct_9fa48("1397") ? dependencies.createClass && createClass : (stryCov_9fa48("1397"), dependencies.createClass ?? createClass);
    return async context => {
      if (stryMutAct_9fa48("1398")) {
        {}
      } else {
        stryCov_9fa48("1398");
        let value: unknown;
        try {
          if (stryMutAct_9fa48("1399")) {
            {}
          } else {
            stryCov_9fa48("1399");
            value = await context.request.json();
          }
        } catch {
          if (stryMutAct_9fa48("1400")) {
            {}
          } else {
            stryCov_9fa48("1400");
            return errorResponse(stryMutAct_9fa48("1401") ? "" : (stryCov_9fa48("1401"), "INVALID_REQUEST"), 400);
          }
        }
        const parsed = createClassRequestSchema.safeParse(value);
        if (stryMutAct_9fa48("1404") ? false : stryMutAct_9fa48("1403") ? true : stryMutAct_9fa48("1402") ? parsed.success : (stryCov_9fa48("1402", "1403", "1404"), !parsed.success)) {
          if (stryMutAct_9fa48("1405")) {
            {}
          } else {
            stryCov_9fa48("1405");
            return errorResponse(stryMutAct_9fa48("1406") ? "" : (stryCov_9fa48("1406"), "INVALID_REQUEST"), 400);
          }
        }
        const supabase = createSupabaseClient(context.request.headers, context.cookies);
        const authorization = await authorize(context.locals, supabase);
        if (stryMutAct_9fa48("1409") ? authorization.status !== "unauthenticated" : stryMutAct_9fa48("1408") ? false : stryMutAct_9fa48("1407") ? true : (stryCov_9fa48("1407", "1408", "1409"), authorization.status === (stryMutAct_9fa48("1410") ? "" : (stryCov_9fa48("1410"), "unauthenticated")))) return errorResponse(stryMutAct_9fa48("1411") ? "" : (stryCov_9fa48("1411"), "UNAUTHENTICATED"), 401);
        if (stryMutAct_9fa48("1414") ? authorization.status === "authorized-teacher" : stryMutAct_9fa48("1413") ? false : stryMutAct_9fa48("1412") ? true : (stryCov_9fa48("1412", "1413", "1414"), authorization.status !== (stryMutAct_9fa48("1415") ? "" : (stryCov_9fa48("1415"), "authorized-teacher")))) return errorResponse(stryMutAct_9fa48("1416") ? "" : (stryCov_9fa48("1416"), "FORBIDDEN"), 403);
        if (stryMutAct_9fa48("1419") ? false : stryMutAct_9fa48("1418") ? true : stryMutAct_9fa48("1417") ? supabase : (stryCov_9fa48("1417", "1418", "1419"), !supabase)) return errorResponse(stryMutAct_9fa48("1420") ? "" : (stryCov_9fa48("1420"), "DATABASE_UNAVAILABLE"), 503);
        try {
          if (stryMutAct_9fa48("1421")) {
            {}
          } else {
            stryCov_9fa48("1421");
            const rows = createClassResultSchema.safeParse(await create(supabase, parsed.data.name));
            const row = rows.success ? rows.data[0] : null;
            const result = classSummarySchema.safeParse(stryMutAct_9fa48("1424") ? row || {
              id: row.class_id,
              name: parsed.data.name,
              classCode: row.class_code,
              createdAt: new Date().toISOString()
            } : stryMutAct_9fa48("1423") ? false : stryMutAct_9fa48("1422") ? true : (stryCov_9fa48("1422", "1423", "1424"), row && (stryMutAct_9fa48("1425") ? {} : (stryCov_9fa48("1425"), {
              id: row.class_id,
              name: parsed.data.name,
              classCode: row.class_code,
              createdAt: new Date().toISOString()
            }))));
            if (stryMutAct_9fa48("1428") ? false : stryMutAct_9fa48("1427") ? true : stryMutAct_9fa48("1426") ? result.success : (stryCov_9fa48("1426", "1427", "1428"), !result.success)) return errorResponse(stryMutAct_9fa48("1429") ? "" : (stryCov_9fa48("1429"), "PERSISTENCE_FAILURE"), 500);
            return jsonResponse(stryMutAct_9fa48("1430") ? {} : (stryCov_9fa48("1430"), {
              class: result.data
            }), 201);
          }
        } catch {
          if (stryMutAct_9fa48("1431")) {
            {}
          } else {
            stryCov_9fa48("1431");
            return errorResponse(stryMutAct_9fa48("1432") ? "" : (stryCov_9fa48("1432"), "PERSISTENCE_FAILURE"), 500);
          }
        }
      }
    };
  }
}
export const POST = createCreateClassHandler();