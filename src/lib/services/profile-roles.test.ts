import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { loadProfileRoles } from "./profile-roles";

function roleClient(data: unknown, error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    eq,
  };
}

describe("loadProfileRoles", () => {
  it("loads the caller's complete explicit role set", async () => {
    const { client, from, select, eq } = roleClient([{ role: "teacher" }, { role: "student" }]);

    await expect(loadProfileRoles(client, "dual-role-user")).resolves.toEqual({
      status: "loaded",
      roles: ["student", "teacher"],
    });
    expect(from).toHaveBeenCalledWith("profile_roles");
    expect(select).toHaveBeenCalledWith("role");
    expect(eq).toHaveBeenCalledWith("user_id", "dual-role-user");
  });

  it("distinguishes a successfully loaded empty role set", async () => {
    await expect(loadProfileRoles(roleClient([]).client, "unassigned-user")).resolves.toEqual({
      status: "loaded",
      roles: [],
    });
  });

  it.each([
    { data: null, error: null, description: "missing role rows" },
    { data: [{ role: "administrator" }], error: null, description: "unknown role" },
    { data: [{ role: "teacher" }, { role: "teacher" }], error: null, description: "duplicate role" },
    { data: [{ role: "student", canonical_answer: "private" }], error: null, description: "unexpected fields" },
    { data: [], error: { message: "private database error" }, description: "query error" },
  ])("reports an explicit unavailable result for $description", async ({ data, error }) => {
    await expect(loadProfileRoles(roleClient(data, error).client, "user-id")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("reports unavailable when the query throws or its caller context is absent", async () => {
    const throwingClient = {
      from: () => ({
        select: () => ({
          eq: () => Promise.reject(new Error("private database error")),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(loadProfileRoles(throwingClient, "user-id")).resolves.toEqual({ status: "unavailable" });
    await expect(loadProfileRoles(null, "user-id")).resolves.toEqual({ status: "unavailable" });
    await expect(loadProfileRoles(roleClient([]).client, null)).resolves.toEqual({ status: "unavailable" });
  });
});
