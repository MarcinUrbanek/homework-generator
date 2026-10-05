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
import { Resend } from "resend";
const INVITATION_VALIDITY_DAYS = 7;
export type ResendClassInvitationErrorCode = "PROVIDER_FAILURE";
export class ResendClassInvitationError extends Error {
  readonly code: ResendClassInvitationErrorCode;
  constructor(code: ResendClassInvitationErrorCode) {
    if (stryMutAct_9fa48("1157")) {
      {}
    } else {
      stryCov_9fa48("1157");
      super(code);
      this.name = stryMutAct_9fa48("1158") ? "" : (stryCov_9fa48("1158"), "ResendClassInvitationError");
      this.code = code;
    }
  }
}
export interface ResendClassInvitationConfig {
  apiKey: string;
  fromEmail: string;
  appOrigin: string;
}
export interface ResendClassInvitationRequest {
  className: string;
  recipientEmail: string;
  token: string;
}
export interface ResendEmailClient {
  emails: {
    send: (message: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
    }) => Promise<{
      data: {
        id: string;
      } | null;
      error: unknown;
    }>;
  };
}
export interface ResendClassInvitationDependencies {
  client?: ResendEmailClient;
  clock?: () => Date;
  createClient?: (apiKey: string) => ResendEmailClient;
}
function escapeHtml(value: string): string {
  if (stryMutAct_9fa48("1159")) {
    {}
  } else {
    stryCov_9fa48("1159");
    return value.replace(stryMutAct_9fa48("1160") ? /[^&<>"']/g : (stryCov_9fa48("1160"), /[&<>"']/g), character => {
      if (stryMutAct_9fa48("1161")) {
        {}
      } else {
        stryCov_9fa48("1161");
        const entities: Record<string, string> = stryMutAct_9fa48("1162") ? {} : (stryCov_9fa48("1162"), {
          "&": stryMutAct_9fa48("1163") ? "" : (stryCov_9fa48("1163"), "&amp;"),
          "<": stryMutAct_9fa48("1164") ? "" : (stryCov_9fa48("1164"), "&lt;"),
          ">": stryMutAct_9fa48("1165") ? "" : (stryCov_9fa48("1165"), "&gt;"),
          '"': stryMutAct_9fa48("1166") ? "" : (stryCov_9fa48("1166"), "&quot;"),
          "'": stryMutAct_9fa48("1167") ? "" : (stryCov_9fa48("1167"), "&#39;")
        });
        return entities[character];
      }
    });
  }
}
function invitationUrl(appOrigin: string, token: string): string {
  if (stryMutAct_9fa48("1168")) {
    {}
  } else {
    stryCov_9fa48("1168");
    const url = new URL(stryMutAct_9fa48("1169") ? "" : (stryCov_9fa48("1169"), "/classes/join"), appOrigin);
    url.searchParams.set(stryMutAct_9fa48("1171") ? "" : (stryCov_9fa48("1171"), "token"), token);
    return url.toString();
  }
}
function formatExpiry(clock: () => Date): string {
  if (stryMutAct_9fa48("1172")) {
    {}
  } else {
    stryCov_9fa48("1172");
    const expiry = new Date(stryMutAct_9fa48("1173") ? clock().getTime() - INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000 : (stryCov_9fa48("1173"), clock().getTime() + (stryMutAct_9fa48("1174") ? INVITATION_VALIDITY_DAYS * 24 * 60 * 60 / 1000 : (stryCov_9fa48("1174"), (stryMutAct_9fa48("1175") ? INVITATION_VALIDITY_DAYS * 24 * 60 / 60 : (stryCov_9fa48("1175"), (stryMutAct_9fa48("1176") ? INVITATION_VALIDITY_DAYS * 24 / 60 : (stryCov_9fa48("1176"), (stryMutAct_9fa48("1177") ? INVITATION_VALIDITY_DAYS / 24 : (stryCov_9fa48("1177"), INVITATION_VALIDITY_DAYS * 24)) * 60)) * 60)) * 1000))));
    return new Intl.DateTimeFormat(stryMutAct_9fa48("1178") ? "" : (stryCov_9fa48("1178"), "pl-PL"), stryMutAct_9fa48("1179") ? {} : (stryCov_9fa48("1179"), {
      dateStyle: stryMutAct_9fa48("1180") ? "" : (stryCov_9fa48("1180"), "long"),
      timeZone: stryMutAct_9fa48("1181") ? "" : (stryCov_9fa48("1181"), "UTC")
    })).format(expiry);
  }
}
function createResendClient(apiKey: string): ResendEmailClient {
  if (stryMutAct_9fa48("1182")) {
    {}
  } else {
    stryCov_9fa48("1182");
    const ResendClientConstructor = Resend as unknown as new (apiKey: string) => ResendEmailClient;
    return new ResendClientConstructor(apiKey);
  }
}
export async function sendResendClassInvitation(request: ResendClassInvitationRequest, config: ResendClassInvitationConfig, dependencies: ResendClassInvitationDependencies = {}): Promise<{
  providerMessageId: string;
}> {
  if (stryMutAct_9fa48("1183")) {
    {}
  } else {
    stryCov_9fa48("1183");
    const client: ResendEmailClient = stryMutAct_9fa48("1184") ? (dependencies.client ?? dependencies.createClient?.(config.apiKey)) && createResendClient(config.apiKey) : (stryCov_9fa48("1184"), (stryMutAct_9fa48("1185") ? dependencies.client && dependencies.createClient?.(config.apiKey) : (stryCov_9fa48("1185"), dependencies.client ?? (stryMutAct_9fa48("1186") ? dependencies.createClient(config.apiKey) : (stryCov_9fa48("1186"), dependencies.createClient?.(config.apiKey))))) ?? createResendClient(config.apiKey));
    const clock = stryMutAct_9fa48("1187") ? dependencies.clock && (() => new Date()) : (stryCov_9fa48("1187"), dependencies.clock ?? (stryMutAct_9fa48("1188") ? () => undefined : (stryCov_9fa48("1188"), () => new Date())));
    const url = invitationUrl(config.appOrigin, request.token);
    const escapedClassName = escapeHtml(request.className);
    const subjectClassName = request.className.replace(stryMutAct_9fa48("1190") ? /[^\r\n]+/g : stryMutAct_9fa48("1189") ? /[\r\n]/g : (stryCov_9fa48("1189", "1190"), /[\r\n]+/g), stryMutAct_9fa48("1191") ? "" : (stryCov_9fa48("1191"), " "));
    const escapedUrl = escapeHtml(url);
    const expiry = formatExpiry(clock);
    try {
      if (stryMutAct_9fa48("1192")) {
        {}
      } else {
        stryCov_9fa48("1192");
        const result = await client.emails.send(stryMutAct_9fa48("1193") ? {} : (stryCov_9fa48("1193"), {
          from: config.fromEmail,
          to: stryMutAct_9fa48("1194") ? [] : (stryCov_9fa48("1194"), [request.recipientEmail]),
          subject: stryMutAct_9fa48("1195") ? `` : (stryCov_9fa48("1195"), `Zaproszenie do klasy ${subjectClassName}`),
          text: (stryMutAct_9fa48("1196") ? [] : (stryCov_9fa48("1196"), [stryMutAct_9fa48("1197") ? `` : (stryCov_9fa48("1197"), `Zapraszamy do klasy ${request.className}.`), stryMutAct_9fa48("1198") ? `` : (stryCov_9fa48("1198"), `Otwórz zaproszenie: ${url}`), stryMutAct_9fa48("1199") ? `` : (stryCov_9fa48("1199"), `Zaproszenie jest ważne do ${expiry}.`)])).join(stryMutAct_9fa48("1200") ? "" : (stryCov_9fa48("1200"), "\n\n")),
          html: (stryMutAct_9fa48("1201") ? [] : (stryCov_9fa48("1201"), [stryMutAct_9fa48("1202") ? `` : (stryCov_9fa48("1202"), `<p>Zapraszamy do klasy <strong>${escapedClassName}</strong>.</p>`), stryMutAct_9fa48("1203") ? `` : (stryCov_9fa48("1203"), `<p><a href="${escapedUrl}">Otwórz zaproszenie</a></p>`), stryMutAct_9fa48("1204") ? `` : (stryCov_9fa48("1204"), `<p>Zaproszenie jest ważne do ${escapeHtml(expiry)}.</p>`)])).join(stryMutAct_9fa48("1205") ? "Stryker was here!" : (stryCov_9fa48("1205"), ""))
        }));
        if (stryMutAct_9fa48("1208") ? result.error && !result.data?.id : stryMutAct_9fa48("1207") ? false : stryMutAct_9fa48("1206") ? true : (stryCov_9fa48("1206", "1207", "1208"), result.error || (stryMutAct_9fa48("1209") ? result.data?.id : (stryCov_9fa48("1209"), !(stryMutAct_9fa48("1210") ? result.data.id : (stryCov_9fa48("1210"), result.data?.id)))))) {
          if (stryMutAct_9fa48("1211")) {
            {}
          } else {
            stryCov_9fa48("1211");
            throw new ResendClassInvitationError(stryMutAct_9fa48("1213") ? "" : (stryCov_9fa48("1213"), "PROVIDER_FAILURE"));
          }
        }
        return stryMutAct_9fa48("1214") ? {} : (stryCov_9fa48("1214"), {
          providerMessageId: result.data.id
        });
      }
    } catch (error) {
      if (stryMutAct_9fa48("1215")) {
        {}
      } else {
        stryCov_9fa48("1215");
        if (stryMutAct_9fa48("1217") ? false : stryMutAct_9fa48("1216") ? true : (stryCov_9fa48("1216", "1217"), error instanceof ResendClassInvitationError)) {
          if (stryMutAct_9fa48("1218")) {
            {}
          } else {
            stryCov_9fa48("1218");
            throw error;
          }
        }
        throw new ResendClassInvitationError(stryMutAct_9fa48("1220") ? "" : (stryCov_9fa48("1220"), "PROVIDER_FAILURE"));
      }
    }
  }
}