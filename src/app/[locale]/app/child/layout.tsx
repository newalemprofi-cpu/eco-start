import { Camera, MessageCircle, Palette, Sprout, Trophy, Wallet, FlaskConical } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getChildSummary } from "@/db/repo/child";
import { ChildShell, type ChildNavItem } from "@/components/shell/child-shell";

export default async function ChildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const summary = await getChildSummary(toTenantContext(session));
  const t = await getTranslations("nav");

  const navItems: ChildNavItem[] = [
    { href: "/app/child", label: t("childHome"), icon: Wallet, color: "var(--primary)" },
    { href: "/app/child/ecolab", label: t("childLab"), icon: Camera, color: "var(--module-ecolab)" },
    { href: "/app/child/greenhouse", label: t("childGreenhouse"), icon: Sprout, color: "var(--module-greenhouse)" },
    { href: "/app/child/games", label: t("childGames"), icon: Trophy, color: "var(--module-game)" },
    { href: "/app/child/studio", label: t("childStudio"), icon: Palette, color: "var(--module-media)" },
    { href: "/app/child/research", label: t("childResearch"), icon: FlaskConical, color: "var(--module-research)" },
    { href: "/app/child/passport", label: t("childPassport"), icon: Wallet, color: "var(--module-passport)" },
    { href: "/app/child/chat", label: t("childChat"), icon: MessageCircle, color: "var(--primary)" },
  ];

  return (
    <ChildShell navItems={navItems} avatar={summary?.avatarUrl ?? null} xp={summary?.xp ?? 0} level={summary?.level ?? 1}>
      {children}
    </ChildShell>
  );
}
