import { describe, expect, it } from "vitest";
import {
  BANK_CATALOG_SNAPSHOT_DATE,
  BANK_CATALOG_SOURCE,
  banks,
  findBankByClabe,
  findBankByCode,
} from "../src/banks.js";

describe("bank catalog snapshot", () => {
  it("is dated and sourced", () => {
    expect(BANK_CATALOG_SNAPSHOT_DATE).toBe("2026-10-08");
    expect(BANK_CATALOG_SOURCE).toBe("https://www.banxico.org.mx/cep/");
  });

  it("contains the major participants with consistent codes", () => {
    expect(banks.length).toBeGreaterThan(80);
    for (const b of banks) {
      expect(b.speiCode).toMatch(/^\d{4,5}$/);
      expect(b.clabeCode).toBe(b.speiCode.slice(-3));
      expect(b.name.length).toBeGreaterThan(0);
    }
    expect(findBankByCode("012")).toMatchObject({ name: "BBVA MEXICO", speiCode: "40012" });
    expect(findBankByCode("40002")?.name).toBe("BANAMEX");
    expect(findBankByCode("2001")?.name).toBe("BANXICO");
  });

  it("has unique codes", () => {
    expect(new Set(banks.map((b) => b.speiCode)).size).toBe(banks.length);
    expect(new Set(banks.map((b) => b.clabeCode)).size).toBe(banks.length);
  });

  it("returns undefined for unknown or malformed codes", () => {
    expect(findBankByCode("999")).toBeUndefined();
    expect(findBankByCode("0012")).toBeUndefined();
    expect(findBankByCode("12")).toBeUndefined();
  });

  it("finds a bank from a CLABE prefix", () => {
    expect(findBankByClabe("002-180-00000000000")?.name).toBe("BANAMEX");
    expect(findBankByClabe("abc")).toBeUndefined();
  });
});
