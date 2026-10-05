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
import { savedExerciseCursorSchema, savedExerciseErrorSchema, savedExerciseFiltersSchema, savedExerciseRetrievalRowSchema, savedExerciseSuccessSchema } from "@/lib/exercises/schemas";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { SavedExerciseCursor, SavedExerciseError, SavedExerciseErrorCode, SavedExerciseFilters, SavedExerciseSuccess } from "@/types";
export const prerender = stryMutAct_9fa48("1812") ? true : (stryCov_9fa48("1812"), false);
const PAGE_SIZE = 20;
const RETRIEVAL_LIMIT = stryMutAct_9fa48("1813") ? PAGE_SIZE - 1 : (stryCov_9fa48("1813"), PAGE_SIZE + 1);
const QUERY_PARAMETER_NAMES = new Set(stryMutAct_9fa48("1814") ? [] : (stryCov_9fa48("1814"), [stryMutAct_9fa48("1815") ? "" : (stryCov_9fa48("1815"), "grade"), stryMutAct_9fa48("1816") ? "" : (stryCov_9fa48("1816"), "topic"), stryMutAct_9fa48("1817") ? "" : (stryCov_9fa48("1817"), "difficulty"), stryMutAct_9fa48("1818") ? "" : (stryCov_9fa48("1818"), "cursor")]));
const ERROR_MESSAGES: Record<SavedExerciseErrorCode, string> = stryMutAct_9fa48("1819") ? {} : (stryCov_9fa48("1819"), {
  INVALID_REQUEST: stryMutAct_9fa48("1820") ? "" : (stryCov_9fa48("1820"), "Nieprawidłowe filtry zapisanych zadań."),
  UNAUTHENTICATED: stryMutAct_9fa48("1821") ? "" : (stryCov_9fa48("1821"), "Zaloguj się, aby przeglądać zapisane zadania."),
  FORBIDDEN: stryMutAct_9fa48("1822") ? "" : (stryCov_9fa48("1822"), "Przeglądanie zapisanych zadań jest dostępne tylko dla nauczycieli."),
  DATABASE_UNAVAILABLE: stryMutAct_9fa48("1823") ? "" : (stryCov_9fa48("1823"), "Baza danych jest chwilowo niedostępna. Spróbuj ponownie później."),
  PERSISTENCE_FAILURE: stryMutAct_9fa48("1824") ? "" : (stryCov_9fa48("1824"), "Nie udało się pobrać zapisanych zadań. Spróbuj ponownie później.")
});
type RequestClient = NonNullable<ReturnType<typeof createClient>>;
interface RetrievalFailure {
  code?: string;
}
interface SavedExerciseQuery {
  filters: SavedExerciseFilters;
  cursor: SavedExerciseCursor | null;
}
export interface SavedExerciseHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: (headers: Headers, cookies: Parameters<typeof createClient>[1]) => ReturnType<typeof createClient>;
  retrieve?: (client: RequestClient, query: SavedExerciseQuery) => Promise<unknown>;
}
function jsonResponse(body: SavedExerciseError | SavedExerciseSuccess, status: number): Response {
  if (stryMutAct_9fa48("1825")) {
    {}
  } else {
    stryCov_9fa48("1825");
    return new Response(JSON.stringify(body), stryMutAct_9fa48("1826") ? {} : (stryCov_9fa48("1826"), {
      status,
      headers: stryMutAct_9fa48("1827") ? {} : (stryCov_9fa48("1827"), {
        "Content-Type": stryMutAct_9fa48("1828") ? "" : (stryCov_9fa48("1828"), "application/json; charset=utf-8")
      })
    }));
  }
}
function errorResponse(code: SavedExerciseErrorCode, status: number, message = ERROR_MESSAGES[code]): Response {
  if (stryMutAct_9fa48("1829")) {
    {}
  } else {
    stryCov_9fa48("1829");
    return jsonResponse(savedExerciseErrorSchema.parse(stryMutAct_9fa48("1830") ? {} : (stryCov_9fa48("1830"), {
      error: stryMutAct_9fa48("1831") ? {} : (stryCov_9fa48("1831"), {
        code,
        message
      })
    })), status);
  }
}
function decodeCursor(value: string): SavedExerciseCursor | null {
  if (stryMutAct_9fa48("1832")) {
    {}
  } else {
    stryCov_9fa48("1832");
    if (stryMutAct_9fa48("1835") ? false : stryMutAct_9fa48("1834") ? true : stryMutAct_9fa48("1833") ? /^[A-Za-z0-9_-]+$/.test(value) : (stryCov_9fa48("1833", "1834", "1835"), !(stryMutAct_9fa48("1839") ? /^[^A-Za-z0-9_-]+$/ : stryMutAct_9fa48("1838") ? /^[A-Za-z0-9_-]$/ : stryMutAct_9fa48("1837") ? /^[A-Za-z0-9_-]+/ : stryMutAct_9fa48("1836") ? /[A-Za-z0-9_-]+$/ : (stryCov_9fa48("1836", "1837", "1838", "1839"), /^[A-Za-z0-9_-]+$/)).test(value))) {
      if (stryMutAct_9fa48("1840")) {
        {}
      } else {
        stryCov_9fa48("1840");
        return null;
      }
    }
    try {
      if (stryMutAct_9fa48("1841")) {
        {}
      } else {
        stryCov_9fa48("1841");
        const normalized = value.replace(/-/g, stryMutAct_9fa48("1842") ? "" : (stryCov_9fa48("1842"), "+")).replace(/_/g, stryMutAct_9fa48("1843") ? "" : (stryCov_9fa48("1843"), "/"));
        const padding = (stryMutAct_9fa48("1844") ? "" : (stryCov_9fa48("1844"), "=")).repeat(stryMutAct_9fa48("1845") ? (4 - normalized.length % 4) * 4 : (stryCov_9fa48("1845"), (stryMutAct_9fa48("1846") ? 4 + normalized.length % 4 : (stryCov_9fa48("1846"), 4 - (stryMutAct_9fa48("1847") ? normalized.length * 4 : (stryCov_9fa48("1847"), normalized.length % 4)))) % 4));
        return stryMutAct_9fa48("1848") ? savedExerciseCursorSchema.safeParse(JSON.parse(atob(`${normalized}${padding}`))).data && null : (stryCov_9fa48("1848"), savedExerciseCursorSchema.safeParse(JSON.parse(atob(stryMutAct_9fa48("1849") ? `` : (stryCov_9fa48("1849"), `${normalized}${padding}`)))).data ?? null);
      }
    } catch {
      if (stryMutAct_9fa48("1850")) {
        {}
      } else {
        stryCov_9fa48("1850");
        return null;
      }
    }
  }
}
function encodeCursor(cursor: SavedExerciseCursor): string {
  if (stryMutAct_9fa48("1851")) {
    {}
  } else {
    stryCov_9fa48("1851");
    return btoa(JSON.stringify(cursor)).replace(/\+/g, stryMutAct_9fa48("1852") ? "" : (stryCov_9fa48("1852"), "-")).replace(/\//g, stryMutAct_9fa48("1853") ? "" : (stryCov_9fa48("1853"), "_")).replace(stryMutAct_9fa48("1855") ? /=$/ : stryMutAct_9fa48("1854") ? /=+/ : (stryCov_9fa48("1854", "1855"), /=+$/), stryMutAct_9fa48("1856") ? "Stryker was here!" : (stryCov_9fa48("1856"), ""));
  }
}
function parseQuery(url: URL): SavedExerciseQuery | null {
  if (stryMutAct_9fa48("1857")) {
    {}
  } else {
    stryCov_9fa48("1857");
    const seen = new Set<string>();
    for (const [name] of url.searchParams) {
      if (stryMutAct_9fa48("1858")) {
        {}
      } else {
        stryCov_9fa48("1858");
        if (stryMutAct_9fa48("1861") ? !QUERY_PARAMETER_NAMES.has(name) && seen.has(name) : stryMutAct_9fa48("1860") ? false : stryMutAct_9fa48("1859") ? true : (stryCov_9fa48("1859", "1860", "1861"), (stryMutAct_9fa48("1862") ? QUERY_PARAMETER_NAMES.has(name) : (stryCov_9fa48("1862"), !QUERY_PARAMETER_NAMES.has(name))) || seen.has(name))) {
          if (stryMutAct_9fa48("1863")) {
            {}
          } else {
            stryCov_9fa48("1863");
            return null;
          }
        }
        if (stryMutAct_9fa48("1864")) {
          ;
        } else {
          stryCov_9fa48("1864");
          seen.add(name);
        }
      }
    }
    const filters = savedExerciseFiltersSchema.safeParse(stryMutAct_9fa48("1865") ? {} : (stryCov_9fa48("1865"), {
      grade: url.searchParams.has(stryMutAct_9fa48("1866") ? "" : (stryCov_9fa48("1866"), "grade")) ? Number(url.searchParams.get(stryMutAct_9fa48("1867") ? "" : (stryCov_9fa48("1867"), "grade"))) : undefined,
      topic: stryMutAct_9fa48("1868") ? url.searchParams.get("topic") && undefined : (stryCov_9fa48("1868"), url.searchParams.get(stryMutAct_9fa48("1869") ? "" : (stryCov_9fa48("1869"), "topic")) ?? undefined),
      difficulty: url.searchParams.has(stryMutAct_9fa48("1870") ? "" : (stryCov_9fa48("1870"), "difficulty")) ? url.searchParams.get(stryMutAct_9fa48("1871") ? "" : (stryCov_9fa48("1871"), "difficulty")) : undefined
    }));
    if (stryMutAct_9fa48("1874") ? false : stryMutAct_9fa48("1873") ? true : stryMutAct_9fa48("1872") ? filters.success : (stryCov_9fa48("1872", "1873", "1874"), !filters.success)) {
      if (stryMutAct_9fa48("1875")) {
        {}
      } else {
        stryCov_9fa48("1875");
        return null;
      }
    }
    const cursorValue = url.searchParams.get(stryMutAct_9fa48("1876") ? "" : (stryCov_9fa48("1876"), "cursor"));
    if (stryMutAct_9fa48("1879") ? cursorValue !== null : stryMutAct_9fa48("1878") ? false : stryMutAct_9fa48("1877") ? true : (stryCov_9fa48("1877", "1878", "1879"), cursorValue === null)) {
      if (stryMutAct_9fa48("1880")) {
        {}
      } else {
        stryCov_9fa48("1880");
        return stryMutAct_9fa48("1881") ? {} : (stryCov_9fa48("1881"), {
          filters: filters.data,
          cursor: null
        });
      }
    }
    const cursor = decodeCursor(cursorValue);
    if (stryMutAct_9fa48("1884") ? cursor?.topic !== filters.data.topic && cursor.difficulty !== filters.data.difficulty : stryMutAct_9fa48("1883") ? false : stryMutAct_9fa48("1882") ? true : (stryCov_9fa48("1882", "1883", "1884"), (stryMutAct_9fa48("1886") ? cursor?.topic === filters.data.topic : stryMutAct_9fa48("1885") ? false : (stryCov_9fa48("1885", "1886"), (stryMutAct_9fa48("1887") ? cursor.topic : (stryCov_9fa48("1887"), cursor?.topic)) !== filters.data.topic)) || (stryMutAct_9fa48("1889") ? cursor.difficulty === filters.data.difficulty : stryMutAct_9fa48("1888") ? false : (stryCov_9fa48("1888", "1889"), cursor.difficulty !== filters.data.difficulty)))) {
      if (stryMutAct_9fa48("1890")) {
        {}
      } else {
        stryCov_9fa48("1890");
        return null;
      }
    }
    return stryMutAct_9fa48("1891") ? {} : (stryCov_9fa48("1891"), {
      filters: filters.data,
      cursor
    });
  }
}
async function retrieveSavedExercises(client: RequestClient, query: SavedExerciseQuery): Promise<unknown> {
  if (stryMutAct_9fa48("1892")) {
    {}
  } else {
    stryCov_9fa48("1892");
    const result = (await client.rpc("get_saved_exercises", {
      p_grade: String(query.filters.grade),
      p_topic: query.filters.topic,
      p_difficulty: query.filters.difficulty ?? null,
      p_cursor_approved_at: query.cursor?.approvedAt ?? null,
      p_cursor_id: query.cursor?.id ?? null,
      p_limit: RETRIEVAL_LIMIT
    })) as {
      data: unknown;
      error: RetrievalFailure | null;
    };
    if (stryMutAct_9fa48("1894") ? false : stryMutAct_9fa48("1893") ? true : (stryCov_9fa48("1893", "1894"), result.error)) {
      if (stryMutAct_9fa48("1895")) {
        {}
      } else {
        stryCov_9fa48("1895");
        throw Object.assign(new Error(stryMutAct_9fa48("1896") ? "" : (stryCov_9fa48("1896"), "Saved exercise retrieval failed")), stryMutAct_9fa48("1897") ? {} : (stryCov_9fa48("1897"), {
          code: result.error.code
        }));
      }
    }
    return result.data;
  }
}
function isDatabaseUnavailable(error: RetrievalFailure): boolean {
  if (stryMutAct_9fa48("1898")) {
    {}
  } else {
    stryCov_9fa48("1898");
    return stryMutAct_9fa48("1901") ? error.code?.startsWith("08") === true && ["PGRST000", "PGRST001", "PGRST002"].includes(error.code ?? "") : stryMutAct_9fa48("1900") ? false : stryMutAct_9fa48("1899") ? true : (stryCov_9fa48("1899", "1900", "1901"), (stryMutAct_9fa48("1903") ? error.code?.startsWith("08") !== true : stryMutAct_9fa48("1902") ? false : (stryCov_9fa48("1902", "1903"), (stryMutAct_9fa48("1905") ? error.code.startsWith("08") : stryMutAct_9fa48("1904") ? error.code?.endsWith("08") : (stryCov_9fa48("1904", "1905"), error.code?.startsWith(stryMutAct_9fa48("1906") ? "" : (stryCov_9fa48("1906"), "08")))) === (stryMutAct_9fa48("1907") ? false : (stryCov_9fa48("1907"), true)))) || (stryMutAct_9fa48("1908") ? [] : (stryCov_9fa48("1908"), [stryMutAct_9fa48("1909") ? "" : (stryCov_9fa48("1909"), "PGRST000"), stryMutAct_9fa48("1910") ? "" : (stryCov_9fa48("1910"), "PGRST001"), stryMutAct_9fa48("1911") ? "" : (stryCov_9fa48("1911"), "PGRST002")])).includes(stryMutAct_9fa48("1912") ? error.code && "" : (stryCov_9fa48("1912"), error.code ?? (stryMutAct_9fa48("1913") ? "Stryker was here!" : (stryCov_9fa48("1913"), "")))));
  }
}
export function createSavedExercisesHandler(dependencies: SavedExerciseHandlerDependencies = {}): APIRoute {
  if (stryMutAct_9fa48("1914")) {
    {}
  } else {
    stryCov_9fa48("1914");
    const authorize = stryMutAct_9fa48("1915") ? dependencies.authorize && authorizeTeacher : (stryCov_9fa48("1915"), dependencies.authorize ?? authorizeTeacher);
    const createSupabaseClient = stryMutAct_9fa48("1916") ? dependencies.createSupabaseClient && createClient : (stryCov_9fa48("1916"), dependencies.createSupabaseClient ?? createClient);
    const retrieve = stryMutAct_9fa48("1917") ? dependencies.retrieve && retrieveSavedExercises : (stryCov_9fa48("1917"), dependencies.retrieve ?? retrieveSavedExercises);
    return async context => {
      if (stryMutAct_9fa48("1918")) {
        {}
      } else {
        stryCov_9fa48("1918");
        const query = parseQuery(new URL(context.request.url));
        if (stryMutAct_9fa48("1921") ? false : stryMutAct_9fa48("1920") ? true : stryMutAct_9fa48("1919") ? query : (stryCov_9fa48("1919", "1920", "1921"), !query)) {
          if (stryMutAct_9fa48("1922")) {
            {}
          } else {
            stryCov_9fa48("1922");
            return errorResponse(stryMutAct_9fa48("1923") ? "" : (stryCov_9fa48("1923"), "INVALID_REQUEST"), 400);
          }
        }
        const supabase = createSupabaseClient(context.request.headers, context.cookies);
        const authorization = await authorize(context.locals, supabase);
        if (stryMutAct_9fa48("1926") ? authorization.status !== "unauthenticated" : stryMutAct_9fa48("1925") ? false : stryMutAct_9fa48("1924") ? true : (stryCov_9fa48("1924", "1925", "1926"), authorization.status === (stryMutAct_9fa48("1927") ? "" : (stryCov_9fa48("1927"), "unauthenticated")))) {
          if (stryMutAct_9fa48("1928")) {
            {}
          } else {
            stryCov_9fa48("1928");
            return errorResponse(stryMutAct_9fa48("1929") ? "" : (stryCov_9fa48("1929"), "UNAUTHENTICATED"), 401);
          }
        }
        if (stryMutAct_9fa48("1932") ? authorization.status !== "non-teacher" : stryMutAct_9fa48("1931") ? false : stryMutAct_9fa48("1930") ? true : (stryCov_9fa48("1930", "1931", "1932"), authorization.status === (stryMutAct_9fa48("1933") ? "" : (stryCov_9fa48("1933"), "non-teacher")))) {
          if (stryMutAct_9fa48("1934")) {
            {}
          } else {
            stryCov_9fa48("1934");
            return errorResponse(stryMutAct_9fa48("1935") ? "" : (stryCov_9fa48("1935"), "FORBIDDEN"), 403);
          }
        }
        if (stryMutAct_9fa48("1938") ? authorization.status !== "profile-unavailable" : stryMutAct_9fa48("1937") ? false : stryMutAct_9fa48("1936") ? true : (stryCov_9fa48("1936", "1937", "1938"), authorization.status === (stryMutAct_9fa48("1939") ? "" : (stryCov_9fa48("1939"), "profile-unavailable")))) {
          if (stryMutAct_9fa48("1940")) {
            {}
          } else {
            stryCov_9fa48("1940");
            return errorResponse(stryMutAct_9fa48("1941") ? "" : (stryCov_9fa48("1941"), "FORBIDDEN"), 403, stryMutAct_9fa48("1942") ? "" : (stryCov_9fa48("1942"), "Nie można potwierdzić uprawnień nauczyciela."));
          }
        }
        if (stryMutAct_9fa48("1945") ? false : stryMutAct_9fa48("1944") ? true : stryMutAct_9fa48("1943") ? supabase : (stryCov_9fa48("1943", "1944", "1945"), !supabase)) {
          if (stryMutAct_9fa48("1946")) {
            {}
          } else {
            stryCov_9fa48("1946");
            return errorResponse(stryMutAct_9fa48("1947") ? "" : (stryCov_9fa48("1947"), "DATABASE_UNAVAILABLE"), 503);
          }
        }
        try {
          if (stryMutAct_9fa48("1948")) {
            {}
          } else {
            stryCov_9fa48("1948");
            const rows = savedExerciseRetrievalRowSchema.array().parse(await retrieve(supabase, query));
            const exercises = stryMutAct_9fa48("1949") ? rows.map(row => ({
              id: row.id,
              text: row.exercise_text,
              canonicalAnswer: row.canonical_answer,
              grade: 4 as const,
              topic: row.topic,
              difficulty: row.difficulty,
              approvedAt: row.approved_at
            })) : (stryCov_9fa48("1949"), rows.slice(0, PAGE_SIZE).map(stryMutAct_9fa48("1950") ? () => undefined : (stryCov_9fa48("1950"), row => stryMutAct_9fa48("1951") ? {} : (stryCov_9fa48("1951"), {
              id: row.id,
              text: row.exercise_text,
              canonicalAnswer: row.canonical_answer,
              grade: 4 as const,
              topic: row.topic,
              difficulty: row.difficulty,
              approvedAt: row.approved_at
            }))));
            const finalExercise = exercises.at(stryMutAct_9fa48("1952") ? +1 : (stryCov_9fa48("1952"), -1));
            const response = savedExerciseSuccessSchema.parse(stryMutAct_9fa48("1953") ? {} : (stryCov_9fa48("1953"), {
              exercises,
              nextCursor: (stryMutAct_9fa48("1956") ? rows.length > PAGE_SIZE || finalExercise : stryMutAct_9fa48("1955") ? false : stryMutAct_9fa48("1954") ? true : (stryCov_9fa48("1954", "1955", "1956"), (stryMutAct_9fa48("1959") ? rows.length <= PAGE_SIZE : stryMutAct_9fa48("1958") ? rows.length >= PAGE_SIZE : stryMutAct_9fa48("1957") ? true : (stryCov_9fa48("1957", "1958", "1959"), rows.length > PAGE_SIZE)) && finalExercise)) ? encodeCursor(stryMutAct_9fa48("1960") ? {} : (stryCov_9fa48("1960"), {
                grade: finalExercise.grade,
                topic: finalExercise.topic,
                difficulty: query.filters.difficulty,
                approvedAt: finalExercise.approvedAt,
                id: finalExercise.id
              })) : null
            }));
            return jsonResponse(response, 200);
          }
        } catch (error) {
          if (stryMutAct_9fa48("1961")) {
            {}
          } else {
            stryCov_9fa48("1961");
            const failure = (stryMutAct_9fa48("1964") ? typeof error === "object" || error !== null : stryMutAct_9fa48("1963") ? false : stryMutAct_9fa48("1962") ? true : (stryCov_9fa48("1962", "1963", "1964"), (stryMutAct_9fa48("1966") ? typeof error !== "object" : stryMutAct_9fa48("1965") ? true : (stryCov_9fa48("1965", "1966"), typeof error === (stryMutAct_9fa48("1967") ? "" : (stryCov_9fa48("1967"), "object")))) && (stryMutAct_9fa48("1969") ? error === null : stryMutAct_9fa48("1968") ? true : (stryCov_9fa48("1968", "1969"), error !== null)))) ? error as RetrievalFailure : {};
            if (stryMutAct_9fa48("1972") ? failure.code !== "22023" : stryMutAct_9fa48("1971") ? false : stryMutAct_9fa48("1970") ? true : (stryCov_9fa48("1970", "1971", "1972"), failure.code === (stryMutAct_9fa48("1973") ? "" : (stryCov_9fa48("1973"), "22023")))) {
              if (stryMutAct_9fa48("1974")) {
                {}
              } else {
                stryCov_9fa48("1974");
                return errorResponse(stryMutAct_9fa48("1975") ? "" : (stryCov_9fa48("1975"), "INVALID_REQUEST"), 400);
              }
            }
            if (stryMutAct_9fa48("1978") ? failure.code !== "42501" : stryMutAct_9fa48("1977") ? false : stryMutAct_9fa48("1976") ? true : (stryCov_9fa48("1976", "1977", "1978"), failure.code === (stryMutAct_9fa48("1979") ? "" : (stryCov_9fa48("1979"), "42501")))) {
              if (stryMutAct_9fa48("1980")) {
                {}
              } else {
                stryCov_9fa48("1980");
                return errorResponse(stryMutAct_9fa48("1981") ? "" : (stryCov_9fa48("1981"), "FORBIDDEN"), 403);
              }
            }
            if (stryMutAct_9fa48("1983") ? false : stryMutAct_9fa48("1982") ? true : (stryCov_9fa48("1982", "1983"), isDatabaseUnavailable(failure))) {
              if (stryMutAct_9fa48("1984")) {
                {}
              } else {
                stryCov_9fa48("1984");
                return errorResponse(stryMutAct_9fa48("1985") ? "" : (stryCov_9fa48("1985"), "DATABASE_UNAVAILABLE"), 503);
              }
            }
            return errorResponse(stryMutAct_9fa48("1986") ? "" : (stryCov_9fa48("1986"), "PERSISTENCE_FAILURE"), 500);
          }
        }
      }
    };
  }
}
export const GET = createSavedExercisesHandler();