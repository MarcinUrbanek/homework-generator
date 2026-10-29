import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import "./quality.mjs";

const hookSource = path.join(path.dirname(fileURLToPath(import.meta.url)), "quality.mjs");
const hookRelativePath = path.join(".github", "hooks", "quality.mjs");
const fixtures = [];
const worktrees = [];
let fixtureRoot;
let sessionId;
let sessionCounter = 0;

function writeToolStub(root, name, bin) {
  const packageRoot = path.join(root, "node_modules", name);
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(path.join(packageRoot, "package.json"), JSON.stringify({ name, bin: { [name]: bin } }));
  const output =
    name === "astro"
      ? `
const args = process.argv.slice(2);
if (process.env.HOOK_TEST_LOG) appendFileSync(process.env.HOOK_TEST_LOG, \`astro:\${args.join(" ")}\\n\`);
if (process.env.HOOK_FAIL_ASTRO === args[0]) {
  console.error(\`HOOK_ASTRO_ERROR \${args[0]}\`);
  process.exit(1);
}
`
      : name === "vitest"
        ? `
const args = process.argv.slice(2);
if (process.env.HOOK_TEST_LOG) appendFileSync(process.env.HOOK_TEST_LOG, \`vitest:\${args.join(" ")}\\n\`);
if (process.env.HOOK_FAIL_VITEST === "1") {
  console.error("HOOK_VITEST_ERROR");
  process.exit(1);
}
`
        : `
const args = process.argv.slice(2);
if (process.env.HOOK_TEST_LOG) appendFileSync(process.env.HOOK_TEST_LOG, \`${name}:\${args.join(" ")}\\n\`);
for (const candidate of args.filter((arg) => !arg.startsWith("-"))) {
  if (!existsSync(candidate)) continue;
  const contents = readFileSync(candidate, "utf8");
  const marker = ${JSON.stringify(name === "eslint" ? "HOOK_LINT_ERROR" : "HOOK_FORMAT_ERROR")};
  if (contents.includes(marker)) {
    console.error(\`\${marker} \${candidate}\`);
    process.exit(1);
  }
}
`;
  writeFileSync(
    path.join(packageRoot, bin),
    `import { appendFileSync, existsSync, readFileSync } from "node:fs";\n${output}`,
  );
}

function installToolStubs(root, options = {}) {
  if (!options.omitEslint) writeToolStub(root, "eslint", "cli.mjs");
  writeToolStub(root, "prettier", "cli.mjs");
  writeToolStub(root, "vitest", "cli.mjs");
  if (!options.omitAstro) writeToolStub(root, "astro", "cli.mjs");
}

function git(root, args) {
  execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
}

function createFixture(options = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "copilot-agent-hook-test-"));
  mkdirSync(path.join(root, ".github", "hooks"), { recursive: true });
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, ".gitignore"), "node_modules/\n");
  copyFileSync(hookSource, path.join(root, hookRelativePath));
  writeFileSync(path.join(root, "src", "main.js"), "export const value = 1;\n");
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Hook Test"]);
  git(root, ["config", "user.email", "hook-test@example.test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "fixture baseline"]);
  installToolStubs(root, options);
  return root;
}

function runHook(root, payload, options = {}) {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  return spawnSync(process.execPath, [path.join(root, hookRelativePath)], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      ...options.env,
    },
    input: serialized,
    windowsHide: true,
  });
}

function postEvent(root, toolInput, overrides = {}) {
  return {
    hook_event_name: "PostToolUse",
    cwd: root,
    session_id: sessionId,
    tool_name: "edit",
    tool_input: toolInput,
    ...overrides,
  };
}

function stopEvent(root, overrides = {}) {
  return {
    hook_event_name: "Stop",
    cwd: root,
    session_id: sessionId,
    stop_hook_active: false,
    ...overrides,
  };
}

function outputObject(result) {
  return result.stdout.trim() ? JSON.parse(result.stdout.trim()) : {};
}

function clearSessionRegistry() {
  const sessionKey = createHash("sha256").update(sessionId).digest("hex");
  rmSync(path.join(os.tmpdir(), "copilot-quality-hook-roots", sessionKey), { recursive: true, force: true });
}

