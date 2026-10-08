import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signWebhook, verifyWebhook } from "../src/webhooks.js";

const secret = "whsec_test_secret";
const payload = JSON.stringify({ id: "evt_1", type: "payout.settled", amount: "5415.00" });
const now = 1_791_400_000;

describe("signWebhook", () => {
  it("produces an RFC 2104 HMAC-SHA256 over `timestamp.payload`", () => {
    const { signature, timestamp } = signWebhook({ payload, secret, timestamp: now });
    const expected = createHmac("sha256", secret).update(`${now}.${payload}`).digest("hex");
    expect(timestamp).toBe(String(now));
    expect(signature).toBe(expected);
  });

  it("defaults the timestamp to now and rejects empty secrets", () => {
    const { timestamp } = signWebhook({ payload, secret });
    expect(Math.abs(Number(timestamp) - Date.now() / 1000)).toBeLessThan(5);
    expect(() => signWebhook({ payload, secret: "" })).toThrow(RangeError);
  });
});

describe("verifyWebhook", () => {
  const signed = signWebhook({ payload, secret, timestamp: now });

  it("accepts a valid signature (with or without sha256= prefix)", () => {
    const input = { payload, secret, timestamp: signed.timestamp, now };
    expect(verifyWebhook({ ...input, signature: signed.signature }).ok).toBe(true);
    expect(
      verifyWebhook({ ...input, signature: `sha256=${signed.signature.toUpperCase()}` }).ok,
    ).toBe(true);
  });

  it("rejects tampered payloads, wrong secrets and wrong timestamps", () => {
    const input = { secret, signature: signed.signature, timestamp: now, now };
    expect(verifyWebhook({ ...input, payload: `${payload} ` }).error?.code).toBe(
      "SIGNATURE_MISMATCH",
    );
    expect(verifyWebhook({ ...input, payload, secret: "other" }).error?.code).toBe(
      "SIGNATURE_MISMATCH",
    );
    expect(verifyWebhook({ ...input, payload, timestamp: now - 1 }).error?.code).toBe(
      "SIGNATURE_MISMATCH",
    );
  });

  it("enforces the replay tolerance window", () => {
    const input = { payload, secret, signature: signed.signature, timestamp: now };
    expect(verifyWebhook({ ...input, now: now + 301 }).error?.code).toBe(
      "TIMESTAMP_OUT_OF_TOLERANCE",
    );
    expect(verifyWebhook({ ...input, now: now - 301 }).error?.code).toBe(
      "TIMESTAMP_OUT_OF_TOLERANCE",
    );
    expect(verifyWebhook({ ...input, now: now + 3600, toleranceSeconds: 7200 }).ok).toBe(true);
    expect(verifyWebhook({ ...input, toleranceSeconds: Number.POSITIVE_INFINITY }).ok).toBe(true);
  });

  it("rejects missing or malformed inputs", () => {
    const input = { payload, secret, timestamp: now, now };
    expect(verifyWebhook({ ...input, signature: undefined }).error?.code).toBe("MISSING_SIGNATURE");
    expect(verifyWebhook({ ...input, signature: "" }).error?.code).toBe("MISSING_SIGNATURE");
    expect(verifyWebhook({ ...input, signature: "abc" }).error?.code).toBe("MALFORMED_SIGNATURE");
    expect(verifyWebhook({ ...input, signature: "z".repeat(64) }).error?.code).toBe(
      "MALFORMED_SIGNATURE",
    );
    expect(
      verifyWebhook({ ...input, signature: signed.signature, timestamp: "yesterday" }).error?.code,
    ).toBe("MALFORMED_TIMESTAMP");
    expect(
      verifyWebhook({ ...input, signature: signed.signature, timestamp: null }).error?.code,
    ).toBe("MALFORMED_TIMESTAMP");
    expect(() => verifyWebhook({ ...input, signature: signed.signature, secret: "" })).toThrow(
      RangeError,
    );
  });

  it("supports custom signed-payload formats", () => {
    const signedPayload = (ts: string, body: string) => `v1:${ts}:${body}`;
    const s = signWebhook({ payload, secret, timestamp: now, signedPayload });
    const input = { payload, secret, signature: s.signature, timestamp: now, now };
    expect(verifyWebhook({ ...input, signedPayload }).ok).toBe(true);
    expect(verifyWebhook(input).ok).toBe(false);
  });
});
