# Contributing to remesa

Thanks for helping! A few ground rules keep this library trustworthy:

1. **Public sources only.** Any new rule, limit or dataset must cite a public
   source in the PR and in [`SOURCES.md`](./SOURCES.md).
2. **Only contribute what you have the right to share.** Do not submit code,
   data, designs or documentation from an employer, a client, or a
   non-public specification.
3. **Money is never a float.** Use `bigint` minor units and decimal strings.
4. **No runtime dependencies** and no network calls inside the library.

## Development

```bash
npm install
npm run lint        # Biome
npm run typecheck   # tsc --noEmit
npm test            # Vitest
npm run test:coverage
npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
npm run examples    # runs examples/ against the build
```

Add an entry to `CHANGELOG.md` under an "Unreleased" heading describing your change.