function writeSource(root, relativePath, contents) {
  const file = path.join(root, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
  return file;
}

function test(name, run, timeout = 30_000) {
  it(name, run, timeout);
}

beforeAll(() => {
  fixtureRoot = createFixture();
}, 30_000);

beforeEach(() => {
  sessionId = `fixture-session-${++sessionCounter}`;
  installToolStubs(fixtureRoot);
});

afterEach(() => {
  for (const worktree of worktrees.splice(0)) {
    rmSync(worktree, { recursive: true, force: true });
  }
  clearSessionRegistry();
  for (const root of fixtures.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("Copilot quality hooks", () => {
  test("passes without running checks when the checkout has no changes", () => {
    const root = fixtureRoot;
    const log = path.join(os.tmpdir(), `copilot-agent-hook-log-${randomUUID()}.txt`);
    fixtures.push(log);
    const result = runHook(root, stopEvent(root), { env: { HOOK_TEST_LOG: log } });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(existsSync(log)).toBe(false);
  });

  test("passes a clean changed file through Astro checks without running deferred tests", () => {
    const root = fixtureRoot;
    writeSource(root, "src/clean.js", "export const clean = 1;\n");
    const log = path.join(os.tmpdir(), `copilot-agent-hook-log-${randomUUID()}.txt`);
    fixtures.push(log);
    const result = runHook(root, stopEvent(root), { env: { HOOK_TEST_LOG: log } });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    const calls = readFileSync(log, "utf8");
    expect(calls).not.toContain("vitest:");
    expect(calls).toContain("astro:check");
    expect(calls).toContain("astro:build");
  });

  test("sends a broken edited file to PostToolUse additionalContext", () => {
    const root = fixtureRoot;
    const file = writeSource(root, "src/broken.js", "export const broken = 1; // HOOK_LINT_ERROR\n");
    const result = runHook(root, postEvent(root, { file_path: file }));
    const output = outputObject(result);

    expect(result.status).toBe(0);
    expect(output.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(output.hookSpecificOutput.additionalContext).toContain("src");
    expect(output.hookSpecificOutput.additionalContext).toContain("HOOK_LINT_ERROR");
  });

  test("accepts a clean edited file without blocking output", () => {
    const root = fixtureRoot;
    const file = writeSource(root, "src/clean.ts", "export const clean: number = 1;\n");
    const result = runHook(root, postEvent(root, { filePath: file }));

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  test("skips unsupported, nonexistent, read-only, and pathless edits", () => {
    const root = fixtureRoot;
    const brokenFile = writeSource(root, "src/broken.ts", "export const broken = 1; // HOOK_LINT_ERROR\n");
    const cases = [
      postEvent(root, {
        replacements: [
          { path: writeSource(root, "README.txt", "not a lint target\n") },
          { filePath: path.join(root, "src", "missing.ts") },
        ],
      }),
      postEvent(root, { filePath: brokenFile }, { tool_name: "read_file" }),
      postEvent(root, {}),
      {},
      "not json",
      "",
    ];

    for (const payload of cases) {
      const result = runHook(root, payload);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
    }
  }, 60_000);

  test("accepts relative paths and recursively checks multi-file edit payloads", () => {
    const root = fixtureRoot;
    writeSource(root, "src/first.js", "export const first = 1;\n");
    const broken = writeSource(root, "src/nested/second.ts", "export const second = 2; // HOOK_LINT_ERROR\n");
    const result = runHook(
      root,
      postEvent(
        root,
        {
          replacements: [{ filePath: "first.js" }, { path: "nested/second.ts" }],
        },
        { cwd: path.join(root, "src") },
      ),
    );
    const output = outputObject(result);

    expect(result.status).toBe(0);
    expect(output.hookSpecificOutput.additionalContext).toContain(path.basename(broken));
    expect(output.hookSpecificOutput.additionalContext).toContain("HOOK_LINT_ERROR");
  });

  test("does not silently pass when ESLint is missing", () => {
    const root = fixtureRoot;
    rmSync(path.join(root, "node_modules", "eslint"), { recursive: true, force: true });
    const file = writeSource(root, "src/missing-tool.ts", "export const value = 1;\n");
    const result = runHook(root, postEvent(root, { filePath: file }));
    const output = outputObject(result);

    expect(result.status).toBe(0);
    expect(output.hookSpecificOutput.additionalContext).toContain("Required local dependency");
    expect(output.hookSpecificOutput.additionalContext).toContain("eslint");
  });

  test("blocks on shell-written lint errors and reports the changed filename", () => {
    const root = fixtureRoot;
    writeSource(root, "src/shell-written.js", "export const broken = 1; // HOOK_LINT_ERROR\n");
    rmSync(path.join(root, "node_modules", "astro"), { recursive: true, force: true });
    const result = runHook(root, stopEvent(root));
    const output = outputObject(result);

    expect(result.status).toBe(0);
    expect(output.hookSpecificOutput.hookEventName).toBe("Stop");
    expect(output.hookSpecificOutput.decision).toBe("block");
    expect(output.hookSpecificOutput.reason).toContain("shell-written.js");
    expect(output.hookSpecificOutput.reason).toContain("HOOK_LINT_ERROR");
    expect(output.hookSpecificOutput.reason).toContain("Astro check could not run");
    expect(output.hookSpecificOutput.reason).toContain("Required local dependency");
  });

  test("does not block again when the Stop retry flag is set", () => {
    const root = fixtureRoot;
    writeSource(root, "src/broken.js", "export const broken = 1; // HOOK_LINT_ERROR\n");
    const log = path.join(os.tmpdir(), `copilot-agent-hook-log-${randomUUID()}.txt`);
    fixtures.push(log);
    const result = runHook(root, stopEvent(root, { stop_hook_active: true }), { env: { HOOK_TEST_LOG: log } });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(existsSync(log)).toBe(false);
  });

  test("ignores stale project-directory variables and skips edits from another repository", () => {
    const root = fixtureRoot;
    const otherRoot = path.join(os.tmpdir(), `copilot-hook-other-repo-${randomUUID()}`);
    fixtures.push(otherRoot);
    mkdirSync(path.join(otherRoot, ".github", "hooks"), { recursive: true });
    mkdirSync(path.join(otherRoot, "src"), { recursive: true });
    writeFileSync(path.join(otherRoot, ".gitignore"), "node_modules/\n");
    writeFileSync(path.join(otherRoot, "src", "other.js"), "export const broken = 1; // HOOK_LINT_ERROR\n");
    git(otherRoot, ["init", "-q"]);
    git(otherRoot, ["config", "user.name", "Hook Test"]);
    git(otherRoot, ["config", "user.email", "hook-test@example.test"]);
    git(otherRoot, ["add", "."]);
    git(otherRoot, ["commit", "-qm", "other repository"]);

    const file = path.join(otherRoot, "src", "other.js");
    const result = runHook(root, postEvent(root, { filePath: file }), {
      env: { CLAUDE_PROJECT_DIR: otherRoot },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  test("sweeps a sibling worktree registered by a per-edit hook", () => {
    const root = fixtureRoot;
    writeSource(root, "src/sibling.js", "export const sibling = 1;\n");
    git(root, ["add", "src/sibling.js"]);
    git(root, ["commit", "-qm", "add sibling fixture"]);
    const siblingRoot = path.join(os.tmpdir(), `copilot-hook-sibling-${randomUUID()}`);
    worktrees.push(siblingRoot);
    execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "hook-test-sibling", siblingRoot, "HEAD"]);
    installToolStubs(siblingRoot);
    const siblingFile = path.join(siblingRoot, "src", "sibling.js");
    const registered = runHook(root, postEvent(root, { filePath: siblingFile }));
    expect(registered.status).toBe(0);
    expect(registered.stdout).toBe("");

    writeFileSync(siblingFile, "export const sibling = 1; // HOOK_LINT_ERROR\n");
    const swept = runHook(root, stopEvent(root));
    const output = outputObject(swept);

    expect(swept.status).toBe(0);
    expect(output.hookSpecificOutput.decision).toBe("block");
    expect(output.hookSpecificOutput.reason).toContain("sibling.js");
    expect(output.hookSpecificOutput.reason).toContain("HOOK_LINT_ERROR");
  }, 60_000);
});
