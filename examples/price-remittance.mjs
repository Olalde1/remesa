// Show a sender exactly what a USD → MXN transfer costs.
// Run after `npm run build`: node examples/price-remittance.mjs
import { formatMoney, money } from "@olalde/remesa/money";
import { priceRemittance } from "@olalde/remesa/quotes";

const quote = priceRemittance({
  send: money("300.00", "USD"),
  fee: money("4.99", "USD"),
  rate: "18.05", // rate you offer the customer (MXN per USD)
  referenceRate: "18.32", // a mid-market reference you fetched yourself, e.g. Banxico FIX
});

console.log(`You send:        ${formatMoney(quote.send)}`);
console.log(`Fee:             ${formatMoney(quote.fee)} (${quote.feePct}%)`);
console.log(`Total charged:   ${formatMoney(quote.totalCharged)}`);
console.log(`Exchange rate:   ${quote.rate} (reference ${quote.referenceRate})`);
console.log(`FX margin:       ${formatMoney(quote.fxMargin)} (${quote.fxMarginPct}%)`);
console.log(`Recipient gets:  ${formatMoney(quote.receive)}`);
console.log(
  `Total cost:      ${formatMoney(quote.totalCost)} (${quote.totalCostPct}% of amount sent)`,
);
