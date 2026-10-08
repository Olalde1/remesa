# remesa

**A TypeScript toolkit for moving money into Mexico: validate CLABE, card, and phone payout accounts, build SPEI-ready transfers, verify webhooks, and price USD/USDC → MXN remittances transparently.**

<!-- Badges: replace placeholders once CI and npm are live -->
[![npm version](https://img.shields.io/npm/v/remesa.svg)](https://www.npmjs.com/package/remesa)
[![CI](https://github.com/Olalde1/remesa/actions/workflows/ci.yml/badge.svg)](https://github.com/Olalde1/remesa/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-TBD-lightgrey.svg)](#)
[![bundle size](https://img.shields.io/bundlephobia/minzip/remesa)](https://bundlephobia.com/package/remesa)
[![types](https://img.shields.io/npm/types/remesa)](https://www.npmjs.com/package/remesa)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> **Status: pre-1.0.** The API may change between minor versions until `v1.0.0`. Feedback and issues are very welcome.

---

## Why

Mexico is one of the largest remittance-receiving countries in the world, and almost all of that money lands in a bank account through **SPEI**, the real-time payment system operated by Banco de México. Every payout product, from remittance apps and payroll to marketplaces and stablecoin off-ramps, ends up rebuilding the same last-mile logic:

- Is this CLABE valid, and which bank does it belong to?
- Is the beneficiary account a CLABE, a debit card, or a phone number?
- Will the bank reject this payment concept because of length or characters?
- What did the customer *actually* pay once you count the fee and the FX margin?
- Is this webhook really from my provider, or is it a replay?

`remesa` packages those answers as small, well-tested, dependency-free functions built **only from public specifications**.

## Features (v0.1 scope)

| Module | What it does |
|---|---|
| `remesa/money` | Exact money math with `bigint` minor units for **MXN**, **USD**, and **USDC** (6 decimals). Parse, format, add, and subtract. No floats, ever. |
| `remesa/clabe` | Validate, parse, compute the check digit for, and generate 18-digit **CLABE** numbers (Banxico 3-7-1 weighting algorithm). |
| `remesa/banks` | Catalog of SPEI participants: 3-digit CLABE bank code ↔ 5-digit SPEI participant code ↔ name. Includes a dated snapshot and its public source. |
| `remesa/spei` | Detect and validate beneficiary account types (CLABE / 16-digit card with Luhn check / 10-digit mobile number), sanitize payment concepts (≤ 40 chars), and validate numeric references (≤ 7 digits) and tracking keys (≤ 30 alphanumeric chars). |
| `remesa/cep` | Validate and normalize the fields Banco de México's public **CEP** (electronic payment receipt) portal asks for, and return them with the official portal link. No scraping. |
| `remesa/webhooks` | Provider-agnostic **HMAC-SHA256** signing and verification (`node:crypto`), with constant-time comparison (`timingSafeEqual`) and timestamp tolerance against replays. |
| `remesa/quotes` | `priceRemittance()` returns receive amount, fee, FX margin, and **total cost %** (World Bank RPW-style). It's a pure function: you supply the offered rate and a reference rate; nothing is fetched. |

## Install

```bash
npm install remesa
# or
pnpm add remesa
# or
yarn add remesa
```

Requires Node.js 20+. Ships ESM and CJS with full type definitions, and every module is also available as a subpath import (`remesa/clabe`, `remesa/spei`, …). All modules except `remesa/webhooks` are plain TypeScript with no Node-specific APIs. `remesa/webhooks` uses `node:crypto`, which Node, Deno and Bun support.

## Quick start

### Validate and parse a CLABE

```ts
import { validateClabe, generateClabe } from 'remesa/clabe';

const result = validateClabe('002 180 00123456789 6'); // spaces and hyphens are ignored

if (result.ok) {
  result.value.bank?.name;  // 'BANAMEX' (undefined if the code isn't in the catalog snapshot)
  result.value.plaza;       // '180'
  result.value.account;     // '00123456789'
  result.value.checkDigit;  // '6'
} else {
  result.error.code; // 'INVALID_LENGTH' | 'INVALID_CHARACTERS' | 'INVALID_CHECK_DIGIT'
}

// Opt in to rejecting bank codes that aren't in the bundled catalog:
validateClabe('999180000000000015', { requireKnownBank: true }).error?.code; // 'UNKNOWN_BANK'

generateClabe({ bankCode: '002', plaza: '180', account: '00123456789' });
// → '002180001234567896'
```

### Look up a bank

```ts
import { findBankByCode, findBankByClabe } from 'remesa/banks';

findBankByCode('012');
// → { clabeCode: '012', speiCode: '40012', name: 'BBVA MEXICO', ... }

findBankByClabe('002180001234567896')?.speiCode; // '40002'
```

The catalog is a **dated snapshot** (`BANK_CATALOG_SNAPSHOT_DATE`, currently `2026-10-08`) of Banco de México's public SPEI participant list. Participants change over time, so treat it as a convenience, not a real-time source.

### Prepare a SPEI payout

```ts
import {
  parseBeneficiaryAccount,
  sanitizeConcept,
  validateNumericReference,
  createTrackingKey,
} from 'remesa/spei';

parseBeneficiaryAccount('4111 1111 1111 1111');
// → { ok: true, value: { type: 'debit_card', number: '4111111111111111' } }

parseBeneficiaryAccount('+52 55 1234 5678');
// → { ok: true, value: { type: 'phone', number: '5512345678' } }

parseBeneficiaryAccount('002180001234567896');
// → { ok: true, value: { type: 'clabe', number: '002180001234567896', clabe: { bank: { name: 'BANAMEX', ... }, ... } } }

sanitizeConcept('Pago renta – Octubre 2026 🏠 para mamá');
// → 'Pago renta - Octubre 2026 para mama' (accents/emoji removed, ≤ 40 chars)

validateConcept('Renta oct 2026');  // strict check, without modifying the concept

validateNumericReference(42);      // { ok: true, value: '0000042' } (zero-padded to 7)
validateNumericReference(12345678); // { ok: false, error: { code: 'TOO_LONG', ... } }

createTrackingKey({ prefix: 'RMS' }); // e.g. 'RMS20261008K3F9Q2ZD7A' (≤ 30 chars, CSPRNG suffix)
```

### Price a remittance transparently

```ts
import { money, formatMoney } from 'remesa/money';
import { priceRemittance } from 'remesa/quotes';

const quote = priceRemittance({
  send: money('300.00', 'USD'),
  fee: money('4.99', 'USD'),
  rate: '18.05',          // MXN per USD offered to the customer
  referenceRate: '18.32', // mid-market or Banxico FIX reference
});

formatMoney(quote.receive);   // '$5,415.00 MXN'
formatMoney(quote.totalCost); // '$9.41 USD'  (fee $4.99 + FX margin $4.42)
quote.feePct;                 // '1.66'
quote.fxMarginPct;            // '1.47'
quote.totalCostPct;           // '3.14'  ← fee + FX margin, as % of the amount sent
```

Stablecoins are first-class amounts but are **never assumed to be pegged**. Pricing a USDC send requires an explicit `USDC/MXN` rate:

```ts
priceRemittance({
  send: money('300', 'USDC'),          // 300.000000 USDC
  fee: money('0', 'USDC'),
  rate: '18.10',
  referenceRate: '18.32',
});
```

`priceRemittance` never fetches rates. Get the reference rate from wherever you trust (for example, Banco de México's published FIX rate) and pass it in as a decimal string. Invalid input, such as a currency mismatch, a non-positive amount or a malformed rate, throws a `TypeError` or `RangeError`.

### Build a CEP lookup

```ts
import { buildCepQuery } from 'remesa/cep';
import { money } from 'remesa/money';

const query = buildCepQuery({
  date: '2026-10-08',
  trackingKey: 'RMS20261008K3F9Q2ZD7A',
  senderBank: '40012',
  receiverBank: '40002',
  beneficiaryAccount: '002180001234567896',
  amount: money('5415.00', 'MXN'),
});

if (query.ok) {
  query.value.portalUrl; // 'https://www.banxico.org.mx/cep/'
  query.value.fields;
  // {
  //   fecha: '08-10-2026', tipoCriterio: 'T', criterio: 'RMS20261008K3F9Q2ZD7A',
  //   emisor: '40012', receptor: '40002', cuenta: '002180001234567896',
  //   receptorParticipante: false, monto: '5415.00'
  // }
}
```

`buildCepQuery` only validates and normalizes. The portal is protected by a captcha, and this library never submits the form or scrapes the site. Pass `numericReference` instead of `trackingKey` to search by reference, or `beneficiaryIsParticipant: true` when the beneficiary is the receiving institution itself.

### Verify a webhook

```ts
import { verifyWebhook } from 'remesa/webhooks';

const result = verifyWebhook({
  payload: rawBody,                          // the raw request body string, not parsed JSON
  signature: req.headers['x-signature'],     // hex; an optional 'sha256=' prefix is accepted
  timestamp: req.headers['x-timestamp'],     // Unix seconds
  secret: process.env.WEBHOOK_SECRET!,
  toleranceSeconds: 300,                     // default
});

if (!result.ok) {
  // 'MISSING_SIGNATURE' | 'MALFORMED_SIGNATURE' | 'MALFORMED_TIMESTAMP'
  // | 'TIMESTAMP_OUT_OF_TOLERANCE' | 'SIGNATURE_MISMATCH'
  return res.writeHead(401).end(result.error.code);
}
```

By default the signature is `` hex(HMAC-SHA256(secret, `${timestamp}.${payload}`)) ``, and `signWebhook()` produces the same format for your own outgoing webhooks. Pass `signedPayload: (timestamp, payload) => string` to match another provider's format. You read the headers yourself, so any header names work.

### Runnable examples

The [`examples/`](./examples) folder contains account validation, remittance pricing, a CEP query and a `node:http` webhook receiver. Run them with `npm run build && npm run examples`.

## Design principles

1. **Public specs only.** Every rule is traceable to a public source listed in [`SOURCES.md`](./SOURCES.md): Banco de México (CLABE, SPEI, CEP, SIE API), ISO 4217, Circle's USDC documentation, the World Bank's Remittance Prices Worldwide methodology, and RFC 2104.
2. **Money is never a float.** Amounts are `bigint` minor units with an explicit currency, and rates are decimal strings.
3. **Zero runtime dependencies.** The library is small, auditable, and tree-shakable through subpath exports.
4. **Portable core.** Every module except `webhooks` (which uses `node:crypto`) avoids Node-specific APIs.
5. **No I/O.** The library never touches the network. Rates and data come from you.
6. **Errors as values.** Validators return typed `Result` objects with stable error codes instead of throwing.
7. **Data with provenance.** Datasets such as the bank catalog ship with their public source and a snapshot date.
8. **Tested like payments code.** Unit tests are paired with property-style checks (for example, every generated CLABE validates and any single-digit change breaks it), and CI enforces a coverage threshold.
9. **Verifiable releases.** A tag-triggered GitHub Actions workflow publishes to npm with provenance.

## Roadmap

Everything below is **planned, not yet available**.

- [ ] Pluggable reference-rate sources (a `RateSource` interface, a static source, and an opt-in Banco de México FIX source using the user's own SIE API token)
- [ ] Web Crypto variant of `webhooks` for browsers and edge runtimes
- [ ] Documentation site (TypeDoc + guides) on GitHub Pages
- [ ] `remesa-mcp`: a Model Context Protocol server exposing validation and pricing to AI agents
- [ ] Bank catalog refresh tooling (a documented, reviewable process for updating the snapshot)
- [ ] Settlement abstraction: a `SettlementRail` interface for SPEI and stablecoin on/off-ramp providers, with community adapters
- [ ] Cost disclosure helpers for remittance receipts (fee, rate, total to recipient), configurable per jurisdiction
- [ ] Additional corridors and currencies beyond USD/USDC → MXN
- [ ] `v1.0.0` with a stable API and a semver guarantee

Have an idea? [Open an issue](https://github.com/Olalde1/remesa/issues).

## Contributing

Contributions are welcome!

1. Fork the repo and create a branch: `git checkout -b feat/my-change`
2. Install dependencies: `npm install`
3. Run the checks: `npm run lint && npm run typecheck && npm test`
4. Add an entry to [`CHANGELOG.md`](./CHANGELOG.md)
5. Open a pull request describing the change and **citing the public source** for any new rule or dataset.

Please don't submit code, data, or documentation that you don't have the right to share, such as material from an employer, a client, or a non-public specification. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

If you find a vulnerability, please **don't open a public issue**. Report it privately through [GitHub Security Advisories](https://github.com/Olalde1/remesa/security/advisories/new).

## Disclaimer

`remesa` is an **independent, personal open-source project** by Luis Olalde. It is **not affiliated with, endorsed by, or derived from** any current or former employer, client, or company the author works or has worked with, and it contains no proprietary code or confidential information from any of them. It is built exclusively from publicly available specifications.

This library is a developer tool, not a financial, legal, or compliance product. It does not move money, and it does not by itself make a product compliant with any regulation. Always verify results against your payment provider and applicable rules. "SPEI" and "CEP" refer to systems operated by Banco de México; this project is not affiliated with Banco de México.

## License

[MIT](./LICENSE) © 2026 Luis Olalde
