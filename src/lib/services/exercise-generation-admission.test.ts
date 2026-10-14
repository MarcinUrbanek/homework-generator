import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { admitExerciseGeneration, releaseExerciseGeneration } from "./exercise-generation-admission";

const reservationId = "b1000000-0000-4000-8000-000000000001";

function clientFor(response: unknown) {
  const rpc = vi.fn().mockResolvedValue(response);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("exercise generation admission service", () => {
  it("translates an admitted RPC result to a typed token decision", async () => {
    const { client, rpc } = clientFor({ data: { status: "admitted", reservation_id: reservationId }, error: null });

    await expect(admitExerciseGeneration(client)).resolves.toEqual({
      status: "admitted",
      reservationId,
    });
    expect(rpc).toHaveBeenCalledWith("admit_exercise_generation");
  });

  it.each([
    [
      { status: "quota-exceeded", retry_after_seconds: 32 },
      { status: "quota-exceeded", retryAfterSeconds: 32 },
    ],
    [
      { status: "in-progress", retry_after_seconds: 120 },
      { status: "in-progress", retryAfterSeconds: 120 },
    ],
  ] as const)("translates denial %o", async (payload, decision) => {
    const { client } = clientFor({ data: payload, error: null });

    await expect(admitExerciseGeneration(client)).resolves.toEqual(decision);
  });

  it.each([
    null,
    [],
    { status: "admitted", reservation_id: "not-a-uuid" },
    { status: "admitted", reservation_id: reservationId, unexpected: true },
    { status: "quota-exceeded", retry_after_seconds: 0 },
    { status: "quota-exceeded", retry_after_seconds: -1 },
    { status: "quota-exceeded", retry_after_seconds: 1.5 },
    { status: "quota-exceeded", retry_after_seconds: "10" },
    { status: "in-progress", retry_after_seconds: 5, unexpected: true },
  ])("fails closed for malformed admission payload %o", async (payload) => {
    const { client } = clientFor({ data: payload, error: null });

    await expect(admitExerciseGeneration(client)).resolves.toEqual({ status: "unavailable" });
  });

  it("maps admission SQLSTATE 42501 to forbidden without exposing the RPC error", async () => {
    const { client } = clientFor({
      data: null,
      error: { code: "42501", message: "sensitive database detail" },
    });

    await expect(admitExerciseGeneration(client)).resolves.toEqual({ status: "forbidden" });
  });

  it.each([
    { data: null, error: { code: "08006", message: "sensitive transport detail" } },
    { data: null, error: null },
    null,
    { data: { status: "admitted", reservation_id: reservationId } },
  ])("fails closed for RPC error or malformed response %o", async (response) => {
    const { client } = clientFor(response);

    await expect(admitExerciseGeneration(client)).resolves.toEqual({ status: "unavailable" });
  });

  it("fails closed for rejected transports and missing client state", async () => {
    const { client, rpc } = clientFor(undefined);
    rpc.mockRejectedValueOnce(new Error("sensitive transport detail"));

    await expect(admitExerciseGeneration(client)).resolves.toEqual({ status: "unavailable" });
    await expect(admitExerciseGeneration(null)).resolves.toEqual({ status: "unavailable" });
  });

  it("releases a valid reservation and treats a stale token as a normal no-op", async () => {
    const released = clientFor({ data: true, error: null });
    const stale = clientFor({ data: false, error: null });

    await expect(releaseExerciseGeneration(released.client, reservationId)).resolves.toBe("released");
    await expect(releaseExerciseGeneration(stale.client, reservationId)).resolves.toBe("stale-token");
    expect(released.rpc).toHaveBeenCalledWith("release_exercise_generation", {
      p_reservation_id: reservationId,
    });
  });

  it.each([
    { data: null, error: { code: "08006", message: "sensitive database detail" } },
    { data: "false", error: null },
    { data: null, error: null },
    null,
    { data: true },
  ])("treats invalid release results as unavailable %o", async (response) => {
    const { client } = clientFor(response);

    await expect(releaseExerciseGeneration(client, reservationId)).resolves.toBe("unavailable");
  });

  it("treats release transport exceptions and missing clients as unavailable", async () => {
    const { client, rpc } = clientFor(undefined);
    rpc.mockRejectedValueOnce(new Error("sensitive transport detail"));

    await expect(releaseExerciseGeneration(client, reservationId)).resolves.toBe("unavailable");
    await expect(releaseExerciseGeneration(null, reservationId)).resolves.toBe("unavailable");
  });
});
