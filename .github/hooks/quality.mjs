import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CODE_EXTENSIONS = new Set([".astro", ".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const FORMAT_EXTENSIONS = new Set([".css", ".json", ".md"]);
const PATH_KEYS = new Set(["file_path", "filepath", "path"]);

function parseInput(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function gitOutput(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`Git could not run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function repositoryInfo(candidate) {
  if (!candidate || !fs.existsSync(candidate)) return null;
  const realCandidate = fs.realpathSync(candidate);
  const directory = fs.statSync(realCandidate).isDirectory() ? realCandidate : path.dirname(realCandidate);
  const output = gitOutput(directory, ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"]);
  const [root, commonDir] = output?.split(/\r?\n/) ?? [];
  if (!root || !commonDir) return null;
  return { root: path.resolve(root), commonDir: path.resolve(commonDir) };
}

function pathKey(value) {
  const normalized = path.resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function sameRepository(first, second) {
  return pathKey(first.commonDir) === pathKey(second.commonDir);
}

function isInside(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function hasNestedRepository(file) {
  let directory = path.dirname(file);
  while (isInside(SCRIPT_ROOT, directory)) {
    if (fs.existsSync(path.join(directory, ".git"))) return true;
    directory = path.dirname(directory);
  }
  return false;
}

function packageBin(root, packageName) {
  const packagePath = path.join(root, "node_modules", packageName, "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Required local dependency "${packageName}" is missing in ${root}`);
  }
  const manifest = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[packageName];
  if (typeof bin !== "string" || bin.length === 0) {
    throw new Error(`Could not resolve the "${packageName}" command from ${packagePath}`);
  }
  const executable = path.resolve(path.dirname(packagePath), bin);
  if (!fs.existsSync(executable)) {
    throw new Error(`The "${packageName}" command is missing: ${executable}`);
  }
  return executable;
}

function runPackage(root, packageName, args) {
  const executable = packageBin(root, packageName);
  const result = spawnSync(process.execPath, [executable, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`Could not run ${packageName}: ${result.error.message}`);
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return {
    ok: result.status === 0,
    output: output || (result.status === 0 ? "" : `${packageName} exited with status ${result.status}`),
  };
}

function collectPaths(value, results = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, results);
    return results;
  }
  if (!value || typeof value !== "object") return results;
  for (const [key, item] of Object.entries(value)) {
    if (PATH_KEYS.has(key.toLowerCase()) && typeof item === "string" && item.trim()) {
      results.add(item);
    } else if (item && typeof item === "object") {
      collectPaths(item, results);
    }
  }
  return results;
}

function editPaths(input) {
  let toolInput = input.tool_input;
  if (!toolInput && typeof input.toolArgs === "string") {
    try {
      toolInput = JSON.parse(input.toolArgs);
    } catch {
      toolInput = null;
    }
  }
  return [...collectPaths(toolInput)];
}

function isReadOnlyTool(toolName) {
  return /read|search|grep|glob|find|list|view|fetch|open|symbol|diagnostic/i.test(toolName ?? "");
}

function registryDirectory(sessionId) {
  if (typeof sessionId !== "string" || !sessionId) return null;
  const sessionKey = createHash("sha256").update(sessionId).digest("hex");
  return path.join(os.tmpdir(), "copilot-quality-hook-roots", sessionKey);
}

function registerRepository(sessionId, root) {
  const directory = registryDirectory(sessionId);
  if (!directory) return;
  fs.mkdirSync(directory, { recursive: true });
  const rootKey = createHash("sha256").update(pathKey(root)).digest("hex");
  fs.writeFileSync(path.join(directory, `${rootKey}.txt`), root);
}

function registeredRepositories(sessionId, expectedRepository) {
  const directory = registryDirectory(sessionId);
  if (!directory || !fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".txt"))
    .map((name) => fs.readFileSync(path.join(directory, name), "utf8").trim())
    .filter((root) => root && fs.existsSync(root))
    .map((root) => repositoryInfo(root))
    .filter((info) => info && sameRepository(info, expectedRepository));
}

