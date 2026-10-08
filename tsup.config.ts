import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    money: "src/money.ts",
    clabe: "src/clabe.ts",
    banks: "src/banks.ts",
    spei: "src/spei.ts",
    cep: "src/cep.ts",
    webhooks: "src/webhooks.ts",
    quotes: "src/quotes.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node20",
  splitting: true,
  treeshake: true,
});
