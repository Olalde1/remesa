// Prepare the data a customer needs to download their CEP from Banxico.
// Run after `npm run build`: node examples/cep-query.mjs
import { buildCepQuery } from "remesa/cep";
import { money } from "remesa/money";

const query = buildCepQuery({
  date: "2026-10-08",
  trackingKey: "RMS20261008K3F9Q2ZD7A",
  senderBank: "40012",
  receiverBank: "002",
  beneficiaryAccount: "002180001234567896",
  amount: money("5415.00", "MXN"),
});

if (query.ok) {
  console.log(`Open ${query.value.portalUrl} and enter:`);
  console.table(query.value.fields);
} else {
  console.error(query.error);
}
