import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ModeToggle } from "@/components/mode-toggle";
import { LogoutButton } from "@/components/shell/logout-button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { levelIntoCurrentLevelLabel } from "@/lib/domain/xp-format";

export type ChildNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
};

export function ChildShell({
  navItems,
  avatar,
  xp,
  level,
  children,
}: {
  navItems: ChildNavItem[];
  avatar: string | null;
  xp: number;
  level: number;
  children: React.ReactNode;
}) {
  const { progressPercent, xpLabel } = levelIntoCurrentLevelLabel(xp);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="flex size-11 shrink-0 animate-bounce items-center justify-center rounded-2xl bg-primary/10 text-2xl [animation-duration:2.5s]">
            {avatar ?? "🦉"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>{level}-lvl</span>
              <span>{xpLabel}</span>
            </div>
            <Progress value={progressPercent} className="h-2.5" />
          </div>
          <ModeToggle />
          <LogoutButton />
        </div>
      </header>

      <nav className="mx-auto flex max-w-5xl flex-wrap justify-center gap-2 px-4 py-4 sm:gap-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card px-4 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-5 sm:py-4"
              )}
            >
              <span
                className="flex size-10 items-center justify-center rounded-xl text-white sm:size-12"
                style={{ backgroundColor: item.color }}
              >
                <Icon className="size-5 sm:size-6" />
              </span>
              <span className="text-xs font-bold sm:text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <main className="mx-auto max-w-5xl px-4 pb-16">{children}</main>
    </div>
  );
}
