import { describe, expect, it } from "vitest";
import { assertSeedEnvironment, SeedRefusedError } from "./seed-guard";

const LOCAL = "postgres://u:p@localhost:5434/eco_start_ai";
const REMOTE = "postgres://u:p@db.internal:5432/eco_start_prod";

describe("assertSeedEnvironment", () => {
  it("allows a local database outside production", () => {
    expect(() => assertSeedEnvironment({ NODE_ENV: "development", DATABASE_URL: LOCAL })).not.toThrow();
    expect(() => assertSeedEnvironment({ DATABASE_URL: "postgres://u:p@127.0.0.1/x" })).not.toThrow();
  });

  it("always refuses NODE_ENV=production, even for localhost", () => {
    expect(() => assertSeedEnvironment({ NODE_ENV: "production", DATABASE_URL: LOCAL })).toThrow(SeedRefusedError);
  });

  it("refuses a non-local database (e.g. the Coolify DB service) by default", () => {
    expect(() => assertSeedEnvironment({ DATABASE_URL: REMOTE })).toThrow(SeedRefusedError);
    expect(() => assertSeedEnvironment({ DATABASE_URL: REMOTE, SEED_ALLOW_REMOTE_DATABASE: "yes" })).toThrow(
      SeedRefusedError
    );
  });

  it("allows a remote database only when its exact name is typed in, and still never in production", () => {
    expect(() =>
      assertSeedEnvironment({ DATABASE_URL: REMOTE, SEED_ALLOW_REMOTE_DATABASE: "eco_start_prod" })
    ).not.toThrow();
    expect(() =>
      assertSeedEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: REMOTE,
        SEED_ALLOW_REMOTE_DATABASE: "eco_start_prod",
      })
    ).toThrow(SeedRefusedError);
  });

  it("refuses a missing or malformed DATABASE_URL", () => {
    expect(() => assertSeedEnvironment({})).toThrow(SeedRefusedError);
    expect(() => assertSeedEnvironment({ DATABASE_URL: "not a url" })).toThrow(SeedRefusedError);
  });
});
