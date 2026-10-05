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
import type { SupabaseClient, User } from "@supabase/supabase-js";
export type TeacherAuthorizationResult = {
  status: "unauthenticated";
} | {
  status: "non-teacher";
} | {
  status: "profile-unavailable";
} | {
  status: "authorized-teacher";
};
export interface TeacherAuthorizationLocals {
  user: User | null;
}
export async function authorizeTeacher(locals: TeacherAuthorizationLocals, supabase: SupabaseClient | null): Promise<TeacherAuthorizationResult> {
  if (stryMutAct_9fa48("1221")) {
    {}
  } else {
    stryCov_9fa48("1221");
    if (stryMutAct_9fa48("1224") ? false : stryMutAct_9fa48("1223") ? true : stryMutAct_9fa48("1222") ? locals.user : (stryCov_9fa48("1222", "1223", "1224"), !locals.user)) {
      if (stryMutAct_9fa48("1225")) {
        {}
      } else {
        stryCov_9fa48("1225");
        return stryMutAct_9fa48("1226") ? {} : (stryCov_9fa48("1226"), {
          status: stryMutAct_9fa48("1227") ? "" : (stryCov_9fa48("1227"), "unauthenticated")
        });
      }
    }
    if (stryMutAct_9fa48("1230") ? false : stryMutAct_9fa48("1229") ? true : stryMutAct_9fa48("1228") ? supabase : (stryCov_9fa48("1228", "1229", "1230"), !supabase)) {
      if (stryMutAct_9fa48("1231")) {
        {}
      } else {
        stryCov_9fa48("1231");
        return stryMutAct_9fa48("1232") ? {} : (stryCov_9fa48("1232"), {
          status: stryMutAct_9fa48("1233") ? "" : (stryCov_9fa48("1233"), "profile-unavailable")
        });
      }
    }
    let result: {
      data: {
        role?: unknown;
      } | null;
      error: unknown;
    };
    try {
      if (stryMutAct_9fa48("1234")) {
        {}
      } else {
        stryCov_9fa48("1234");
        result = await supabase.from(stryMutAct_9fa48("1235") ? "" : (stryCov_9fa48("1235"), "profile_roles")).select(stryMutAct_9fa48("1236") ? "" : (stryCov_9fa48("1236"), "role")).eq(stryMutAct_9fa48("1237") ? "" : (stryCov_9fa48("1237"), "user_id"), locals.user.id).eq(stryMutAct_9fa48("1238") ? "" : (stryCov_9fa48("1238"), "role"), stryMutAct_9fa48("1239") ? "" : (stryCov_9fa48("1239"), "teacher")).maybeSingle();
      }
    } catch {
      if (stryMutAct_9fa48("1240")) {
        {}
      } else {
        stryCov_9fa48("1240");
        return stryMutAct_9fa48("1241") ? {} : (stryCov_9fa48("1241"), {
          status: stryMutAct_9fa48("1242") ? "" : (stryCov_9fa48("1242"), "profile-unavailable")
        });
      }
    }
    const {
      data,
      error
    } = result;
    if (stryMutAct_9fa48("1244") ? false : stryMutAct_9fa48("1243") ? true : (stryCov_9fa48("1243", "1244"), error)) {
      if (stryMutAct_9fa48("1245")) {
        {}
      } else {
        stryCov_9fa48("1245");
        return stryMutAct_9fa48("1246") ? {} : (stryCov_9fa48("1246"), {
          status: stryMutAct_9fa48("1247") ? "" : (stryCov_9fa48("1247"), "profile-unavailable")
        });
      }
    }
    if (stryMutAct_9fa48("1250") ? false : stryMutAct_9fa48("1249") ? true : stryMutAct_9fa48("1248") ? data : (stryCov_9fa48("1248", "1249", "1250"), !data)) {
      if (stryMutAct_9fa48("1251")) {
        {}
      } else {
        stryCov_9fa48("1251");
        return stryMutAct_9fa48("1252") ? {} : (stryCov_9fa48("1252"), {
          status: stryMutAct_9fa48("1253") ? "" : (stryCov_9fa48("1253"), "non-teacher")
        });
      }
    }
    return (stryMutAct_9fa48("1256") ? data.role !== "teacher" : stryMutAct_9fa48("1255") ? false : stryMutAct_9fa48("1254") ? true : (stryCov_9fa48("1254", "1255", "1256"), data.role === (stryMutAct_9fa48("1257") ? "" : (stryCov_9fa48("1257"), "teacher")))) ? stryMutAct_9fa48("1258") ? {} : (stryCov_9fa48("1258"), {
      status: stryMutAct_9fa48("1259") ? "" : (stryCov_9fa48("1259"), "authorized-teacher")
    }) : stryMutAct_9fa48("1260") ? {} : (stryCov_9fa48("1260"), {
      status: stryMutAct_9fa48("1261") ? "" : (stryCov_9fa48("1261"), "profile-unavailable")
    });
  }
}