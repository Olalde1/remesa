/**
 * CLABE (Clave Bancaria Estandarizada): 18-digit standardized account number
 * used for SPEI transfers in Mexico.
 *
 * Structure (public Banco de México / ABM standard):
 *   - 3 digits: bank code
 *   - 3 digits: plaza (city/branch) code
 *   - 11 digits: account number
 *   - 1 digit: check digit
 *
 * Check digit: multiply each of the first 17 digits by the repeating weights
 * 3, 7, 1; take each product modulo 10; sum; the check digit is
 * (10 - (sum mod 10)) mod 10.
 */

import { type Bank, findBankByClabe } from "./banks.js";
import { err, ok, type Result } from "./result.js";

const WEIGHTS = [3, 7, 1] as const;

export interface ParsedClabe {
  /** The normalized 18-digit CLABE. */
  readonly clabe: string;
  readonly bankCode: string;
  /** Bank from the bundled snapshot, or undefined if the code isn't in it. */
  readonly bank: Bank | undefined;
  readonly plaza: string;
  readonly account: string;
  readonly checkDigit: string;
}

export type ClabeErrorCode =
  | "INVALID_CHARACTERS"
  | "INVALID_LENGTH"
  | "INVALID_CHECK_DIGIT"
  | "UNKNOWN_BANK";

export interface ValidateClabeOptions {
  /** Reject CLABEs whose bank code is not in the bundled catalog snapshot. Default: false. */
  readonly requireKnownBank?: boolean;
}

/** Removes spaces and hyphens commonly used to group CLABE digits. */
export function normalizeClabe(input: string): string {
  return input.replace(/[\s-]/g, "");
}

/**
 * Computes the CLABE check digit for the first 17 digits.
 * @throws RangeError if the input is not exactly 17 digits.
 */
export function computeClabeCheckDigit(first17: string): string {
  if (!/^\d{17}$/.test(first17)) {
    throw new RangeError("computeClabeCheckDigit expects exactly 17 digits");
  }
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += (Number(first17[i]) * (WEIGHTS[i % 3] as number)) % 10;
  }
  return String((10 - (sum % 10)) % 10);
}

/** Validates a CLABE and parses its parts. */
export function validateClabe(
  input: string,
  options: ValidateClabeOptions = {},
): Result<ParsedClabe, ClabeErrorCode> {
  const clabe = normalizeClabe(input);
  if (!/^\d*$/.test(clabe)) return err("INVALID_CHARACTERS", "A CLABE may only contain digits");
  if (clabe.length !== 18) {
    return err("INVALID_LENGTH", `A CLABE has 18 digits, got ${clabe.length}`);
  }
  const expected = computeClabeCheckDigit(clabe.slice(0, 17));
  if (clabe[17] !== expected) {
    return err(
      "INVALID_CHECK_DIGIT",
      `Invalid check digit: expected ${expected}, got ${clabe[17]}`,
    );
  }
  const bank = findBankByClabe(clabe);
  if (options.requireKnownBank && !bank) {
    return err("UNKNOWN_BANK", `Bank code ${clabe.slice(0, 3)} is not in the catalog snapshot`);
  }
  return ok({
    clabe,
    bankCode: clabe.slice(0, 3),
    bank,
    plaza: clabe.slice(3, 6),
    account: clabe.slice(6, 17),
    checkDigit: clabe.slice(17),
  });
}

/** Convenience boolean wrapper around {@link validateClabe}. */
export function isValidClabe(input: string, options?: ValidateClabeOptions): boolean {
  return validateClabe(input, options).ok;
}

export interface GenerateClabeInput {
  /** 3-digit bank code, e.g. "002". */
  readonly bankCode: string;
  /** 3-digit plaza code, e.g. "180". */
  readonly plaza: string;
  /** Account number, up to 11 digits (left-padded with zeros). */
  readonly account: string;
}

/**
 * Builds a valid CLABE from its parts by appending the check digit.
 * Useful for test fixtures and for institutions issuing their own CLABEs.
 * @throws RangeError on malformed parts.
 */
export function generateClabe({ bankCode, plaza, account }: GenerateClabeInput): string {
  if (!/^\d{3}$/.test(bankCode)) throw new RangeError("bankCode must be 3 digits");
  if (!/^\d{3}$/.test(plaza)) throw new RangeError("plaza must be 3 digits");
  if (!/^\d{1,11}$/.test(account)) throw new RangeError("account must be 1 to 11 digits");
  const first17 = `${bankCode}${plaza}${account.padStart(11, "0")}`;
  return first17 + computeClabeCheckDigit(first17);
}
