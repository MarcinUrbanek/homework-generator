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
export interface SignUpHandlerDependencies {
  createSupabaseClient?: typeof createClient;
}
function signupPageUrl(error: string, returnTo: string): string {
  if (stryMutAct_9fa48("1347")) {
    {}
  } else {
    stryCov_9fa48("1347");
    return stryMutAct_9fa48("1348") ? `` : (stryCov_9fa48("1348"), `/auth/signup?${new URLSearchParams(stryMutAct_9fa48("1349") ? {} : (stryCov_9fa48("1349"), {
      error,
      return_to: returnTo
    }))}`);
  }
}
export function createSignUpHandler(dependencies: SignUpHandlerDependencies = {}): APIRoute {
  if (stryMutAct_9fa48("1350")) {
    {}
  } else {
    stryCov_9fa48("1350");
    const createSupabaseClient = stryMutAct_9fa48("1351") ? dependencies.createSupabaseClient && createClient : (stryCov_9fa48("1351"), dependencies.createSupabaseClient ?? createClient);
    return async context => {
      if (stryMutAct_9fa48("1352")) {
        {}
      } else {
        stryCov_9fa48("1352");
        const form = await context.request.formData();
        const email = form.get("email") as string;
        const password = form.get("password") as string;
        const returnTo = returnDestination(form.get(stryMutAct_9fa48("1353") ? "" : (stryCov_9fa48("1353"), "return_to")));
        const supabase = createSupabaseClient(context.request.headers, context.cookies);
        if (stryMutAct_9fa48("1356") ? false : stryMutAct_9fa48("1355") ? true : stryMutAct_9fa48("1354") ? supabase : (stryCov_9fa48("1354", "1355", "1356"), !supabase)) {
          if (stryMutAct_9fa48("1357")) {
            {}
          } else {
            stryCov_9fa48("1357");
            return context.redirect(signupPageUrl(stryMutAct_9fa48("1358") ? "" : (stryCov_9fa48("1358"), "Supabase is not configured"), returnTo));
          }
        }
        const {
          error
        } = await supabase.auth.signUp(stryMutAct_9fa48("1359") ? {} : (stryCov_9fa48("1359"), {
          email,
          password
        }));
        if (stryMutAct_9fa48("1361") ? false : stryMutAct_9fa48("1360") ? true : (stryCov_9fa48("1360", "1361"), error)) {
          if (stryMutAct_9fa48("1362")) {
            {}
          } else {
            stryCov_9fa48("1362");
            return context.redirect(signupPageUrl(error.message, returnTo));
          }
        }
        return context.redirect(stryMutAct_9fa48("1363") ? `` : (stryCov_9fa48("1363"), `/auth/confirm-email?${new URLSearchParams(stryMutAct_9fa48("1364") ? {} : (stryCov_9fa48("1364"), {
          return_to: returnTo
        }))}`));
      }
    };
  }
}
export const POST = createSignUpHandler();