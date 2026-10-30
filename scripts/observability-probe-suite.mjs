/* global setTimeout, clearTimeout */
// Observability runtime probe suite. NEVER run against master/production code: the probes only exist after
// applying context/audits/observability/2026-10-30_probe-injections.patch in a throwaway git worktree:
//   git worktree add --detach $env:TEMP\obs-probe HEAD; cd $env:TEMP\obs-probe; git apply <patch>
//   copy .dev.vars there; npm ci; npm run build; node scripts/observability-probe-suite.mjs
// Uses local Supabase only; never calls OpenRouter/Resend (probe stubs replace generate).
// Results: probe/out/results.json and probe/out/worker.log in the worktree.
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PORT = 4399;
const BASE = `http://localhost:${PORT}`;
const HARD_TIMEOUT_MS = 240_000;
mkdirSync("probe/out", { recursive: true });

const env = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ""),
      ];
    }),
);

let log = "";
const server = spawn(process.execPath, ["node_modules/astro/bin/astro.mjs", "preview", "--port", String(PORT)], {
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (d) => (log += d.toString()));
server.stderr.on("data", (d) => (log += d.toString()));

function killServer() {
  try {
    execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
}
const hardTimer = setTimeout(() => {
  writeFileSync("probe/out/worker.log", log);
  killServer();
  console.error("suite hard timeout");
  process.exit(2);
}, HARD_TIMEOUT_MS);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function req(path, { method = "GET", headers = {}, body, form } = {}) {
  const h = { Origin: BASE, Cookie: cookieHeader(), ...headers };
  let payload = body;
  if (form) {
    h["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: "manual" });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  let text;
  try {
    text = await res.text();
  } catch (e) {
    text = `<<body read failed: ${e.name}: ${e.message}>>`;
  }
  return { status: res.status, location: res.headers.get("location"), body: text };
}

async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(`${BASE}/auth/signin`, { redirect: "manual" });
      return;
    } catch {
      await sleep(1000);
    }
  }
  throw new Error("server not ready");
}

const genBody = { grade: 4, topic: "addition-subtraction", difficulty: "easy" };
const probes = [
  { id: "P1", shape: "throw in API handler", path: "/api/exercises/request", method: "POST", body: genBody },
  { id: "P1b", shape: "throw in SSR page frontmatter", path: "/exercises/request" },
  {
    id: "P4",
    shape: "generator throws → handler returns 502 (no throw)",
    path: "/api/exercises/request",
    method: "POST",
    body: genBody,
  },
  {
    id: "P4b",
    shape: "admission RPC throws → 503 + constant log",
    path: "/api/exercises/request",
    method: "POST",
    body: genBody,
  },
  { id: "P5", shape: "throw in middleware", path: "/" },
  { id: "P5b", shape: "Supabase auth unreachable in middleware", path: "/exercises/request" },
  {
    id: "P6",
    shape: "DB error result (missing RPC) in saved pool",
    path: "/api/exercises/saved?grade=4&topic=addition-subtraction",
  },
  { id: "P7", shape: "unhandled promise rejection", path: "/api/exercises/request", method: "POST", body: genBody },
  { id: "P8", shape: "background waitUntil rejection", path: "/api/exercises/request", method: "POST", body: genBody },
  {
    id: "P9",
    shape: "console.error(errorWithCause) + 500",
    path: "/api/exercises/request",
    method: "POST",
    body: genBody,
  },
  { id: "P10", shape: "throw in child component after streaming starts", path: "/exercises/request" },
];

const results = [];
let userId = null;
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  await waitReady();
  const email = `obs-probe-${Date.now()}@example.test`;
  const password = "Obs-Probe-Passw0rd!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("could not create local probe user");
  userId = data.user.id;
  const signIn = await req("/api/auth/signin", { method: "POST", form: { email, password } });
  results.push({ id: "signin", status: signIn.status, location: signIn.location });

  for (const p of probes) {
    await req("/", { headers: { "x-probe-marker": `BEGIN-${p.id}` } });
    await sleep(300);
    const start = log.length;
    const r = await req(p.path, { method: p.method, body: p.body, headers: { "x-probe": p.id } });
    await sleep(1500);
    results.push({
      id: p.id,
      shape: p.shape,
      status: r.status,
      location: r.location,
      body: r.body.slice(0, 300),
      bodyTail: r.body.slice(-200),
      console: log.slice(start).trim().slice(0, 2500),
    });
  }
} catch (e) {
  results.push({ id: "suite-error", error: `${e.name}: ${e.message}` });
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error(`probe user cleanup failed: ${error.message}`);
  }
  writeFileSync("probe/out/worker.log", log);
  writeFileSync("probe/out/results.json", JSON.stringify(results, null, 2));
  killServer();
  clearTimeout(hardTimer);
  console.log(JSON.stringify(results.map(({ id, status }) => ({ id, status }))));
  process.exit(0);
}
