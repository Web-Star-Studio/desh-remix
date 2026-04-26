import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/_helpers/global-setup.ts"],
    // Tests share one Postgres container per process; reset state via
    // table truncation in beforeEach where needed.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
});
