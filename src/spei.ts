/**
 * SPEI field helpers, based on public Banco de México information:
 *  - Beneficiary account types accepted by SPEI ("Mi SPEI", banxico.org.mx):
 *    18-digit CLABE, 16-digit debit card, or 10-digit mobile phone number.
 *  - CEP portal notes (banxico.org.mx/cep): numeric reference of up to 7
 *    positions; tracking key ("clave de rastreo") of up to 30 alphanumeric
 *    positions.
 *  - Payment concept ("concepto de pago"): up to 40 alphanumeric characters
 *    as commonly published by banks for SPEI instructions.
 *
 * Banks may apply stricter rules; when in doubt, use the conservative
 * defaults here and confirm with your payment provider.
 */

import { type ParsedClabe, validateClabe } from "./clabe.js";
import { err, ok, type Result } from "./result.js";

export const SPEI_CONCEPT_MAX_LENGTH = 40;
export const SPEI_NUMERIC_REFERENCE_MAX_DIGITS = 7;
export const SPEI_TRACKING_KEY_MAX_LENGTH = 30;

// ---------------------------------------------------------------------------
// Beneficiary accounts
// ---------------------------------------------------------------------------

export type BeneficiaryAccount =
  | { readonly type: "clabe"; readonly number: string; readonly clabe: ParsedClabe }
  | { readonly type: "debit_card"; readonly number: string }
  | { readonly type: "phone"; readonly number: string };

export type BeneficiaryAccountErrorCode =
  | "INVALID_CHARACTERS"
  | "UNSUPPORTED_LENGTH"
  | "INVALID_CHECK_DIGIT"
  | "INVALID_LUHN"
  | "INVALID_PHONE";

