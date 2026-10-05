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
export function exerciseNoun(count: number): string {
  if (stryMutAct_9fa48("495")) {
    {}
  } else {
    stryCov_9fa48("495");
    if (stryMutAct_9fa48("498") ? count !== 1 : stryMutAct_9fa48("497") ? false : stryMutAct_9fa48("496") ? true : (stryCov_9fa48("496", "497", "498"), count === 1)) return stryMutAct_9fa48("499") ? "" : (stryCov_9fa48("499"), "zadanie");
    const lastTwoDigits = stryMutAct_9fa48("500") ? count * 100 : (stryCov_9fa48("500"), count % 100);
    const lastDigit = stryMutAct_9fa48("501") ? count * 10 : (stryCov_9fa48("501"), count % 10);
    if (stryMutAct_9fa48("504") ? lastDigit >= 2 && lastDigit <= 4 || !(lastTwoDigits >= 12 && lastTwoDigits <= 14) : stryMutAct_9fa48("503") ? false : stryMutAct_9fa48("502") ? true : (stryCov_9fa48("502", "503", "504"), (stryMutAct_9fa48("506") ? lastDigit >= 2 || lastDigit <= 4 : stryMutAct_9fa48("505") ? true : (stryCov_9fa48("505", "506"), (stryMutAct_9fa48("509") ? lastDigit < 2 : stryMutAct_9fa48("508") ? lastDigit > 2 : stryMutAct_9fa48("507") ? true : (stryCov_9fa48("507", "508", "509"), lastDigit >= 2)) && (stryMutAct_9fa48("512") ? lastDigit > 4 : stryMutAct_9fa48("511") ? lastDigit < 4 : stryMutAct_9fa48("510") ? true : (stryCov_9fa48("510", "511", "512"), lastDigit <= 4)))) && (stryMutAct_9fa48("513") ? lastTwoDigits >= 12 && lastTwoDigits <= 14 : (stryCov_9fa48("513"), !(stryMutAct_9fa48("516") ? lastTwoDigits >= 12 || lastTwoDigits <= 14 : stryMutAct_9fa48("515") ? false : stryMutAct_9fa48("514") ? true : (stryCov_9fa48("514", "515", "516"), (stryMutAct_9fa48("519") ? lastTwoDigits < 12 : stryMutAct_9fa48("518") ? lastTwoDigits > 12 : stryMutAct_9fa48("517") ? true : (stryCov_9fa48("517", "518", "519"), lastTwoDigits >= 12)) && (stryMutAct_9fa48("522") ? lastTwoDigits > 14 : stryMutAct_9fa48("521") ? lastTwoDigits < 14 : stryMutAct_9fa48("520") ? true : (stryCov_9fa48("520", "521", "522"), lastTwoDigits <= 14)))))))) return stryMutAct_9fa48("523") ? "" : (stryCov_9fa48("523"), "zadania");
    return stryMutAct_9fa48("524") ? "" : (stryCov_9fa48("524"), "zadań");
  }
}