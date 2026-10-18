import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixtureId = "submit-and-score-homework-manual-v1";
const fixtureRationale = "Local S-07 manual fixtures certified from arithmetic-authority-v1.";
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
const anonKey = process.env.SUPABASE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL, SUPABASE_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env or .dev.vars.");
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
const arithmeticFixtures = JSON.parse(
  readFileSync(resolve(projectRoot, "src/lib/exercises/__fixtures__/arithmetic-authority-v1.json"), "utf8"),
);

const accountDefinitions = [
  { key: "teacher", email: "s07.teacher@example.test", roles: ["teacher"] },
  { key: "otherTeacher", email: "s07.other-teacher@example.test", roles: ["teacher"] },
  { key: "studentA", email: "s07.student-a@example.test", roles: ["student"] },
  { key: "studentB", email: "s07.student-b@example.test", roles: ["student"] },
  { key: "dualRole", email: "s07.dual-role@example.test", roles: ["student", "teacher"] },
  { key: "notEnrolled", email: "s07.not-enrolled@example.test", roles: ["student"] },
];

const exerciseDefinitions = arithmeticFixtures.certifiedCases
  .filter(({ manualSeed }) => manualSeed)
  .map(({ id, metadata, structure, statement, literalAnswer }) => ({
    id,
    metadata,
    arithmeticStructure: structure,
    prompt: statement,
    answer: literalAnswer,
  }));

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

  const { error: exercisesError } = await supabase
    .from("exercises")
    .delete()
    .eq("verification_rationale", fixtureRationale)
    .eq("creator_id", teacher.id)
    .eq("approver_id", teacher.id);
  assertNoError(exercisesError, "Replacing previous fixture exercises");

  const { error: legacyFixtureError } = await supabase
    .from("exercises")
    .delete()
    .eq("verifier_identity", fixtureId)
    .eq("creator_id", teacher.id)
    .eq("approver_id", teacher.id);
  assertNoError(legacyFixtureError, "Replacing legacy exercises owned by this fixture");
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
  const teacher = accounts.get("teacher");
  const verifications = exerciseDefinitions.map((definition) => ({
    id: randomUUID(),
    teacher_id: teacher.id,
    candidate_id: `${fixtureId}:${definition.id}:${randomUUID()}`,
    candidate_text: definition.prompt,
    proposed_canonical_answer: definition.answer,
    grade: String(definition.metadata.grade),
    topic: definition.metadata.topic,
    difficulty: definition.metadata.difficulty,
    outcome: "unique_answer",
    verified_answer: definition.answer,
    verifier_identity: "ArithmeticAuthority",
    verifier_version: "arithmetic-authority-v1",
    verified_at: now,
    rationale: fixtureRationale,
    arithmetic_structure: definition.arithmeticStructure,
    authority_version: 1,
  }));
  const { error: verificationError } = await supabase.from("exercise_verifications").insert(verifications);
  assertNoError(verificationError, "Creating certified local arithmetic evidence");

  const authenticatedTeacher = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await authenticatedTeacher.auth.signInWithPassword({
    email: accountDefinitions.find(({ key }) => key === "teacher").email,
    password: fixturePassword,
  });
  assertNoError(signInError, "Signing in as the local fixture teacher");

  const approved = [];
  for (let offset = 0; offset < verifications.length; offset += 5) {
    const batch = verifications.slice(offset, offset + 5);
    const { data, error: approvalError } = await authenticatedTeacher.rpc("approve_verified_exercises", {
      verification_ids: batch.map(({ id }) => id),
    });
    assertNoError(approvalError, "Promoting certified local arithmetic evidence");
    if (
      !Array.isArray(data) ||
      data.length !== batch.length ||
      data.some((row, index) => row.verification_id !== batch[index].id || typeof row.exercise_id !== "string")
    ) {
      throw new Error("The approval function did not return every certified local fixture.");
    }
    approved.push(
      ...data.map((row, index) => ({
        id: row.exercise_id,
        exercise_text: batch[index].candidate_text,
        canonical_answer: batch[index].verified_answer,
        grade: batch[index].grade,
        topic: batch[index].topic,
        difficulty: batch[index].difficulty,
      })),
    );
  }
  await authenticatedTeacher.auth.signOut();

  return approved;
}

async function createAssignment(classId, exercises, title, allocations, difficulty = "easy") {
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
    difficulty,
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
  await createAssignment(
    fixtureClass.id,
    exercises,
    "Grouped numeric answers - 1 204 and 2 468",
    [{ accountKey: "studentA", exerciseIndexes: [6, 7] }],
    "medium",
  );

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
