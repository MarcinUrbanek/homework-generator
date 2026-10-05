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
import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
const PROTECTED_ROUTES = stryMutAct_9fa48("1292") ? [] : (stryCov_9fa48("1292"), [stryMutAct_9fa48("1293") ? "" : (stryCov_9fa48("1293"), "/dashboard"), stryMutAct_9fa48("1294") ? "" : (stryCov_9fa48("1294"), "/exercises"), stryMutAct_9fa48("1295") ? "" : (stryCov_9fa48("1295"), "/classes")]);
export const onRequest = defineMiddleware(async (context, next) => {
  if (stryMutAct_9fa48("1296")) {
    {}
  } else {
    stryCov_9fa48("1296");
    if (stryMutAct_9fa48("1299") ? import.meta.env.PROD || context.url.pathname.startsWith("/dev/") : stryMutAct_9fa48("1298") ? false : stryMutAct_9fa48("1297") ? true : (stryCov_9fa48("1297", "1298", "1299"), import.meta.env.PROD && (stryMutAct_9fa48("1300") ? context.url.pathname.endsWith("/dev/") : (stryCov_9fa48("1300"), context.url.pathname.startsWith(stryMutAct_9fa48("1301") ? "" : (stryCov_9fa48("1301"), "/dev/")))))) {
      if (stryMutAct_9fa48("1302")) {
        {}
      } else {
        stryCov_9fa48("1302");
        return new Response(null, stryMutAct_9fa48("1303") ? {} : (stryCov_9fa48("1303"), {
          status: 404
        }));
      }
    }
    const supabase = createClient(context.request.headers, context.cookies);
    if (stryMutAct_9fa48("1305") ? false : stryMutAct_9fa48("1304") ? true : (stryCov_9fa48("1304", "1305"), supabase)) {
      if (stryMutAct_9fa48("1306")) {
        {}
      } else {
        stryCov_9fa48("1306");
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        context.locals.user = stryMutAct_9fa48("1307") ? user && null : (stryCov_9fa48("1307"), user ?? null);
      }
    } else {
      if (stryMutAct_9fa48("1308")) {
        {}
      } else {
        stryCov_9fa48("1308");
        context.locals.user = null;
      }
    }
    if (stryMutAct_9fa48("1311") ? PROTECTED_ROUTES.some(route => context.url.pathname.startsWith(route)) || context.url.pathname !== "/classes/join" : stryMutAct_9fa48("1310") ? false : stryMutAct_9fa48("1309") ? true : (stryCov_9fa48("1309", "1310", "1311"), (stryMutAct_9fa48("1312") ? PROTECTED_ROUTES.every(route => context.url.pathname.startsWith(route)) : (stryCov_9fa48("1312"), PROTECTED_ROUTES.some(stryMutAct_9fa48("1313") ? () => undefined : (stryCov_9fa48("1313"), route => stryMutAct_9fa48("1314") ? context.url.pathname.endsWith(route) : (stryCov_9fa48("1314"), context.url.pathname.startsWith(route)))))) && (stryMutAct_9fa48("1316") ? context.url.pathname === "/classes/join" : stryMutAct_9fa48("1315") ? true : (stryCov_9fa48("1315", "1316"), context.url.pathname !== (stryMutAct_9fa48("1317") ? "" : (stryCov_9fa48("1317"), "/classes/join")))))) {
      if (stryMutAct_9fa48("1318")) {
        {}
      } else {
        stryCov_9fa48("1318");
        if (stryMutAct_9fa48("1321") ? false : stryMutAct_9fa48("1320") ? true : stryMutAct_9fa48("1319") ? context.locals.user : (stryCov_9fa48("1319", "1320", "1321"), !context.locals.user)) {
          if (stryMutAct_9fa48("1322")) {
            {}
          } else {
            stryCov_9fa48("1322");
            const returnTo = stryMutAct_9fa48("1323") ? `` : (stryCov_9fa48("1323"), `${context.url.pathname}${context.url.search}`);
            return context.redirect(stryMutAct_9fa48("1324") ? `` : (stryCov_9fa48("1324"), `/auth/signin?${new URLSearchParams(stryMutAct_9fa48("1325") ? {} : (stryCov_9fa48("1325"), {
              return_to: returnTo
            }))}`));
          }
        }
      }
    }
    return next();
  }
});