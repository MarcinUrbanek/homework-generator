import type { APIContext, APIRoute } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createSignInHandler } from "./signin";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

function contextFor(values: Record<string, string>): APIContext {
  return {
    request: new Request("http://localhost/api/auth/signin", {
      method: "POST",
      body: new URLSearchParams(values),
    }),
    cookies: {},
    redirect: (location: string) => new Response(null, { status: 303, headers: { Location: location } }),
  } as APIContext;
}

function handlerFor(error: { message: string } | null = null) {
  const signInWithPassword = vi.fn().mockResolvedValue({ error });
  const createSupabaseClient = vi.fn(() => ({ auth: { signInWithPassword } }));
  const handler = createSignInHandler({ createSupabaseClient: createSupabaseClient as never });

  return { handler, signInWithPassword };
}

async function invoke(handler: APIRoute, returnTo: string): Promise<Response> {
  return handler(contextFor({ email: "teacher@example.test", password: "password", return_to: returnTo }));
}

describe("POST /api/auth/signin", () => {
  it("redirects to a complete safe destination after signing in", async () => {
    const { handler, signInWithPassword } = handlerFor();

    const response = await invoke(handler, "/classes/join?token=example&source=email");

    expect(response.headers.get("Location")).toBe("/classes/join?token=example&source=email");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "teacher@example.test", password: "password" });
  });

  it.each(["https://attacker.example", "//attacker.example"])(
    "falls back from unsafe return_to: %s",
    async (returnTo) => {
      const { handler } = handlerFor();

      const response = await invoke(handler, returnTo);

      expect(response.headers.get("Location")).toBe("/");
    },
  );

  it("preserves a validated destination when sign-in fails", async () => {
    const { handler } = handlerFor({ message: "Invalid credentials" });

    const response = await invoke(handler, "/classes/join?token=example");
    const location = response.headers.get("Location");
    expect(location).not.toBeNull();
    const redirect = new URL(location ?? "/", "http://localhost");

    expect(redirect.pathname).toBe("/auth/signin");
    expect(redirect.searchParams.get("error")).toBe("Invalid credentials");
    expect(redirect.searchParams.get("return_to")).toBe("/classes/join?token=example");
  });
});
