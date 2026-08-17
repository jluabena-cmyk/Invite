---
name: Lib package build workflow
description: How to rebuild lib/db and lib/api-client-react so downstream TS checks pass after schema/type changes.
---

Both `lib/db` and `lib/api-client-react` are TypeScript composite projects (`"composite": true, "emitDeclarationOnly": true`). They emit `.d.ts` files into their `dist/` directories, which `artifacts/api-server` and `artifacts/bill-splitter` reference via `tsconfig.json` `"references"`.

**Rule:** After editing any source file in `lib/db/src/` or `lib/api-client-react/src/`, run `tsc --build` inside that lib directory before running `tsc --noEmit` in the consuming packages.

```bash
cd lib/db && pnpm exec tsc --build
cd lib/api-client-react && pnpm exec tsc --build
```

**Why:** The packages export `"./src/index.ts"` directly (no compile step in package.json scripts), but TS project references require the declaration output to exist. Forgetting this causes TS2769/TS2551 errors claiming fields "don't exist" even though the source is correct.

**How to apply:** Any time you change `lib/db/src/schema/*.ts` or `lib/api-client-react/src/generated/*.ts`, rebuild those libs before checking the consumers.
