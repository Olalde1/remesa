import { describe, expect, it } from "vitest";
import { formatMoney, money, toDecimalString } from "../src/money.js";
import { parseRate, priceRemittance } from "../src/quotes.js";

describe("priceRemittance", () => {
  it("breaks down fee, FX margin and total cost (RPW-style)", () => {
    const q = priceRemittance({
      send: money("300.00", "USD"),
      fee: money("4.99", "USD"),
      rate: "18.05",
      referenceRate: "18.32",
    });
    expect(formatMoney(q.receive)).toBe("$5,415.00 MXN");
    expect(formatMoney(q.receiveAtReference)).toBe("$5,496.00 MXN");
    expect(formatMoney(q.totalCharged)).toBe("$304.99 USD");
    expect(toDecimalString(q.fxMargin)).toBe("4.42"); // 300 × 0.27 / 18.32 = 4.4214
    expect(toDecimalString(q.totalCost)).toBe("9.41");
    expect(q.feePct).toBe("1.66");
    expect(q.fxMarginPct).toBe("1.47");
    expect(q.totalCostPct).toBe("3.14");
    expect(q.rate).toBe("18.05");
    expect(q.referenceRate).toBe("18.32");
  });

  it("handles USDC's 6 decimals without assuming a peg", () => {
    const q = priceRemittance({
      send: money("300", "USDC"),
      fee: money("0", "USDC"),
      rate: "18.10",
      referenceRate: "18.32",
    });
    expect(toDecimalString(q.receive)).toBe("5430.00");
    expect(q.feePct).toBe("0.00");
    expect(q.fxMarginPct).toBe("1.20");
    expect(q.totalCostPct).toBe("1.20");
    expect(toDecimalString(q.fxMargin)).toBe("3.602620");
  });

  it("reports a negative margin when the rate beats the reference", () => {
    const q = priceRemittance({
      send: money("100", "USD"),
      fee: money("0", "USD"),
      rate: "18.50",
      referenceRate: "18.32",
    });
    expect(q.fxMarginPct).toBe("-0.98");
    expect(q.totalCostPct).toBe("-0.98");
    expect(toDecimalString(q.fxMargin)).toBe("-0.98");
  });

  it("rounds receive amounts half-up to centavos", () => {
    const q = priceRemittance({
      send: money("0.01", "USD"),
      fee: money("0", "USD"),
      rate: "18.5",
      referenceRate: "18.5",
    });
    expect(toDecimalString(q.receive)).toBe("0.19"); // 0.185 → 0.19
    expect(q.fxMarginPct).toBe("0.00");
  });

  it("validates inputs", () => {
    const ok = {
      send: money("100", "USD"),
      fee: money("1", "USD"),
      rate: "18",
      referenceRate: "18.3",
    };
    expect(() => priceRemittance({ ...ok, send: money("100", "MXN") })).toThrow(TypeError);
    expect(() => priceRemittance({ ...ok, fee: money("1", "USDC") })).toThrow(TypeError);
    expect(() => priceRemittance({ ...ok, send: money("0", "USD") })).toThrow(RangeError);
    expect(() => priceRemittance({ ...ok, fee: money("-1", "USD") })).toThrow(RangeError);
    expect(() => priceRemittance({ ...ok, rate: "abc" })).toThrow(RangeError);
    expect(() => priceRemittance({ ...ok, rate: "0" })).toThrow(RangeError);
    expect(() => priceRemittance({ ...ok, referenceRate: "-18" })).toThrow(RangeError);
  });
});

describe("parseRate", () => {
  it("parses up to 12 decimals", () => {
    expect(parseRate("18.123456789012")).toBe(18_123_456_789_012n);
    expect(() => parseRate("18.1234567890123")).toThrow(RangeError);
    expect(parseRate(" 1 ")).toBe(1_000_000_000_000n);
  });
});