function clearRegisteredRepositories(sessionId) {
  const directory = registryDirectory(sessionId);
  if (directory && fs.existsSync(directory)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function checkEditedFile(root, file) {
  const extension = path.extname(file).toLowerCase();
  if (CODE_EXTENSIONS.has(extension)) {
    return runPackage(root, "eslint", ["--quiet", "--no-warn-ignored", file]);
  }
  if (FORMAT_EXTENSIONS.has(extension)) {
    return runPackage(root, "prettier", ["--check", file]);
  }
  return { ok: true, output: "" };
}

function postToolUse(input) {
  if (isReadOnlyTool(input.tool_name ?? input.toolName)) return [];

  const failures = [];
  for (const rawPath of editPaths(input)) {
    const file = path.resolve(input.cwd || SCRIPT_ROOT, rawPath);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    let repository = { root: SCRIPT_ROOT, commonDir: null };
    if (!isInside(SCRIPT_ROOT, file) || hasNestedRepository(file)) {
      const fileRepository = repositoryInfo(file);
      const scriptRepository = repositoryInfo(SCRIPT_ROOT);
      if (!fileRepository || !scriptRepository || !sameRepository(fileRepository, scriptRepository)) continue;
      repository = fileRepository;
    }
    registerRepository(input.session_id ?? input.sessionId, repository.root);

    try {
      const result = checkEditedFile(repository.root, file);
      if (!result.ok) {
        failures.push(`${path.relative(repository.root, file)} failed its file check:\n${result.output}`);
      }
    } catch (error) {
      failures.push(`${path.relative(repository.root, file)} could not be checked:\n${error.message}`);
    }
  }
  return failures;
}

function changedFiles(root) {
  const modified = gitOutput(root, ["diff", "--name-only", "-z", "HEAD"]);
  const untracked = gitOutput(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
  if (modified === null || untracked === null) {
    throw new Error(`Could not enumerate changed files in ${root}`);
  }
  return [...new Set(`${modified}\0${untracked}`.split("\0").filter(Boolean))]
    .map((file) => path.resolve(root, file))
    .filter((file) => fs.existsSync(file) && fs.statSync(file).isFile());
}

function runCheck(failures, root, label, packageName, args) {
  try {
    const result = runPackage(root, packageName, args);
    if (!result.ok) failures.push(`${label} failed in ${root}:\n${result.output}`);
  } catch (error) {
    failures.push(`${label} could not run in ${root}:\n${error.message}`);
  }
}

function checkChangedRepository(repository, files, failures) {
  const lintFiles = files.filter((file) => CODE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const formatFiles = files.filter((file) => FORMAT_EXTENSIONS.has(path.extname(file).toLowerCase()));

  if (lintFiles.length > 0) {
    runCheck(
      failures,
      repository.root,
      `ESLint on changed files (${lintFiles.map((file) => path.relative(repository.root, file)).join(", ")})`,
      "eslint",
      ["--quiet", "--no-warn-ignored", ...lintFiles],
    );
  }
  if (formatFiles.length > 0) {
    runCheck(
      failures,
      repository.root,
      `Prettier on changed files (${formatFiles.map((file) => path.relative(repository.root, file)).join(", ")})`,
      "prettier",
      ["--check", ...formatFiles],
    );
  }
  runCheck(failures, repository.root, "Astro check", "astro", ["check"]);
  runCheck(failures, repository.root, "Production build", "astro", ["build"]);
}

function stop(input) {
  const sessionId = input.session_id ?? input.sessionId;
  if (input.stop_hook_active === true) {
    clearRegisteredRepositories(sessionId);
    return [];
  }

  const scriptRepository = repositoryInfo(SCRIPT_ROOT);
  if (!scriptRepository) {
    throw new Error(`Could not resolve the hook checkout at ${SCRIPT_ROOT}`);
  }
  const cwdRepository = repositoryInfo(input.cwd || SCRIPT_ROOT) || scriptRepository;
  if (!sameRepository(cwdRepository, scriptRepository)) return [];

  const roots = new Map([[pathKey(cwdRepository.root), cwdRepository]]);
  for (const repository of registeredRepositories(sessionId, scriptRepository)) {
    roots.set(pathKey(repository.root), repository);
  }

  const failures = [];
  const changedByRoot = [];
  for (const repository of roots.values()) {
    try {
      const files = changedFiles(repository.root);
      if (files.length > 0) changedByRoot.push({ repository, files });
    } catch (error) {
      failures.push(`Could not inspect changed files in ${repository.root}:\n${error.message}`);
    }
  }
  if (changedByRoot.length === 0) {
    clearRegisteredRepositories(sessionId);
    return failures;
  }

  for (const { repository, files } of changedByRoot) {
    checkChangedRepository(repository, files, failures);
  }
  clearRegisteredRepositories(sessionId);
  return failures;
}

function emitFailure(eventName, failures) {
  if (failures.length === 0) return;
  const details = failures.join("\n\n").slice(0, 9000);
  if (eventName === "Stop") {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "Stop",
          decision: "block",
          reason: `Fix these quality checks before finishing:\n${details}`,
        },
      })}\n`,
    );
  } else if (eventName === "PostToolUse") {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: `Fix the edited file check before continuing:\n${details}`,
        },
      })}\n`,
    );
  }
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const input = parseInput(fs.readFileSync(0, "utf8"));
  const eventName = input.hook_event_name;
  try {
    const failures = eventName === "Stop" ? stop(input) : eventName === "PostToolUse" ? postToolUse(input) : [];
    emitFailure(eventName, failures);
  } catch (error) {
    emitFailure(eventName, [`Quality hook failed:\n${error.message}`]);
  }
}
