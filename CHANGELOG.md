# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-08

### Added

- `remesa/money`: exact `bigint` money for MXN, USD and USDC (6 decimals): `money`, `toDecimalString`, `formatMoney`, `add`, `subtract`.
- `remesa/clabe`: `validateClabe` (with parsing of bank, plaza, account and check digit), `isValidClabe`, `computeClabeCheckDigit`, `generateClabe`, `normalizeClabe`.
- `remesa/banks`: SPEI participant catalog (snapshot 2026-10-08, public Banxico CEP list) with `findBankByCode` and `findBankByClabe`.
- `remesa/spei`: `parseBeneficiaryAccount` (CLABE / 16-digit card with Luhn / 10-digit phone), `isValidLuhn`, `normalizeMexicanPhone`, `sanitizeConcept`, `validateConcept`, `validateNumericReference`, `isValidTrackingKey`, `createTrackingKey`.
- `remesa/cep`: `buildCepQuery` for Banco de México's public CEP portal (no scraping).
- `remesa/webhooks`: `signWebhook` and `verifyWebhook` (HMAC-SHA256, constant-time compare, replay tolerance).
- `remesa/quotes`: `priceRemittance` (fee, FX margin and total cost %, World Bank RPW-style) and `parseRate`.
- ESM + CJS builds with type definitions, Vitest suite, GitHub Actions CI, and runnable examples.

[0.1.0]: https://github.com/Olalde1/remesa/releases/tag/v0.1.0
