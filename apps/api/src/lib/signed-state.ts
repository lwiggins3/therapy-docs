import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stands in for a real session in the OAuth `state` parameter — there's no session/identity
 * system in this app yet (every controller trusts a client-supplied x-therapist-id header, see
 * apps/api/src/dev/dev.controller.ts). This is a deliberate stopgap in the same spirit: an
 * HMAC-signed, short-lived token binding the callback back to the therapist who started the
 * flow, without inventing full session infra ahead of real auth (IAP).
 */
export interface StatePayload {
  therapistId: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createSignedState(therapistId: string, secret: string, ttlMs = DEFAULT_TTL_MS): string {
  const payload: StatePayload = { therapistId, expiresAt: Date.now() + ttlMs };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function verifySignedState(state: string, secret: string): StatePayload {
  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) {
    throw new Error("Malformed state parameter");
  }

  const expected = Buffer.from(sign(payloadB64, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid state signature");
  }

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as StatePayload;
  if (payload.expiresAt < Date.now()) {
    throw new Error("State parameter expired");
  }
  return payload;
}
