import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixtureId = "submit-and-score-homework-manual-v1";
const fixturePassword = "LocalHomeworkTest!2026";
const fixtureClassName = "S-07 manual test fixtures";
const appOrigin = process.env.PUBLIC_APP_ORIGIN ?? process.env.BASE_URL ?? "http://localhost:4321";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

for (const fileName of [".env", ".dev.vars"]) {
  const filePath = resolve(projectRoot, fileName);
  if (!existsSync(filePath)) continue;

  try {
    process.loadEnvFile(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or .dev.vars.");
}

const parsedSupabaseUrl = new URL(supabaseUrl);
if (
  parsedSupabaseUrl.protocol !== "http:" ||
  !localHosts.has(parsedSupabaseUrl.hostname) ||
  parsedSupabaseUrl.port !== "54321"
) {
  throw new Error("Refusing to seed: SUPABASE_URL must target local Supabase at http://localhost:54321.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const accountDefinitions = [
  { key: "teacher", email: "s07.teacher@example.test", roles: ["teacher"] },
  { key: "otherTeacher", email: "s07.other-teacher@example.test", roles: ["teacher"] },
  { key: "studentA", email: "s07.student-a@example.test", roles: ["student"] },
  { key: "studentB", email: "s07.student-b@example.test", roles: ["student"] },
  { key: "dualRole", email: "s07.dual-role@example.test", roles: ["student", "teacher"] },
  { key: "notEnrolled", email: "s07.not-enrolled@example.test", roles: ["student"] },
];

const exerciseDefinitions = [
  { prompt: "Basia miała 11 naklejek i dostała 9. Ile ma teraz naklejek?", answer: "20" },
  { prompt: "Na półce było 18 książek. Dołożono 16. Ile książek jest teraz?", answer: "34" },
  { prompt: "Autobus przejechał 28 km rano i 28 km po południu. Ile kilometrów przejechał?", answer: "56" },
  { prompt: "Ogrodnik posadził 40 tulipanów i 41 róż. Ile kwiatów posadził?", answer: "81" },
  { prompt: "Biblioteka miała 200 zakładek i rozdała 75. Ile zakładek zostało?", answer: "125" },
  { prompt: "Do 300 dodaj liczbę potrzebną do otrzymania 547. Jaka to liczba?", answer: "247" },
  { prompt: "Magazyn spakował 600 paczek, potem wysłał 120. Ile paczek zostało?", answer: "480" },
  { prompt: "Sklep miał 1 000 jabłek i sprzedał 64. Ile jabłek zostało?", answer: "936" },
  { prompt: "Oblicz sumę 1 000 i 204.", answer: "1204" },
  { prompt: "Jaka liczba jest o 1 większa od 2 467?", answer: "2468" },
];

const accounts = new Map();
const seededAssignments = [];

function assertNoError(error, action) {
  if (error) {
    const code = typeof error.code === "string" ? ` (${error.code})` : "";
    throw new Error(`${action} failed${code}.`);
  }
}

async function findAuthUser(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    assertNoError(error, "Looking up a local test account");

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
}

async function ensureAccount(definition) {
  const existing = await findAuthUser(definition.email);
  let user;

  if (existing) {
    if (existing.user_metadata?.manual_fixture_id !== fixtureId) {
      throw new Error(`Refusing to modify ${definition.email}: it is not tagged as this local fixture.`);
    }

    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: fixturePassword,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, manual_fixture_id: fixtureId },
    });
    assertNoError(error, `Resetting local test account ${definition.email}`);
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: definition.email,
      password: fixturePassword,
      email_confirm: true,
      user_metadata: { manual_fixture_id: fixtureId },
    });
    assertNoError(error, `Creating local test account ${definition.email}`);
    user = data.user;
  }

  if (!user) throw new Error(`Supabase did not return the local test account ${definition.email}.`);
  accounts.set(definition.key, user);

  const { error: deleteRolesError } = await supabase.from("profile_roles").delete().eq("user_id", user.id);
  assertNoError(deleteRolesError, `Resetting roles for ${definition.email}`);

  const { error: insertRolesError } = await supabase
    .from("profile_roles")
    .insert(definition.roles.map((role) => ({ user_id: user.id, role })));
  assertNoError(insertRolesError, `Assigning roles to ${definition.email}`);
}

