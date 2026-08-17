import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    // Integration tests share a real DB — run files sequentially so DB row
    // counts are deterministic (no cross-file interference on shared tables).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@workspace/db": new URL("../../lib/db/src/index.ts", import.meta.url).pathname,
      "@workspace/test-helpers": new URL("../../lib/test-helpers", import.meta.url).pathname,
    },
  },
});
