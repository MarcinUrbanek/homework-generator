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
import { OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_VERIFIER_MODEL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}
export const configStatuses: ConfigStatus[] = stryMutAct_9fa48("371") ? [] : (stryCov_9fa48("371"), [stryMutAct_9fa48("372") ? {} : (stryCov_9fa48("372"), {
  name: stryMutAct_9fa48("373") ? "" : (stryCov_9fa48("373"), "Supabase"),
  configured: Boolean(stryMutAct_9fa48("376") ? SUPABASE_URL || SUPABASE_KEY : stryMutAct_9fa48("375") ? false : stryMutAct_9fa48("374") ? true : (stryCov_9fa48("374", "375", "376"), SUPABASE_URL && SUPABASE_KEY)),
  message: stryMutAct_9fa48("377") ? "" : (stryCov_9fa48("377"), "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone."),
  docsUrl: stryMutAct_9fa48("378") ? "" : (stryCov_9fa48("378"), "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration"),
  docsLabel: stryMutAct_9fa48("379") ? "" : (stryCov_9fa48("379"), "Zobacz instrukcję konfiguracji")
}), stryMutAct_9fa48("380") ? {} : (stryCov_9fa48("380"), {
  name: stryMutAct_9fa48("381") ? "" : (stryCov_9fa48("381"), "OpenRouter"),
  configured: Boolean(stryMutAct_9fa48("384") ? OPENROUTER_API_KEY || OPENROUTER_MODEL : stryMutAct_9fa48("383") ? false : stryMutAct_9fa48("382") ? true : (stryCov_9fa48("382", "383", "384"), OPENROUTER_API_KEY && OPENROUTER_MODEL)),
  message: stryMutAct_9fa48("385") ? "" : (stryCov_9fa48("385"), "OpenRouter nie jest skonfigurowany — generowanie zadań jest wyłączone.")
}), stryMutAct_9fa48("386") ? {} : (stryCov_9fa48("386"), {
  name: stryMutAct_9fa48("387") ? "" : (stryCov_9fa48("387"), "Weryfikacja zadań"),
  configured: Boolean(stryMutAct_9fa48("390") ? OPENROUTER_API_KEY && OPENROUTER_VERIFIER_MODEL && SUPABASE_URL || SUPABASE_SERVICE_ROLE_KEY : stryMutAct_9fa48("389") ? false : stryMutAct_9fa48("388") ? true : (stryCov_9fa48("388", "389", "390"), (stryMutAct_9fa48("392") ? OPENROUTER_API_KEY && OPENROUTER_VERIFIER_MODEL || SUPABASE_URL : stryMutAct_9fa48("391") ? true : (stryCov_9fa48("391", "392"), (stryMutAct_9fa48("394") ? OPENROUTER_API_KEY || OPENROUTER_VERIFIER_MODEL : stryMutAct_9fa48("393") ? true : (stryCov_9fa48("393", "394"), OPENROUTER_API_KEY && OPENROUTER_VERIFIER_MODEL)) && SUPABASE_URL)) && SUPABASE_SERVICE_ROLE_KEY)),
  message: stryMutAct_9fa48("395") ? "" : (stryCov_9fa48("395"), "Weryfikacja zadań nie jest skonfigurowana — zatwierdzanie zadań jest wyłączone.")
})]);
export const missingConfigs = stryMutAct_9fa48("396") ? configStatuses : (stryCov_9fa48("396"), configStatuses.filter(stryMutAct_9fa48("397") ? () => undefined : (stryCov_9fa48("397"), s => stryMutAct_9fa48("398") ? s.configured : (stryCov_9fa48("398"), !s.configured))));