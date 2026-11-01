import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * DB integration tests (src/**\/*.int.test.ts): run the real repo
 * functions as `app_user`, so RLS and the group/ownership checks are
 * exercised for real. They WRITE data, so src/test/integration-setup.ts
 * refuses to run unless both URLs point at a localhost database whose
 * name ends in "_test". Typical throwaway setup:
 *
 *   docker run -d --name eco-start-ai-testdb -e POSTGRES_USER=ecostart \
 *     -e POSTGRES_PASSWORD=ecostart_test -e POSTGRES_DB=eco_start_ai_test \
 *     -p 5435:5432 --tmpfs /var/lib/postgresql/data postgres:16-alpine
 *   DATABASE_URL=postgres://ecostart:ecostart_test@localhost:5435/eco_start_ai_test npm run db:migrate
 *   DATABASE_URL=... npm run db:seed
 *   TEST_DATABASE_URL=postgres://ecostart:ecostart_test@localhost:5435/eco_start_ai_test \
 *   TEST_APP_DATABASE_URL=postgres://app_user:app_user_dev_password@localhost:5435/eco_start_ai_test \
 *     npm run test:integration
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts", "scripts/**/*.int.test.ts"],
    setupFiles: ["./src/test/integration-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
