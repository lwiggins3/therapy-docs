import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSignedState, verifySignedState } from "./signed-state";

describe("signed-state", () => {
  const secret = "test-secret";

  it("round-trips a valid state", () => {
    const therapistId = randomUUID();
    const state = createSignedState(therapistId, secret);
    expect(verifySignedState(state, secret).therapistId).toBe(therapistId);
  });

  it("rejects a state signed with a different secret", () => {
    const state = createSignedState(randomUUID(), secret);
    expect(() => verifySignedState(state, "wrong-secret")).toThrow("Invalid state signature");
  });

  it("rejects a tampered payload", () => {
    const state = createSignedState(randomUUID(), secret);
    const [, signature] = state.split(".");
    const tampered = `${Buffer.from(JSON.stringify({ therapistId: randomUUID(), expiresAt: Date.now() + 1000 })).toString("base64url")}.${signature}`;
    expect(() => verifySignedState(tampered, secret)).toThrow("Invalid state signature");
  });

  it("rejects an expired state", () => {
    const state = createSignedState(randomUUID(), secret, -1000);
    expect(() => verifySignedState(state, secret)).toThrow("State parameter expired");
  });

  it("rejects a malformed state string", () => {
    expect(() => verifySignedState("not-a-valid-state", secret)).toThrow("Malformed state parameter");
  });
});
