"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate } from "@/lib/auth/credentials";
import { createSession, deleteSession } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/dal";
import { getLoginLock, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/login-throttle";
import { clientIpFromHeaders, minutesUntil } from "@/lib/auth/login-throttle-policy";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = {
  error?: string;
  fieldErrors?: Partial<Record<"identifier" | "secret", string>>;
  retryAfterMinutes?: number;
};

export async function loginAction(
  locale: string,
  next: string | undefined,
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = {
    identifier: String(formData.get("identifier") ?? ""),
    secret: String(formData.get("secret") ?? ""),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "identifier" | "secret" | undefined;
      if (key) fieldErrors[key] = issue.message;
    }
    return { error: "validation", fieldErrors };
  }

  // Persistent brute-force throttle (0015 migration): per identifier
  // AND per client IP, checked before the PIN/password is even looked
  // at — a locked identifier is refused even with the right PIN.
  const { identifier } = parsed.data;
  const ip = clientIpFromHeaders(await headers());
  const lockedUntil = await getLoginLock(identifier, ip);
  if (lockedUntil) {
    return { error: "rate_limited", retryAfterMinutes: minutesUntil(lockedUntil) };
  }

  const user = await authenticate(identifier, parsed.data.secret);
  if (!user) {
    const nowLocked = await recordLoginFailure(identifier, ip);
    if (nowLocked) return { error: "rate_limited", retryAfterMinutes: minutesUntil(nowLocked) };
    // Deliberately generic — never reveal whether the identifier
    // existed, to avoid leaking which accounts are real. Unknown
    // identifiers are throttled exactly like real ones.
    return { error: "invalid_credentials" };
  }
  await recordLoginSuccess(identifier);

  await createSession({
    userId: user.id,
    role: user.role,
    schoolId: user.schoolId,
    displayName: user.displayName,
    locale: user.locale,
  });

  redirect(`/${locale}${next && next.startsWith("/app") ? next : roleHome(user.role)}`);
}

export async function logoutAction(locale: string) {
  await deleteSession();
  redirect(`/${locale}/login`);
}
