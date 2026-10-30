import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// The Cloudflare preview keeps the service-role key in .dev.vars; playwright.config.ts only loads .env.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".dev.vars")) process.loadEnvFile(".dev.vars");

function localAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env or .dev.vars) for E2E account fixtures.");
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
    throw new Error("E2E account fixtures only run against a local Supabase (SUPABASE_URL must be localhost).");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface LocalAccount {
  id: string;
  email: string;
  password: string;
}

// Sign-up assigns the teacher role by default, so the student role replaces it explicitly.
export async function createLocalStudent(tag: string): Promise<LocalAccount> {
  const admin = localAdminClient();
  const email = `e2e.${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = `E2e!${crypto.randomUUID()}`;

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const id = created.data.user.id;

  const removed = await admin.from("profile_roles").delete().eq("user_id", id);
  if (removed.error) throw removed.error;
  const inserted = await admin.from("profile_roles").insert({ user_id: id, role: "student" });
  if (inserted.error) throw inserted.error;

  return { id, email, password };
}

// Deleting the auth user cascades to profiles and profile_roles; both are checked so a broken cleanup turns the run red.
export async function deleteLocalAccount(id: string): Promise<void> {
  const admin = localAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
  const roles = await admin.from("profile_roles").select("role").eq("user_id", id);
  if (roles.error) throw roles.error;
  const profiles = await admin.from("profiles").select("id").eq("id", id);
  if (profiles.error) throw profiles.error;
  if (roles.data.length > 0 || profiles.data.length > 0) {
    throw new Error(`Profile data left behind for deleted E2E account ${id}`);
  }
}
