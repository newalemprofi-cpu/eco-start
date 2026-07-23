import { ClipboardList, FileText, GraduationCap, LayoutDashboard, UsersRound, Baby, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/dal";
import { DashboardShell, type NavItem } from "@/components/shell/dashboard-shell";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SCHOOL_ADMIN");
  const t = await getTranslations("nav");
  const tRoles = await getTranslations("roles");

  const navItems: NavItem[] = [
    { href: "/app/admin", label: t("adminOverview"), icon: LayoutDashboard },
    { href: "/app/admin/teachers", label: t("adminTeachers"), icon: GraduationCap },
    { href: "/app/admin/children", label: t("adminChildren"), icon: Baby },
    { href: "/app/admin/groups", label: "Топтар", icon: Users },
    { href: "/app/admin/parents", label: t("adminParents"), icon: UsersRound },
    { href: "/app/admin/content", label: t("adminContent"), icon: FileText },
    { href: "/app/admin/audit", label: t("adminAudit"), icon: ClipboardList },
  ];

  return (
    <DashboardShell navItems={navItems} roleLabel={tRoles("SCHOOL_ADMIN")} userName={session.displayName}>
      {children}
    </DashboardShell>
  );
}