/** Luhn (mod 10) checksum used by payment card numbers (ISO/IEC 7812). */
export function isValidLuhn(digits: string): boolean {
  if (!/^\d{2,}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Validates a 10-digit Mexican phone number as a SPEI destination.
 * Mexican national numbers are 10 digits and do not start with 0 or 1.
 * A leading "+52" or "52" country code is accepted and removed.
 */
export function normalizeMexicanPhone(input: string): string | undefined {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+52")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("52")) digits = digits.slice(2);
  return /^[2-9]\d{9}$/.test(digits) ? digits : undefined;
}

/**
 * Detects and validates a SPEI beneficiary account: CLABE (18 digits, check
 * digit), debit card (16 digits, Luhn) or mobile phone (10 digits).
 * Spaces, hyphens and dots used for grouping are ignored.
 */
export function parseBeneficiaryAccount(
  input: string,
): Result<BeneficiaryAccount, BeneficiaryAccountErrorCode> {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) {
    const phone = normalizeMexicanPhone(trimmed);
    return phone
      ? ok({ type: "phone", number: phone })
      : err("INVALID_PHONE", "Not a valid 10-digit Mexican phone number");
  }
  const digits = trimmed.replace(/[\s\-().]/g, "");
  if (!/^\d+$/.test(digits)) return err("INVALID_CHARACTERS", "Account must contain only digits");
  switch (digits.length) {
    case 18: {
      const r = validateClabe(digits);
      if (r.ok) return ok({ type: "clabe", number: digits, clabe: r.value });
      return err("INVALID_CHECK_DIGIT", r.error.message);
    }
    case 16:
      return isValidLuhn(digits)
        ? ok({ type: "debit_card", number: digits })
        : err("INVALID_LUHN", "Card number fails the Luhn check");
    case 10: {
      const phone = normalizeMexicanPhone(digits);
      return phone
        ? ok({ type: "phone", number: phone })
        : err("INVALID_PHONE", "Mexican phone numbers do not start with 0 or 1");
    }
    default:
      return err(
        "UNSUPPORTED_LENGTH",
        `Expected 18 (CLABE), 16 (debit card) or 10 (phone) digits, got ${digits.length}`,
      );
  }
}

// ---------------------------------------------------------------------------
// Payment concept
// ---------------------------------------------------------------------------

/** Characters this library treats as safe in a SPEI payment concept. */
const CONCEPT_ALLOWED = /^[A-Za-z0-9 .,\-/]*$/;

export interface SanitizeConceptOptions {
  /** Maximum length. Default: 40. */
  readonly maxLength?: number;
}

/**
 * Makes a free-text payment concept safe for SPEI: removes accents (á → a,
 * ñ → n), replaces typographic dashes, drops any other unsupported character
 * (including emoji), collapses whitespace and truncates to 40 characters.
 */
export function sanitizeConcept(input: string, options: SanitizeConceptOptions = {}): string {
  const max = options.maxLength ?? SPEI_CONCEPT_MAX_LENGTH;
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[^A-Za-z0-9 .,\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trimEnd();
}

export type ConceptErrorCode = "EMPTY" | "TOO_LONG" | "INVALID_CHARACTERS";

/** Strict check: does the concept already satisfy the rules (no changes needed)? */
export function validateConcept(
  input: string,
  options: SanitizeConceptOptions = {},
): Result<string, ConceptErrorCode> {
  const max = options.maxLength ?? SPEI_CONCEPT_MAX_LENGTH;
  if (input.trim().length === 0) return err("EMPTY", "Concept must not be empty");
  if (input.length > max) return err("TOO_LONG", `Concept exceeds ${max} characters`);
  if (!CONCEPT_ALLOWED.test(input)) {
    return err("INVALID_CHARACTERS", "Use letters, digits, spaces and . , - / only");
  }
  return ok(input);
}

// ---------------------------------------------------------------------------
// Numeric reference
// ---------------------------------------------------------------------------

export type NumericReferenceErrorCode = "INVALID_FORMAT" | "TOO_LONG";

/**
 * Validates a SPEI numeric reference (up to 7 digits) and returns it
 * left-padded with zeros to 7 positions.
 */
export function validateNumericReference(
  value: number | string,
): Result<string, NumericReferenceErrorCode> {
  const s = typeof value === "number" ? (Number.isSafeInteger(value) ? String(value) : "") : value;
  const digits = s.trim();
  if (!/^\d+$/.test(digits)) {
    return err("INVALID_FORMAT", "Numeric reference must be a non-negative integer");
  }
  const stripped = digits.replace(/^0+(?=\d)/, "");
  if (stripped.length > SPEI_NUMERIC_REFERENCE_MAX_DIGITS) {
    return err("TOO_LONG", "Numeric reference has at most 7 digits");
  }
  return ok(stripped.padStart(SPEI_NUMERIC_REFERENCE_MAX_DIGITS, "0"));
}

// ---------------------------------------------------------------------------
// Tracking key (clave de rastreo)
// ---------------------------------------------------------------------------

/** A tracking key is 1–30 alphanumeric characters. */
export function isValidTrackingKey(key: string): boolean {
  return /^[A-Za-z0-9]{1,30}$/.test(key);
}

const TRACKING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I for readability

export interface CreateTrackingKeyOptions {
  /** Alphanumeric prefix identifying your platform, 1–10 chars. */
  readonly prefix: string;
  /** Date embedded as YYYYMMDD (UTC). Default: now. */
  readonly date?: Date;
  /** Random suffix length. Default: 10. Total length must stay ≤ 30. */
  readonly randomLength?: number;
}

/**
 * Creates a tracking key: PREFIX + YYYYMMDD + random suffix, e.g.
 * "RMS20261008K3F9Q2ZD7A". Uses the Web Crypto CSPRNG (Node 20+, browsers).
 *
 * Note: in production the *sending* institution assigns the tracking key;
 * use this when you are that institution or your provider lets you set it.
 */
export function createTrackingKey(options: CreateTrackingKeyOptions): string {
  const { prefix, date = new Date(), randomLength = 10 } = options;
  if (!/^[A-Za-z0-9]{1,10}$/.test(prefix)) {
    throw new RangeError("prefix must be 1-10 alphanumeric characters");
  }
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  if (!Number.isInteger(randomLength) || randomLength < 0) {
    throw new RangeError("randomLength must be a non-negative integer");
  }
  if (prefix.length + ymd.length + randomLength > SPEI_TRACKING_KEY_MAX_LENGTH) {
    throw new RangeError("Tracking key would exceed 30 characters");
  }
  const bytes = new Uint8Array(randomLength);
  globalThis.crypto.getRandomValues(bytes);
  let suffix = "";
  for (const b of bytes) suffix += TRACKING_ALPHABET[b % TRACKING_ALPHABET.length];
  return `${prefix.toUpperCase()}${ymd}${suffix}`;
}
