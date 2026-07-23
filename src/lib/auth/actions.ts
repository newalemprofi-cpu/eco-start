"use server";

import { redirect } from "next/navigation";
import { authenticate } from "@/lib/auth/credentials";
import { createSession, deleteSession } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = {
  error?: string;
  fieldErrors?: Partial<Record<"identifier" | "secret", string>>;
};

// Configurable like the AI rate limits — the fixed default is tuned
// for real brute-force protection (bcrypt already slows guessing
// substantially); it's exposed via env mainly so automated tests that
// reuse a small, fixed set of demo accounts across many spec files
// don't trip it within its window.
const LOGIN_ATTEMPT_LIMIT = Number(process.env.LOGIN_RATE_LIMIT_ATTEMPTS ?? 30);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES ?? 5) * 60 * 1000;

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

  const rateKey = `login:${parsed.data.identifier.toLowerCase()}`;
  const { allowed } = rateLimit(rateKey, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
  if (!allowed) {
    return { error: "rate_limited" };
  }

  const user = await authenticate(parsed.data.identifier, parsed.data.secret);
  if (!user) {
    // Deliberately generic — never reveal whether the identifier
    // existed, to avoid leaking which accounts are real.
    return { error: "invalid_credentials" };
  }

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
