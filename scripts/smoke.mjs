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
let anonymousRootSigninLocation = "";

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

function hasExactSigninRedirect(actual, returnTo) {
  if (actual.status !== 302 || !actual.location) return false;
  let target;
  try {
    target = new URL(actual.location, BASE_URL);
  } catch {
    return false;
  }
  const base = new URL(BASE_URL);
  return (
    target.origin === base.origin &&
    target.pathname === "/auth/signin" &&
    target.searchParams.size === 1 &&
    target.searchParams.get("return_to") === returnTo &&
    target.hash === ""
  );
}

function hasTeacherPanelContent(actual) {
  const html = actual.html ?? "";
  const teacherLinks = [
    ["/classes", "Otwórz klasy"],
    ["/exercises/request", "Wygeneruj zadania"],
    ["/exercises/saved", "Przeglądaj zatwierdzone zadania"],
  ];
  const hasLink = ([href, label]) => {
    const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`<a\\b[^>]*\\bhref=["']${escapedHref}["'][^>]*>\\s*${escapedLabel}\\s*</a>`, "i").test(html);
  };

  return (
    /<h1\b[^>]*>\s*Panel\s*<\/h1>/i.test(html) &&
    html.includes(email) &&
    teacherLinks.every(hasLink) &&
    /<form\b(?=[^>]*\bmethod=["']POST["'])(?=[^>]*\baction=["']\/api\/auth\/signout["'])[^>]*>/i.test(html) &&
    !html.includes("10x Astro Starter") &&
    !html.includes("A production-ready starter with authentication")
  );
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
    html: responseBody,
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

// Exercise pool rows must link to certified arithmetic evidence. Verification evidence is append-only and
// keeps a non-cascading link to its teacher, so a stable local fixture teacher owns it across runs; the
// approved pool rows are re-created by the approval RPC and deleted at cleanup.
const homeworkPoolOwnerEmail = "smoke-homework-pool-owner@example.test";
// Hand-checked medium addition fixtures: operands <= 10000 and the ones digits cross ten.
const homeworkPoolFixtures = [
  { id: "5e000000-0000-4000-8000-000000000001", left: 9876, right: 8765, answer: "18641" },
  { id: "5e000000-0000-4000-8000-000000000002", left: 9758, right: 7869, answer: "17627" },
  { id: "5e000000-0000-4000-8000-000000000003", left: 8967, right: 9478, answer: "18445" },
];

async function findAuthUserByEmail(targetEmail) {
  for (let page = 1; ; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Could not look up local smoke accounts");
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === targetEmail);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
}

async function approveHomeworkPool() {
  let poolOwner = await findAuthUserByEmail(homeworkPoolOwnerEmail);
  if (!poolOwner) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: homeworkPoolOwnerEmail,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error("Could not create the local homework pool owner");
    poolOwner = data.user;
  }
  const { error: passwordError } = await adminClient.auth.admin.updateUserById(poolOwner.id, { password });
  if (passwordError) throw new Error("Could not configure the local homework pool owner");

  const cookieJar = new Map();
  const signIn = await request("/api/auth/signin", {
    method: "POST",
    form: { email: homeworkPoolOwnerEmail, password },
    cookieJar,
  });
  if (signIn.status !== 302) throw new Error("Could not sign in the local homework pool owner");

  const verifications = homeworkPoolFixtures.map(({ id, left, right, answer }, index) => ({
    id,
    teacher_id: poolOwner.id,
    candidate_id: `smoke-homework-pool-${index + 1}`,
    candidate_text: `Oblicz wartość wyrażenia: (${left} + ${right}). Podaj wynik jako jedną liczbę naturalną.`,
    proposed_canonical_answer: answer,
    grade: "4",
    topic: "addition-subtraction",
    difficulty: "medium",
    outcome: "unique_answer",
    verified_answer: answer,
    verifier_identity: "configured-smoke",
    verifier_version: "1",
    verified_at: "2026-10-01T08:00:00.000Z",
    rationale: "Hand-checked local smoke fixture.",
    arithmetic_structure: {
      version: 1,
      expression: { kind: "add", left: { kind: "number", value: left }, right: { kind: "number", value: right } },
    },
    authority_version: 1,
  }));
  const { error: verificationError } = await adminClient
    .from("exercise_verifications")
    .upsert(verifications, { onConflict: "id", ignoreDuplicates: true });
  if (verificationError) throw new Error("Could not seed certified homework smoke evidence");

  const approval = await request("/api/exercises/approve", {
    method: "POST",
    json: { verificationIds: homeworkPoolFixtures.map(({ id }) => id) },
    cookieJar,
  });
  const mappings = approval.body?.mappings;
  if (approval.status !== 200 || !Array.isArray(mappings) || mappings.length !== homeworkPoolFixtures.length) {
    throw new Error("Could not approve the shared homework smoke pool");
  }
  return mappings.map(({ exerciseId }) => exerciseId);
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

  const exerciseIds = await approveHomeworkPool();
  homeworkExerciseIds.push(...exerciseIds);

  homeworkContext = {
    owner,
    otherTeacher,
    students,
    classId,
    exerciseIds,
    canonicalAnswers: homeworkPoolFixtures.map(({ answer }) => answer),
    rosterStudentIds: students.map(({ id }) => id),
    idempotencyKey: randomUUID(),
  };
  homeworkContext.assignmentRequest = {
    classId,
    studentIds: homeworkContext.rosterStudentIds.slice(0, 3),
    title: "  Smoke homework  ",
    topic: "addition-subtraction",
    difficulty: "medium",
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

function feedbackPath(studentId) {
  return `/api/homework/${homeworkContext.assignmentId}/students/${studentId}/feedback`;
}

function teacherHomeworkPaths() {
  const base = `/classes/${homeworkContext.classId}/homework`;
  return [
    base,
    `${base}/${homeworkContext.assignmentId}`,
    `${base}/${homeworkContext.assignmentId}/${homeworkContext.students[0].id}`,
  ];
}

function studentListEntry(actual) {
  return actual.body?.assignments?.find(({ assignmentId }) => assignmentId === homeworkContext.assignmentId);
}

const smokeFeedback = "Dobra praca.\nPopraw zadanie 2.";

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
        "student submits the assigned homework",
        () =>
          request(`/api/homework/${homeworkContext.assignmentId}/submit`, {
            method: "POST",
            json: {
              answers: [
                { position: 1, answer: "1" },
                { position: 2, answer: "2" },
              ],
            },
            cookieJar: homeworkContext.students[0].cookieJar,
          }),
        { status: 201, validate: (actual) => actual.body?.kind === "scored" && actual.body?.correctCount === 0 },
      ],
      [
        "teacher class homework page lists the assignment with counts",
        () => request(teacherHomeworkPaths()[0], { cookieJar: homeworkContext.owner.cookieJar }),
        {
          status: 200,
          validate: (actual) => actual.html.includes("Smoke homework") && actual.html.includes("Oddane: 1"),
        },
      ],
      [
        "teacher assignment page shows submitted and unsubmitted students",
        () => request(teacherHomeworkPaths()[1], { cookieJar: homeworkContext.owner.cookieJar }),
        {
          status: 200,
          validate: (actual) =>
            actual.html.includes(homeworkContext.students[0].email) &&
            actual.html.includes(homeworkContext.students[1].email) &&
            actual.html.includes("nie oddano"),
        },
      ],
      [
        "teacher review page shows answers, expected answers, and the feedback form",
        () => request(teacherHomeworkPaths()[2], { cookieJar: homeworkContext.owner.cookieJar }),
        {
          status: 200,
          validate: (actual) =>
            homeworkContext.canonicalAnswers.some((answer) => actual.html.includes(answer)) &&
            actual.html.includes("Komentarz dla ucznia"),
        },
      ],
      [
        "another teacher cannot open the class homework review pages",
        async () => {
          const responses = await Promise.all(
            teacherHomeworkPaths().map((path) => request(path, { cookieJar: homeworkContext.otherTeacher.cookieJar })),
          );
          return {
            status: responses.every(({ status }) => status === 404)
              ? 404
              : responses.map(({ status }) => status).join(","),
            location: "",
            errorCode: "",
            leaksAnswers: responses.some(({ html }) =>
              homeworkContext.canonicalAnswers.some((answer) => html.includes(answer)),
            ),
          };
        },
        { status: 404, validate: (actual) => !actual.leaksAnswers },
      ],
      [
        "student cannot save homework feedback",
        () =>
          request(feedbackPath(homeworkContext.students[0].id), {
            method: "PUT",
            json: { feedback: "Sam sobie" },
            cookieJar: homeworkContext.students[0].cookieJar,
          }),
        { status: 403, errorCode: "FORBIDDEN" },
      ],
      [
        "another teacher cannot save homework feedback",
        () =>
          request(feedbackPath(homeworkContext.students[0].id), {
            method: "PUT",
            json: { feedback: "Nie moja klasa" },
            cookieJar: homeworkContext.otherTeacher.cookieJar,
          }),
        { status: 404, errorCode: "HOMEWORK_UNAVAILABLE" },
      ],
      [
        "unsubmitted homework cannot receive feedback",
        () =>
          request(feedbackPath(homeworkContext.students[1].id), {
            method: "PUT",
            json: { feedback: "Brak pracy" },
            cookieJar: homeworkContext.owner.cookieJar,
          }),
        { status: 409, errorCode: "FEEDBACK_NOT_ALLOWED" },
      ],
      [
        "teacher saves multi-line feedback on a submitted homework",
        () =>
          request(feedbackPath(homeworkContext.students[0].id), {
            method: "PUT",
            json: { feedback: `  ${smokeFeedback}  ` },
            cookieJar: homeworkContext.owner.cookieJar,
          }),
        { status: 200, validate: (actual) => actual.body?.feedback?.body === smokeFeedback },
      ],
      [
        "student sees the feedback on the detail API without expected answers",
        async () => {
          const actual = await request(`/api/homework/${homeworkContext.assignmentId}`, {
            cookieJar: homeworkContext.students[0].cookieJar,
          });
          return { ...actual, privacyLeak: homeworkResponseHasPrivacyLeak(actual, { checkEmails: true }) };
        },
        {
          status: 200,
          validate: (actual) =>
            actual.body?.feedback?.body === smokeFeedback &&
            typeof actual.body?.feedback?.updatedAt === "string" &&
            !actual.privacyLeak,
        },
      ],
      [
        "student list flags homework with feedback",
        () => request("/api/homework/list", { cookieJar: homeworkContext.students[0].cookieJar }),
        { status: 200, validate: (actual) => studentListEntry(actual)?.hasFeedback === true },
      ],
      [
        "student pages show the feedback badge and comment",
        async () => {
          const list = await request("/homework", { cookieJar: homeworkContext.students[0].cookieJar });
          const detail = await request(`/homework/${homeworkContext.assignmentId}`, {
            cookieJar: homeworkContext.students[0].cookieJar,
          });
          return {
            status: list.status === 200 && detail.status === 200 ? 200 : `${list.status},${detail.status}`,
            location: "",
            errorCode: "",
            listHasBadge: list.html.includes("Komentarz nauczyciela"),
            detailHasComment:
              detail.html.includes("Komentarz nauczyciela") && detail.html.includes("Popraw zadanie 2."),
          };
        },
        { status: 200, validate: (actual) => actual.listHasBadge && actual.detailHasComment },
      ],
      [
        "classmate cannot see another student's feedback",
        async () => {
          const list = await request("/api/homework/list", { cookieJar: homeworkContext.students[1].cookieJar });
          const detail = await request(`/api/homework/${homeworkContext.assignmentId}`, {
            cookieJar: homeworkContext.students[1].cookieJar,
          });
          return {
            ...list,
            entryHasFeedback: studentListEntry(list)?.hasFeedback,
            leaksFeedback: [list.html, detail.html].some((html) => html.includes("Popraw zadanie 2.")),
          };
        },
        {
          status: 200,
          validate: (actual) => actual.entryHasFeedback === false && !actual.leaksFeedback,
        },
      ],
      [
        "teacher clears the feedback",
        () =>
          request(feedbackPath(homeworkContext.students[0].id), {
            method: "PUT",
            json: { feedback: "" },
            cookieJar: homeworkContext.owner.cookieJar,
          }),
        { status: 200, validate: (actual) => actual.body?.feedback === null },
      ],
      [
        "cleared feedback disappears for the student",
        async () => {
          const list = await request("/api/homework/list", { cookieJar: homeworkContext.students[0].cookieJar });
          const detail = await request(`/api/homework/${homeworkContext.assignmentId}`, {
            cookieJar: homeworkContext.students[0].cookieJar,
          });
          return { ...detail, listHasFeedback: studentListEntry(list)?.hasFeedback };
        },
        {
          status: 200,
          validate: (actual) => actual.body?.feedback === null && actual.listHasFeedback === false,
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
  [
    "anonymous root redirects to sign-in with an exact root return destination",
    async () => {
      const actual = await request("/");
      anonymousRootSigninLocation = actual.location;
      return actual;
    },
    { status: 302, validate: (actual) => hasExactSigninRedirect(actual, "/") },
  ],
  [
    "anonymous query root redirects to sign-in with its exact return destination",
    () => request("/?source=example"),
    { status: 302, validate: (actual) => hasExactSigninRedirect(actual, "/?source=example") },
  ],
  [
    "root sign-in destination renders",
    () => {
      try {
        const destination = new URL(anonymousRootSigninLocation, BASE_URL);
        return request(`${destination.pathname}${destination.search}`);
      } catch {
        return request("");
      }
    },
    { status: 200 },
  ],
  ["retired dashboard route is unavailable anonymously", () => request("/dashboard"), { status: 404 }],

  ["development gallery is unavailable", () => request("/dev/ui-exercise-request"), { status: 404 }],
  ["saved exercise gallery is unavailable", () => request("/dev/ui-saved-exercises"), { status: 404 }],

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
    { status: 302, exactLocation: "/" },
  ],
  [
    "root renders the authenticated teacher panel",
    () => request("/"),
    { status: 200, validate: hasTeacherPanelContent },
  ],
  ["retired dashboard route remains unavailable when authenticated", () => request("/dashboard"), { status: 404 }],
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

  [
    "signout clears session with the exact root redirect",
    () => request("/api/auth/signout", { method: "POST" }),
    { status: 302, exactLocation: "/" },
  ],
  [
    "root redirects to sign-in after signout",
    () => request("/"),
    { status: 302, validate: (actual) => hasExactSigninRedirect(actual, "/") },
  ],
  ["retired dashboard route remains unavailable after signout", () => request("/dashboard"), { status: 404 }],
];

let failed = 0;
try {
  for (const [name, run, expected] of steps) {
    const actual = await run();
    const ok =
      actual.status === expected.status &&
      (expected.location === undefined || actual.location.startsWith(expected.location)) &&
      (expected.exactLocation === undefined || actual.location === expected.exactLocation) &&
      (expected.errorCode === undefined || actual.errorCode === expected.errorCode) &&
      (expected.validate === undefined || expected.validate(actual));
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location || actual.errorCode}`);
    if (!ok) {
      failed++;
      console.log(
        `      expected ${expected.status} ${expected.exactLocation ?? expected.location ?? expected.errorCode ?? ""}`,
      );
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