async function clearPreviousFixture() {
  const teacher = accounts.get("teacher");
  const { data: existingClass, error: lookupError } = await supabase
    .from("classes")
    .select("id,teacher_id")
    .eq("name", fixtureClassName)
    .maybeSingle();
  assertNoError(lookupError, "Looking up the previous fixture class");

  if (existingClass && existingClass.teacher_id !== teacher.id) {
    throw new Error("Refusing to replace the fixture class because it belongs to another account.");
  }

  if (existingClass) {
    const { error: assignmentsError } = await supabase
      .from("homework_assignments")
      .delete()
      .eq("class_id", existingClass.id);
    assertNoError(assignmentsError, "Replacing previous fixture assignments");

    const { error: membershipsError } = await supabase
      .from("class_memberships")
      .delete()
      .eq("class_id", existingClass.id);
    assertNoError(membershipsError, "Replacing previous fixture memberships");

    const { error: classError } = await supabase.from("classes").delete().eq("id", existingClass.id);
    assertNoError(classError, "Replacing the previous fixture class");
  }

  const { error: exercisesError } = await supabase.from("exercises").delete().eq("verifier_identity", fixtureId);
  assertNoError(exercisesError, "Replacing previous fixture exercises");
}

async function createFixtureClass() {
  const classCode = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      teacher_id: accounts.get("teacher").id,
      name: fixtureClassName,
      class_code: classCode,
    })
    .select("id,class_code")
    .single();
  assertNoError(error, "Creating the local fixture class");

  const enrolledAccounts = ["studentA", "studentB", "dualRole"].map((key) => accounts.get(key));
  const { error: membershipError } = await supabase
    .from("class_memberships")
    .insert(enrolledAccounts.map((account) => ({ class_id: data.id, student_id: account.id })));
  assertNoError(membershipError, "Enrolling local student fixtures");

  return data;
}

async function createFixtureExercises() {
  const now = new Date().toISOString();
  const exercises = exerciseDefinitions.map((definition) => ({
    id: randomUUID(),
    exercise_text: definition.prompt,
    canonical_answer: definition.answer,
    grade: "4",
    topic: "addition-subtraction",
    difficulty: "easy",
    verification_verdict: "unique_answer",
    verifier_identity: fixtureId,
    verifier_version: "1",
    verified_at: now,
    verification_rationale: "Deterministic local-only fixture for S-07 manual acceptance checks.",
    creator_id: accounts.get("teacher").id,
    approver_id: accounts.get("teacher").id,
    approved_at: now,
  }));
  const { error } = await supabase.from("exercises").insert(exercises);
  assertNoError(error, "Creating approved local exercise fixtures");

  return exercises;
}

async function createAssignment(classId, exercises, title, allocations) {
  const exerciseCount = allocations[0].exerciseIndexes.length;
  if (allocations.some(({ exerciseIndexes }) => exerciseIndexes.length !== exerciseCount)) {
    throw new Error(`Fixture assignment "${title}" has inconsistent recipient exercise counts.`);
  }

  const assignment = {
    id: randomUUID(),
    class_id: classId,
    teacher_id: accounts.get("teacher").id,
    title,
    grade: "4",
    topic: "addition-subtraction",
    difficulty: "easy",
    exercise_count: exerciseCount,
    idempotency_key: randomUUID(),
    request_fingerprint: createHash("md5").update(`${fixtureId}:${title}:${randomUUID()}`).digest("hex"),
  };
  const { error: assignmentError } = await supabase.from("homework_assignments").insert(assignment);
  assertNoError(assignmentError, `Creating fixture assignment "${title}"`);

  const recipients = allocations.map(({ accountKey, exerciseIndexes }) => {
    const exerciseIds = exerciseIndexes.map((index) => exercises[index].id);
    return {
      assignmentId: assignment.id,
      studentId: accounts.get(accountKey).id,
      exerciseIds,
      setSignature: [...exerciseIds].sort().join(","),
    };
  });

  const { data: recipientRows, error: recipientError } = await supabase
    .from("homework_recipients")
    .insert(
      recipients.map(({ assignmentId, studentId, setSignature }) => ({
        assignment_id: assignmentId,
        student_id: studentId,
        set_signature: setSignature,
      })),
    )
    .select("id,student_id");
  assertNoError(recipientError, `Creating recipients for "${title}"`);

  const recipientExercises = recipientRows.flatMap((recipient) => {
    const allocation = recipients.find(({ studentId }) => studentId === recipient.student_id);
    return allocation.exerciseIds.map((exerciseId, index) => ({
      recipient_id: recipient.id,
      exercise_id: exerciseId,
      position: index + 1,
    }));
  });
  const { error: exerciseLinkError } = await supabase.from("homework_recipient_exercises").insert(recipientExercises);
  assertNoError(exerciseLinkError, `Attaching exercises to "${title}"`);

  seededAssignments.push({
    title,
    id: assignment.id,
    homeworkUrl: `${appOrigin.replace(/\/+$/, "")}/homework/${assignment.id}`,
    answersByStudent: allocations
      .map(({ accountKey, exerciseIndexes }) => {
        const email = accountDefinitions.find(({ key }) => key === accountKey).email;
        const answers = exerciseIndexes.map((index) => exerciseDefinitions[index].answer).join(", ");
        return `${email}: ${answers}`;
      })
      .join("; "),
  });
}

