// @ts-nocheck
import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { classSummarySchema } from "@/lib/classes/schemas";
import { createListClassesHandler } from "./list";

vi.mock("astro:env/server", () => ({ SUPABASE_KEY: undefined, SUPABASE_URL: undefined }));

function context(): APIContext {
  return {
    request: new Request("http://localhost/api/classes/list"),
    locals: { user: { id: "teacher" } },
    cookies: {},
  } as APIContext;
}

describe("GET /api/classes/list", () => {
  it("rejects unauthenticated and non-teacher callers", async () => {
    for (const status of ["unauthenticated", "non-teacher"] as const) {
      const response = await createListClassesHandler({
        authorize: vi.fn().mockResolvedValue({ status }),
        createSupabaseClient: vi.fn(() => ({}) as never),
      })(context());
      expect(response.status).toBe(status === "unauthenticated" ? 401 : 403);
    }
  });

  it("returns only mapped owned classes", async () => {
    const listClasses = vi.fn().mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "4A",
        class_code: "AB12CD34",
        created_at: "2026-10-02T12:00:00.000Z",
      },
    ]);
    const response = await createListClassesHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-teacher" }),
      createSupabaseClient: vi.fn(() => ({}) as never),
      listClasses,
    })(context());
    const body: unknown = await response.json();
    expect(response.status).toBe(200);
    expect(z.object({ classes: classSummarySchema.array() }).parse(body)).toEqual({
      classes: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "4A",
          classCode: "AB12CD34",
          createdAt: "2026-10-02T12:00:00.000Z",
        },
      ],
    });
  });
});
