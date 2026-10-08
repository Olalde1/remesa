/**
 * Provider-agnostic HMAC-SHA256 webhook signing and verification
 * (RFC 2104 HMAC, FIPS 180-4 SHA-256), using node:crypto.
 *
 * Default scheme: signature = hex(HMAC-SHA256(secret, `${timestamp}.${payload}`)),
 * where `timestamp` is Unix seconds. Including the timestamp in the signed
 * string and enforcing a tolerance window protects against replay attacks.
 * Use `signedPayload` to adapt to other providers' formats.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { err, ok, type Result } from "./result.js";

export type SignedPayloadFn = (timestamp: string, payload: string) => string;

export const defaultSignedPayload: SignedPayloadFn = (timestamp, payload) =>
  `${timestamp}.${payload}`;

export interface SignWebhookInput {
  /** The exact raw body that will be sent. */
  readonly payload: string;
  readonly secret: string;
  /** Unix seconds. Default: now. */
  readonly timestamp?: number;
  readonly signedPayload?: SignedPayloadFn;
}

export interface SignedWebhook {
  /** Lowercase hex HMAC-SHA256 signature. */
  readonly signature: string;
  /** Unix seconds as a string, to send in a header. */
  readonly timestamp: string;
}

export function signWebhook(input: SignWebhookInput): SignedWebhook {
  if (!input.secret) throw new RangeError("secret must not be empty");
  const timestamp = String(input.timestamp ?? Math.floor(Date.now() / 1000));
  const toSign = (input.signedPayload ?? defaultSignedPayload)(timestamp, input.payload);
  const signature = createHmac("sha256", input.secret).update(toSign, "utf8").digest("hex");
  return { signature, timestamp };
}

export interface VerifyWebhookInput {
  /** The raw request body string, exactly as received (not re-serialized JSON). */
  readonly payload: string;
  /** Hex signature; an optional "sha256=" prefix is accepted. */
  readonly signature: string | null | undefined;
  /** Unix seconds, as sent by the provider. */
  readonly timestamp: string | number | null | undefined;
  readonly secret: string;
  /** Maximum allowed clock difference in seconds. Default: 300. Use Infinity to disable. */
  readonly toleranceSeconds?: number;
  /** Current time in Unix seconds (for tests). Default: now. */
  readonly now?: number;
  readonly signedPayload?: SignedPayloadFn;
}

export type VerifyWebhookErrorCode =
  | "MISSING_SIGNATURE"
  | "MALFORMED_SIGNATURE"
  | "MALFORMED_TIMESTAMP"
  | "TIMESTAMP_OUT_OF_TOLERANCE"
  | "SIGNATURE_MISMATCH";

/**
 * Verifies a webhook signature with a constant-time comparison
 * (crypto.timingSafeEqual) and a timestamp tolerance window.
 */
export function verifyWebhook(input: VerifyWebhookInput): Result<true, VerifyWebhookErrorCode> {
  if (!input.secret) throw new RangeError("secret must not be empty");
  if (!input.signature) return err("MISSING_SIGNATURE", "No signature provided");
  const sig = input.signature
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sig)) {
    return err("MALFORMED_SIGNATURE", "Signature must be 64 hex characters");
  }
  const ts = String(input.timestamp ?? "").trim();
  if (!/^\d{1,12}$/.test(ts)) return err("MALFORMED_TIMESTAMP", "Timestamp must be Unix seconds");

  const tolerance = input.toleranceSeconds ?? 300;
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > tolerance) {
    return err("TIMESTAMP_OUT_OF_TOLERANCE", `Timestamp is outside the ${tolerance}s tolerance`);
  }

  const toSign = (input.signedPayload ?? defaultSignedPayload)(ts, input.payload);
  const expected = createHmac("sha256", input.secret).update(toSign, "utf8").digest();
  const received = Buffer.from(sig, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return err("SIGNATURE_MISMATCH", "Signature does not match");
  }
  return ok(true);
}
