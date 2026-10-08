/**
 * Transparent remittance pricing (pure functions, no network).
 *
 * Follows the cost definition used by the World Bank's Remittance Prices
 * Worldwide (RPW) database: the total cost of sending money is the fee plus
 * the exchange-rate margin, expressed as a percentage of the amount sent.
 *
 *   FX margin %   = (referenceRate - rate) / referenceRate × 100
 *   fee %         = fee / send × 100
 *   total cost %  = fee % + FX margin %
 *
 * `referenceRate` should be a mid-market (interbank) rate you obtained
 * yourself, e.g. Banco de México's FIX rate. The caller supplies all rates;
 * this module never fetches anything.
 */

import { decimalsOf, type Money, money } from "./money.js";

/** Fixed-point scale for rates: up to 12 decimal places. */
const RATE_DECIMALS = 12;
const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);

export type SendCurrency = "USD" | "USDC";

export interface PriceRemittanceInput {
  /** Principal sent (excluding the fee), in USD or USDC. */
  readonly send: Money;
  /** Fee charged to the sender, same currency as `send`. Use money("0", ...) for none. */
  readonly fee: Money;
  /** MXN per 1 unit of the send currency offered to the customer, as a decimal string. */
  readonly rate: string;
  /** Mid-market / reference MXN rate for the same pair, as a decimal string. */
  readonly referenceRate: string;
}

export interface RemittanceQuote {
  readonly send: Money;
  readonly fee: Money;
  /** send + fee: what the sender pays in total. */
  readonly totalCharged: Money;
  /** MXN the beneficiary receives at the offered rate (rounded half-up to centavos). */
  readonly receive: Money;
  /** MXN the beneficiary would receive at the reference rate. */
  readonly receiveAtReference: Money;
  readonly rate: string;
  readonly referenceRate: string;
  /** FX margin expressed in the send currency (negative if the rate beats the reference). */
  readonly fxMargin: Money;
  /** fee + fxMargin, in the send currency. */
  readonly totalCost: Money;
  /** Percentages as strings with 2 decimals, e.g. "3.14". */
  readonly feePct: string;
  readonly fxMarginPct: string;
  readonly totalCostPct: string;
}

/** Parses a positive decimal rate string into a bigint scaled by 10^12. */
export function parseRate(rate: string): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  if (!m) throw new RangeError(`Invalid rate: "${rate}"`);
  const [, int, frac = ""] = m;
  if (frac.length > RATE_DECIMALS) {
    throw new RangeError(`Rates support at most ${RATE_DECIMALS} decimals`);
  }
  const scaled = BigInt(int + frac.padEnd(RATE_DECIMALS, "0"));
  if (scaled <= 0n) throw new RangeError("Rate must be greater than zero");
  return scaled;
}

function formatRate(scaled: bigint): string {
  const s = scaled.toString().padStart(RATE_DECIMALS + 1, "0");
  const int = s.slice(0, -RATE_DECIMALS);
  const frac = s.slice(-RATE_DECIMALS).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

/** Integer division rounding half away from zero. Denominator must be positive. */
function divRound(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  if (r === 0n) return q;
  const twice = (r < 0n ? -r : r) * 2n;
  if (twice >= d) return n < 0n ? q - 1n : q + 1n;
  return q;
}

/** n/d as a percentage string with 2 decimals. */
function pct(n: bigint, d: bigint): string {
  const hundredths = divRound(n * 10000n, d);
  const neg = hundredths < 0n;
  const abs = (neg ? -hundredths : hundredths).toString().padStart(3, "0");
  return `${neg ? "-" : ""}${abs.slice(0, -2)}.${abs.slice(-2)}`;
}

function toMxn(send: Money, scaledRate: bigint): Money {
  const sendDecimals = BigInt(decimalsOf(send.currency));
  const mxnDecimals = BigInt(decimalsOf("MXN"));
  const n = send.amount * scaledRate * 10n ** mxnDecimals;
  const d = RATE_SCALE * 10n ** sendDecimals;
  return money(divRound(n, d), "MXN");
}

/**
 * Prices a USD or USDC → MXN remittance and breaks down its true cost.
 *
 * Stablecoins are never assumed to be pegged: for a USDC send, pass a
 * USDC/MXN `rate` and `referenceRate`.
 *
 * @throws TypeError / RangeError on invalid input (currency mismatch,
 *   non-positive send amount, negative fee, malformed rates).
 */
export function priceRemittance(input: PriceRemittanceInput): RemittanceQuote {
  const { send, fee } = input;
  if (send.currency !== "USD" && send.currency !== "USDC") {
    throw new TypeError("send must be in USD or USDC");
  }
  if (fee.currency !== send.currency) throw new TypeError("fee must use the send currency");
  if (send.amount <= 0n) throw new RangeError("send amount must be greater than zero");
  if (fee.amount < 0n) throw new RangeError("fee must not be negative");

  const rate = parseRate(input.rate);
  const ref = parseRate(input.referenceRate);

  const fxMargin = money(divRound(send.amount * (ref - rate), ref), send.currency);

  return {
    send,
    fee,
    totalCharged: money(send.amount + fee.amount, send.currency),
    receive: toMxn(send, rate),
    receiveAtReference: toMxn(send, ref),
    rate: formatRate(rate),
    referenceRate: formatRate(ref),
    fxMargin,
    totalCost: money(fee.amount + fxMargin.amount, send.currency),
    feePct: pct(fee.amount, send.amount),
    fxMarginPct: pct(ref - rate, ref),
    totalCostPct: pct(fee.amount * ref + send.amount * (ref - rate), send.amount * ref),
  };
}
