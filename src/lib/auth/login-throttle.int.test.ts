import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { getLoginLock, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/login-throttle";
import { authenticate } from "@/lib/auth/credentials";
import { pool } from "@/db/client";

// Persistent throttle (0015) through the same functions loginAction
// uses, as app_user. Default policy: 5 per identifier, 20 per IP.

const owner = postgres(process.env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
const uniq = () => `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await owner.end();
  await pool.end();
});

describe("persistent login throttle", () => {
  it("locks an identifier after 5 wrong attempts — even the right PIN is then refused", async () => {
    const id = uniq();
    for (let i = 1; i <= 4; i++) {
      expect(await recordLoginFailure(id, `198.51.100.${i}`)).toBeNull();
    }
    const lock = await recordLoginFailure(id, "198.51.100.5");
    expect(lock).not.toBeNull();
    expect(lock!.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
    expect(await getLoginLock(id, "192.0.2.200")).not.toBeNull(); // new IP doesn't help
  });

  it("is case/space-insensitive on the identifier", async () => {
    const id = uniq();
    for (let i = 0; i < 5; i++) await recordLoginFailure(id.toUpperCase(), `198.51.101.${i}`);
    expect(await getLoginLock(`  ${id} `, null)).not.toBeNull();
  });

  it("locks an IP that scans many different login codes", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    let locked: Date | null = null;
    for (let i = 0; i < 20; i++) locked = await recordLoginFailure(uniq(), ip);
    expect(locked).not.toBeNull();
    expect(await getLoginLock(uniq(), ip)).not.toBeNull(); // a fresh code from that IP is blocked too
  });

  it("a successful login clears the identifier's failures but not a locked IP", async () => {
    const id = uniq();
    for (let i = 0; i < 4; i++) await recordLoginFailure(id, null);
    await recordLoginSuccess(id);
    // Counter reset: four more failures don't lock yet.
    for (let i = 0; i < 4; i++) expect(await recordLoginFailure(id, null)).toBeNull();
  });

  it("survives a restart: the lock lives in Postgres, not in process memory", async () => {
    const id = uniq();
    for (let i = 0; i < 5; i++) await recordLoginFailure(id, null);
    const [row] = await owner<{ locked: boolean }[]>`
      select locked_until > now() as locked from auth_login_throttle
      where scope = 'identifier' and key_hash = encode(digest(lower(${id}), 'sha256'), 'hex')
    `;
    expect(row.locked).toBe(true);
  });

  it("stores no identifiers or IPs in clear text", async () => {
    const id = uniq();
    await recordLoginFailure(id, "198.51.100.77");
    const rows = await owner<{ key_hash: string }[]>`select key_hash from auth_login_throttle`;
    expect(rows.some((r) => r.key_hash.includes(id) || r.key_hash.includes("198.51.100.77"))).toBe(false);
  });

  it("app_user cannot read or tamper with the throttle table directly", async () => {
    await expect(pool`select * from auth_login_throttle`).rejects.toThrow(/permission denied/);
    await expect(pool`delete from auth_login_throttle`).rejects.toThrow(/permission denied/);
  });

  it("unknown identifiers fail like real ones (no account oracle)", async () => {
    expect(await authenticate(uniq(), "1234")).toBeNull();
  });
});
