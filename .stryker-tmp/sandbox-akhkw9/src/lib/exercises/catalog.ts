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
import type { ExerciseDifficulty, ExerciseTopicSlug } from "@/types";
export const GRADE_4 = 4 as const;
export const DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = stryMutAct_9fa48("462") ? {} : (stryCov_9fa48("462"), {
  easy: stryMutAct_9fa48("463") ? "" : (stryCov_9fa48("463"), "Łatwy"),
  medium: stryMutAct_9fa48("464") ? "" : (stryCov_9fa48("464"), "Średni"),
  hard: stryMutAct_9fa48("465") ? "" : (stryCov_9fa48("465"), "Trudny")
});
export interface Grade4ExerciseTopic {
  slug: ExerciseTopicSlug;
  label: string;
  guidance: Record<ExerciseDifficulty, string>;
}
export const GRADE_4_EXERCISE_CATALOG: readonly Grade4ExerciseTopic[] = stryMutAct_9fa48("466") ? [] : (stryCov_9fa48("466"), [stryMutAct_9fa48("467") ? {} : (stryCov_9fa48("467"), {
  slug: stryMutAct_9fa48("468") ? "" : (stryCov_9fa48("468"), "addition-subtraction"),
  label: stryMutAct_9fa48("469") ? "" : (stryCov_9fa48("469"), "Dodawanie i odejmowanie liczb naturalnych"),
  guidance: stryMutAct_9fa48("470") ? {} : (stryCov_9fa48("470"), {
    easy: stryMutAct_9fa48("471") ? "" : (stryCov_9fa48("471"), "Jedno działanie na liczbach naturalnych do 100, bez przekraczania progu dziesiątkowego."),
    medium: stryMutAct_9fa48("472") ? "" : (stryCov_9fa48("472"), "Jedno działanie pisemne na liczbach naturalnych do 10 000, z przekraczaniem progów dziesiątkowych."),
    hard: stryMutAct_9fa48("473") ? "" : (stryCov_9fa48("473"), "Dwa kolejne działania dodawania lub odejmowania na liczbach naturalnych do 1 000 000.")
  })
}), stryMutAct_9fa48("474") ? {} : (stryCov_9fa48("474"), {
  slug: stryMutAct_9fa48("475") ? "" : (stryCov_9fa48("475"), "multiplication-division"),
  label: stryMutAct_9fa48("476") ? "" : (stryCov_9fa48("476"), "Mnożenie i dzielenie liczb naturalnych"),
  guidance: stryMutAct_9fa48("477") ? {} : (stryCov_9fa48("477"), {
    easy: stryMutAct_9fa48("478") ? "" : (stryCov_9fa48("478"), "Jedno mnożenie lub dzielenie w zakresie tabliczki mnożenia do 100; dzielenie bez reszty."),
    medium: stryMutAct_9fa48("479") ? "" : (stryCov_9fa48("479"), "Mnożenie liczby najwyżej trzycyfrowej przez jednocyfrową albo odpowiadające mu dzielenie bez reszty."),
    hard: stryMutAct_9fa48("480") ? "" : (stryCov_9fa48("480"), "Mnożenie dwóch liczb co najmniej dwucyfrowych albo dzielenie liczby wielocyfrowej przez jednocyfrową bez reszty.")
  })
}), stryMutAct_9fa48("481") ? {} : (stryCov_9fa48("481"), {
  slug: stryMutAct_9fa48("482") ? "" : (stryCov_9fa48("482"), "order-of-operations"),
  label: stryMutAct_9fa48("483") ? "" : (stryCov_9fa48("483"), "Kolejność wykonywania działań"),
  guidance: stryMutAct_9fa48("484") ? {} : (stryCov_9fa48("484"), {
    easy: stryMutAct_9fa48("485") ? "" : (stryCov_9fa48("485"), "Wyrażenie z dwoma działaniami na liczbach naturalnych do 100, wymagające pierwszeństwa mnożenia lub dzielenia."),
    medium: stryMutAct_9fa48("486") ? "" : (stryCov_9fa48("486"), "Wyrażenie z trzema działaniami na liczbach naturalnych do 1 000 i jedną parą nawiasów."),
    hard: stryMutAct_9fa48("487") ? "" : (stryCov_9fa48("487"), "Wyrażenie z co najmniej czterema działaniami na liczbach naturalnych do 10 000 i dwiema parami nawiasów.")
  })
}), stryMutAct_9fa48("488") ? {} : (stryCov_9fa48("488"), {
  slug: stryMutAct_9fa48("489") ? "" : (stryCov_9fa48("489"), "word-problems"),
  label: stryMutAct_9fa48("490") ? "" : (stryCov_9fa48("490"), "Zadania tekstowe na liczbach naturalnych"),
  guidance: stryMutAct_9fa48("491") ? {} : (stryCov_9fa48("491"), {
    easy: stryMutAct_9fa48("492") ? "" : (stryCov_9fa48("492"), "Krótki kontekst życia codziennego wymagający jednego dodawania albo odejmowania liczb naturalnych do 100."),
    medium: stryMutAct_9fa48("493") ? "" : (stryCov_9fa48("493"), "Kontekst życia codziennego wymagający dwóch kolejnych działań na liczbach naturalnych do 1 000."),
    hard: stryMutAct_9fa48("494") ? "" : (stryCov_9fa48("494"), "Wieloetapowy kontekst życia codziennego wymagający samodzielnego doboru co najmniej trzech działań na liczbach naturalnych.")
  })
})]);