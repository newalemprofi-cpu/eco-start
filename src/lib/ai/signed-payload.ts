import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The AI Studio generates a lesson in one request and saves it in a
 * later one, with the bundle round-tripping through the browser in
 * between. Without a signature the save action would have to trust
 * whatever the client sends back (edited bundle, a faked
 * provider/isMock flag). The generate action signs the exact payload
 * with SESSION_SECRET; the save action only accepts a payload whose
 * signature matches, for the same user, within `maxAgeMs`.
 */
export type SignedPayload<T> = { data: T; issuedAt: number; userId: string; signature: string };

function digest(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function bodyOf<T>(p: Omit<SignedPayload<T>, "signature">): string {
  return JSON.stringify([p.userId, p.issuedAt, p.data]);
}

export function signPayload<T>(secret: string, userId: string, data: T, now = Date.now()): SignedPayload<T> {
  const unsigned = { data, issuedAt: now, userId };
  return { ...unsigned, signature: digest(secret, bodyOf(unsigned)) };
}

export function verifyPayload<T>(
  secret: string,
  userId: string,
  payload: SignedPayload<T> | null | undefined,
  maxAgeMs: number,
  now = Date.now()
): payload is SignedPayload<T> {
  if (!payload || typeof payload.signature !== "string") return false;
  if (payload.userId !== userId) return false;
  if (typeof payload.issuedAt !== "number" || now - payload.issuedAt > maxAgeMs || payload.issuedAt > now + 60_000) {
    return false;
  }
  const expected = Buffer.from(digest(secret, bodyOf(payload)));
  const actual = Buffer.from(payload.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
