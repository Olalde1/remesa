# Sources

`remesa` is built exclusively from publicly available specifications and
documentation. Every rule in the code should be traceable to one of these.

| Topic | Public source | Used in |
|---|---|---|
| CLABE structure (bank 3 + plaza 3 + account 11 + check digit 1) and the 3-7-1 weighted check digit | Banco de México / Asociación de Bancos de México public CLABE standard; widely reproduced, e.g. https://es.wikipedia.org/wiki/CLABE | `src/clabe.ts` |
| SPEI participants and their codes (snapshot 2026-10-08) | Banco de México, public CEP portal institution list: https://www.banxico.org.mx/cep/ | `src/banks.ts` |
| Beneficiary account types (CLABE 18, debit card 16, mobile phone 10 digits) | Banco de México, "Mi SPEI, transferencias": https://www.banxico.org.mx/servicios/mi-spei_-transferencias-ban.html | `src/spei.ts` |
| Numeric reference (≤ 7 digits) and tracking key (≤ 30 alphanumeric) | Banco de México CEP portal notes: https://www.banxico.org.mx/cep/ and SPEI rules, Circular 14/2017: https://www.banxico.org.mx/marco-normativo/ | `src/spei.ts`, `src/cep.ts` |
| Payment concept (≤ 40 alphanumeric characters) | Bank-published SPEI instruction formats (e.g. HSBC México public notice, 2017) and SPEI rules, Circular 14/2017 | `src/spei.ts` |
| CEP lookup inputs (date, criterion, sender, receiver, account, amount) | Banco de México CEP portal: https://www.banxico.org.mx/cep/ | `src/cep.ts` |
| Luhn check for card numbers | ISO/IEC 7812-1 (Luhn mod-10 algorithm) | `src/spei.ts` |
| HMAC-SHA256 | RFC 2104 (HMAC), FIPS 180-4 (SHA-256) | `src/webhooks.ts` |
| Currency minor units | ISO 4217 (MXN, USD: 2 decimals); Circle USDC documentation (6 decimals): https://developers.circle.com/stablecoins | `src/money.ts` |
| Total cost of a remittance = fee + FX margin, as % of amount sent | World Bank, Remittance Prices Worldwide methodology: https://remittanceprices.worldbank.org/ | `src/quotes.ts` |
