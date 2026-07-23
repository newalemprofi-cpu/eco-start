import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const t = useTranslations("nav");
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        <span className="min-w-0 flex-1 cursor-default text-center text-lg font-bold text-balance text-primary select-none sm:text-2xl">
          №37 «Жұлдыз-ай» бөбекжайы
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/news" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline">
            Жаңалықтар
          </Link>
          <ModeToggle />
          <Link href="/login" className={cn(buttonVariants())}>
            {t("login")}
          </Link>
        </div>
      </div>
    </header>
  );
}
