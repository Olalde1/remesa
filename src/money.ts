/**
 * Exact money arithmetic using bigint minor units. Never floats.
 *
 * Decimal places: MXN and USD per ISO 4217 (2); USDC per Circle's public
 * token documentation (6 decimals).
 */

export const CURRENCIES = { MXN: 2, USD: 2, USDC: 6 } as const;

export type Currency = keyof typeof CURRENCIES;

export interface Money {
  /** Amount in minor units (centavos, cents, or 10^-6 USDC). */
  readonly amount: bigint;
  readonly currency: Currency;
}

const DECIMAL_RE = /^(-)?(\d+)(?:\.(\d+))?$/;

export function isCurrency(value: string): value is Currency {
  return Object.hasOwn(CURRENCIES, value);
}

/** Number of decimal places for a currency. */
export function decimalsOf(currency: Currency): number {
  return CURRENCIES[currency];
}

/**
 * Creates a Money value from a decimal string (or a bigint of minor units).
 *
 * @example money("300.00", "USD") // { amount: 30000n, currency: "USD" }
 * @throws RangeError if the string is not a plain decimal or has more
 *   decimals than the currency allows.
 */
export function money(value: string | bigint, currency: Currency): Money {
  if (!isCurrency(currency)) throw new RangeError(`Unsupported currency: ${String(currency)}`);
  if (typeof value === "bigint") return Object.freeze({ amount: value, currency });
  const decimals = CURRENCIES[currency];
  const m = DECIMAL_RE.exec(value.trim().replace(/_/g, ""));
  if (!m) throw new RangeError(`Invalid decimal amount: "${value}"`);
  const [, sign, int, frac = ""] = m;
  if (frac.length > decimals) {
    throw new RangeError(`${currency} supports at most ${decimals} decimals, got "${value}"`);
  }
  const minor = BigInt(int + frac.padEnd(decimals, "0"));
  return Object.freeze({ amount: sign ? -minor : minor, currency });
}

/** Exact decimal string, e.g. "5415.00" or "300.000000". */
export function toDecimalString(m: Money): string {
  const decimals = CURRENCIES[m.currency];
  const neg = m.amount < 0n;
  const digits = (neg ? -m.amount : m.amount).toString().padStart(decimals + 1, "0");
  const int = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals);
  return `${neg ? "-" : ""}${int}${decimals > 0 ? `.${frac}` : ""}`;
}

/** Human-friendly format, e.g. "$5,415.00 MXN" or "300.000000 USDC". */
export function formatMoney(m: Money): string {
  const [int = "0", frac] = toDecimalString(m).replace("-", "").split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = m.amount < 0n ? "-" : "";
  const body = frac === undefined ? grouped : `${grouped}.${frac}`;
  return m.currency === "USDC" ? `${sign}${body} USDC` : `${sign}$${body} ${m.currency}`;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}
