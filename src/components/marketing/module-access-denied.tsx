import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { roleHome } from "@/lib/auth/roles";
import type { Role } from "@/lib/auth/roles";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Shown when a signed-in user follows a homepage module link their
 * role doesn't have access to — never a dead "#" link and never a
 * silent redirect with no explanation. See src/app/[locale]/app/{module}/page.tsx
 * for the router pages that render this.
 */
export async function ModuleAccessDenied({ role }: { role: Role }) {
  const t = await getTranslations("modulesAccess");
  const tRoles = await getTranslations("roles");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="max-w-md border-border/60 text-center shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 pt-2">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <ShieldAlert className="size-7" />
          </span>
          <div>
            <h1 className="font-heading text-xl font-bold">{t("title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("description", { role: tRoles(role) })}
            </p>
          </div>
          <Link href={roleHome(role)} className={cn(buttonVariants())}>
            {t("backToDashboard")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
