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
import { useCallback, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { exerciseCandidateSchema, exerciseGenerationSuccessSchema, exerciseVerificationResultSchema } from "@/lib/exercises/schemas";
import type { ExerciseApprovalMapping, ExerciseCandidate, ExerciseGenerationSuccess, ExerciseGenerationSuccessMetadata, ExerciseVerificationResult } from "@/types";
const STORAGE_KEY = stryMutAct_9fa48("0") ? "" : (stryCov_9fa48("0"), "latest-successful-exercise-batch");
const STORAGE_VERSION = 2;
export type ExerciseReviewStatus = "unverified" | "unique_answer" | "answer_mismatch" | "not_unique_answer" | "indeterminate";
export type ExerciseReviewCandidate = {
  candidate: ExerciseCandidate;
  status: "unverified";
} | {
  candidate: ExerciseCandidate;
  status: Exclude<ExerciseReviewStatus, "unverified">;
  evidence: ExerciseVerificationResult;
};
export interface ExerciseReviewBatch extends ExerciseGenerationSuccessMetadata {
  candidates: ExerciseReviewCandidate[];
  selectedVerificationIds: string[];
}
interface StoredExerciseBatch {
  version: typeof STORAGE_VERSION;
  batch: ExerciseReviewBatch;
}
const validExerciseCountSchema = z.union(stryMutAct_9fa48("1") ? [] : (stryCov_9fa48("1"), [z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]));
const exerciseReviewCandidateSchema = z.object(stryMutAct_9fa48("2") ? {} : (stryCov_9fa48("2"), {
  candidate: exerciseCandidateSchema,
  status: z.enum(stryMutAct_9fa48("3") ? [] : (stryCov_9fa48("3"), [stryMutAct_9fa48("4") ? "" : (stryCov_9fa48("4"), "unverified"), stryMutAct_9fa48("5") ? "" : (stryCov_9fa48("5"), "unique_answer"), stryMutAct_9fa48("6") ? "" : (stryCov_9fa48("6"), "answer_mismatch"), stryMutAct_9fa48("7") ? "" : (stryCov_9fa48("7"), "not_unique_answer"), stryMutAct_9fa48("8") ? "" : (stryCov_9fa48("8"), "indeterminate")])),
  evidence: exerciseVerificationResultSchema.optional()
})).strict().superRefine((reviewCandidate, context) => {
  if (stryMutAct_9fa48("9")) {
    {}
  } else {
    stryCov_9fa48("9");
    if (stryMutAct_9fa48("12") ? reviewCandidate.status !== "unverified" : stryMutAct_9fa48("11") ? false : stryMutAct_9fa48("10") ? true : (stryCov_9fa48("10", "11", "12"), reviewCandidate.status === (stryMutAct_9fa48("13") ? "" : (stryCov_9fa48("13"), "unverified")))) {
      if (stryMutAct_9fa48("14")) {
        {}
      } else {
        stryCov_9fa48("14");
        if (stryMutAct_9fa48("17") ? reviewCandidate.evidence === undefined : stryMutAct_9fa48("16") ? false : stryMutAct_9fa48("15") ? true : (stryCov_9fa48("15", "16", "17"), reviewCandidate.evidence !== undefined)) {
          if (stryMutAct_9fa48("18")) {
            {}
          } else {
            stryCov_9fa48("18");
            context.addIssue(stryMutAct_9fa48("20") ? {} : (stryCov_9fa48("20"), {
              code: stryMutAct_9fa48("21") ? "" : (stryCov_9fa48("21"), "custom"),
              path: stryMutAct_9fa48("22") ? [] : (stryCov_9fa48("22"), [stryMutAct_9fa48("23") ? "" : (stryCov_9fa48("23"), "evidence")]),
              message: stryMutAct_9fa48("24") ? "" : (stryCov_9fa48("24"), "Unverified candidates cannot have evidence")
            }));
          }
        }
        return;
      }
    }
    if (stryMutAct_9fa48("27") ? reviewCandidate.evidence?.outcome !== reviewCandidate.status && reviewCandidate.evidence.candidateId !== reviewCandidate.candidate.id : stryMutAct_9fa48("26") ? false : stryMutAct_9fa48("25") ? true : (stryCov_9fa48("25", "26", "27"), (stryMutAct_9fa48("29") ? reviewCandidate.evidence?.outcome === reviewCandidate.status : stryMutAct_9fa48("28") ? false : (stryCov_9fa48("28", "29"), (stryMutAct_9fa48("30") ? reviewCandidate.evidence.outcome : (stryCov_9fa48("30"), reviewCandidate.evidence?.outcome)) !== reviewCandidate.status)) || (stryMutAct_9fa48("32") ? reviewCandidate.evidence.candidateId === reviewCandidate.candidate.id : stryMutAct_9fa48("31") ? false : (stryCov_9fa48("31", "32"), reviewCandidate.evidence.candidateId !== reviewCandidate.candidate.id)))) {
      if (stryMutAct_9fa48("33")) {
        {}
      } else {
        stryCov_9fa48("33");
        context.addIssue(stryMutAct_9fa48("35") ? {} : (stryCov_9fa48("35"), {
          code: stryMutAct_9fa48("36") ? "" : (stryCov_9fa48("36"), "custom"),
          path: stryMutAct_9fa48("37") ? [] : (stryCov_9fa48("37"), [stryMutAct_9fa48("38") ? "" : (stryCov_9fa48("38"), "evidence")]),
          message: stryMutAct_9fa48("39") ? "" : (stryCov_9fa48("39"), "Evidence must match the candidate and review status")
        }));
      }
    }
  }
});
const exerciseReviewBatchSchema = z.object(stryMutAct_9fa48("40") ? {} : (stryCov_9fa48("40"), {
  requestedCount: z.literal(5),
  validCount: validExerciseCountSchema,
  partial_batch: z.literal(stryMutAct_9fa48("41") ? false : (stryCov_9fa48("41"), true)).optional(),
  candidates: stryMutAct_9fa48("43") ? z.array(exerciseReviewCandidateSchema).max(1).max(5) : stryMutAct_9fa48("42") ? z.array(exerciseReviewCandidateSchema).min(1).min(5) : (stryCov_9fa48("42", "43"), z.array(exerciseReviewCandidateSchema).min(1).max(5)),
  selectedVerificationIds: stryMutAct_9fa48("44") ? z.array(z.uuid()).min(5) : (stryCov_9fa48("44"), z.array(z.uuid()).max(5))
})).strict().superRefine((batch, context) => {
  if (stryMutAct_9fa48("45")) {
    {}
  } else {
    stryCov_9fa48("45");
    if (stryMutAct_9fa48("48") ? batch.candidates.length === batch.validCount : stryMutAct_9fa48("47") ? false : stryMutAct_9fa48("46") ? true : (stryCov_9fa48("46", "47", "48"), batch.candidates.length !== batch.validCount)) {
      if (stryMutAct_9fa48("49")) {
        {}
      } else {
        stryCov_9fa48("49");
        context.addIssue(stryMutAct_9fa48("51") ? {} : (stryCov_9fa48("51"), {
          code: stryMutAct_9fa48("52") ? "" : (stryCov_9fa48("52"), "custom"),
          path: stryMutAct_9fa48("53") ? [] : (stryCov_9fa48("53"), [stryMutAct_9fa48("54") ? "" : (stryCov_9fa48("54"), "validCount")]),
          message: stryMutAct_9fa48("55") ? "" : (stryCov_9fa48("55"), "validCount must match candidates")
        }));
      }
    }
    if (stryMutAct_9fa48("58") ? batch.validCount < batch.requestedCount === (batch.partial_batch === true) : stryMutAct_9fa48("57") ? false : stryMutAct_9fa48("56") ? true : (stryCov_9fa48("56", "57", "58"), (stryMutAct_9fa48("62") ? batch.validCount >= batch.requestedCount : stryMutAct_9fa48("61") ? batch.validCount <= batch.requestedCount : stryMutAct_9fa48("60") ? false : stryMutAct_9fa48("59") ? true : (stryCov_9fa48("59", "60", "61", "62"), batch.validCount < batch.requestedCount)) !== (stryMutAct_9fa48("65") ? batch.partial_batch !== true : stryMutAct_9fa48("64") ? false : stryMutAct_9fa48("63") ? true : (stryCov_9fa48("63", "64", "65"), batch.partial_batch === (stryMutAct_9fa48("66") ? false : (stryCov_9fa48("66"), true)))))) {
      if (stryMutAct_9fa48("67")) {
        {}
      } else {
        stryCov_9fa48("67");
        context.addIssue(stryMutAct_9fa48("69") ? {} : (stryCov_9fa48("69"), {
          code: stryMutAct_9fa48("70") ? "" : (stryCov_9fa48("70"), "custom"),
          path: stryMutAct_9fa48("71") ? [] : (stryCov_9fa48("71"), [stryMutAct_9fa48("72") ? "" : (stryCov_9fa48("72"), "partial_batch")]),
          message: stryMutAct_9fa48("73") ? "" : (stryCov_9fa48("73"), "partial_batch must match validCount")
        }));
      }
    }
    const successfulVerificationIds = new Set(batch.candidates.flatMap(stryMutAct_9fa48("74") ? () => undefined : (stryCov_9fa48("74"), reviewCandidate => (stryMutAct_9fa48("77") ? reviewCandidate.status === "unique_answer" || reviewCandidate.evidence?.outcome === "unique_answer" : stryMutAct_9fa48("76") ? false : stryMutAct_9fa48("75") ? true : (stryCov_9fa48("75", "76", "77"), (stryMutAct_9fa48("79") ? reviewCandidate.status !== "unique_answer" : stryMutAct_9fa48("78") ? true : (stryCov_9fa48("78", "79"), reviewCandidate.status === (stryMutAct_9fa48("80") ? "" : (stryCov_9fa48("80"), "unique_answer")))) && (stryMutAct_9fa48("82") ? reviewCandidate.evidence?.outcome !== "unique_answer" : stryMutAct_9fa48("81") ? true : (stryCov_9fa48("81", "82"), (stryMutAct_9fa48("83") ? reviewCandidate.evidence.outcome : (stryCov_9fa48("83"), reviewCandidate.evidence?.outcome)) === (stryMutAct_9fa48("84") ? "" : (stryCov_9fa48("84"), "unique_answer")))))) ? stryMutAct_9fa48("85") ? [] : (stryCov_9fa48("85"), [reviewCandidate.evidence.verificationId]) : stryMutAct_9fa48("86") ? ["Stryker was here"] : (stryCov_9fa48("86"), []))));
    if (stryMutAct_9fa48("89") ? new Set(batch.selectedVerificationIds).size !== batch.selectedVerificationIds.length && batch.selectedVerificationIds.some(verificationId => !successfulVerificationIds.has(verificationId)) : stryMutAct_9fa48("88") ? false : stryMutAct_9fa48("87") ? true : (stryCov_9fa48("87", "88", "89"), (stryMutAct_9fa48("91") ? new Set(batch.selectedVerificationIds).size === batch.selectedVerificationIds.length : stryMutAct_9fa48("90") ? false : (stryCov_9fa48("90", "91"), new Set(batch.selectedVerificationIds).size !== batch.selectedVerificationIds.length)) || (stryMutAct_9fa48("92") ? batch.selectedVerificationIds.every(verificationId => !successfulVerificationIds.has(verificationId)) : (stryCov_9fa48("92"), batch.selectedVerificationIds.some(stryMutAct_9fa48("93") ? () => undefined : (stryCov_9fa48("93"), verificationId => stryMutAct_9fa48("94") ? successfulVerificationIds.has(verificationId) : (stryCov_9fa48("94"), !successfulVerificationIds.has(verificationId)))))))) {
      if (stryMutAct_9fa48("95")) {
        {}
      } else {
        stryCov_9fa48("95");
        context.addIssue(stryMutAct_9fa48("97") ? {} : (stryCov_9fa48("97"), {
          code: stryMutAct_9fa48("98") ? "" : (stryCov_9fa48("98"), "custom"),
          path: stryMutAct_9fa48("99") ? [] : (stryCov_9fa48("99"), [stryMutAct_9fa48("100") ? "" : (stryCov_9fa48("100"), "selectedVerificationIds")]),
          message: stryMutAct_9fa48("101") ? "" : (stryCov_9fa48("101"), "Only distinct successful verifications may be selected")
        }));
      }
    }
  }
});
function unsubscribeFromHydration(): void {
  if (stryMutAct_9fa48("102")) {
    {}
  } else {
    stryCov_9fa48("102");
    return;
  }
}
function subscribeToHydration(): () => void {
  if (stryMutAct_9fa48("103")) {
    {}
  } else {
    stryCov_9fa48("103");
    return unsubscribeFromHydration;
  }
}
const getClientSnapshot = stryMutAct_9fa48("104") ? () => undefined : (stryCov_9fa48("104"), (() => {
  const getClientSnapshot = () => stryMutAct_9fa48("105") ? false : (stryCov_9fa48("105"), true);
  return getClientSnapshot;
})());
const getServerSnapshot = stryMutAct_9fa48("106") ? () => undefined : (stryCov_9fa48("106"), (() => {
  const getServerSnapshot = () => stryMutAct_9fa48("107") ? true : (stryCov_9fa48("107"), false);
  return getServerSnapshot;
})());
export function createExerciseReviewBatch(batch: ExerciseGenerationSuccess): ExerciseReviewBatch {
  if (stryMutAct_9fa48("108")) {
    {}
  } else {
    stryCov_9fa48("108");
    return stryMutAct_9fa48("109") ? {} : (stryCov_9fa48("109"), {
      requestedCount: batch.requestedCount,
      validCount: batch.validCount,
      ...(batch.partial_batch ? stryMutAct_9fa48("110") ? {} : (stryCov_9fa48("110"), {
        partial_batch: true as const
      }) : {}),
      candidates: batch.candidates.map(stryMutAct_9fa48("111") ? () => undefined : (stryCov_9fa48("111"), candidate => stryMutAct_9fa48("112") ? {} : (stryCov_9fa48("112"), {
        candidate,
        status: stryMutAct_9fa48("113") ? "" : (stryCov_9fa48("113"), "unverified")
      }))),
      selectedVerificationIds: stryMutAct_9fa48("114") ? ["Stryker was here"] : (stryCov_9fa48("114"), [])
    });
  }
}
export function restoreSessionExerciseBatch(storage: Storage): ExerciseReviewBatch | null {
  if (stryMutAct_9fa48("115")) {
    {}
  } else {
    stryCov_9fa48("115");
    try {
      if (stryMutAct_9fa48("116")) {
        {}
      } else {
        stryCov_9fa48("116");
        const storedValue = storage.getItem(STORAGE_KEY);
        if (stryMutAct_9fa48("119") ? false : stryMutAct_9fa48("118") ? true : stryMutAct_9fa48("117") ? storedValue : (stryCov_9fa48("117", "118", "119"), !storedValue)) {
          if (stryMutAct_9fa48("120")) {
            {}
          } else {
            stryCov_9fa48("120");
            return null;
          }
        }
        const parsedValue = JSON.parse(storedValue) as unknown;
        if (stryMutAct_9fa48("123") ? (typeof parsedValue !== "object" || parsedValue === null || !("version" in parsedValue)) && !("batch" in parsedValue) : stryMutAct_9fa48("122") ? false : stryMutAct_9fa48("121") ? true : (stryCov_9fa48("121", "122", "123"), (stryMutAct_9fa48("125") ? (typeof parsedValue !== "object" || parsedValue === null) && !("version" in parsedValue) : stryMutAct_9fa48("124") ? false : (stryCov_9fa48("124", "125"), (stryMutAct_9fa48("127") ? typeof parsedValue !== "object" && parsedValue === null : stryMutAct_9fa48("126") ? false : (stryCov_9fa48("126", "127"), (stryMutAct_9fa48("129") ? typeof parsedValue === "object" : stryMutAct_9fa48("128") ? false : (stryCov_9fa48("128", "129"), typeof parsedValue !== (stryMutAct_9fa48("130") ? "" : (stryCov_9fa48("130"), "object")))) || (stryMutAct_9fa48("132") ? parsedValue !== null : stryMutAct_9fa48("131") ? false : (stryCov_9fa48("131", "132"), parsedValue === null)))) || (stryMutAct_9fa48("133") ? "version" in parsedValue : (stryCov_9fa48("133"), !((stryMutAct_9fa48("134") ? "" : (stryCov_9fa48("134"), "version")) in parsedValue))))) || (stryMutAct_9fa48("135") ? "batch" in parsedValue : (stryCov_9fa48("135"), !((stryMutAct_9fa48("136") ? "" : (stryCov_9fa48("136"), "batch")) in parsedValue))))) {
          if (stryMutAct_9fa48("137")) {
            {}
          } else {
            stryCov_9fa48("137");
            if (stryMutAct_9fa48("138")) {
              ;
            } else {
              stryCov_9fa48("138");
              clearSessionExerciseBatch(storage);
            }
            return null;
          }
        }
        if (stryMutAct_9fa48("141") ? parsedValue.version !== 1 : stryMutAct_9fa48("140") ? false : stryMutAct_9fa48("139") ? true : (stryCov_9fa48("139", "140", "141"), parsedValue.version === 1)) {
          if (stryMutAct_9fa48("142")) {
            {}
          } else {
            stryCov_9fa48("142");
            const parsedGenerationBatch = exerciseGenerationSuccessSchema.safeParse(parsedValue.batch);
            if (stryMutAct_9fa48("145") ? false : stryMutAct_9fa48("144") ? true : stryMutAct_9fa48("143") ? parsedGenerationBatch.success : (stryCov_9fa48("143", "144", "145"), !parsedGenerationBatch.success)) {
              if (stryMutAct_9fa48("146")) {
                {}
              } else {
                stryCov_9fa48("146");
                if (stryMutAct_9fa48("147")) {
                  ;
                } else {
                  stryCov_9fa48("147");
                  clearSessionExerciseBatch(storage);
                }
                return null;
              }
            }
            const migratedBatch = createExerciseReviewBatch(parsedGenerationBatch.data);
            if (stryMutAct_9fa48("148")) {
              ;
            } else {
              stryCov_9fa48("148");
              storeSessionExerciseBatch(storage, migratedBatch);
            }
            return migratedBatch;
          }
        }
        if (stryMutAct_9fa48("151") ? parsedValue.version === STORAGE_VERSION : stryMutAct_9fa48("150") ? false : stryMutAct_9fa48("149") ? true : (stryCov_9fa48("149", "150", "151"), parsedValue.version !== STORAGE_VERSION)) {
          if (stryMutAct_9fa48("152")) {
            {}
          } else {
            stryCov_9fa48("152");
            if (stryMutAct_9fa48("153")) {
              ;
            } else {
              stryCov_9fa48("153");
              clearSessionExerciseBatch(storage);
            }
            return null;
          }
        }
        const parsedBatch = exerciseReviewBatchSchema.safeParse(parsedValue.batch);
        if (stryMutAct_9fa48("156") ? false : stryMutAct_9fa48("155") ? true : stryMutAct_9fa48("154") ? parsedBatch.success : (stryCov_9fa48("154", "155", "156"), !parsedBatch.success)) {
          if (stryMutAct_9fa48("157")) {
            {}
          } else {
            stryCov_9fa48("157");
            if (stryMutAct_9fa48("158")) {
              ;
            } else {
              stryCov_9fa48("158");
              clearSessionExerciseBatch(storage);
            }
            return null;
          }
        }
        return parsedBatch.data as ExerciseReviewBatch;
      }
    } catch {
      if (stryMutAct_9fa48("159")) {
        {}
      } else {
        stryCov_9fa48("159");
        if (stryMutAct_9fa48("160")) {
          ;
        } else {
          stryCov_9fa48("160");
          clearSessionExerciseBatch(storage);
        }
        return null;
      }
    }
  }
}
export function storeSessionExerciseBatch(storage: Storage, batch: ExerciseReviewBatch): void {
  if (stryMutAct_9fa48("161")) {
    {}
  } else {
    stryCov_9fa48("161");
    const storedBatch: StoredExerciseBatch = stryMutAct_9fa48("162") ? {} : (stryCov_9fa48("162"), {
      version: STORAGE_VERSION,
      batch
    });
    if (stryMutAct_9fa48("163")) {
      ;
    } else {
      stryCov_9fa48("163");
      storage.setItem(STORAGE_KEY, JSON.stringify(storedBatch));
    }
  }
}
export function clearSessionExerciseBatch(storage: Storage): void {
  if (stryMutAct_9fa48("164")) {
    {}
  } else {
    stryCov_9fa48("164");
    try {
      if (stryMutAct_9fa48("165")) {
        {}
      } else {
        stryCov_9fa48("165");
        if (stryMutAct_9fa48("166")) {
          ;
        } else {
          stryCov_9fa48("166");
          storage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // The in-memory batch remains usable when browser storage is unavailable.
    }
  }
}
export function applyExerciseVerificationResults(batch: ExerciseReviewBatch, results: ExerciseVerificationResult[]): ExerciseReviewBatch {
  if (stryMutAct_9fa48("167")) {
    {}
  } else {
    stryCov_9fa48("167");
    const resultByCandidateId = new Map(results.map(stryMutAct_9fa48("168") ? () => undefined : (stryCov_9fa48("168"), result => stryMutAct_9fa48("169") ? [] : (stryCov_9fa48("169"), [result.candidateId, result]))));
    const candidateIds = new Set(batch.candidates.map(stryMutAct_9fa48("170") ? () => undefined : (stryCov_9fa48("170"), ({
      candidate
    }) => candidate.id)));
    if (stryMutAct_9fa48("173") ? resultByCandidateId.size !== results.length && results.some(result => !candidateIds.has(result.candidateId)) : stryMutAct_9fa48("172") ? false : stryMutAct_9fa48("171") ? true : (stryCov_9fa48("171", "172", "173"), (stryMutAct_9fa48("175") ? resultByCandidateId.size === results.length : stryMutAct_9fa48("174") ? false : (stryCov_9fa48("174", "175"), resultByCandidateId.size !== results.length)) || (stryMutAct_9fa48("176") ? results.every(result => !candidateIds.has(result.candidateId)) : (stryCov_9fa48("176"), results.some(stryMutAct_9fa48("177") ? () => undefined : (stryCov_9fa48("177"), result => stryMutAct_9fa48("178") ? candidateIds.has(result.candidateId) : (stryCov_9fa48("178"), !candidateIds.has(result.candidateId)))))))) {
      if (stryMutAct_9fa48("179")) {
        {}
      } else {
        stryCov_9fa48("179");
        return batch;
      }
    }
    const candidates = batch.candidates.map(reviewCandidate => {
      if (stryMutAct_9fa48("180")) {
        {}
      } else {
        stryCov_9fa48("180");
        const result = resultByCandidateId.get(reviewCandidate.candidate.id);
        if (stryMutAct_9fa48("183") ? reviewCandidate.status !== "unverified" || reviewCandidate.status !== "indeterminate" : stryMutAct_9fa48("182") ? false : stryMutAct_9fa48("181") ? true : (stryCov_9fa48("181", "182", "183"), (stryMutAct_9fa48("185") ? reviewCandidate.status === "unverified" : stryMutAct_9fa48("184") ? true : (stryCov_9fa48("184", "185"), reviewCandidate.status !== (stryMutAct_9fa48("186") ? "" : (stryCov_9fa48("186"), "unverified")))) && (stryMutAct_9fa48("188") ? reviewCandidate.status === "indeterminate" : stryMutAct_9fa48("187") ? true : (stryCov_9fa48("187", "188"), reviewCandidate.status !== (stryMutAct_9fa48("189") ? "" : (stryCov_9fa48("189"), "indeterminate")))))) {
          if (stryMutAct_9fa48("190")) {
            {}
          } else {
            stryCov_9fa48("190");
            return reviewCandidate;
          }
        }
        return result ? stryMutAct_9fa48("191") ? {} : (stryCov_9fa48("191"), {
          candidate: reviewCandidate.candidate,
          status: result.outcome,
          evidence: result
        }) : reviewCandidate;
      }
    });
    const successfulVerificationIds = new Set(candidates.flatMap(stryMutAct_9fa48("192") ? () => undefined : (stryCov_9fa48("192"), reviewCandidate => (stryMutAct_9fa48("195") ? reviewCandidate.status === "unique_answer" || reviewCandidate.evidence.outcome === "unique_answer" : stryMutAct_9fa48("194") ? false : stryMutAct_9fa48("193") ? true : (stryCov_9fa48("193", "194", "195"), (stryMutAct_9fa48("197") ? reviewCandidate.status !== "unique_answer" : stryMutAct_9fa48("196") ? true : (stryCov_9fa48("196", "197"), reviewCandidate.status === (stryMutAct_9fa48("198") ? "" : (stryCov_9fa48("198"), "unique_answer")))) && (stryMutAct_9fa48("200") ? reviewCandidate.evidence.outcome !== "unique_answer" : stryMutAct_9fa48("199") ? true : (stryCov_9fa48("199", "200"), reviewCandidate.evidence.outcome === (stryMutAct_9fa48("201") ? "" : (stryCov_9fa48("201"), "unique_answer")))))) ? stryMutAct_9fa48("202") ? [] : (stryCov_9fa48("202"), [reviewCandidate.evidence.verificationId]) : stryMutAct_9fa48("203") ? ["Stryker was here"] : (stryCov_9fa48("203"), []))));
    return stryMutAct_9fa48("204") ? {} : (stryCov_9fa48("204"), {
      ...batch,
      candidates,
      selectedVerificationIds: stryMutAct_9fa48("205") ? batch.selectedVerificationIds : (stryCov_9fa48("205"), batch.selectedVerificationIds.filter(stryMutAct_9fa48("206") ? () => undefined : (stryCov_9fa48("206"), id => successfulVerificationIds.has(id))))
    });
  }
}
export function selectExerciseVerification(batch: ExerciseReviewBatch, verificationId: string, selected: boolean): ExerciseReviewBatch {
  if (stryMutAct_9fa48("207")) {
    {}
  } else {
    stryCov_9fa48("207");
    const isSuccessful = stryMutAct_9fa48("208") ? batch.candidates.every(reviewCandidate => reviewCandidate.status === "unique_answer" && reviewCandidate.evidence.outcome === "unique_answer" && reviewCandidate.evidence.verificationId === verificationId) : (stryCov_9fa48("208"), batch.candidates.some(stryMutAct_9fa48("209") ? () => undefined : (stryCov_9fa48("209"), reviewCandidate => stryMutAct_9fa48("212") ? reviewCandidate.status === "unique_answer" && reviewCandidate.evidence.outcome === "unique_answer" || reviewCandidate.evidence.verificationId === verificationId : stryMutAct_9fa48("211") ? false : stryMutAct_9fa48("210") ? true : (stryCov_9fa48("210", "211", "212"), (stryMutAct_9fa48("214") ? reviewCandidate.status === "unique_answer" || reviewCandidate.evidence.outcome === "unique_answer" : stryMutAct_9fa48("213") ? true : (stryCov_9fa48("213", "214"), (stryMutAct_9fa48("216") ? reviewCandidate.status !== "unique_answer" : stryMutAct_9fa48("215") ? true : (stryCov_9fa48("215", "216"), reviewCandidate.status === (stryMutAct_9fa48("217") ? "" : (stryCov_9fa48("217"), "unique_answer")))) && (stryMutAct_9fa48("219") ? reviewCandidate.evidence.outcome !== "unique_answer" : stryMutAct_9fa48("218") ? true : (stryCov_9fa48("218", "219"), reviewCandidate.evidence.outcome === (stryMutAct_9fa48("220") ? "" : (stryCov_9fa48("220"), "unique_answer")))))) && (stryMutAct_9fa48("222") ? reviewCandidate.evidence.verificationId !== verificationId : stryMutAct_9fa48("221") ? true : (stryCov_9fa48("221", "222"), reviewCandidate.evidence.verificationId === verificationId))))));
    if (stryMutAct_9fa48("225") ? false : stryMutAct_9fa48("224") ? true : stryMutAct_9fa48("223") ? isSuccessful : (stryCov_9fa48("223", "224", "225"), !isSuccessful)) {
      if (stryMutAct_9fa48("226")) {
        {}
      } else {
        stryCov_9fa48("226");
        return batch;
      }
    }
    const selectedVerificationIds = selected ? stryMutAct_9fa48("227") ? [] : (stryCov_9fa48("227"), [...new Set(stryMutAct_9fa48("228") ? [] : (stryCov_9fa48("228"), [...batch.selectedVerificationIds, verificationId]))]) : stryMutAct_9fa48("229") ? batch.selectedVerificationIds : (stryCov_9fa48("229"), batch.selectedVerificationIds.filter(stryMutAct_9fa48("230") ? () => undefined : (stryCov_9fa48("230"), id => stryMutAct_9fa48("233") ? id === verificationId : stryMutAct_9fa48("232") ? false : stryMutAct_9fa48("231") ? true : (stryCov_9fa48("231", "232", "233"), id !== verificationId))));
    return stryMutAct_9fa48("234") ? {} : (stryCov_9fa48("234"), {
      ...batch,
      selectedVerificationIds
    });
  }
}
export function removeApprovedExerciseCandidates(batch: ExerciseReviewBatch, mappings: ExerciseApprovalMapping[]): ExerciseReviewBatch | null {
  if (stryMutAct_9fa48("235")) {
    {}
  } else {
    stryCov_9fa48("235");
    const savedVerificationIds = new Set(mappings.map(stryMutAct_9fa48("236") ? () => undefined : (stryCov_9fa48("236"), ({
      verificationId
    }) => verificationId)));
    const candidates = stryMutAct_9fa48("237") ? batch.candidates : (stryCov_9fa48("237"), batch.candidates.filter(stryMutAct_9fa48("238") ? () => undefined : (stryCov_9fa48("238"), reviewCandidate => stryMutAct_9fa48("241") ? (reviewCandidate.status !== "unique_answer" || reviewCandidate.evidence.outcome !== "unique_answer") && !savedVerificationIds.has(reviewCandidate.evidence.verificationId) : stryMutAct_9fa48("240") ? false : stryMutAct_9fa48("239") ? true : (stryCov_9fa48("239", "240", "241"), (stryMutAct_9fa48("243") ? reviewCandidate.status !== "unique_answer" && reviewCandidate.evidence.outcome !== "unique_answer" : stryMutAct_9fa48("242") ? false : (stryCov_9fa48("242", "243"), (stryMutAct_9fa48("245") ? reviewCandidate.status === "unique_answer" : stryMutAct_9fa48("244") ? false : (stryCov_9fa48("244", "245"), reviewCandidate.status !== (stryMutAct_9fa48("246") ? "" : (stryCov_9fa48("246"), "unique_answer")))) || (stryMutAct_9fa48("248") ? reviewCandidate.evidence.outcome === "unique_answer" : stryMutAct_9fa48("247") ? false : (stryCov_9fa48("247", "248"), reviewCandidate.evidence.outcome !== (stryMutAct_9fa48("249") ? "" : (stryCov_9fa48("249"), "unique_answer")))))) || (stryMutAct_9fa48("250") ? savedVerificationIds.has(reviewCandidate.evidence.verificationId) : (stryCov_9fa48("250"), !savedVerificationIds.has(reviewCandidate.evidence.verificationId)))))));
    if (stryMutAct_9fa48("253") ? candidates.length !== 0 : stryMutAct_9fa48("252") ? false : stryMutAct_9fa48("251") ? true : (stryCov_9fa48("251", "252", "253"), candidates.length === 0)) {
      if (stryMutAct_9fa48("254")) {
        {}
      } else {
        stryCov_9fa48("254");
        return null;
      }
    }
    return stryMutAct_9fa48("255") ? {} : (stryCov_9fa48("255"), {
      ...batch,
      validCount: candidates.length as ExerciseGenerationSuccessMetadata["validCount"],
      partial_batch: stryMutAct_9fa48("256") ? false : (stryCov_9fa48("256"), true),
      candidates,
      selectedVerificationIds: stryMutAct_9fa48("257") ? batch.selectedVerificationIds : (stryCov_9fa48("257"), batch.selectedVerificationIds.filter(stryMutAct_9fa48("258") ? () => undefined : (stryCov_9fa48("258"), id => stryMutAct_9fa48("259") ? savedVerificationIds.has(id) : (stryCov_9fa48("259"), !savedVerificationIds.has(id)))))
    });
  }
}
export function useSessionExerciseBatch() {
  if (stryMutAct_9fa48("260")) {
    {}
  } else {
    stryCov_9fa48("260");
    const [batch, setBatch] = useState<ExerciseReviewBatch | null>(stryMutAct_9fa48("261") ? () => undefined : (stryCov_9fa48("261"), () => (stryMutAct_9fa48("264") ? typeof window !== "undefined" : stryMutAct_9fa48("263") ? false : stryMutAct_9fa48("262") ? true : (stryCov_9fa48("262", "263", "264"), typeof window === (stryMutAct_9fa48("265") ? "" : (stryCov_9fa48("265"), "undefined")))) ? null : restoreSessionExerciseBatch(window.sessionStorage)));
    const isRestored = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
    const persistBatch = useCallback((nextBatch: ExerciseReviewBatch | null) => {
      if (stryMutAct_9fa48("266")) {
        {}
      } else {
        stryCov_9fa48("266");
        try {
          if (stryMutAct_9fa48("267")) {
            {}
          } else {
            stryCov_9fa48("267");
            if (stryMutAct_9fa48("269") ? false : stryMutAct_9fa48("268") ? true : (stryCov_9fa48("268", "269"), nextBatch)) {
              if (stryMutAct_9fa48("270")) {
                ;
              } else {
                stryCov_9fa48("270");
                storeSessionExerciseBatch(window.sessionStorage, nextBatch);
              }
            } else if (stryMutAct_9fa48("271")) {
              ;
            } else {
              stryCov_9fa48("271");
              clearSessionExerciseBatch(window.sessionStorage);
            }
          }
        } catch {
          // A storage failure must not hide paid generation or verification work.
        }
        if (stryMutAct_9fa48("272")) {
          ;
        } else {
          stryCov_9fa48("272");
          setBatch(nextBatch);
        }
      }
    }, stryMutAct_9fa48("273") ? ["Stryker was here"] : (stryCov_9fa48("273"), []));
    const replaceBatch = useCallback((nextBatch: ExerciseGenerationSuccess) => {
      if (stryMutAct_9fa48("274")) {
        {}
      } else {
        stryCov_9fa48("274");
        if (stryMutAct_9fa48("275")) {
          ;
        } else {
          stryCov_9fa48("275");
          persistBatch(createExerciseReviewBatch(nextBatch));
        }
      }
    }, stryMutAct_9fa48("276") ? [] : (stryCov_9fa48("276"), [persistBatch]));
    const applyVerificationResults = useCallback((results: ExerciseVerificationResult[]) => {
      if (stryMutAct_9fa48("277")) {
        {}
      } else {
        stryCov_9fa48("277");
        setBatch(currentBatch => {
          if (stryMutAct_9fa48("279")) {
            {}
          } else {
            stryCov_9fa48("279");
            if (stryMutAct_9fa48("282") ? false : stryMutAct_9fa48("281") ? true : stryMutAct_9fa48("280") ? currentBatch : (stryCov_9fa48("280", "281", "282"), !currentBatch)) return currentBatch;
            const nextBatch = applyExerciseVerificationResults(currentBatch, results);
            try {
              if (stryMutAct_9fa48("283")) {
                {}
              } else {
                stryCov_9fa48("283");
                if (stryMutAct_9fa48("284")) {
                  ;
                } else {
                  stryCov_9fa48("284");
                  storeSessionExerciseBatch(window.sessionStorage, nextBatch);
                }
              }
            } catch {
              // Keep the in-memory evidence when browser storage is unavailable.
            }
            return nextBatch;
          }
        });
      }
    }, stryMutAct_9fa48("285") ? ["Stryker was here"] : (stryCov_9fa48("285"), []));
    const setVerificationSelected = useCallback((verificationId: string, selected: boolean) => {
      if (stryMutAct_9fa48("286")) {
        {}
      } else {
        stryCov_9fa48("286");
        setBatch(currentBatch => {
          if (stryMutAct_9fa48("288")) {
            {}
          } else {
            stryCov_9fa48("288");
            if (stryMutAct_9fa48("291") ? false : stryMutAct_9fa48("290") ? true : stryMutAct_9fa48("289") ? currentBatch : (stryCov_9fa48("289", "290", "291"), !currentBatch)) return currentBatch;
            const nextBatch = selectExerciseVerification(currentBatch, verificationId, selected);
            try {
              if (stryMutAct_9fa48("292")) {
                {}
              } else {
                stryCov_9fa48("292");
                if (stryMutAct_9fa48("293")) {
                  ;
                } else {
                  stryCov_9fa48("293");
                  storeSessionExerciseBatch(window.sessionStorage, nextBatch);
                }
              }
            } catch {
              // Keep the in-memory selection when browser storage is unavailable.
            }
            return nextBatch;
          }
        });
      }
    }, stryMutAct_9fa48("294") ? ["Stryker was here"] : (stryCov_9fa48("294"), []));
    const removeApprovedCandidates = useCallback((mappings: ExerciseApprovalMapping[]) => {
      if (stryMutAct_9fa48("295")) {
        {}
      } else {
        stryCov_9fa48("295");
        setBatch(currentBatch => {
          if (stryMutAct_9fa48("297")) {
            {}
          } else {
            stryCov_9fa48("297");
            if (stryMutAct_9fa48("300") ? false : stryMutAct_9fa48("299") ? true : stryMutAct_9fa48("298") ? currentBatch : (stryCov_9fa48("298", "299", "300"), !currentBatch)) return currentBatch;
            const nextBatch = removeApprovedExerciseCandidates(currentBatch, mappings);
            try {
              if (stryMutAct_9fa48("301")) {
                {}
              } else {
                stryCov_9fa48("301");
                if (stryMutAct_9fa48("303") ? false : stryMutAct_9fa48("302") ? true : (stryCov_9fa48("302", "303"), nextBatch)) {
                  if (stryMutAct_9fa48("304")) {
                    ;
                  } else {
                    stryCov_9fa48("304");
                    storeSessionExerciseBatch(window.sessionStorage, nextBatch);
                  }
                } else if (stryMutAct_9fa48("305")) {
                  ;
                } else {
                  stryCov_9fa48("305");
                  clearSessionExerciseBatch(window.sessionStorage);
                }
              }
            } catch {
              // Keep the in-memory remainder when browser storage is unavailable.
            }
            return nextBatch;
          }
        });
      }
    }, stryMutAct_9fa48("306") ? ["Stryker was here"] : (stryCov_9fa48("306"), []));
    const clearBatch = useCallback(() => {
      if (stryMutAct_9fa48("307")) {
        {}
      } else {
        stryCov_9fa48("307");
        if (stryMutAct_9fa48("308")) {
          ;
        } else {
          stryCov_9fa48("308");
          persistBatch(null);
        }
      }
    }, stryMutAct_9fa48("309") ? [] : (stryCov_9fa48("309"), [persistBatch]));
    return stryMutAct_9fa48("310") ? {} : (stryCov_9fa48("310"), {
      batch,
      isRestored,
      replaceBatch,
      applyVerificationResults,
      setVerificationSelected,
      removeApprovedCandidates,
      clearBatch
    });
  }
}