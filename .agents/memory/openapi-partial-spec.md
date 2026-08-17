---
name: openapi-partial-spec
description: The openapi.yaml is a PARTIAL spec — it does not describe all API endpoints. Generated files in lib/api-client-react and lib/api-zod contain many more hooks than the yaml. Never run pnpm --filter @workspace/api-spec run codegen — it cleans the output folder and wipes all hooks not in the yaml.
---

# OpenAPI Spec is Partial — Never Run Full Codegen

## The Rule
NEVER run `pnpm --filter @workspace/api-spec run codegen`. It wipes all generated hooks not in openapi.yaml.

**Why:** The openapi.yaml in `lib/api-spec/openapi.yaml` only contains ~8 operationIds (healthCheck, getCurrentUser, upsertCurrentUser, joinEvent, generateJoinCode, scanReceiptPhoto, and a few more). But the generated `lib/api-client-react/src/generated/api.ts` has 1133+ lines of hooks generated from a much larger spec that no longer exists in source form.

Running codegen deletes the output folder and regenerates only from the current yaml, destroying all pre-existing hooks (useCreateReceipt, useGetEventDetail, useDeleteReceiptPhoto, etc.).

## How to Add New Endpoints
1. Add the new endpoint to `lib/api-spec/openapi.yaml` (for documentation only)
2. Manually append the hook to `lib/api-client-react/src/generated/api.ts` (follow the existing pattern)
3. Manually append any new types to `lib/api-client-react/src/generated/api.schemas.ts`
4. Run `cd lib/api-client-react && pnpm tsc --build` to rebuild the dist declaration files
5. Do NOT run codegen

## How to Apply
Any time you're asked to add a new API endpoint and generate client hooks — add to yaml for docs, manually write the hook in generated/api.ts, rebuild with tsc --build.
