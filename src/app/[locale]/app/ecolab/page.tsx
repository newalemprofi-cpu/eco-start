import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { verifySession } from "@/lib/auth/dal";
import { ModuleAccessDenied } from "@/components/marketing/module-access-denied";

// Generic, role-agnostic entry point homepage module cards link to
// (see homepage_modules.route). Resolves to the real implementation
// for roles that have one, or a clear permission message otherwise —
// never a dead link. src/proxy.ts already sends unauthenticated
// visitors to /login before this ever runs.
export default async function EcolabModuleRouter({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifySession();

  if (session.role === "CHILD") redirect(`/${locale}/app/child/ecolab`);
  return <ModuleAccessDenied role={session.role} />;
}
