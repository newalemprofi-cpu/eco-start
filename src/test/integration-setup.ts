// Runs before every integration test file (and before src/db/client.ts
// is imported), so the app pool connects to the test database only.
function assertTestDatabase(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set — integration tests need an isolated *_test database.`);
  const url = new URL(value);
  const db = url.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !db.endsWith("_test")) {
    throw new Error(`${name} must point at a localhost database ending in "_test" (got ${url.hostname}/${db}).`);
  }
  return value;
}

process.env.APP_DATABASE_URL = assertTestDatabase("TEST_APP_DATABASE_URL", process.env.TEST_APP_DATABASE_URL);
assertTestDatabase("TEST_DATABASE_URL", process.env.TEST_DATABASE_URL);
