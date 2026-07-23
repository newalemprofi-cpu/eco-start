"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const t = useTranslations("common");
  const params = useParams<{ locale: string }>();

  return (
    <form action={() => logoutAction(params.locale)}>
      <Button type="submit" variant={variant} size="sm" className="gap-1.5">
        <LogOut className="size-4" />
        {t("logout")}
      </Button>
    </form>
  );
}
