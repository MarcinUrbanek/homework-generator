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
import { CLASS_API_ERROR_CODES } from "@/types";
const uuidSchema = z.uuid();
const nonEmptyStringSchema = stryMutAct_9fa48("339") ? z.string().min(1) : stryMutAct_9fa48("338") ? z.string().trim().max(1) : (stryCov_9fa48("338", "339"), z.string().trim().min(1));
const normalizedEmailSchema = stryMutAct_9fa48("341") ? z.string().toLowerCase().pipe(z.email()) : stryMutAct_9fa48("340") ? z.string().trim().toUpperCase().pipe(z.email()) : (stryCov_9fa48("340", "341"), z.string().trim().toLowerCase().pipe(z.email()));
export const createClassRequestSchema = z.object(stryMutAct_9fa48("342") ? {} : (stryCov_9fa48("342"), {
  name: nonEmptyStringSchema
})).strict();
export const inviteStudentsRequestSchema = z.object(stryMutAct_9fa48("343") ? {} : (stryCov_9fa48("343"), {
  classId: uuidSchema,
  emails: stryMutAct_9fa48("345") ? z.array(normalizedEmailSchema).max(1).max(50) : stryMutAct_9fa48("344") ? z.array(normalizedEmailSchema).min(1).min(50) : (stryCov_9fa48("344", "345"), z.array(normalizedEmailSchema).min(1).max(50))
})).strict().superRefine(({
  emails
}, context) => {
  if (stryMutAct_9fa48("346")) {
    {}
  } else {
    stryCov_9fa48("346");
    if (stryMutAct_9fa48("349") ? new Set(emails).size === emails.length : stryMutAct_9fa48("348") ? false : stryMutAct_9fa48("347") ? true : (stryCov_9fa48("347", "348", "349"), new Set(emails).size !== emails.length)) {
      if (stryMutAct_9fa48("350")) {
        {}
      } else {
        stryCov_9fa48("350");
        context.addIssue(stryMutAct_9fa48("352") ? {} : (stryCov_9fa48("352"), {
          code: stryMutAct_9fa48("353") ? "" : (stryCov_9fa48("353"), "custom"),
          path: stryMutAct_9fa48("354") ? [] : (stryCov_9fa48("354"), [stryMutAct_9fa48("355") ? "" : (stryCov_9fa48("355"), "emails")]),
          message: stryMutAct_9fa48("356") ? "" : (stryCov_9fa48("356"), "Invitation emails must be unique")
        }));
      }
    }
  }
});
export const classSummarySchema = z.object(stryMutAct_9fa48("357") ? {} : (stryCov_9fa48("357"), {
  id: uuidSchema,
  name: nonEmptyStringSchema,
  classCode: z.string().regex(stryMutAct_9fa48("361") ? /^[^A-Z0-9]{8}$/ : stryMutAct_9fa48("360") ? /^[A-Z0-9]$/ : stryMutAct_9fa48("359") ? /^[A-Z0-9]{8}/ : stryMutAct_9fa48("358") ? /[A-Z0-9]{8}$/ : (stryCov_9fa48("358", "359", "360", "361"), /^[A-Z0-9]{8}$/)),
  createdAt: z.iso.datetime(stryMutAct_9fa48("362") ? {} : (stryCov_9fa48("362"), {
    offset: stryMutAct_9fa48("363") ? false : (stryCov_9fa48("363"), true)
  }))
})).strict();
export const invitationDeliveryResultSchema = z.object(stryMutAct_9fa48("364") ? {} : (stryCov_9fa48("364"), {
  email: normalizedEmailSchema,
  status: z.enum(stryMutAct_9fa48("365") ? [] : (stryCov_9fa48("365"), [stryMutAct_9fa48("366") ? "" : (stryCov_9fa48("366"), "sent"), stryMutAct_9fa48("367") ? "" : (stryCov_9fa48("367"), "refreshed"), stryMutAct_9fa48("368") ? "" : (stryCov_9fa48("368"), "failed")]))
})).strict();
export const classApiErrorSchema = z.object(stryMutAct_9fa48("369") ? {} : (stryCov_9fa48("369"), {
  error: z.object(stryMutAct_9fa48("370") ? {} : (stryCov_9fa48("370"), {
    code: z.enum(CLASS_API_ERROR_CODES),
    message: nonEmptyStringSchema
  })).strict()
})).strict();