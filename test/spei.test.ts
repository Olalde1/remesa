import { describe, expect, it } from "vitest";
import {
  createTrackingKey,
  isValidLuhn,
  isValidTrackingKey,
  normalizeMexicanPhone,
  parseBeneficiaryAccount,
  sanitizeConcept,
  validateConcept,
  validateNumericReference,
} from "../src/spei.js";

describe("isValidLuhn", () => {
  it("accepts valid card numbers and rejects invalid ones", () => {
    expect(isValidLuhn("4111111111111111")).toBe(true);
    expect(isValidLuhn("5555555555554444")).toBe(true);
    expect(isValidLuhn("4111111111111112")).toBe(false);
    expect(isValidLuhn("41111111111111a1")).toBe(false);
    expect(isValidLuhn("0")).toBe(false);
  });
});

describe("parseBeneficiaryAccount", () => {
  it("detects a CLABE", () => {
    const r = parseBeneficiaryAccount("002 180 00123456789 6");
    expect(r.ok && r.value.type).toBe("clabe");
    if (r.ok && r.value.type === "clabe") expect(r.value.clabe.bank?.name).toBe("BANAMEX");
  });

  it("detects a debit card with a valid Luhn digit", () => {
    expect(parseBeneficiaryAccount("4111 1111 1111 1111")).toEqual({
      ok: true,
      value: { type: "debit_card", number: "4111111111111111" },
    });
    expect(parseBeneficiaryAccount("4111-1111-1111-1112").error?.code).toBe("INVALID_LUHN");
  });

  it("detects a 10-digit phone, with or without +52", () => {
    expect(parseBeneficiaryAccount("55 1234 5678")).toEqual({
      ok: true,
      value: { type: "phone", number: "5512345678" },
    });
    expect(parseBeneficiaryAccount("+52 (55) 1234-5678").ok).toBe(true);
    expect(parseBeneficiaryAccount("0512345678").error?.code).toBe("INVALID_PHONE");
    expect(parseBeneficiaryAccount("+1 555 123 4567").error?.code).toBe("INVALID_PHONE");
  });

  it("reports bad CLABEs, characters and lengths", () => {
    expect(parseBeneficiaryAccount("002180001234567890").error?.code).toBe("INVALID_CHECK_DIGIT");
    expect(parseBeneficiaryAccount("abc").error?.code).toBe("INVALID_CHARACTERS");
    expect(parseBeneficiaryAccount("").error?.code).toBe("INVALID_CHARACTERS");
    expect(parseBeneficiaryAccount("12345").error?.code).toBe("UNSUPPORTED_LENGTH");
  });
});

describe("normalizeMexicanPhone", () => {
  it("strips a 52 country code without plus", () => {
    expect(normalizeMexicanPhone("525512345678")).toBe("5512345678");
    expect(normalizeMexicanPhone("1512345678")).toBeUndefined();
  });
});

describe("sanitizeConcept", () => {
  it("removes accents, emoji and typographic dashes", () => {
    expect(sanitizeConcept("Pago renta – Octubre 2026 🏠 para mamá")).toBe(
      "Pago renta - Octubre 2026 para mama",
    );
    expect(sanitizeConcept("Año niño ÁÉÍÓÚ ü")).toBe("Ano nino AEIOU u");
  });

  it("truncates to 40 characters without trailing spaces", () => {
    const out = sanitizeConcept(`${"a".repeat(39)} bcd`);
    expect(out).toBe("a".repeat(39));
    expect(sanitizeConcept("x".repeat(60))).toHaveLength(40);
    expect(sanitizeConcept("abcdef", { maxLength: 3 })).toBe("abc");
  });

  it("produces concepts that pass validateConcept", () => {
    const inputs = ["¡Hola! ¿Qué tal? #123", "Colegiatura @ escuela", "Pago   factura\n\t001/2026"];
    for (const s of inputs) {
      const clean = sanitizeConcept(s);
      expect(validateConcept(clean).ok).toBe(true);
    }
  });
});

describe("validateConcept", () => {
  it("flags empty, long and invalid concepts", () => {
    expect(validateConcept("   ").error?.code).toBe("EMPTY");
    expect(validateConcept("x".repeat(41)).error?.code).toBe("TOO_LONG");
    expect(validateConcept("mamá").error?.code).toBe("INVALID_CHARACTERS");
    expect(validateConcept("Renta oct 2026, depto 3/B").ok).toBe(true);
    expect(validateConcept("abcd", { maxLength: 3 }).error?.code).toBe("TOO_LONG");
  });
});

describe("validateNumericReference", () => {
  it("pads to 7 digits", () => {
    expect(validateNumericReference(1234567)).toEqual({ ok: true, value: "1234567" });
    expect(validateNumericReference(42)).toEqual({ ok: true, value: "0000042" });
    expect(validateNumericReference("0001234")).toEqual({ ok: true, value: "0001234" });
    expect(validateNumericReference(0)).toEqual({ ok: true, value: "0000000" });
  });

  it("rejects long, negative, fractional and non-numeric references", () => {
    expect(validateNumericReference(12345678).error?.code).toBe("TOO_LONG");
    expect(validateNumericReference(-1).error?.code).toBe("INVALID_FORMAT");
    expect(validateNumericReference(1.5).error?.code).toBe("INVALID_FORMAT");
    expect(validateNumericReference("12a").error?.code).toBe("INVALID_FORMAT");
  });
});

describe("tracking keys", () => {
  it("validates length and charset", () => {
    expect(isValidTrackingKey("RMS20261008K3F9Q2ZD7A")).toBe(true);
    expect(isValidTrackingKey("A".repeat(30))).toBe(true);
    expect(isValidTrackingKey("A".repeat(31))).toBe(false);
    expect(isValidTrackingKey("ABC-123")).toBe(false);
    expect(isValidTrackingKey("")).toBe(false);
  });

  it("creates valid, unique keys with the date embedded", () => {
    const date = new Date("2026-10-08T12:00:00Z");
    const a = createTrackingKey({ prefix: "rms", date });
    const b = createTrackingKey({ prefix: "rms", date });
    expect(a).toMatch(/^RMS20261008[A-Z2-9]{10}$/);
    expect(isValidTrackingKey(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(createTrackingKey({ prefix: "X" })).toHaveLength(19);
  });

  it("rejects bad options", () => {
    expect(() => createTrackingKey({ prefix: "" })).toThrow(RangeError);
    expect(() => createTrackingKey({ prefix: "TOO-LONG!" })).toThrow(RangeError);
    expect(() => createTrackingKey({ prefix: "A", date: new Date("nope") })).toThrow(RangeError);
    expect(() => createTrackingKey({ prefix: "ABCDEFGHIJ", randomLength: 13 })).toThrow(RangeError);
    expect(() => createTrackingKey({ prefix: "A", randomLength: -1 })).toThrow(RangeError);
  });
});
