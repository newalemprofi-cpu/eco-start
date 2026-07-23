import { BarChart3, FlaskConical, LayoutDashboard, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/dal";
import { isDevelopmentAiMode } from "@/lib/ai/gateway";
import { DashboardShell, type NavItem } from "@/components/shell/dashboard-shell";

export default async function TeacherLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("TEACHER");
  const t = await getTranslations("nav");
  const tRoles = await getTranslations("roles");

  const navItems: NavItem[] = [
    { href: "/app/teacher", label: t("teacherOverview"), icon: LayoutDashboard },
    { href: "/app/teacher/ai-studio", label: t("teacherAiStudio"), icon: Sparkles },
    { href: "/app/teacher/research", label: t("teacherResearch"), icon: FlaskConical },
    { href: "/app/teacher/reports", label: t("teacherReports"), icon: BarChart3 },
  ];

  return (
    <DashboardShell
      navItems={navItems}
      roleLabel={tRoles("TEACHER")}
      userName={session.displayName}
      devModeBadge={isDevelopmentAiMode()}
    >
      {children}
    </DashboardShell>
  );
}