async function seed() {
  for (const definition of accountDefinitions) await ensureAccount(definition);

  await clearPreviousFixture();
  const fixtureClass = await createFixtureClass();
  const exercises = await createFixtureExercises();

  await createAssignment(fixtureClass.id, exercises, "Privacy - separate student allocations", [
    { accountKey: "studentA", exerciseIndexes: [0, 1] },
    { accountKey: "studentB", exerciseIndexes: [2, 3] },
    { accountKey: "dualRole", exerciseIndexes: [4, 5] },
  ]);
  await createAssignment(fixtureClass.id, exercises, "Blank answer and reload", [
    { accountKey: "studentA", exerciseIndexes: [0, 1] },
  ]);
  await createAssignment(fixtureClass.id, exercises, "Pass boundary - one of two", [
    { accountKey: "studentA", exerciseIndexes: [0, 1] },
  ]);
  await createAssignment(fixtureClass.id, exercises, "Fail boundary - two of five", [
    { accountKey: "studentA", exerciseIndexes: [0, 1, 2, 3, 4] },
  ]);
  await createAssignment(fixtureClass.id, exercises, "Pass boundary - three of five", [
    { accountKey: "studentA", exerciseIndexes: [0, 1, 2, 3, 4] },
  ]);
  await createAssignment(fixtureClass.id, exercises, "All blank answers fail", [
    { accountKey: "studentA", exerciseIndexes: [0, 1, 2, 3, 4] },
  ]);
  await createAssignment(fixtureClass.id, exercises, "Retry and changed-answer conflict", [
    { accountKey: "studentA", exerciseIndexes: [0, 1] },
  ]);
  await createAssignment(fixtureClass.id, exercises, "Revoke membership before submission", [
    { accountKey: "studentA", exerciseIndexes: [0, 1] },
  ]);
  await createAssignment(fixtureClass.id, exercises, "Revoke membership after submission", [
    { accountKey: "studentA", exerciseIndexes: [0, 1] },
  ]);
  await createAssignment(fixtureClass.id, exercises, "Grouped numeric answers - 1 204 and 2 468", [
    { accountKey: "studentA", exerciseIndexes: [8, 9] },
  ]);

  console.log("Local S-07 manual test fixtures are ready.");
  console.log(`Class: ${fixtureClassName} (join code ${fixtureClass.class_code})`);
  console.log(`Sign-in password for all fixture accounts: ${fixturePassword}`);
  console.table(accountDefinitions.map(({ key, email, roles }) => ({ account: key, email, roles: roles.join(", ") })));
  console.log("Fixture assignments (sign in as s07.student-a@example.test unless noted):");
  console.table(
    seededAssignments.map(({ title, homeworkUrl, answersByStudent }) => ({ title, homeworkUrl, answersByStudent })),
  );
  console.log("Student B uses the privacy assignment; dualRole has both student and teacher entry points.");
  console.log("The notEnrolled and otherTeacher accounts have no class membership.");
  console.log(`Re-running this command replaces only the "${fixtureClassName}" fixture.`);
}

seed().catch((error) => {
  console.error(`Local fixture setup failed: ${error.message}`);
  process.exitCode = 1;
});
