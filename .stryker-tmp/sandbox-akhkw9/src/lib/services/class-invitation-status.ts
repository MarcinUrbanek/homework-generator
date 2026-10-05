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
export type ClassInvitationStatus = "missing" | "invalid" | "expired" | "delivery-failed" | "valid" | "email-mismatch" | "ready";
interface InvitationRecord {
  normalizedEmail: string;
  expiresAt: string;
  deliveryState: "sent" | "failed" | "pending";
}
export interface ClassInvitationStatusDependencies {
  digestToken?: (token: string) => Promise<string>;
  findInvitation?: (tokenDigest: string) => Promise<InvitationRecord | null>;
  now?: () => Date;
}
const tokenPattern = stryMutAct_9fa48("713") ? /^[^a-f0-9]{64}$/ : stryMutAct_9fa48("712") ? /^[a-f0-9]$/ : stryMutAct_9fa48("711") ? /^[a-f0-9]{64}/ : stryMutAct_9fa48("710") ? /[a-f0-9]{64}$/ : (stryCov_9fa48("710", "711", "712", "713"), /^[a-f0-9]{64}$/);
const invitationRecordSchema = z.object(stryMutAct_9fa48("714") ? {} : (stryCov_9fa48("714"), {
  normalized_email: z.email(),
  expires_at: z.iso.datetime(stryMutAct_9fa48("715") ? {} : (stryCov_9fa48("715"), {
    offset: stryMutAct_9fa48("716") ? false : (stryCov_9fa48("716"), true)
  })),
  delivery_state: z.enum(stryMutAct_9fa48("717") ? [] : (stryCov_9fa48("717"), [stryMutAct_9fa48("718") ? "" : (stryCov_9fa48("718"), "sent"), stryMutAct_9fa48("719") ? "" : (stryCov_9fa48("719"), "failed"), stryMutAct_9fa48("720") ? "" : (stryCov_9fa48("720"), "pending")]))
})).strict();
async function defaultDigestToken(token: string): Promise<string> {
  if (stryMutAct_9fa48("721")) {
    {}
  } else {
    stryCov_9fa48("721");
    const digest = await crypto.subtle.digest(stryMutAct_9fa48("722") ? "" : (stryCov_9fa48("722"), "SHA-256"), new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest), stryMutAct_9fa48("723") ? () => undefined : (stryCov_9fa48("723"), value => value.toString(16).padStart(2, stryMutAct_9fa48("724") ? "" : (stryCov_9fa48("724"), "0")))).join(stryMutAct_9fa48("725") ? "Stryker was here!" : (stryCov_9fa48("725"), ""));
  }
}
async function findInvitation(tokenDigest: string): Promise<InvitationRecord | null> {
  if (stryMutAct_9fa48("726")) {
    {}
  } else {
    stryCov_9fa48("726");
    const {
      createServiceClient
    } = await import("@/lib/supabase");
    const client = createServiceClient();
    if (stryMutAct_9fa48("729") ? false : stryMutAct_9fa48("728") ? true : stryMutAct_9fa48("727") ? client : (stryCov_9fa48("727", "728", "729"), !client)) return null;
    const response = await client.from(stryMutAct_9fa48("730") ? "" : (stryCov_9fa48("730"), "class_invitations")).select(stryMutAct_9fa48("731") ? "" : (stryCov_9fa48("731"), "normalized_email,expires_at,delivery_state")).eq(stryMutAct_9fa48("732") ? "" : (stryCov_9fa48("732"), "token_digest"), tokenDigest).maybeSingle();
    if (stryMutAct_9fa48("734") ? false : stryMutAct_9fa48("733") ? true : (stryCov_9fa48("733", "734"), response.error)) throw new Error(stryMutAct_9fa48("736") ? "" : (stryCov_9fa48("736"), "Invitation lookup failed"));
    const parsed = invitationRecordSchema.nullable().safeParse(response.data);
    if (stryMutAct_9fa48("739") ? !parsed.success && !parsed.data : stryMutAct_9fa48("738") ? false : stryMutAct_9fa48("737") ? true : (stryCov_9fa48("737", "738", "739"), (stryMutAct_9fa48("740") ? parsed.success : (stryCov_9fa48("740"), !parsed.success)) || (stryMutAct_9fa48("741") ? parsed.data : (stryCov_9fa48("741"), !parsed.data)))) return null;
    return stryMutAct_9fa48("742") ? {} : (stryCov_9fa48("742"), {
      normalizedEmail: parsed.data.normalized_email,
      expiresAt: parsed.data.expires_at,
      deliveryState: parsed.data.delivery_state
    });
  }
}
export async function resolveClassInvitationStatus(token: string | null, authenticatedEmail: string | null, dependencies: ClassInvitationStatusDependencies = {}): Promise<ClassInvitationStatus> {
  if (stryMutAct_9fa48("743")) {
    {}
  } else {
    stryCov_9fa48("743");
    if (stryMutAct_9fa48("746") ? token !== null : stryMutAct_9fa48("745") ? false : stryMutAct_9fa48("744") ? true : (stryCov_9fa48("744", "745", "746"), token === null)) return stryMutAct_9fa48("747") ? "" : (stryCov_9fa48("747"), "missing");
    if (stryMutAct_9fa48("750") ? false : stryMutAct_9fa48("749") ? true : stryMutAct_9fa48("748") ? tokenPattern.test(token) : (stryCov_9fa48("748", "749", "750"), !tokenPattern.test(token))) return stryMutAct_9fa48("751") ? "" : (stryCov_9fa48("751"), "invalid");
    const digestToken = stryMutAct_9fa48("752") ? dependencies.digestToken && defaultDigestToken : (stryCov_9fa48("752"), dependencies.digestToken ?? defaultDigestToken);
    const lookup = stryMutAct_9fa48("753") ? dependencies.findInvitation && findInvitation : (stryCov_9fa48("753"), dependencies.findInvitation ?? findInvitation);
    let invitation: InvitationRecord | null;
    try {
      if (stryMutAct_9fa48("754")) {
        {}
      } else {
        stryCov_9fa48("754");
        invitation = await lookup(await digestToken(token));
      }
    } catch {
      if (stryMutAct_9fa48("755")) {
        {}
      } else {
        stryCov_9fa48("755");
        return stryMutAct_9fa48("756") ? "" : (stryCov_9fa48("756"), "invalid");
      }
    }

    // Rotated and unknown token digests intentionally share this state.
    if (stryMutAct_9fa48("759") ? false : stryMutAct_9fa48("758") ? true : stryMutAct_9fa48("757") ? invitation : (stryCov_9fa48("757", "758", "759"), !invitation)) return stryMutAct_9fa48("760") ? "" : (stryCov_9fa48("760"), "invalid");
    if (stryMutAct_9fa48("764") ? new Date(invitation.expiresAt).getTime() > (dependencies.now ?? (() => new Date()))().getTime() : stryMutAct_9fa48("763") ? new Date(invitation.expiresAt).getTime() < (dependencies.now ?? (() => new Date()))().getTime() : stryMutAct_9fa48("762") ? false : stryMutAct_9fa48("761") ? true : (stryCov_9fa48("761", "762", "763", "764"), new Date(invitation.expiresAt).getTime() <= (stryMutAct_9fa48("765") ? dependencies.now && (() => new Date()) : (stryCov_9fa48("765"), dependencies.now ?? (stryMutAct_9fa48("766") ? () => undefined : (stryCov_9fa48("766"), () => new Date()))))().getTime())) return stryMutAct_9fa48("767") ? "" : (stryCov_9fa48("767"), "expired");
    if (stryMutAct_9fa48("770") ? invitation.deliveryState === "sent" : stryMutAct_9fa48("769") ? false : stryMutAct_9fa48("768") ? true : (stryCov_9fa48("768", "769", "770"), invitation.deliveryState !== (stryMutAct_9fa48("771") ? "" : (stryCov_9fa48("771"), "sent")))) return stryMutAct_9fa48("772") ? "" : (stryCov_9fa48("772"), "delivery-failed");
    if (stryMutAct_9fa48("775") ? false : stryMutAct_9fa48("774") ? true : stryMutAct_9fa48("773") ? authenticatedEmail : (stryCov_9fa48("773", "774", "775"), !authenticatedEmail)) return stryMutAct_9fa48("776") ? "" : (stryCov_9fa48("776"), "valid");
    return (stryMutAct_9fa48("779") ? authenticatedEmail.trim().toLowerCase() !== invitation.normalizedEmail : stryMutAct_9fa48("778") ? false : stryMutAct_9fa48("777") ? true : (stryCov_9fa48("777", "778", "779"), (stryMutAct_9fa48("781") ? authenticatedEmail.toLowerCase() : stryMutAct_9fa48("780") ? authenticatedEmail.trim().toUpperCase() : (stryCov_9fa48("780", "781"), authenticatedEmail.trim().toLowerCase())) === invitation.normalizedEmail)) ? stryMutAct_9fa48("782") ? "" : (stryCov_9fa48("782"), "ready") : stryMutAct_9fa48("783") ? "" : (stryCov_9fa48("783"), "email-mismatch");
  }
}