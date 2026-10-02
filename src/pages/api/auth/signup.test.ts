import type { APIContext, APIRoute } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createSignUpHandler } from "./signup";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

function contextFor(values: Record<string, string>): APIContext {
  return {
    request: new Request("http://localhost/api/auth/signup", {
      method: "POST",
      body: new URLSearchParams(values),
    }),
    cookies: {},
    redirect: (location: string) => new Response(null, { status: 303, headers: { Location: location } }),
  } as APIContext;
}

function handlerFor(error: { message: string } | null = null) {
  const signUp = vi.fn().mockResolvedValue({ error });
  const createSupabaseClient = vi.fn(() => ({ auth: { signUp } }));
  const handler = createSignUpHandler({ createSupabaseClient: createSupabaseClient as never });

  return { handler, signUp };
}

async function invoke(handler: APIRoute, returnTo: string): Promise<Response> {
  return handler(contextFor({ email: "student@example.test", password: "password", return_to: returnTo }));
}

describe("POST /api/auth/signup", () => {
  it("carries a complete safe destination to email confirmation", async () => {
    const { handler, signUp } = handlerFor();

    const response = await invoke(handler, "/classes/join?token=example&source=email");
    const location = response.headers.get("Location");
    expect(location).not.toBeNull();
    const redirect = new URL(location ?? "/", "http://localhost");

    expect(redirect.pathname).toBe("/auth/confirm-email");
    expect(redirect.searchParams.get("return_to")).toBe("/classes/join?token=example&source=email");
    expect(signUp).toHaveBeenCalledWith({ email: "student@example.test", password: "password" });
  });

  it.each(["https://attacker.example", "//attacker.example"])(
    "falls back from unsafe return_to: %s",
    async (returnTo) => {
      const { handler } = handlerFor();

      const response = await invoke(handler, returnTo);
      const location = response.headers.get("Location");
      expect(location).not.toBeNull();
      const redirect = new URL(location ?? "/", "http://localhost");

      expect(redirect.searchParams.get("return_to")).toBe("/");
    },
  );

  it("preserves a validated destination when signup fails", async () => {
    const { handler } = handlerFor({ message: "Account exists" });

    const response = await invoke(handler, "/classes/join?token=example");
    const location = response.headers.get("Location");
    expect(location).not.toBeNull();
    const redirect = new URL(location ?? "/", "http://localhost");

    expect(redirect.pathname).toBe("/auth/signup");
    expect(redirect.searchParams.get("error")).toBe("Account exists");
    expect(redirect.searchParams.get("return_to")).toBe("/classes/join?token=example");
  });
});
