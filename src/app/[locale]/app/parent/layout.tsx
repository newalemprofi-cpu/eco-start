import { BookOpen, LayoutDashboard, Wallet } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/dal";
import { DashboardShell, type NavItem } from "@/components/shell/dashboard-shell";

export default async function ParentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("PARENT");
  const t = await getTranslations("nav");
  const tRoles = await getTranslations("roles");

  const navItems: NavItem[] = [
    { href: "/app/parent", label: t("parentOverview"), icon: LayoutDashboard },
    { href: "/app/parent/passport", label: t("parentPassport"), icon: Wallet },
    { href: "/app/parent/homework", label: t("parentHomework"), icon: BookOpen },
  ];

  return (
    <DashboardShell navItems={navItems} roleLabel={tRoles("PARENT")} userName={session.displayName}>
      {children}
    </DashboardShell>
  );
}
