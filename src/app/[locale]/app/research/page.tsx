import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { verifySession } from "@/lib/auth/dal";
import { ModuleAccessDenied } from "@/components/marketing/module-access-denied";

export default async function ResearchModuleRouter({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifySession();

  if (session.role === "CHILD") redirect(`/${locale}/app/child/research`);
  if (session.role === "TEACHER") redirect(`/${locale}/app/teacher/research`);
  return <ModuleAccessDenied role={session.role} />;
}
