import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { decrypt } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/dal";

// Next.js 16 renamed Middleware to Proxy; behavior is unchanged. This
// file does two jobs in one pass because only one proxy.ts is allowed
// per project: (1) next-intl locale resolution/redirects, (2)
// OPTIMISTIC auth redirects (cookie-only, no DB hit — fast UX, not the
// real authorization boundary). The real boundary is the DAL
// (src/lib/auth/dal.ts), invoked by every server component/action/route
// handler individually. See docs/ARCHITECTURE.md.

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PREFIX = "/app";
const AUTH_ONLY_PREFIX = "/login";

const LOCALE_PATH_RE = new RegExp(`^/(${routing.locales.join("|")})(/.*)?$`);

// Locales retired from `routing.locales` when the platform went
// Kazakh-only — old bookmarked/shared /ru and /en links still need to
// resolve somewhere sane. next-intl's own middleware does NOT do this
// for you: once a locale segment isn't in `routing.locales`, it treats
// the whole path as an unprefixed path under the default locale (so
// "/ru" becomes "/kk/ru", a 404) rather than stripping "/ru" and
// re-prefixing the rest. This regex + redirect below runs first so
// that never happens.
const RETIRED_LOCALE_RE = /^\/(ru|en)(\/.*)?$/;

function stripLocale(pathname: string): { locale: string; rest: string } {
  const match = pathname.match(LOCALE_PATH_RE);
  if (!match) return { locale: routing.defaultLocale, rest: pathname };
  return { locale: match[1], rest: match[2] ?? "/" };
}

export default async function proxy(request: NextRequest) {
  const retired = request.nextUrl.pathname.match(RETIRED_LOCALE_RE);
  if (retired) {
    const target = new URL(`/${routing.defaultLocale}${retired[2] ?? ""}`, request.url);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target);
  }

  const intlResponse = intlMiddleware(request);

  // A 3xx here means next-intl is adding/correcting the locale prefix —
  // let that redirect happen first; auth is re-checked on the follow-up
  // request once the URL has a locale segment.
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  const { locale, rest } = stripLocale(request.nextUrl.pathname);
  const sessionCookie = request.cookies.get("eco_start_session")?.value;
  const session = await decrypt(sessionCookie);

  if (rest.startsWith(PROTECTED_PREFIX) && !session) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", rest);
    return copyHeaders(NextResponse.redirect(loginUrl), intlResponse);
  }

  if (rest.startsWith(AUTH_ONLY_PREFIX) && session) {
    const homeUrl = new URL(`/${locale}${roleHome(session.role)}`, request.url);
    return copyHeaders(NextResponse.redirect(homeUrl), intlResponse);
  }

  return intlResponse;
}

function copyHeaders(target: NextResponse, source: NextResponse) {
  source.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") target.headers.append(key, value);
  });
  return target;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
