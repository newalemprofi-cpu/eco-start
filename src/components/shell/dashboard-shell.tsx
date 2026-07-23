import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { LogoutButton } from "@/components/shell/logout-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export async function DashboardShell({
  navItems,
  roleLabel,
  userName,
  devModeBadge,
  children,
}: {
  navItems: NavItem[];
  roleLabel: string;
  userName: string;
  devModeBadge?: boolean;
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-background px-4 py-5 md:flex">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {navItems.map((item) => (
              <SidebarLink key={item.href} item={item} />
            ))}
          </nav>
          <div className="border-t border-border/60 pt-4">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <Logo />
            </div>
            <nav className="flex flex-1 items-center gap-1 overflow-x-auto md:hidden">
              {navItems.map((item) => (
                <MobileNavLink key={item.href} item={item} />
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {devModeBadge && (
                <Badge variant="outline" className="hidden border-warning/50 text-warning sm:inline-flex">
                  {t("devModeBadge")}
                </Badge>
              )}
              <ModeToggle />
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4.5" />
      {item.label}
    </Link>
  );
}

function MobileNavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground"
    >
      <Icon className="size-3.5" />
      {item.label}
    </Link>
  );
}
