import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { verifySession } from "@/lib/auth/dal";
import { ModuleAccessDenied } from "@/components/marketing/module-access-denied";

export default async function GreenhouseModuleRouter({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifySession();

  if (session.role === "CHILD") redirect(`/${locale}/app/child/greenhouse`);
  return <ModuleAccessDenied role={session.role} />;
}
