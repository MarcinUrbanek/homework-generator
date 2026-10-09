// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Uses existing project dependencies. Set SMOKE_CLASS_CHECKS=true for local class checks and cleanup.
// Set SMOKE_CONFIGURED_PREVIEW=true when preview loads configured provider credentials.

import { URL } from "node:url";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const classChecksEnabled = process.env.SMOKE_CLASS_CHECKS === "true";
const homeworkChecksEnabled = process.env.SMOKE_HOMEWORK_CHECKS === "true";
const configuredPreview = process.env.SMOKE_CONFIGURED_PREVIEW === "true";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
let adminClient = null;
const createdAuthUserIds = [];
const createdHomeworkTeacherIds = [];
const homeworkExerciseIds = [];
const homeworkRunId = randomUUID();
let homeworkContext = null;

if (homeworkChecksEnabled && !classChecksEnabled) {
  throw new Error("Homework smoke checks require SMOKE_CLASS_CHECKS=true");
}

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

function cookieHeader(cookieJar = jar) {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response, cookieJar = jar) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) cookieJar.delete(name.trim());
    else cookieJar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form, json, cookieJar = jar } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(cookieJar),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined,
  });
  storeCookies(response, cookieJar);
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

  const cleanupErrors = [];
  if (createdHomeworkTeacherIds.length > 0) {
    const { error } = await adminClient
      .from("homework_assignments")
      .delete()
      .in("teacher_id", createdHomeworkTeacherIds);
    if (error) cleanupErrors.push("assignment rows");
  }
  if (homeworkExerciseIds.length > 0) {
    const { error } = await adminClient.from("exercises").delete().in("id", homeworkExerciseIds);
    if (error) cleanupErrors.push("approved exercise fixtures");
  }
  for (const userId of createdAuthUserIds) {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push("generated auth accounts");
  }

  for (let page = 1; ; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      cleanupErrors.push("original smoke account lookup");
      break;
    }

    const smokeUser = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (smokeUser) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(smokeUser.id);
      if (deleteError) cleanupErrors.push("original smoke account");
      break;
    }
    if (data.users.length < 1000) break;
  }

  if (cleanupErrors.length > 0) throw new Error(`Smoke cleanup failed: ${cleanupErrors.join(", ")}`);
  console.log("PASS  smoke accounts and related data cleaned up");
}

async function createHomeworkUser(role, label) {
  const userEmail = `smoke-${homeworkRunId}-${label}@example.test`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Could not create a local homework smoke account");
  createdAuthUserIds.push(data.user.id);
  if (role === "teacher") createdHomeworkTeacherIds.push(data.user.id);

  if (role === "student") {
    const { error: removeTeacherRoleError } = await adminClient
      .from("profile_roles")
      .delete()
      .eq("user_id", data.user.id)
      .eq("role", "teacher");
    if (removeTeacherRoleError) throw new Error("Could not configure a local student smoke account");
    const { error: addStudentRoleError } = await adminClient
      .from("profile_roles")
      .insert({ user_id: data.user.id, role: "student" });
    if (addStudentRoleError) throw new Error("Could not configure a local student smoke account");
  }

  const cookieJar = new Map();
  const signIn = await request("/api/auth/signin", {
    method: "POST",
    form: { email: userEmail, password },
    cookieJar,
  });
  if (signIn.status !== 302 || signIn.location !== "/") {
    throw new Error("Could not sign in a local homework smoke account");
  }

  return { id: data.user.id, email: userEmail, cookieJar };
}

