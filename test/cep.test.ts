import { describe, expect, it } from "vitest";
import { buildCepQuery, CEP_PORTAL_URL } from "../src/cep.js";
import { money } from "../src/money.js";

const base = {
  date: "2026-10-08",
  trackingKey: "RMS20261008K3F9Q2ZD7A",
  senderBank: "40012",
  receiverBank: "002",
  beneficiaryAccount: "002180001234567896",
  amount: money("5415.00", "MXN"),
} as const;

describe("buildCepQuery", () => {
  it("normalizes fields for the public portal", () => {
    expect(buildCepQuery(base)).toEqual({
      ok: true,
      value: {
        portalUrl: CEP_PORTAL_URL,
        fields: {
          fecha: "08-10-2026",
          tipoCriterio: "T",
          criterio: "RMS20261008K3F9Q2ZD7A",
          emisor: "40012",
          receptor: "40002",
          cuenta: "002180001234567896",
          receptorParticipante: false,
          monto: "5415.00",
        },
      },
    });
    expect(CEP_PORTAL_URL).toBe("https://www.banxico.org.mx/cep/");
  });

  it("supports numeric references, Date objects and payments to the institution itself", () => {
    const { trackingKey: _t, beneficiaryAccount: _b, ...rest } = base;
    const r = buildCepQuery({
      ...rest,
      date: new Date("2026-10-08T23:00:00Z"),
      numericReference: 42,
      beneficiaryIsParticipant: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fields).toMatchObject({
      fecha: "08-10-2026",
      tipoCriterio: "R",
      criterio: "0000042",
      cuenta: "",
      receptorParticipante: true,
    });
  });

  it("returns typed errors", () => {
    const { trackingKey: _t, ...noKey } = base;
    expect(buildCepQuery({ ...base, date: "2026-02-30" }).error?.code).toBe("INVALID_DATE");
    expect(buildCepQuery({ ...base, date: "08/10/2026" }).error?.code).toBe("INVALID_DATE");
    expect(buildCepQuery({ ...base, date: new Date("x") }).error?.code).toBe("INVALID_DATE");
    expect(buildCepQuery(noKey).error?.code).toBe("MISSING_CRITERION");
    expect(buildCepQuery({ ...base, trackingKey: "bad key!" }).error?.code).toBe(
      "INVALID_TRACKING_KEY",
    );
    expect(buildCepQuery({ ...noKey, numericReference: 123456789 }).error?.code).toBe(
      "INVALID_NUMERIC_REFERENCE",
    );
    expect(buildCepQuery({ ...base, senderBank: "999" }).error?.code).toBe("UNKNOWN_SENDER_BANK");
    expect(buildCepQuery({ ...base, receiverBank: "999" }).error?.code).toBe(
      "UNKNOWN_RECEIVER_BANK",
    );
    expect(buildCepQuery({ ...base, beneficiaryAccount: "123" }).error?.code).toBe(
      "INVALID_ACCOUNT",
    );
    const { beneficiaryAccount: _b, ...noAccount } = base;
    expect(buildCepQuery(noAccount).error?.code).toBe("INVALID_ACCOUNT");
    expect(buildCepQuery({ ...base, amount: money("10", "USD") }).error?.code).toBe(
      "INVALID_AMOUNT",
    );
    expect(buildCepQuery({ ...base, amount: money("0", "MXN") }).error?.code).toBe(
      "INVALID_AMOUNT",
    );
  });
});
