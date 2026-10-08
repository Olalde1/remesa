import { describe, expect, it } from "vitest";
import {
  computeClabeCheckDigit,
  generateClabe,
  isValidClabe,
  normalizeClabe,
  validateClabe,
} from "../src/clabe.js";

// Well-known valid CLABEs used as public documentation examples.
const SAMPLES = ["032180000118359719", "002010077777777771", "646180157000000004"];

describe("computeClabeCheckDigit", () => {
  it("matches known valid CLABEs", () => {
    for (const c of SAMPLES) expect(computeClabeCheckDigit(c.slice(0, 17))).toBe(c[17]);
  });

  it("rejects malformed input", () => {
    expect(() => computeClabeCheckDigit("123")).toThrow(RangeError);
    expect(() => computeClabeCheckDigit("1234567890123456a")).toThrow(RangeError);
  });

  it("handles a check digit of zero (sum divisible by 10)", () => {
    expect(computeClabeCheckDigit("01218000000000006")).toBe("0");
  });
});

describe("validateClabe", () => {
  it("parses bank, plaza and account", () => {
    const r = validateClabe("002 180 00123456789 6");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      clabe: "002180001234567896",
      bankCode: "002",
      plaza: "180",
      account: "00123456789",
      checkDigit: "6",
    });
    expect(r.value.bank?.name).toBe("BANAMEX");
    expect(r.value.bank?.speiCode).toBe("40002");
  });

  it("accepts hyphens as grouping", () => {
    expect(validateClabe("032-180-00011835971-9").ok).toBe(true);
  });

  it("rejects letters, wrong lengths and bad check digits", () => {
    expect(validateClabe("00218000123456789A").error?.code).toBe("INVALID_CHARACTERS");
    expect(validateClabe("0021800012345678").error?.code).toBe("INVALID_LENGTH");
    expect(validateClabe("002180001234567890").error?.code).toBe("INVALID_CHECK_DIGIT");
  });

  it("only flags unknown banks when asked", () => {
    const clabe = generateClabe({ bankCode: "999", plaza: "180", account: "1" });
    expect(validateClabe(clabe).ok).toBe(true);
    expect(validateClabe(clabe, { requireKnownBank: true }).error?.code).toBe("UNKNOWN_BANK");
  });

  it("isValidClabe mirrors validateClabe", () => {
    expect(isValidClabe(SAMPLES[0] as string)).toBe(true);
    expect(isValidClabe("1234")).toBe(false);
  });
});

describe("generateClabe", () => {
  it("round-trips through validation and left-pads the account", () => {
    const clabe = generateClabe({ bankCode: "012", plaza: "180", account: "42" });
    const r = validateClabe(clabe);
    expect(r.ok && r.value.account).toBe("00000000042");
    expect(r.ok && r.value.bank?.name).toBe("BBVA MEXICO");
  });

  it("rejects malformed parts", () => {
    expect(() => generateClabe({ bankCode: "12", plaza: "180", account: "1" })).toThrow(RangeError);
    expect(() => generateClabe({ bankCode: "012", plaza: "18", account: "1" })).toThrow(RangeError);
    expect(() => generateClabe({ bankCode: "012", plaza: "180", account: "" })).toThrow(RangeError);
    expect(() => generateClabe({ bankCode: "012", plaza: "180", account: "123456789012" })).toThrow(
      RangeError,
    );
  });
});

describe("normalizeClabe", () => {
  it("strips spaces and hyphens", () => {
    expect(normalizeClabe("002 180-001234567896")).toBe("002180001234567896");
  });
});
