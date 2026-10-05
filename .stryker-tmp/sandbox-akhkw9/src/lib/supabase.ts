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
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  if (stryMutAct_9fa48("1262")) {
    {}
  } else {
    stryCov_9fa48("1262");
    if (stryMutAct_9fa48("1265") ? !SUPABASE_URL && !SUPABASE_KEY : stryMutAct_9fa48("1264") ? false : stryMutAct_9fa48("1263") ? true : (stryCov_9fa48("1263", "1264", "1265"), (stryMutAct_9fa48("1266") ? SUPABASE_URL : (stryCov_9fa48("1266"), !SUPABASE_URL)) || (stryMutAct_9fa48("1267") ? SUPABASE_KEY : (stryCov_9fa48("1267"), !SUPABASE_KEY)))) {
      if (stryMutAct_9fa48("1268")) {
        {}
      } else {
        stryCov_9fa48("1268");
        return null;
      }
    }
    return createServerClient(SUPABASE_URL, SUPABASE_KEY, stryMutAct_9fa48("1269") ? {} : (stryCov_9fa48("1269"), {
      cookies: stryMutAct_9fa48("1270") ? {} : (stryCov_9fa48("1270"), {
        getAll() {
          if (stryMutAct_9fa48("1271")) {
            {}
          } else {
            stryCov_9fa48("1271");
            return parseCookieHeader(stryMutAct_9fa48("1272") ? requestHeaders.get("Cookie") && "" : (stryCov_9fa48("1272"), requestHeaders.get(stryMutAct_9fa48("1273") ? "" : (stryCov_9fa48("1273"), "Cookie")) ?? (stryMutAct_9fa48("1274") ? "Stryker was here!" : (stryCov_9fa48("1274"), ""))));
          }
        },
        setAll(cookiesToSet) {
          if (stryMutAct_9fa48("1275")) {
            {}
          } else {
            stryCov_9fa48("1275");
            cookiesToSet.forEach(({
              name,
              value,
              options
            }) => {
              if (stryMutAct_9fa48("1277")) {
                {}
              } else {
                stryCov_9fa48("1277");
                if (stryMutAct_9fa48("1278")) {
                  ;
                } else {
                  stryCov_9fa48("1278");
                  cookies.set(name, value, options);
                }
              }
            });
          }
        }
      })
    }));
  }
}
export function createServiceClient() {
  if (stryMutAct_9fa48("1279")) {
    {}
  } else {
    stryCov_9fa48("1279");
    if (stryMutAct_9fa48("1282") ? !SUPABASE_URL && !SUPABASE_SERVICE_ROLE_KEY : stryMutAct_9fa48("1281") ? false : stryMutAct_9fa48("1280") ? true : (stryCov_9fa48("1280", "1281", "1282"), (stryMutAct_9fa48("1283") ? SUPABASE_URL : (stryCov_9fa48("1283"), !SUPABASE_URL)) || (stryMutAct_9fa48("1284") ? SUPABASE_SERVICE_ROLE_KEY : (stryCov_9fa48("1284"), !SUPABASE_SERVICE_ROLE_KEY)))) {
      if (stryMutAct_9fa48("1285")) {
        {}
      } else {
        stryCov_9fa48("1285");
        return null;
      }
    }
    return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, stryMutAct_9fa48("1286") ? {} : (stryCov_9fa48("1286"), {
      auth: stryMutAct_9fa48("1287") ? {} : (stryCov_9fa48("1287"), {
        autoRefreshToken: stryMutAct_9fa48("1288") ? true : (stryCov_9fa48("1288"), false),
        detectSessionInUrl: stryMutAct_9fa48("1289") ? true : (stryCov_9fa48("1289"), false),
        persistSession: stryMutAct_9fa48("1290") ? true : (stryCov_9fa48("1290"), false)
      })
    }));
  }
}