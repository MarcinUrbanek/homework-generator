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
import { sendResendClassInvitation, type ResendClassInvitationConfig } from "@/lib/services/resend-class-invitation";
import type { InvitationDeliveryResult } from "@/types";
export interface PreparedInvitation {
  recipientEmail: string;
  invitationId: string;
  preparation: "created" | "refreshed";
}
export interface ClassInvitationPersistence {
  loadClassName: (classId: string) => Promise<string | null>;
  prepare: (classId: string, emails: string[], tokenDigests: string[]) => Promise<PreparedInvitation[]>;
  recordDelivery: (invitationId: string, tokenDigest: string, deliveryState: "sent" | "failed", providerMessageId?: string) => Promise<boolean>;
}
export interface ClassInvitationDependencies {
  createToken?: () => string;
  digestToken?: (token: string) => Promise<string>;
  send?: typeof sendResendClassInvitation;
}
export class ClassInvitationPersistenceError extends Error {}
export class ClassInvitationOwnershipError extends Error {}
function defaultToken(): string {
  if (stryMutAct_9fa48("784")) {
    {}
  } else {
    stryCov_9fa48("784");
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, stryMutAct_9fa48("785") ? () => undefined : (stryCov_9fa48("785"), value => value.toString(16).padStart(2, stryMutAct_9fa48("786") ? "" : (stryCov_9fa48("786"), "0")))).join(stryMutAct_9fa48("787") ? "Stryker was here!" : (stryCov_9fa48("787"), ""));
  }
}
async function defaultDigestToken(token: string): Promise<string> {
  if (stryMutAct_9fa48("788")) {
    {}
  } else {
    stryCov_9fa48("788");
    const digest = await crypto.subtle.digest(stryMutAct_9fa48("789") ? "" : (stryCov_9fa48("789"), "SHA-256"), new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest), stryMutAct_9fa48("790") ? () => undefined : (stryCov_9fa48("790"), value => value.toString(16).padStart(2, stryMutAct_9fa48("791") ? "" : (stryCov_9fa48("791"), "0")))).join(stryMutAct_9fa48("792") ? "Stryker was here!" : (stryCov_9fa48("792"), ""));
  }
}
export async function deliverClassInvitations(persistence: ClassInvitationPersistence, request: {
  classId: string;
  emails: string[];
}, config: ResendClassInvitationConfig, dependencies: ClassInvitationDependencies = {}): Promise<InvitationDeliveryResult[]> {
  if (stryMutAct_9fa48("793")) {
    {}
  } else {
    stryCov_9fa48("793");
    const createToken = stryMutAct_9fa48("794") ? dependencies.createToken && defaultToken : (stryCov_9fa48("794"), dependencies.createToken ?? defaultToken);
    const digestToken = stryMutAct_9fa48("795") ? dependencies.digestToken && defaultDigestToken : (stryCov_9fa48("795"), dependencies.digestToken ?? defaultDigestToken);
    const send = stryMutAct_9fa48("796") ? dependencies.send && sendResendClassInvitation : (stryCov_9fa48("796"), dependencies.send ?? sendResendClassInvitation);
    const className = await persistence.loadClassName(request.classId);
    if (stryMutAct_9fa48("799") ? false : stryMutAct_9fa48("798") ? true : stryMutAct_9fa48("797") ? className : (stryCov_9fa48("797", "798", "799"), !className)) {
      if (stryMutAct_9fa48("800")) {
        {}
      } else {
        stryCov_9fa48("800");
        if (stryMutAct_9fa48("801")) {
          ;
        } else {
          stryCov_9fa48("801");
          throw new ClassInvitationOwnershipError();
        }
      }
    }
    const tokens = request.emails.map(stryMutAct_9fa48("802") ? () => undefined : (stryCov_9fa48("802"), () => createToken()));
    const tokenDigests = await Promise.all(tokens.map(stryMutAct_9fa48("803") ? () => undefined : (stryCov_9fa48("803"), token => digestToken(token))));
    const prepared = await persistence.prepare(request.classId, request.emails, tokenDigests);
    const preparedByEmail = new Map(prepared.map(stryMutAct_9fa48("804") ? () => undefined : (stryCov_9fa48("804"), invitation => stryMutAct_9fa48("805") ? [] : (stryCov_9fa48("805"), [invitation.recipientEmail, invitation]))));
    if (stryMutAct_9fa48("808") ? preparedByEmail.size === request.emails.length : stryMutAct_9fa48("807") ? false : stryMutAct_9fa48("806") ? true : (stryCov_9fa48("806", "807", "808"), preparedByEmail.size !== request.emails.length)) {
      if (stryMutAct_9fa48("809")) {
        {}
      } else {
        stryCov_9fa48("809");
        if (stryMutAct_9fa48("810")) {
          ;
        } else {
          stryCov_9fa48("810");
          throw new ClassInvitationPersistenceError();
        }
      }
    }
    const results: InvitationDeliveryResult[] = stryMutAct_9fa48("811") ? ["Stryker was here"] : (stryCov_9fa48("811"), []);
    for (const [index, email] of request.emails.entries()) {
      if (stryMutAct_9fa48("812")) {
        {}
      } else {
        stryCov_9fa48("812");
        const invitation = preparedByEmail.get(email);
        if (stryMutAct_9fa48("815") ? false : stryMutAct_9fa48("814") ? true : stryMutAct_9fa48("813") ? invitation : (stryCov_9fa48("813", "814", "815"), !invitation)) {
          if (stryMutAct_9fa48("816")) {
            {}
          } else {
            stryCov_9fa48("816");
            if (stryMutAct_9fa48("817")) {
              ;
            } else {
              stryCov_9fa48("817");
              throw new ClassInvitationPersistenceError();
            }
          }
        }
        try {
          if (stryMutAct_9fa48("818")) {
            {}
          } else {
            stryCov_9fa48("818");
            const {
              providerMessageId
            } = await send(stryMutAct_9fa48("819") ? {} : (stryCov_9fa48("819"), {
              className,
              recipientEmail: email,
              token: tokens[index]
            }), config);
            const recorded = await persistence.recordDelivery(invitation.invitationId, tokenDigests[index], stryMutAct_9fa48("820") ? "" : (stryCov_9fa48("820"), "sent"), providerMessageId);
            if (stryMutAct_9fa48("823") ? false : stryMutAct_9fa48("822") ? true : stryMutAct_9fa48("821") ? recorded : (stryCov_9fa48("821", "822", "823"), !recorded)) {
              if (stryMutAct_9fa48("824")) {
                {}
              } else {
                stryCov_9fa48("824");
                if (stryMutAct_9fa48("825")) {
                  ;
                } else {
                  stryCov_9fa48("825");
                  throw new ClassInvitationPersistenceError();
                }
              }
            }
            results.push(stryMutAct_9fa48("827") ? {} : (stryCov_9fa48("827"), {
              email,
              status: (stryMutAct_9fa48("830") ? invitation.preparation !== "created" : stryMutAct_9fa48("829") ? false : stryMutAct_9fa48("828") ? true : (stryCov_9fa48("828", "829", "830"), invitation.preparation === (stryMutAct_9fa48("831") ? "" : (stryCov_9fa48("831"), "created")))) ? stryMutAct_9fa48("832") ? "" : (stryCov_9fa48("832"), "sent") : stryMutAct_9fa48("833") ? "" : (stryCov_9fa48("833"), "refreshed")
            }));
          }
        } catch {
          if (stryMutAct_9fa48("834")) {
            {}
          } else {
            stryCov_9fa48("834");
            try {
              if (stryMutAct_9fa48("835")) {
                {}
              } else {
                stryCov_9fa48("835");
                await persistence.recordDelivery(invitation.invitationId, tokenDigests[index], stryMutAct_9fa48("836") ? "" : (stryCov_9fa48("836"), "failed"));
              }
            } catch {
              // The recipient result remains failed even if the delivery ledger cannot be updated.
            }
            results.push(stryMutAct_9fa48("838") ? {} : (stryCov_9fa48("838"), {
              email,
              status: stryMutAct_9fa48("839") ? "" : (stryCov_9fa48("839"), "failed")
            }));
          }
        }
      }
    }
    return results;
  }
}