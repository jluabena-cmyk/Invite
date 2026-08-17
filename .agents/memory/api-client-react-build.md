---
name: api-client-react build requirement
description: After editing lib/api-client-react/src/generated/api.ts, must rebuild declarations or bill-splitter TS check fails.
---

The lib/api-client-react package uses TypeScript project references (`composite: true`, `emitDeclarationOnly: true`, `outDir: dist`). The bill-splitter tsconfig references it via `"references": [{ "path": "../../lib/api-client-react" }]`.

**Rule:** Any time you add or change exports in `lib/api-client-react/src/generated/api.ts`, run `cd lib/api-client-react && npx tsc --build` before running the bill-splitter TS check, otherwise the type checker will not see the new exports and will report "Module has no exported member".

**Why:** Project references consume the `dist/` declaration files, not the source. The source edit alone is not enough.

**How to apply:** After every manual edit to the api-client-react generated files, always rebuild the lib before running the app-level TS check.
