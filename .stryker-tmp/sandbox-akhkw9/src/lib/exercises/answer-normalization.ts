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
const UNGROUPED_NATURAL_NUMBER_PATTERN = stryMutAct_9fa48("402") ? /^\D+$/u : stryMutAct_9fa48("401") ? /^\d$/u : stryMutAct_9fa48("400") ? /^\d+/u : stryMutAct_9fa48("399") ? /\d+$/u : (stryCov_9fa48("399", "400", "401", "402"), /^\d+$/u);
const GROUPED_NATURAL_NUMBER_PATTERN = stryMutAct_9fa48("409") ? /^\d{1,3}(?: \D{3})+$/u : stryMutAct_9fa48("408") ? /^\d{1,3}(?: \d)+$/u : stryMutAct_9fa48("407") ? /^\d{1,3}(?: \d{3})$/u : stryMutAct_9fa48("406") ? /^\D{1,3}(?: \d{3})+$/u : stryMutAct_9fa48("405") ? /^\d(?: \d{3})+$/u : stryMutAct_9fa48("404") ? /^\d{1,3}(?: \d{3})+/u : stryMutAct_9fa48("403") ? /\d{1,3}(?: \d{3})+$/u : (stryCov_9fa48("403", "404", "405", "406", "407", "408", "409"), /^\d{1,3}(?: \d{3})+$/u);
const NATURAL_NUMBER_TOKEN_PATTERN = stryMutAct_9fa48("424") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![\p{L}\P{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("423") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![\P{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("422") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![^\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("421") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?=[\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("420") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\D+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("419") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("418") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \D{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("417") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d)+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("416") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("415") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\D{1,3}(?: \d{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("414") ? /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d(?: \d{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("413") ? /(?<![\p{L}\P{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("412") ? /(?<![\P{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("411") ? /(?<![^\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : stryMutAct_9fa48("410") ? /(?<=[\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu : (stryCov_9fa48("410", "411", "412", "413", "414", "415", "416", "417", "418", "419", "420", "421", "422", "423", "424"), /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu);
export interface VerificationAnswerCanonicalization {
  comparisonKey: string;
  canonicalAnswer: string;
}
export function normalizeExerciseAnswer(value: string): string {
  if (stryMutAct_9fa48("425")) {
    {}
  } else {
    stryCov_9fa48("425");
    return stryMutAct_9fa48("427") ? value.normalize("NFC").replace(/\s+/gu, " ").toLocaleLowerCase("pl-PL").replace(/\.$/u, "") : stryMutAct_9fa48("426") ? value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleUpperCase("pl-PL").replace(/\.$/u, "") : (stryCov_9fa48("426", "427"), value.normalize(stryMutAct_9fa48("428") ? "" : (stryCov_9fa48("428"), "NFC")).trim().replace(stryMutAct_9fa48("430") ? /\S+/gu : stryMutAct_9fa48("429") ? /\s/gu : (stryCov_9fa48("429", "430"), /\s+/gu), stryMutAct_9fa48("431") ? "" : (stryCov_9fa48("431"), " ")).toLocaleLowerCase(stryMutAct_9fa48("432") ? "" : (stryCov_9fa48("432"), "pl-PL")).replace(stryMutAct_9fa48("433") ? /\./u : (stryCov_9fa48("433"), /\.$/u), stryMutAct_9fa48("434") ? "Stryker was here!" : (stryCov_9fa48("434"), "")));
  }
}
function canonicalizeNaturalNumber(value: string): string {
  if (stryMutAct_9fa48("435")) {
    {}
  } else {
    stryCov_9fa48("435");
    return value.replaceAll(stryMutAct_9fa48("436") ? "" : (stryCov_9fa48("436"), " "), stryMutAct_9fa48("437") ? "Stryker was here!" : (stryCov_9fa48("437"), "")).replace(stryMutAct_9fa48("441") ? /^0+(?=\D)/u : stryMutAct_9fa48("440") ? /^0+(?!\d)/u : stryMutAct_9fa48("439") ? /^0(?=\d)/u : stryMutAct_9fa48("438") ? /0+(?=\d)/u : (stryCov_9fa48("438", "439", "440", "441"), /^0+(?=\d)/u), stryMutAct_9fa48("442") ? "Stryker was here!" : (stryCov_9fa48("442"), ""));
  }
}
export function canonicalizeExerciseAnswerForVerification(value: string): VerificationAnswerCanonicalization {
  if (stryMutAct_9fa48("443")) {
    {}
  } else {
    stryCov_9fa48("443");
    const normalizedAnswer = normalizeExerciseAnswer(value);
    let numericAnswer: string | undefined;
    if (stryMutAct_9fa48("446") ? UNGROUPED_NATURAL_NUMBER_PATTERN.test(normalizedAnswer) && GROUPED_NATURAL_NUMBER_PATTERN.test(normalizedAnswer) : stryMutAct_9fa48("445") ? false : stryMutAct_9fa48("444") ? true : (stryCov_9fa48("444", "445", "446"), UNGROUPED_NATURAL_NUMBER_PATTERN.test(normalizedAnswer) || GROUPED_NATURAL_NUMBER_PATTERN.test(normalizedAnswer))) {
      if (stryMutAct_9fa48("447")) {
        {}
      } else {
        stryCov_9fa48("447");
        numericAnswer = normalizedAnswer;
      }
    } else {
      if (stryMutAct_9fa48("448")) {
        {}
      } else {
        stryCov_9fa48("448");
        const numericTokens = stryMutAct_9fa48("449") ? [] : (stryCov_9fa48("449"), [...normalizedAnswer.matchAll(NATURAL_NUMBER_TOKEN_PATTERN)]);
        if (stryMutAct_9fa48("452") ? numericTokens.length !== 1 : stryMutAct_9fa48("451") ? false : stryMutAct_9fa48("450") ? true : (stryCov_9fa48("450", "451", "452"), numericTokens.length === 1)) {
          if (stryMutAct_9fa48("453")) {
            {}
          } else {
            stryCov_9fa48("453");
            numericAnswer = numericTokens[0][0];
          }
        }
      }
    }
    if (stryMutAct_9fa48("456") ? numericAnswer === undefined : stryMutAct_9fa48("455") ? false : stryMutAct_9fa48("454") ? true : (stryCov_9fa48("454", "455", "456"), numericAnswer !== undefined)) {
      if (stryMutAct_9fa48("457")) {
        {}
      } else {
        stryCov_9fa48("457");
        const canonicalAnswer = canonicalizeNaturalNumber(numericAnswer);
        return stryMutAct_9fa48("458") ? {} : (stryCov_9fa48("458"), {
          comparisonKey: stryMutAct_9fa48("459") ? `` : (stryCov_9fa48("459"), `natural-number:${canonicalAnswer}`),
          canonicalAnswer
        });
      }
    }
    return stryMutAct_9fa48("460") ? {} : (stryCov_9fa48("460"), {
      comparisonKey: stryMutAct_9fa48("461") ? `` : (stryCov_9fa48("461"), `literal:${normalizedAnswer}`),
      canonicalAnswer: normalizedAnswer
    });
  }
}