async function setupHomeworkSmoke() {
  const owner = await createHomeworkUser("teacher", "owner");
  const otherTeacher = await createHomeworkUser("teacher", "other-teacher");
  const students = [];
  for (const label of ["student-one", "student-two", "departed-student", "unselected-student"]) {
    students.push(await createHomeworkUser("student", label));
  }

  const classResponse = await request("/api/classes/create", {
    method: "POST",
    json: { name: `Smoke homework ${homeworkRunId.slice(0, 8)}` },
    cookieJar: owner.cookieJar,
  });
  const classId = classResponse.body?.class?.id;
  if (classResponse.status !== 201 || typeof classId !== "string") {
    throw new Error("Could not create the local homework smoke class");
  }

  const { error: membershipError } = await adminClient
    .from("class_memberships")
    .insert(students.map(({ id }) => ({ class_id: classId, student_id: id })));
  if (membershipError) throw new Error("Could not seed local homework smoke memberships");

  const exerciseFixtures = Array.from({ length: 3 }, (_, index) => ({
    id: randomUUID(),
    exercise_text: `Smoke exercise ${homeworkRunId}-${index + 1}`,
    canonical_answer: `SMOKE-CANONICAL-${homeworkRunId}-${index + 1}`,
    grade: "4",
    topic: "addition-subtraction",
    difficulty: "easy",
    verification_verdict: "unique_answer",
    verifier_identity: "configured-smoke",
    verifier_version: "1",
    verified_at: new Date().toISOString(),
    verification_rationale: "Controlled local smoke fixture.",
    creator_id: otherTeacher.id,
    approver_id: otherTeacher.id,
    approved_at: new Date(Date.now() - index * 1000).toISOString(),
  }));
  homeworkExerciseIds.push(...exerciseFixtures.map(({ id }) => id));
  const { error: exerciseError } = await adminClient.from("exercises").insert(exerciseFixtures);
  if (exerciseError) throw new Error("Could not seed the shared approved homework smoke pool");

  homeworkContext = {
    owner,
    otherTeacher,
    students,
    classId,
    exerciseIds: exerciseFixtures.map(({ id }) => id),
    canonicalAnswers: exerciseFixtures.map(({ canonical_answer }) => canonical_answer),
    rosterStudentIds: students.map(({ id }) => id),
    idempotencyKey: randomUUID(),
  };
  homeworkContext.assignmentRequest = {
    classId,
    studentIds: homeworkContext.rosterStudentIds.slice(0, 3),
    title: "  Smoke homework  ",
    topic: "addition-subtraction",
    difficulty: "easy",
    exerciseCount: 2,
    idempotencyKey: homeworkContext.idempotencyKey,
  };

  return { status: 200, created: true };
}

function homeworkResponseHasPrivacyLeak(actual, { checkEmails = false } = {}) {
  const serializedBody = JSON.stringify(actual.body ?? null);
  const containsCanonicalAnswer = homeworkContext.canonicalAnswers.some((answer) => serializedBody.includes(answer));
  const containsRosterEmail =
    checkEmails && homeworkContext.students.some(({ email: studentEmail }) => serializedBody.includes(studentEmail));
  const containsExerciseDetails = /canonical[_A-Z]?answer|exercise[_A-Z]?ids/i.test(serializedBody);
  return containsCanonicalAnswer || containsRosterEmail || containsExerciseDetails;
}

