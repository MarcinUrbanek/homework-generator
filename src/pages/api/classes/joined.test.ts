import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createJoinedHandler } from "./joined";

vi.mock("astro:env/server", () => ({ SUPABASE_KEY: undefined, SUPABASE_URL: undefined }));

function context(userId: string | null = "student"): APIContext {
  return {
    request: new Request("http://localhost/api/classes/joined"),
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as APIContext;
}

describe("GET /api/classes/joined", () => {
  it("returns only the caller's joined class summaries", async () => {
    const listMemberships = vi.fn().mockResolvedValue([
      {
        class_id: "00000000-0000-4000-8000-000000000001",
        class_name: "Matematyka 4A",
        teacher_display_name: "Ada",
        joined_at: "2026-10-06T08:00:00.000Z",
      },
      {
        class_id: "00000000-0000-4000-8000-000000000002",
        class_name: "Matematyka 4B",
        teacher_display_name: null,
        joined_at: "2026-10-05T08:00:00.000Z",
      },
    ]);
    const response = await createJoinedHandler({
      createSupabaseClient: vi.fn(() => ({}) as never),
      listMemberships,
    })(context());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      classes: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Matematyka 4A",
          teacherDisplayName: "Ada",
          joinedAt: "2026-10-06T08:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          name: "Matematyka 4B",
          teacherDisplayName: null,
          joinedAt: "2026-10-05T08:00:00.000Z",
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("email");
    expect(JSON.stringify(body)).not.toContain("teacher_id");
  });

  it("requires authentication before reading memberships", async () => {
    const createSupabaseClient = vi.fn();
    const listMemberships = vi.fn();
    const response = await createJoinedHandler({ createSupabaseClient, listMemberships })(context(null));

    expect(response.status).toBe(401);
    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(listMemberships).not.toHaveBeenCalled();
  });
});
