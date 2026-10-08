import { describe, expect, it } from "vitest";
import { add, formatMoney, isCurrency, money, subtract, toDecimalString } from "../src/money.js";

describe("money", () => {
  it("parses decimal strings into minor units", () => {
    expect(money("300.00", "USD").amount).toBe(30000n);
    expect(money("300", "USDC").amount).toBe(300_000_000n);
    expect(money("0.5", "MXN").amount).toBe(50n);
    expect(money("-1.25", "USD").amount).toBe(-125n);
    expect(money("1_000.10", "MXN").amount).toBe(100010n);
    expect(money(123n, "MXN")).toEqual({ amount: 123n, currency: "MXN" });
  });

  it("rejects floats-in-disguise and too many decimals", () => {
    expect(() => money("1.234", "USD")).toThrow(RangeError);
    expect(() => money("1e3", "USD")).toThrow(RangeError);
    expect(() => money("", "USD")).toThrow(RangeError);
    // @ts-expect-error unsupported currency
    expect(() => money("1", "EUR")).toThrow(RangeError);
  });

  it("formats exactly", () => {
    expect(toDecimalString(money("5415", "MXN"))).toBe("5415.00");
    expect(toDecimalString(money("0.05", "MXN"))).toBe("0.05");
    expect(toDecimalString(money("-0.05", "MXN"))).toBe("-0.05");
    expect(formatMoney(money("5415.00", "MXN"))).toBe("$5,415.00 MXN");
    expect(formatMoney(money("1234567.8", "USD"))).toBe("$1,234,567.80 USD");
    expect(formatMoney(money("-12.5", "USD"))).toBe("-$12.50 USD");
    expect(formatMoney(money("300", "USDC"))).toBe("300.000000 USDC");
  });

  it("adds and subtracts same-currency amounts only", () => {
    expect(add(money("1.10", "USD"), money("2.25", "USD")).amount).toBe(335n);
    expect(subtract(money("1.10", "USD"), money("2.25", "USD")).amount).toBe(-115n);
    expect(() => add(money("1", "USD"), money("1", "USDC"))).toThrow(TypeError);
  });

  it("isCurrency guards", () => {
    expect(isCurrency("USDC")).toBe(true);
    expect(isCurrency("toString")).toBe(false);
  });
});
