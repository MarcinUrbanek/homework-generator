import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("astro:middleware", () => ({
  defineMiddleware: (handler: unknown) => handler,
}));

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

vi.mock("@/lib/supabase", () => ({
  createClient: createClientMock,
}));

import { onRequest } from "./middleware";

interface TestUser {
  id: string;
  email: string;
}

interface TestContext {
  url: URL;
  request: Request;
  cookies: Record<string, never>;
  locals: { user?: TestUser | null };
  redirect: (location: string) => Response;
}

async function invokeMiddleware(path: string, user: TestUser | null = null, missingClient = false) {
  const getUser = vi.fn().mockResolvedValue({ data: { user } });
  createClientMock.mockReturnValue(
    missingClient
      ? null
      : {
          auth: { getUser },
        },
  );

  const url = new URL(path, "http://localhost");
  const context: TestContext = {
    url,
    request: new Request(url),
    cookies: {},
    locals: {},
    redirect: (location) => new Response(null, { status: 303, headers: { Location: location } }),
  };
  const next = vi.fn(() => Promise.resolve(new Response("next")));
  const response = await onRequest(context as unknown as Parameters<typeof onRequest>[0], next);

  return { context, next, response };
}

function expectSignInRedirect(response: Response | undefined, returnTo: string) {
  expect(response?.status).toBe(303);
  const location = response?.headers.get("Location");
  expect(location).not.toBeNull();
  const destination = new URL(location ?? "/", "http://localhost");

  expect(destination.pathname).toBe("/auth/signin");
  expect(destination.searchParams.get("return_to")).toBe(returnTo);
}

describe("request middleware", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["/", "/"],
    ["/?source=example", "/?source=example"],
  ])("redirects anonymous requests to %s with the complete return destination", async (path, returnTo) => {
    const { context, next, response } = await invokeMiddleware(path);

    expectSignInRedirect(response, returnTo);
    expect(next).not.toHaveBeenCalled();
    expect(context.locals.user).toBeNull();
  });

  it("allows an authenticated user through the protected homepage", async () => {
    const user = { id: "user-1", email: "teacher@example.test" };
    const { context, next, response } = await invokeMiddleware("/", user);

    expect(response?.status).toBe(200);
    expect(next).toHaveBeenCalledOnce();
    expect(context.locals.user).toBe(user);
  });

  it("protects the homepage when the Supabase client is unavailable", async () => {
    const { context, next, response } = await invokeMiddleware("/", null, true);

    expectSignInRedirect(response, "/");
    expect(next).not.toHaveBeenCalled();
    expect(context.locals.user).toBeNull();
  });

  it.each(["/auth/signin", "/auth/signup", "/auth/confirm-email", "/classes/join?token=example"])(
    "allows the public path %s without a session",
    async (path) => {
      const { context, next, response } = await invokeMiddleware(path);

      expect(response?.status).toBe(200);
      expect(next).toHaveBeenCalledOnce();
      expect(context.locals.user).toBeNull();
    },
  );

  it.each([
    ["/exercises/request?topic=fractions", "/exercises/request?topic=fractions"],
    ["/classes?tab=active", "/classes?tab=active"],
    ["/homework?status=pending", "/homework?status=pending"],
  ])("preserves the return destination for protected path %s", async (path, returnTo) => {
    const { context, next, response } = await invokeMiddleware(path);

    expectSignInRedirect(response, returnTo);
    expect(next).not.toHaveBeenCalled();
    expect(context.locals.user).toBeNull();
  });

  it.each([null, { id: "user-1", email: "teacher@example.test" }])(
    "allows exact /dashboard to reach next for session %s",
    async (user) => {
      const { context, next, response } = await invokeMiddleware("/dashboard", user);

      expect(response?.status).toBe(200);
      expect(next).toHaveBeenCalledOnce();
      expect(context.locals.user).toBe(user);
    },
  );

  it("continues protecting /dashboard prefix siblings", async () => {
    const { context, next, response } = await invokeMiddleware("/dashboardish?source=example");

    expectSignInRedirect(response, "/dashboardish?source=example");
    expect(next).not.toHaveBeenCalled();
    expect(context.locals.user).toBeNull();
  });

  it("denies /dev/ paths in production", async () => {
    vi.stubEnv("PROD", true);

    const { context, next, response } = await invokeMiddleware("/dev/example");

    expect(response?.status).toBe(404);
    expect(next).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
    expect(context.locals.user).toBeUndefined();
  });
});
