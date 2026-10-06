// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Uses existing project dependencies. Set SMOKE_CLASS_CHECKS=true for local class checks and cleanup.
// Set SMOKE_CONFIGURED_PREVIEW=true when preview loads configured provider credentials.

import { URL } from "node:url";

import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const classChecksEnabled = process.env.SMOKE_CLASS_CHECKS === "true";
const configuredPreview = process.env.SMOKE_CONFIGURED_PREVIEW === "true";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
let adminClient = null;

if (classChecksEnabled) {
  const appHost = new URL(BASE_URL).hostname;
  const databaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : "";
  if (!localHosts.has(appHost) || !localHosts.has(databaseHost)) {
    throw new Error("Class smoke checks are restricted to a local app and Supabase instance");
  }
  if (!serviceRoleKey) {
    throw new Error("Class smoke checks require SUPABASE_SERVICE_ROLE_KEY for cleanup");
  }
  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const className = `Smoke class ${Date.now()}`;
const teacherDisplayName = `Smoke teacher ${Date.now()}`;
const jar = new Map();
let smokeClassCode = "";

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
  let body = null;
  try {
    body = JSON.parse(responseBody);
  } catch {
    // Non-JSON page and redirect responses have no body object.
  }
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    errorCode: body?.error?.code ?? "",
    body,
  };
}

async function cleanupSmokeAccount() {
  if (!adminClient) return;

  for (let page = 1; ; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const smokeUser = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (smokeUser) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(smokeUser.id);
      if (deleteError) throw deleteError;
      console.log("PASS  smoke account and related class data cleaned up");
      return;
    }
    if (data.users.length < 1000) break;
  }

  console.log("PASS  no smoke account found to clean up");
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
        [
          "class-code preview rejects anonymous user",
          () => request("/api/classes/preview-code", { method: "POST", json: { classCode: "SMOKE123" } }),
          { status: 401, errorCode: "UNAUTHENTICATED" },
        ],
        [
          "class-code confirmation rejects anonymous user",
          () => request("/api/classes/join-by-code", { method: "POST", json: { classCode: "SMOKE123" } }),
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
          "teacher display name saves for join previews",
          () => request("/api/profile/display-name", { method: "POST", json: { displayName: teacherDisplayName } }),
          { status: 200, validate: (actual) => actual.body?.displayName === teacherDisplayName },
        ],
        [
          "class creation succeeds for teacher",
          async () => {
            const actual = await request("/api/classes/create", { method: "POST", json: { name: className } });
            smokeClassCode = actual.body?.class?.classCode ?? "";
            return actual;
          },
          {
            status: 201,
            validate: (actual) => /^[A-Z0-9]{8}$/.test(smokeClassCode) && actual.body?.class?.name === className,
          },
        ],
        [
          "joined-class list starts empty",
          () => request("/api/classes/joined"),
          { status: 200, validate: (actual) => actual.body?.classes?.length === 0 },
        ],
        [
          "code preview reveals the class without creating membership",
          async () => {
            const preview = await request("/api/classes/preview-code", {
              method: "POST",
              json: { classCode: smokeClassCode.toLowerCase() },
            });
            const memberships = await request("/api/classes/joined");
            const previewClass = preview.body?.class;
            return {
              ...preview,
              safePreview:
                previewClass?.name === className &&
                previewClass?.teacherDisplayName === teacherDisplayName &&
                previewClass?.alreadyMember === false &&
                Object.keys(previewClass).sort().join(",") === "alreadyMember,name,teacherDisplayName",
              noMembership: memberships.status === 200 && memberships.body?.classes?.length === 0,
            };
          },
          { status: 200, validate: (actual) => actual.safePreview && actual.noMembership },
        ],
        [
          "code confirmation creates the membership",
          () => request("/api/classes/join-by-code", { method: "POST", json: { classCode: smokeClassCode } }),
          {
            status: 200,
            validate: (actual) => actual.body?.redirectTo === "/classes/joined" && actual.body?.alreadyMember === false,
          },
        ],
        [
          "repeated code confirmation is idempotent",
          () => request("/api/classes/join-by-code", { method: "POST", json: { classCode: smokeClassCode } }),
          {
            status: 200,
            validate: (actual) => actual.body?.redirectTo === "/classes/joined" && actual.body?.alreadyMember === true,
          },
        ],
        [
          "joined-class list contains only the joined class summary",
          () => request("/api/classes/joined"),
          {
            status: 200,
            validate: (actual) => {
              const joinedClass = actual.body?.classes?.[0];
              return (
                actual.body?.classes?.length === 1 &&
                joinedClass?.name === className &&
                joinedClass?.teacherDisplayName === teacherDisplayName &&
                Object.keys(joinedClass).sort().join(",") === "id,joinedAt,name,teacherDisplayName"
              );
            },
          },
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
try {
  for (const [name, run, expected] of steps) {
    const actual = await run();
    const ok =
      actual.status === expected.status &&
      (expected.location === undefined || actual.location.startsWith(expected.location)) &&
      (expected.errorCode === undefined || actual.errorCode === expected.errorCode) &&
      (expected.validate === undefined || expected.validate(actual));
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location || actual.errorCode}`);
    if (!ok) {
      failed++;
      console.log(`      expected ${expected.status} ${expected.location ?? expected.errorCode ?? ""}`);
    }
  }
} finally {
  try {
    await cleanupSmokeAccount();
  } catch {
    failed++;
    console.log("FAIL  smoke account cleanup");
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
