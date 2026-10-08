import { describe, expect, it } from "vitest";
import * as remesa from "../src/index.js";

describe("public API", () => {
  it("exposes every MVP module from the root entry", () => {
    for (const name of [
      "money",
      "formatMoney",
      "validateClabe",
      "generateClabe",
      "computeClabeCheckDigit",
      "banks",
      "findBankByCode",
      "findBankByClabe",
      "parseBeneficiaryAccount",
      "isValidLuhn",
      "sanitizeConcept",
      "validateNumericReference",
      "createTrackingKey",
      "buildCepQuery",
      "signWebhook",
      "verifyWebhook",
      "priceRemittance",
    ]) {
      expect(remesa, name).toHaveProperty(name);
    }
  });

  it("generated CLABEs always validate (property check over many inputs)", () => {
    for (let i = 0; i < 2000; i++) {
      const account = String((i * 7919) % 100_000_000_000);
      const plaza = String((i * 31) % 1000).padStart(3, "0");
      const bank = remesa.banks[i % remesa.banks.length];
      if (!bank) continue;
      const clabe = remesa.generateClabe({ bankCode: bank.clabeCode, plaza, account });
      const r = remesa.validateClabe(clabe, { requireKnownBank: true });
      expect(r.ok).toBe(true);
      // Changing any single digit must break the check digit.
      const pos = i % 18;
      const digit = Number(clabe[pos]);
      const mutated = `${clabe.slice(0, pos)}${(digit + 1 + (i % 9)) % 10}${clabe.slice(pos + 1)}`;
      if (mutated !== clabe) expect(remesa.isValidClabe(mutated)).toBe(false);
    }
  });
});
