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
import { PUBLIC_APP_ORIGIN, RESEND_API_KEY, RESEND_FROM_EMAIL } from "astro:env/server";
import { z } from "zod";
import { classApiErrorSchema, inviteStudentsRequestSchema } from "@/lib/classes/schemas";
import { ClassInvitationOwnershipError, deliverClassInvitations, type ClassInvitationPersistence } from "@/lib/services/class-invitations";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient, createServiceClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, InviteStudentsSuccess } from "@/types";
export const prerender = stryMutAct_9fa48("1433") ? true : (stryCov_9fa48("1433"), false);
const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = stryMutAct_9fa48("1434") ? {} : (stryCov_9fa48("1434"), {
  INVALID_REQUEST: stryMutAct_9fa48("1435") ? "" : (stryCov_9fa48("1435"), "Nieprawidłowa lista adresów e-mail."),
  UNAUTHENTICATED: stryMutAct_9fa48("1436") ? "" : (stryCov_9fa48("1436"), "Zaloguj się, aby wysłać zaproszenia."),
  FORBIDDEN: stryMutAct_9fa48("1437") ? "" : (stryCov_9fa48("1437"), "Zaproszenia są dostępne tylko dla właściciela klasy."),
  DATABASE_UNAVAILABLE: stryMutAct_9fa48("1438") ? "" : (stryCov_9fa48("1438"), "Baza danych jest chwilowo niedostępna."),
  PERSISTENCE_FAILURE: stryMutAct_9fa48("1439") ? "" : (stryCov_9fa48("1439"), "Nie udało się przygotować zaproszeń. Spróbuj ponownie później."),
  SERVICE_UNAVAILABLE: stryMutAct_9fa48("1440") ? "" : (stryCov_9fa48("1440"), "Usługa wysyłki zaproszeń nie jest skonfigurowana.")
});
type RequestClient = NonNullable<ReturnType<typeof createClient>>;
type WriterClient = NonNullable<ReturnType<typeof createServiceClient>>;
const supabaseResponseSchema = z.object(stryMutAct_9fa48("1441") ? {} : (stryCov_9fa48("1441"), {
  data: z.unknown(),
  error: z.unknown().nullable()
}));
const preparedInvitationSchema = z.object(stryMutAct_9fa48("1442") ? {} : (stryCov_9fa48("1442"), {
  recipient_email: z.string(),
  invitation_id: z.string(),
  preparation: z.enum(stryMutAct_9fa48("1443") ? [] : (stryCov_9fa48("1443"), [stryMutAct_9fa48("1444") ? "" : (stryCov_9fa48("1444"), "created"), stryMutAct_9fa48("1445") ? "" : (stryCov_9fa48("1445"), "refreshed")]))
})).strict();
const preparedInvitationsSchema = z.array(preparedInvitationSchema);
export interface InviteStudentsHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  createWriterClient?: typeof createServiceClient;
  deliver?: typeof deliverClassInvitations;
  providerConfig?: {
    apiKey?: string;
    fromEmail?: string;
    appOrigin?: string;
  };
  createPersistence?: (requestClient: RequestClient, writerClient: WriterClient) => ClassInvitationPersistence;
}
function jsonResponse(body: ClassApiError | InviteStudentsSuccess, status: number): Response {
  if (stryMutAct_9fa48("1446")) {
    {}
  } else {
    stryCov_9fa48("1446");
    return new Response(JSON.stringify(body), stryMutAct_9fa48("1447") ? {} : (stryCov_9fa48("1447"), {
      headers: stryMutAct_9fa48("1448") ? {} : (stryCov_9fa48("1448"), {
        "Content-Type": stryMutAct_9fa48("1449") ? "" : (stryCov_9fa48("1449"), "application/json; charset=utf-8")
      }),
      status
    }));
  }
}
function errorResponse(code: ClassApiErrorCode, status: number): Response {
  if (stryMutAct_9fa48("1450")) {
    {}
  } else {
    stryCov_9fa48("1450");
    return jsonResponse(classApiErrorSchema.parse(stryMutAct_9fa48("1451") ? {} : (stryCov_9fa48("1451"), {
      error: stryMutAct_9fa48("1452") ? {} : (stryCov_9fa48("1452"), {
        code,
        message: ERROR_MESSAGES[code]
      })
    })), status);
  }
}
function environmentValue(value: unknown): string | undefined {
  if (stryMutAct_9fa48("1453")) {
    {}
  } else {
    stryCov_9fa48("1453");
    return (stryMutAct_9fa48("1456") ? typeof value !== "string" : stryMutAct_9fa48("1455") ? false : stryMutAct_9fa48("1454") ? true : (stryCov_9fa48("1454", "1455", "1456"), typeof value === (stryMutAct_9fa48("1457") ? "" : (stryCov_9fa48("1457"), "string")))) ? value : undefined;
  }
}
function supabaseError(error: unknown): Error {
  if (stryMutAct_9fa48("1458")) {
    {}
  } else {
    stryCov_9fa48("1458");
    return error instanceof Error ? error : new Error(stryMutAct_9fa48("1459") ? "" : (stryCov_9fa48("1459"), "Supabase request failed"));
  }
}
function createPersistence(requestClient: RequestClient, writerClient: WriterClient): ClassInvitationPersistence {
  if (stryMutAct_9fa48("1460")) {
    {}
  } else {
    stryCov_9fa48("1460");
    return stryMutAct_9fa48("1461") ? {} : (stryCov_9fa48("1461"), {
      async loadClassName(classId) {
        if (stryMutAct_9fa48("1462")) {
          {}
        } else {
          stryCov_9fa48("1462");
          const response: unknown = await requestClient.from(stryMutAct_9fa48("1463") ? "" : (stryCov_9fa48("1463"), "classes")).select(stryMutAct_9fa48("1464") ? "" : (stryCov_9fa48("1464"), "name")).eq(stryMutAct_9fa48("1465") ? "" : (stryCov_9fa48("1465"), "id"), classId).maybeSingle();
          const {
            data,
            error
          } = supabaseResponseSchema.parse(response);
          if (stryMutAct_9fa48("1467") ? false : stryMutAct_9fa48("1466") ? true : (stryCov_9fa48("1466", "1467"), error)) throw supabaseError(error);
          const result = z.object(stryMutAct_9fa48("1468") ? {} : (stryCov_9fa48("1468"), {
            name: z.string()
          })).nullable().safeParse(data);
          return result.success ? stryMutAct_9fa48("1469") ? result.data?.name && null : (stryCov_9fa48("1469"), (stryMutAct_9fa48("1470") ? result.data.name : (stryCov_9fa48("1470"), result.data?.name)) ?? null) : null;
        }
      },
      async prepare(classId, emails, tokenDigests) {
        if (stryMutAct_9fa48("1471")) {
          {}
        } else {
          stryCov_9fa48("1471");
          const response: unknown = await requestClient.rpc(stryMutAct_9fa48("1472") ? "" : (stryCov_9fa48("1472"), "prepare_class_invitations"), stryMutAct_9fa48("1473") ? {} : (stryCov_9fa48("1473"), {
            p_class_id: classId,
            p_emails: emails,
            p_token_digests: tokenDigests
          }));
          const {
            data,
            error
          } = supabaseResponseSchema.parse(response);
          const prepared = preparedInvitationsSchema.safeParse(data);
          if (stryMutAct_9fa48("1475") ? false : stryMutAct_9fa48("1474") ? true : (stryCov_9fa48("1474", "1475"), error)) throw supabaseError(error);
          if (stryMutAct_9fa48("1478") ? false : stryMutAct_9fa48("1477") ? true : stryMutAct_9fa48("1476") ? prepared.success : (stryCov_9fa48("1476", "1477", "1478"), !prepared.success)) throw new Error(stryMutAct_9fa48("1480") ? "" : (stryCov_9fa48("1480"), "Invalid invitation preparation result"));
          return prepared.data.map(stryMutAct_9fa48("1481") ? () => undefined : (stryCov_9fa48("1481"), row => stryMutAct_9fa48("1482") ? {} : (stryCov_9fa48("1482"), {
            recipientEmail: row.recipient_email,
            invitationId: row.invitation_id,
            preparation: row.preparation
          })));
        }
      },
      async recordDelivery(invitationId, tokenDigest, deliveryState, providerMessageId) {
        if (stryMutAct_9fa48("1483")) {
          {}
        } else {
          stryCov_9fa48("1483");
          const response: unknown = await writerClient.rpc(stryMutAct_9fa48("1484") ? "" : (stryCov_9fa48("1484"), "record_class_invitation_delivery"), stryMutAct_9fa48("1485") ? {} : (stryCov_9fa48("1485"), {
            p_invitation_id: invitationId,
            p_token_digest: tokenDigest,
            p_delivery_state: deliveryState,
            p_provider_message_id: stryMutAct_9fa48("1486") ? providerMessageId && null : (stryCov_9fa48("1486"), providerMessageId ?? null)
          }));
          const {
            data,
            error
          } = supabaseResponseSchema.parse(response);
          const recorded = z.boolean().safeParse(data);
          if (stryMutAct_9fa48("1488") ? false : stryMutAct_9fa48("1487") ? true : (stryCov_9fa48("1487", "1488"), error)) throw supabaseError(error);
          if (stryMutAct_9fa48("1491") ? false : stryMutAct_9fa48("1490") ? true : stryMutAct_9fa48("1489") ? recorded.success : (stryCov_9fa48("1489", "1490", "1491"), !recorded.success)) throw new Error(stryMutAct_9fa48("1493") ? "" : (stryCov_9fa48("1493"), "Invalid delivery record result"));
          return recorded.data;
        }
      }
    });
  }
}
export function createInviteStudentsHandler(dependencies: InviteStudentsHandlerDependencies = {}): APIRoute {
  if (stryMutAct_9fa48("1494")) {
    {}
  } else {
    stryCov_9fa48("1494");
    const authorize = stryMutAct_9fa48("1495") ? dependencies.authorize && authorizeTeacher : (stryCov_9fa48("1495"), dependencies.authorize ?? authorizeTeacher);
    const createSupabaseClient = stryMutAct_9fa48("1496") ? dependencies.createSupabaseClient && createClient : (stryCov_9fa48("1496"), dependencies.createSupabaseClient ?? createClient);
    const createWriterClient = stryMutAct_9fa48("1497") ? dependencies.createWriterClient && createServiceClient : (stryCov_9fa48("1497"), dependencies.createWriterClient ?? createServiceClient);
    const deliver = stryMutAct_9fa48("1498") ? dependencies.deliver && deliverClassInvitations : (stryCov_9fa48("1498"), dependencies.deliver ?? deliverClassInvitations);
    const providerConfig = stryMutAct_9fa48("1499") ? dependencies.providerConfig && {
      apiKey: environmentValue(RESEND_API_KEY),
      fromEmail: environmentValue(RESEND_FROM_EMAIL),
      appOrigin: environmentValue(PUBLIC_APP_ORIGIN)
    } : (stryCov_9fa48("1499"), dependencies.providerConfig ?? (stryMutAct_9fa48("1500") ? {} : (stryCov_9fa48("1500"), {
      apiKey: environmentValue(RESEND_API_KEY),
      fromEmail: environmentValue(RESEND_FROM_EMAIL),
      appOrigin: environmentValue(PUBLIC_APP_ORIGIN)
    })));
    const persistenceFactory = stryMutAct_9fa48("1501") ? dependencies.createPersistence && createPersistence : (stryCov_9fa48("1501"), dependencies.createPersistence ?? createPersistence);
    return async context => {
      if (stryMutAct_9fa48("1502")) {
        {}
      } else {
        stryCov_9fa48("1502");
        let value: unknown;
        try {
          if (stryMutAct_9fa48("1503")) {
            {}
          } else {
            stryCov_9fa48("1503");
            value = await context.request.json();
          }
        } catch {
          if (stryMutAct_9fa48("1504")) {
            {}
          } else {
            stryCov_9fa48("1504");
            return errorResponse(stryMutAct_9fa48("1505") ? "" : (stryCov_9fa48("1505"), "INVALID_REQUEST"), 400);
          }
        }
        const parsed = inviteStudentsRequestSchema.safeParse(value);
        if (stryMutAct_9fa48("1508") ? false : stryMutAct_9fa48("1507") ? true : stryMutAct_9fa48("1506") ? parsed.success : (stryCov_9fa48("1506", "1507", "1508"), !parsed.success)) return errorResponse(stryMutAct_9fa48("1509") ? "" : (stryCov_9fa48("1509"), "INVALID_REQUEST"), 400);
        const supabase = createSupabaseClient(context.request.headers, context.cookies);
        const authorization = await authorize(context.locals, supabase);
        if (stryMutAct_9fa48("1512") ? authorization.status !== "unauthenticated" : stryMutAct_9fa48("1511") ? false : stryMutAct_9fa48("1510") ? true : (stryCov_9fa48("1510", "1511", "1512"), authorization.status === (stryMutAct_9fa48("1513") ? "" : (stryCov_9fa48("1513"), "unauthenticated")))) return errorResponse(stryMutAct_9fa48("1514") ? "" : (stryCov_9fa48("1514"), "UNAUTHENTICATED"), 401);
        if (stryMutAct_9fa48("1517") ? authorization.status === "authorized-teacher" : stryMutAct_9fa48("1516") ? false : stryMutAct_9fa48("1515") ? true : (stryCov_9fa48("1515", "1516", "1517"), authorization.status !== (stryMutAct_9fa48("1518") ? "" : (stryCov_9fa48("1518"), "authorized-teacher")))) return errorResponse(stryMutAct_9fa48("1519") ? "" : (stryCov_9fa48("1519"), "FORBIDDEN"), 403);
        if (stryMutAct_9fa48("1522") ? false : stryMutAct_9fa48("1521") ? true : stryMutAct_9fa48("1520") ? supabase : (stryCov_9fa48("1520", "1521", "1522"), !supabase)) return errorResponse(stryMutAct_9fa48("1523") ? "" : (stryCov_9fa48("1523"), "DATABASE_UNAVAILABLE"), 503);
        const writer = createWriterClient();
        if (stryMutAct_9fa48("1526") ? (!providerConfig.apiKey || !providerConfig.fromEmail || !providerConfig.appOrigin) && !writer : stryMutAct_9fa48("1525") ? false : stryMutAct_9fa48("1524") ? true : (stryCov_9fa48("1524", "1525", "1526"), (stryMutAct_9fa48("1528") ? (!providerConfig.apiKey || !providerConfig.fromEmail) && !providerConfig.appOrigin : stryMutAct_9fa48("1527") ? false : (stryCov_9fa48("1527", "1528"), (stryMutAct_9fa48("1530") ? !providerConfig.apiKey && !providerConfig.fromEmail : stryMutAct_9fa48("1529") ? false : (stryCov_9fa48("1529", "1530"), (stryMutAct_9fa48("1531") ? providerConfig.apiKey : (stryCov_9fa48("1531"), !providerConfig.apiKey)) || (stryMutAct_9fa48("1532") ? providerConfig.fromEmail : (stryCov_9fa48("1532"), !providerConfig.fromEmail)))) || (stryMutAct_9fa48("1533") ? providerConfig.appOrigin : (stryCov_9fa48("1533"), !providerConfig.appOrigin)))) || (stryMutAct_9fa48("1534") ? writer : (stryCov_9fa48("1534"), !writer)))) {
          if (stryMutAct_9fa48("1535")) {
            {}
          } else {
            stryCov_9fa48("1535");
            return errorResponse(stryMutAct_9fa48("1536") ? "" : (stryCov_9fa48("1536"), "SERVICE_UNAVAILABLE"), 503);
          }
        }
        try {
          if (stryMutAct_9fa48("1537")) {
            {}
          } else {
            stryCov_9fa48("1537");
            const results = await deliver(persistenceFactory(supabase, writer), parsed.data, stryMutAct_9fa48("1538") ? {} : (stryCov_9fa48("1538"), {
              apiKey: providerConfig.apiKey,
              fromEmail: providerConfig.fromEmail,
              appOrigin: providerConfig.appOrigin
            }));
            return jsonResponse(stryMutAct_9fa48("1539") ? {} : (stryCov_9fa48("1539"), {
              results
            }), 200);
          }
        } catch (error) {
          if (stryMutAct_9fa48("1540")) {
            {}
          } else {
            stryCov_9fa48("1540");
            if (stryMutAct_9fa48("1542") ? false : stryMutAct_9fa48("1541") ? true : (stryCov_9fa48("1541", "1542"), error instanceof ClassInvitationOwnershipError)) return errorResponse(stryMutAct_9fa48("1543") ? "" : (stryCov_9fa48("1543"), "FORBIDDEN"), 403);
            return errorResponse(stryMutAct_9fa48("1544") ? "" : (stryCov_9fa48("1544"), "PERSISTENCE_FAILURE"), 500);
          }
        }
      }
    };
  }
}
export const POST = createInviteStudentsHandler();