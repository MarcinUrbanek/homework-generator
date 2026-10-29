import { describe, expect, it, vi } from "vitest";

import { HomeworkReviewServiceError } from "./homework-review";
import { loadTeacherReviewPage } from "./homework-review-page";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const classId = "00000000-0000-4000-8000-000000000010";
const client = {} as never;
const locals = { user: { id: "teacher" } } as never;
const teacher = vi.fn().mockResolvedValue({ status: "authorized-teacher" });

describe("loadTeacherReviewPage", () => {
  it("returns 404 for invalid route IDs before authorization", async () => {
    const authorize = vi.fn();
    const load = vi.fn();
    await expect(
      loadTeacherReviewPage({ params: [classId, "nope"], locals, supabase: client, load, authorize }),
    ).resolves.toEqual({ state: "not-found", status: 404, data: null });
    expect(authorize).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it.each(["non-teacher", "profile-unavailable", "unauthenticated"])("returns 403 for %s", async (status) => {
    const load = vi.fn();
    await expect(
      loadTeacherReviewPage({
        params: [classId],
        locals,
        supabase: client,
        load,
        authorize: vi.fn().mockResolvedValue({ status }),
      }),
    ).resolves.toEqual({ state: "forbidden", status: 403, data: null });
    expect(load).not.toHaveBeenCalled();
  });

  it("returns ready data and passes parsed IDs to the loader", async () => {
    const load = vi.fn().mockResolvedValue(["row"]);
    await expect(
      loadTeacherReviewPage({ params: [classId], locals, supabase: client, load, authorize: teacher }),
    ).resolves.toEqual({ state: "ready", status: 200, data: ["row"] });
    expect(load).toHaveBeenCalledWith(client, [classId]);
  });

  it("returns 404 when the record belongs to another class or is unavailable", async () => {
    await expect(
      loadTeacherReviewPage({
        params: [classId],
        locals,
        supabase: client,
        load: vi.fn().mockResolvedValue(null),
        authorize: teacher,
      }),
    ).resolves.toMatchObject({ state: "not-found", status: 404 });
    await expect(
      loadTeacherReviewPage({
        params: [classId],
        locals,
        supabase: client,
        load: vi.fn().mockRejectedValue(new HomeworkReviewServiceError("HOMEWORK_UNAVAILABLE")),
        authorize: teacher,
      }),
    ).resolves.toMatchObject({ state: "not-found", status: 404 });
  });

  it("maps database outages to 503 and other failures to 500", async () => {
    await expect(
      loadTeacherReviewPage({ params: [classId], locals, supabase: null, load: vi.fn(), authorize: teacher }),
    ).resolves.toMatchObject({ state: "error", status: 503 });
    await expect(
      loadTeacherReviewPage({
        params: [classId],
        locals,
        supabase: client,
        load: vi.fn().mockRejectedValue(new HomeworkReviewServiceError("DATABASE_UNAVAILABLE")),
        authorize: teacher,
      }),
    ).resolves.toMatchObject({ state: "error", status: 503 });
    await expect(
      loadTeacherReviewPage({
        params: [classId],
        locals,
        supabase: client,
        load: vi.fn().mockRejectedValue(new Error("boom")),
        authorize: teacher,
      }),
    ).resolves.toMatchObject({ state: "error", status: 500 });
  });
});
