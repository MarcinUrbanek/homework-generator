// @ts-nocheck
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { authorizeTeacher } from "./teacher-authorization";

const user = { id: "teacher-id" } as User;

function profileRoleClient(data: { role: string } | null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const roleEq = vi.fn(() => ({ maybeSingle }));
  const userIdEq = vi.fn(() => ({ eq: roleEq }));
  const select = vi.fn(() => ({ eq: userIdEq }));
  const from = vi.fn(() => ({ select }));

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    userIdEq,
    roleEq,
  };
}

describe("authorizeTeacher", () => {
  it("distinguishes an unauthenticated request without querying profiles", async () => {
    expect(await authorizeTeacher({ user: null }, null)).toEqual({ status: "unauthenticated" });
  });

  it("authorizes a teacher role", async () => {
    const { client, from, select, userIdEq, roleEq } = profileRoleClient({ role: "teacher" });

    expect(await authorizeTeacher({ user }, client)).toEqual({ status: "authorized-teacher" });
    expect(from).toHaveBeenCalledWith("profile_roles");
    expect(select).toHaveBeenCalledWith("role");
    expect(userIdEq).toHaveBeenCalledWith("user_id", "teacher-id");
    expect(roleEq).toHaveBeenCalledWith("role", "teacher");
  });

  it("distinguishes an account without a teacher role", async () => {
    const { client } = profileRoleClient(null);

    expect(await authorizeTeacher({ user }, client)).toEqual({ status: "non-teacher" });
  });

  it.each([
    { client: null, label: "missing request client" },
    { client: profileRoleClient(null, { message: "database unavailable" }).client, label: "query error" },
    { client: profileRoleClient({ role: "student" }).client, label: "unexpected role" },
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