async function inspectPersistedHomework(assignmentId) {
  const { data: recipients, error: recipientError } = await adminClient
    .from("homework_recipients")
    .select("id,student_id,set_signature")
    .eq("assignment_id", assignmentId);
  if (recipientError || !recipients) throw new Error("Could not inspect persisted homework recipients");

  const persistedSets = await Promise.all(
    recipients.map(async (recipient) => {
      const { data: exercises, error } = await adminClient
        .from("homework_recipient_exercises")
        .select("exercise_id,position")
        .eq("recipient_id", recipient.id)
        .order("position");
      if (error || !exercises) throw new Error("Could not inspect persisted homework exercises");
      return {
        studentId: recipient.student_id,
        signature: recipient.set_signature,
        exerciseIds: exercises.map(({ exercise_id }) => exercise_id),
      };
    }),
  );
  const signatures = persistedSets.map(({ signature }) => signature);
  const firstSet = persistedSets[0]?.exerciseIds ?? [];
  const secondSet = persistedSets[1]?.exerciseIds ?? [];
  const overlap = firstSet.filter((exerciseId) => secondSet.includes(exerciseId)).length;

  return {
    recipientCount: persistedSets.length,
    eachSetComplete: persistedSets.every(({ exerciseIds }) => exerciseIds.length === 2),
    distinctSignatures: new Set(signatures).size === persistedSets.length,
    distinctExercisesWithinSets: persistedSets.every(({ exerciseIds }) => new Set(exerciseIds).size === 2),
    exercisesFromSharedPool: persistedSets.every(({ exerciseIds }) =>
      exerciseIds.every((exerciseId) => homeworkContext.exerciseIds.includes(exerciseId)),
    ),
    overlapIsMinimumForFixture: overlap === 1,
    assignedStudentsMatch: persistedSets.every(({ studentId }) =>
      homeworkContext.students.slice(0, 2).some(({ id }) => id === studentId),
    ),
  };
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

const homeworkSteps = homeworkChecksEnabled
  ? [
      [
        "homework fixtures create local roles, class, and shared approved exercises",
        setupHomeworkSmoke,
        { status: 200 },
      ],
      [
        "homework roster rejects anonymous user",
        () => request(`/api/classes/${homeworkContext.classId}/members`, { cookieJar: new Map() }),
        { status: 401, errorCode: "UNAUTHENTICATED" },
      ],
      [
        "homework assignment rejects anonymous user",
        () =>
          request("/api/homework/assign", {
            method: "POST",
            json: homeworkContext.assignmentRequest,
            cookieJar: new Map(),
          }),
        { status: 401, errorCode: "UNAUTHENTICATED" },
      ],
      [
        "homework roster rejects student",
        () =>
          request(`/api/classes/${homeworkContext.classId}/members`, {
            cookieJar: homeworkContext.students[0].cookieJar,
          }),
        { status: 403, errorCode: "FORBIDDEN" },
      ],
      [
        "homework assignment rejects student",
        () =>
          request("/api/homework/assign", {
            method: "POST",
            json: homeworkContext.assignmentRequest,
            cookieJar: homeworkContext.students[0].cookieJar,
          }),
        { status: 403, errorCode: "FORBIDDEN" },
      ],
      [
        "homework roster rejects a different teacher",
        () =>
          request(`/api/classes/${homeworkContext.classId}/members`, {
            cookieJar: homeworkContext.otherTeacher.cookieJar,
          }),
        { status: 404, errorCode: "CLASS_UNAVAILABLE" },
      ],
      [
        "homework assignment rejects a different teacher",
        () =>
          request("/api/homework/assign", {
            method: "POST",
            json: { ...homeworkContext.assignmentRequest, classId: homeworkContext.classId },
            cookieJar: homeworkContext.otherTeacher.cookieJar,
          }),
        { status: 404, errorCode: "CLASS_UNAVAILABLE" },
      ],
      [
        "homework owner roster returns all current members and their emails",
        async () => {
          const actual = await request(`/api/classes/${homeworkContext.classId}/members`, {
            cookieJar: homeworkContext.owner.cookieJar,
          });
          homeworkContext.roster = actual.body?.members ?? [];
          return actual;
        },
        {
          status: 200,
          validate: (actual) =>
            homeworkContext.roster.length === homeworkContext.students.length &&
            Object.keys(actual.body ?? {}).join(",") === "members" &&
            homeworkContext.students.every(({ id, email: studentEmail }) =>
              homeworkContext.roster.some(
                (member) =>
                  member.studentId === id &&
                  member.email === studentEmail &&
                  Object.keys(member).sort().join(",") === "email,joinedAt,studentId",
              ),
            ),
        },
      ],
      [
        "homework roster hides emails from another teacher",
        async () => {
          const actual = await request(`/api/classes/${homeworkContext.classId}/members`, {
            cookieJar: homeworkContext.otherTeacher.cookieJar,
          });
          return { ...actual, leaksRosterEmail: homeworkResponseHasPrivacyLeak(actual, { checkEmails: true }) };
        },
        { status: 404, errorCode: "CLASS_UNAVAILABLE", validate: (actual) => !actual.leaksRosterEmail },
      ],
      [
        "departed member is excluded while selected current members are assigned",
        async () => {
          const { error } = await adminClient
            .from("class_memberships")
            .delete()
            .eq("class_id", homeworkContext.classId)
            .eq("student_id", homeworkContext.students[2].id);
          if (error) throw new Error("Could not simulate a departed homework recipient");

          const actual = await request("/api/homework/assign", {
            method: "POST",
            json: homeworkContext.assignmentRequest,
            cookieJar: homeworkContext.owner.cookieJar,
          });
          homeworkContext.assignmentId = actual.body?.assignmentId;
          homeworkContext.persistedSets =
            actual.status === 201 && typeof homeworkContext.assignmentId === "string"
              ? await inspectPersistedHomework(homeworkContext.assignmentId)
              : null;
          return {
            ...actual,
            privacyLeak: homeworkResponseHasPrivacyLeak(actual, { checkEmails: true }),
            persistedSets: homeworkContext.persistedSets,
          };
        },
        {
          status: 201,
          validate: (actual) =>
            actual.body?.title === "Smoke homework" &&
            actual.body?.assignedCount === 2 &&
            actual.body?.excludedCount === 1 &&
            actual.body?.excludedStudentIds?.length === 1 &&
            actual.body?.excludedStudentIds?.[0] === homeworkContext.students[2].id &&
            actual.body?.replayed === false &&
            Object.keys(actual.body ?? {})
              .sort()
              .join(",") === "assignedCount,assignmentId,createdAt,excludedCount,excludedStudentIds,replayed,title" &&
            !actual.privacyLeak &&
            actual.persistedSets?.recipientCount === 2 &&
            actual.persistedSets.eachSetComplete &&
            actual.persistedSets.distinctSignatures &&
            actual.persistedSets.distinctExercisesWithinSets &&
            actual.persistedSets.exercisesFromSharedPool &&
            actual.persistedSets.overlapIsMinimumForFixture &&
            actual.persistedSets.assignedStudentsMatch,
        },
      ],
      [
        "homework retry replays the same assignment without leaking exercise data",
        async () => {
          const actual = await request("/api/homework/assign", {
            method: "POST",
            json: homeworkContext.assignmentRequest,
            cookieJar: homeworkContext.owner.cookieJar,
          });
          return {
            ...actual,
            privacyLeak: homeworkResponseHasPrivacyLeak(actual, { checkEmails: true }),
          };
        },
        {
          status: 200,
          validate: (actual) =>
            actual.body?.assignmentId === homeworkContext.assignmentId &&
            actual.body?.assignedCount === 2 &&
            actual.body?.excludedCount === 1 &&
            actual.body?.replayed === true &&
            !actual.privacyLeak,
        },
      ],
      [
        "homework assignment rejects an all-departed selection without persistence",
        async () => {
          const remainingStudents = homeworkContext.students.slice(0, 2).map(({ id }) => id);
          const { error } = await adminClient
            .from("class_memberships")
            .delete()
            .eq("class_id", homeworkContext.classId)
            .in("student_id", remainingStudents);
          if (error) throw new Error("Could not simulate all selected homework recipients leaving");

          const idempotencyKey = randomUUID();
          const actual = await request("/api/homework/assign", {
            method: "POST",
            json: { ...homeworkContext.assignmentRequest, studentIds: remainingStudents, idempotencyKey },
            cookieJar: homeworkContext.owner.cookieJar,
          });
          const { count, error: countError } = await adminClient
            .from("homework_assignments")
            .select("id", { count: "exact", head: true })
            .eq("teacher_id", homeworkContext.owner.id)
            .eq("idempotency_key", idempotencyKey);
          if (countError) throw new Error("Could not verify empty homework assignment was not persisted");
          return { ...actual, persistedAssignmentCount: count };
        },
        {
          status: 409,
          errorCode: "EMPTY_ELIGIBLE_ROSTER",
          validate: (actual) => actual.persistedAssignmentCount === 0,
        },
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
  ...homeworkSteps,

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
