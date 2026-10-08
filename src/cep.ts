/**
 * CEP (Comprobante Electrónico de Pago) lookup helper.
 *
 * Banco de México's public CEP portal (https://www.banxico.org.mx/cep/) lets
 * the sender or beneficiary of a SPEI transfer download its electronic
 * receipt. The portal asks for: the operation date, a search criterion
 * (tracking key or numeric reference), the sending and receiving
 * institutions, the beneficiary account and the amount, and it is protected
 * by a captcha.
 *
 * This module only validates and normalizes those inputs and returns them
 * with the official portal URL. It never submits the form, solves captchas
 * or scrapes the site.
 */

import { findBankByCode } from "./banks.js";
import { type Money, toDecimalString } from "./money.js";
import { err, ok, type Result } from "./result.js";
import { isValidTrackingKey, parseBeneficiaryAccount, validateNumericReference } from "./spei.js";

export const CEP_PORTAL_URL = "https://www.banxico.org.mx/cep/";

export interface CepQueryInput {
  /** Operation date as "YYYY-MM-DD" or a Date (its UTC date is used). */
  readonly date: string | Date;
  /** Tracking key (preferred: unique across SPEI). Provide this or `numericReference`. */
  readonly trackingKey?: string;
  /** Numeric reference (up to 7 digits). Used only if no tracking key is given. */
  readonly numericReference?: number | string;
  /** Sending institution: 3-digit CLABE code or SPEI participant code. */
  readonly senderBank: string;
  /** Receiving institution: 3-digit CLABE code or SPEI participant code. */
  readonly receiverBank: string;
  /** Beneficiary CLABE, debit card or phone. Ignored when `beneficiaryIsParticipant`. */
  readonly beneficiaryAccount?: string;
  /** The beneficiary is the receiving institution itself, not one of its clients. */
  readonly beneficiaryIsParticipant?: boolean;
  /** Transfer amount; must be MXN and positive. */
  readonly amount: Money;
}

export interface CepQuery {
  readonly portalUrl: string;
  /** Normalized values, keyed by the portal's public form field names. */
  readonly fields: {
    /** DD-MM-YYYY, as used by the portal's date picker. */
    readonly fecha: string;
    /** "T" = tracking key, "R" = numeric reference. */
    readonly tipoCriterio: "T" | "R";
    readonly criterio: string;
    /** SPEI participant code of the sender. */
    readonly emisor: string;
    /** SPEI participant code of the receiver. */
    readonly receptor: string;
    readonly cuenta: string;
    readonly receptorParticipante: boolean;
    /** Amount with 2 decimals, e.g. "5415.00". */
    readonly monto: string;
  };
}

export type CepQueryErrorCode =
  | "INVALID_DATE"
  | "MISSING_CRITERION"
  | "INVALID_TRACKING_KEY"
  | "INVALID_NUMERIC_REFERENCE"
  | "UNKNOWN_SENDER_BANK"
  | "UNKNOWN_RECEIVER_BANK"
  | "INVALID_ACCOUNT"
  | "INVALID_AMOUNT";

function toIsoDate(date: string | Date): string | undefined {
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return undefined;
  const d = new Date(`${m[0]}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === m[0] ? m[0] : undefined;
}

/** Validates and normalizes the data needed to look up a CEP on Banxico's portal. */
export function buildCepQuery(input: CepQueryInput): Result<CepQuery, CepQueryErrorCode> {
  const iso = toIsoDate(input.date);
  if (!iso) return err("INVALID_DATE", "date must be a valid YYYY-MM-DD date");
  const [y, mo, d] = iso.split("-");

  let tipoCriterio: "T" | "R";
  let criterio: string;
  if (input.trackingKey !== undefined) {
    const key = input.trackingKey.trim();
    if (!isValidTrackingKey(key)) {
      return err("INVALID_TRACKING_KEY", "Tracking key must be 1-30 alphanumeric characters");
    }
    tipoCriterio = "T";
    criterio = key;
  } else if (input.numericReference !== undefined) {
    const ref = validateNumericReference(input.numericReference);
    if (!ref.ok) return err("INVALID_NUMERIC_REFERENCE", ref.error.message);
    tipoCriterio = "R";
    criterio = ref.value;
  } else {
    return err("MISSING_CRITERION", "Provide a trackingKey or a numericReference");
  }

  const sender = findBankByCode(input.senderBank);
  if (!sender) return err("UNKNOWN_SENDER_BANK", `Unknown sender bank: ${input.senderBank}`);
  const receiver = findBankByCode(input.receiverBank);
  if (!receiver)
    return err("UNKNOWN_RECEIVER_BANK", `Unknown receiver bank: ${input.receiverBank}`);

  let cuenta = "";
  const receptorParticipante = input.beneficiaryIsParticipant === true;
  if (!receptorParticipante) {
    const account = parseBeneficiaryAccount(input.beneficiaryAccount ?? "");
    if (!account.ok) return err("INVALID_ACCOUNT", account.error.message);
    cuenta = account.value.number;
  }

  if (input.amount.currency !== "MXN" || input.amount.amount <= 0n) {
    return err("INVALID_AMOUNT", "amount must be a positive MXN amount");
  }
  const monto = toDecimalString(input.amount);

  return ok({
    portalUrl: CEP_PORTAL_URL,
    fields: {
      fecha: `${d}-${mo}-${y}`,
      tipoCriterio,
      criterio,
      emisor: sender.speiCode,
      receptor: receiver.speiCode,
      cuenta,
      receptorParticipante,
      monto,
    },
  });
}
