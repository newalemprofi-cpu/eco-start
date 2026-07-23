import { ClipboardList, LayoutDashboard, Settings2, Newspaper, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/dal";
import { DashboardShell, type NavItem } from "@/components/shell/dashboard-shell";

export default async function SuperAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SUPER_ADMIN");
  const t = await getTranslations("nav");
  const tRoles = await getTranslations("roles");

  // The old "Бөбекжайлар" (superSchools) nav slot is replaced in place
  // by "Топтар" per the approved groups-module plan — the schools
  // overview page itself (src/app/[locale]/app/super-admin/schools/)
  // is left intact and still reachable by direct URL, just no longer
  // linked from the sidebar, same "keep working code, drop the nav
  // entry" pattern used for the removed design/homepage sections.
  const navItems: NavItem[] = [
    { href: "/app/super-admin", label: t("superOverview"), icon: LayoutDashboard },
    { href: "/app/super-admin/groups", label: "Топтар", icon: Users },
    { href: "/app/super-admin/news", label: "Жаңалықтар", icon: Newspaper },
    { href: "/app/super-admin/ai-config", label: t("superAiConfig"), icon: Settings2 },
    { href: "/app/super-admin/audit", label: t("superAudit"), icon: ClipboardList },
  ];

  return (
    <DashboardShell navItems={navItems} roleLabel={tRoles("SUPER_ADMIN")} userName={session.displayName}>
      {children}
    </DashboardShell>
  );
}
