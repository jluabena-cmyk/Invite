---
name: No codegen — manual API client edits only
description: openapi.yaml is partial/stub; running codegen will overwrite real implementations. Always edit api.ts manually.
---

**Rule:** Never run the openapi codegen for `lib/api-client-react`. The `lib/api-spec/openapi.yaml` is intentionally partial and does not reflect the full API surface.

**Why:** Running codegen would wipe all manually-added endpoints and hooks from `generated/api.ts` and `generated/api.schemas.ts`.

**How to apply:** When adding a new API endpoint, manually add the fetch function, mutation options, mutation types, and hook to `lib/api-client-react/src/generated/api.ts` following the existing patterns. Then rebuild declarations with `npx tsc --build` in that package.
