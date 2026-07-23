import "server-only";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, SALT_ROUNDS);
}

export async function verifySecret(secret: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(secret, hash);
}
