---
name: Express 5 async error handling
description: api-server uses Express 5, not 4; express-async-errors package is incompatible and breaks esbuild bundling
---

The api-server uses **Express 5** (`express@5.2.1`). Express 5 automatically catches errors thrown from async route handlers and forwards them to error-handler middleware.

**Why:** `express-async-errors` monkey-patches Express 4 internals (`express/lib/router/layer`, `express/lib/router`). These paths don't resolve in esbuild bundles and don't exist in Express 5, causing build failures.

**How to apply:** Never install `express-async-errors` in this project. Add a 4-argument `(err, req, res, next)` middleware at the end of `app.ts` and Express 5 will route async throws to it automatically.
