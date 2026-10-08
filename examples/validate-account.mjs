// Validate whatever a user typed as their payout account.
// Run after `npm run build`: node examples/validate-account.mjs
import { parseBeneficiaryAccount } from "@olalde/remesa/spei";

const inputs = ["002 180 00123456789 6", "4111 1111 1111 1111", "+52 55 1234 5678", "12345"];

for (const input of inputs) {
  const result = parseBeneficiaryAccount(input);
  if (result.ok) {
    const { type, number } = result.value;
    const bank = type === "clabe" ? ` (${result.value.clabe.bank?.name ?? "unknown bank"})` : "";
    console.log(`✔ ${input} → ${type} ${number}${bank}`);
  } else {
    console.log(`✘ ${input} → ${result.error.code}: ${result.error.message}`);
  }
}
