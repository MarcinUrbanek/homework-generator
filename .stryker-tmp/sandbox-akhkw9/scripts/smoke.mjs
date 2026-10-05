// @ts-nocheck
// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs
// Set SMOKE_CONFIGURED_PREVIEW=true when preview loads configured provider credentials.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const classChecksEnabled = process.env.SMOKE_CLASS_CHECKS === "true";
const configuredPreview = process.env.SMOKE_CONFIGURED_PREVIEW === "true";
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const className = `Smoke class ${Date.now()}`;
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form, json } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined,
  });
  storeCookies(response);
  const responseBody = await response.text();
  let errorCode = "";
  try {
    errorCode = JSON.parse(responseBody).error?.code ?? "";
  } catch {
    // Non-JSON page and redirect responses have no API error code.
  }
  return { status: response.status, location: response.headers.get("location") ?? "", errorCode };
}

const smokeCandidate = {
  id: "smoke-candidate-1",
  grade: 4,
  topic: "addition-subtraction",
  difficulty: "easy",
  text: "Ile to jest 2 + 2?",
  proposedCanonicalAnswer: "4",
  approvalStatus: "unverified",
};
const smokeVerificationId = "00000000-0000-4000-8000-000000000001";

const unconfiguredProviderSteps =
  process.env.SMOKE_EXPECT_UNCONFIGURED_PROVIDERS === "true"
    ? [
        [
          "verification API reports missing verifier configuration",
          () => request("/api/exercises/verify", { method: "POST", json: { candidates: [smokeCandidate] } }),
          { status: 503, errorCode: "VERIFIER_NOT_CONFIGURED" },
        ],
        [
          "exercise API reports missing provider configuration",
          () =>
            request("/api/exercises/request", {
              method: "POST",
              json: { grade: 4, topic: "addition-subtraction", difficulty: "easy" },
            }),
          { status: 503, errorCode: "PROVIDER_NOT_CONFIGURED" },
        ],
      ]
    : [];

const steps = [
  ["home renders", () => request("/"), { status: 200 }],

  ["development gallery is unavailable", () => request("/dev/ui-exercise-request"), { status: 404 }],
  ["saved exercise gallery is unavailable", () => request("/dev/ui-saved-exercises"), { status: 404 }],

  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "exercise request redirects anonymous user",
    () => request("/exercises/request"),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "saved exercises redirect anonymous user",
    () => request("/exercises/saved"),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "verification API rejects anonymous user",
    () => request("/api/exercises/verify", { method: "POST", json: { candidates: [smokeCandidate] } }),
    { status: 401, errorCode: "UNAUTHENTICATED" },
  ],
  [
    "approval API rejects anonymous user",
    () => request("/api/exercises/approve", { method: "POST", json: { verificationIds: [smokeVerificationId] } }),
    { status: 401, errorCode: "UNAUTHENTICATED" },
  ],
  ...(classChecksEnabled
    ? [
        [
          "class creation rejects anonymous user",
          () => request("/api/classes/create", { method: "POST", json: { name: className } }),
          { status: 401, errorCode: "UNAUTHENTICATED" },
        ],
      ]
    : []),
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  ["exercise request renders for teacher", () => request("/exercises/request"), { status: 200 }],

  ...(classChecksEnabled
    ? [
        [
          "class creation succeeds for teacher",
          () => request("/api/classes/create", { method: "POST", json: { name: className } }),
          { status: 201 },
        ],
        ["class listing succeeds for teacher", () => request("/api/classes/list"), { status: 200 }],
      ]
    : []),

  ["saved exercises render for teacher", () => request("/exercises/saved"), { status: 200 }],

  [
    "exercise API rejects invalid metadata",
    () =>
      request("/api/exercises/request", { method: "POST", json: { grade: 5, topic: "invalid", difficulty: "easy" } }),
    { status: 400, errorCode: "INVALID_REQUEST" },
  ],
  [
    "saved exercise API rejects invalid query",
    () => request("/api/exercises/saved?grade=5&topic=invalid"),
    { status: 400, errorCode: "INVALID_REQUEST" },
  ],
  [
    "verification API rejects invalid request",
    () => request("/api/exercises/verify", { method: "POST", json: { candidates: [] } }),
    { status: 400, errorCode: "INVALID_REQUEST" },
  ],
  [
    "approval API rejects invalid request",
    () => request("/api/exercises/approve", { method: "POST", json: { verificationIds: ["not-a-uuid"] } }),
    { status: 400, errorCode: "INVALID_REQUEST" },
  ],

  ...(configuredPreview
    ? []
    : [
        [
          "verification API reports missing verifier configuration",
          () => request("/api/exercises/verify", { method: "POST", json: { candidates: [smokeCandidate] } }),
          { status: 503, errorCode: "VERIFIER_NOT_CONFIGURED" },
        ],
        [
          "exercise API reports missing provider configuration",
          () =>
            request("/api/exercises/request", {
              method: "POST",
              json: { grade: 4, topic: "addition-subtraction", difficulty: "easy" },
            }),
          { status: 503, errorCode: "PROVIDER_NOT_CONFIGURED" },
        ],
      ]),

  ...unconfiguredProviderSteps,

  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || actual.location.startsWith(expected.location)) &&
    (expected.errorCode === undefined || actual.errorCode === expected.errorCode);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location || actual.errorCode}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? expected.errorCode ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
