import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { routing } from "@/i18n/routing";

/**
 * Where dal.ts sends a request whose JWT is still signed but whose
 * account was archived or whose sessions were revoked (password reset).
 * Server components can't clear cookies, so this handler does — then
 * the login page opens normally instead of proxy.ts bouncing a
 * cookie-holding visitor back to their dashboard in a loop.
 */
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const target = new URL(`/${routing.defaultLocale}/login`, req.url);
  target.searchParams.set("ended", "1");
  const res = NextResponse.redirect(target);
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
