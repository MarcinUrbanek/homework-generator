import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { authorizeTeacher } from "./teacher-authorization";

const user = { id: "teacher-id" } as User;

function profileClient(data: { role: string } | null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    eq,
  };
}

describe("authorizeTeacher", () => {
  it("distinguishes an unauthenticated request without querying profiles", async () => {
    expect(await authorizeTeacher({ user: null }, null)).toEqual({ status: "unauthenticated" });
  });

  it("authorizes a teacher by selecting only their role", async () => {
    const { client, from, select, eq } = profileClient({ role: "teacher" });

    expect(await authorizeTeacher({ user }, client)).toEqual({ status: "authorized-teacher" });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("role");
    expect(eq).toHaveBeenCalledWith("id", "teacher-id");
  });

  it("distinguishes a non-teacher", async () => {
    const { client } = profileClient({ role: "student" });

    expect(await authorizeTeacher({ user }, client)).toEqual({ status: "non-teacher" });
  });

  it.each([
    { client: null, label: "missing request client" },
    { client: profileClient(null).client, label: "missing profile" },
    { client: profileClient(null, { message: "database unavailable" }).client, label: "query error" },
    { client: profileClient({ role: "unknown" }).client, label: "unknown role" },
  ])("reports profile-unavailable for $label", async ({ client }) => {
    expect(await authorizeTeacher({ user }, client)).toEqual({ status: "profile-unavailable" });
  });

  it("reports profile-unavailable when the profile query throws", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.reject(new Error("connection failed")) }),
        }),
      }),
    } as unknown as SupabaseClient;

    expect(await authorizeTeacher({ user }, client)).toEqual({ status: "profile-unavailable" });
  });
});
