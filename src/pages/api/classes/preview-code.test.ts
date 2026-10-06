import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createPreviewCodeHandler } from "./preview-code";

vi.mock("astro:env/server", () => ({ SUPABASE_KEY: undefined, SUPABASE_URL: undefined }));

function context(body: string, userId: string | null = "student"): APIContext {
  return {
    request: new Request("http://localhost/api/classes/preview-code", { method: "POST", body }),
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as APIContext;
}

describe("POST /api/classes/preview-code", () => {
  it("returns only the safe preview without enrolling the student", async () => {
    const previewClass = vi.fn().mockResolvedValue([
      {
        class_id: "00000000-0000-4000-8000-000000000001",
        class_name: "Matematyka 4A",
        teacher_display_name: "Ada",
        already_member: false,
      },
    ]);
    const handler = createPreviewCodeHandler({
      createSupabaseClient: vi.fn(() => ({}) as never),
      previewClass,
    });

    const response = await handler(context(JSON.stringify({ classCode: " ab12cd34 " })));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      class: { name: "Matematyka 4A", teacherDisplayName: "Ada", alreadyMember: false },
    });
    expect(previewClass).toHaveBeenCalledWith(expect.anything(), "AB12CD34");
    expect(JSON.stringify(body)).not.toContain("00000000");
  });

  it("rejects malformed codes before creating a database client", async () => {
    const createSupabaseClient = vi.fn();
    const response = await createPreviewCodeHandler({ createSupabaseClient })(
      context(JSON.stringify({ classCode: "bad" })),
    );

    expect(response.status).toBe(400);
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });
});
