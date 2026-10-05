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
import { returnDestination } from "@/lib/auth/return-destination";
import { createClient } from "@/lib/supabase";
export interface SignInHandlerDependencies {
  createSupabaseClient?: typeof createClient;
}
function signinPageUrl(error: string, returnTo: string): string {
  if (stryMutAct_9fa48("1326")) {
    {}
  } else {
    stryCov_9fa48("1326");
    return stryMutAct_9fa48("1327") ? `` : (stryCov_9fa48("1327"), `/auth/signin?${new URLSearchParams(stryMutAct_9fa48("1328") ? {} : (stryCov_9fa48("1328"), {
      error,
      return_to: returnTo
    }))}`);
  }
}
export function createSignInHandler(dependencies: SignInHandlerDependencies = {}): APIRoute {
  if (stryMutAct_9fa48("1329")) {
    {}
  } else {
    stryCov_9fa48("1329");
    const createSupabaseClient = stryMutAct_9fa48("1330") ? dependencies.createSupabaseClient && createClient : (stryCov_9fa48("1330"), dependencies.createSupabaseClient ?? createClient);
    return async context => {
      if (stryMutAct_9fa48("1331")) {
        {}
      } else {
        stryCov_9fa48("1331");
        const form = await context.request.formData();
        const email = form.get("email") as string;
        const password = form.get("password") as string;
        const returnTo = returnDestination(form.get(stryMutAct_9fa48("1332") ? "" : (stryCov_9fa48("1332"), "return_to")));
        const supabase = createSupabaseClient(context.request.headers, context.cookies);
        if (stryMutAct_9fa48("1335") ? false : stryMutAct_9fa48("1334") ? true : stryMutAct_9fa48("1333") ? supabase : (stryCov_9fa48("1333", "1334", "1335"), !supabase)) {
          if (stryMutAct_9fa48("1336")) {
            {}
          } else {
            stryCov_9fa48("1336");
            return context.redirect(signinPageUrl(stryMutAct_9fa48("1337") ? "" : (stryCov_9fa48("1337"), "Supabase is not configured"), returnTo));
          }
        }
        const {
          error
        } = await supabase.auth.signInWithPassword(stryMutAct_9fa48("1338") ? {} : (stryCov_9fa48("1338"), {
          email,
          password
        }));
        if (stryMutAct_9fa48("1340") ? false : stryMutAct_9fa48("1339") ? true : (stryCov_9fa48("1339", "1340"), error)) {
          if (stryMutAct_9fa48("1341")) {
            {}
          } else {
            stryCov_9fa48("1341");
            return context.redirect(signinPageUrl(error.message, returnTo));
          }
        }
        return context.redirect(returnTo);
      }
    };
  }
}
export const POST = createSignInHandler();