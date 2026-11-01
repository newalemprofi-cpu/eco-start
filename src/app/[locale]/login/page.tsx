import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { LoginForm, type DemoAccount } from "@/components/auth/login-form";

const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "SUPER_ADMIN", identifier: "superadmin@ecostart.local" },
  { role: "SCHOOL_ADMIN", identifier: "admin@ecostart.local" },
  { role: "TEACHER", identifier: "teacher@ecostart.local" },
  { role: "PARENT", identifier: "parent@ecostart.local" },
  { role: "CHILD", identifier: "child@ecostart.local" },
];

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; ended?: string }>;
}) {
  const { locale } = await params;
  const { next, ended } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  const showDemo = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-10">
      <div className="mb-8 flex w-full max-w-4xl items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>

      <div className="mb-6 text-center">
        <h1 className="font-heading text-2xl font-bold">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("loginSubtitle")}</p>
        {ended === "1" && (
          <p role="status" className="mx-auto mt-3 max-w-sm rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {t("sessionEnded")}
          </p>
        )}
      </div>

      <LoginForm
        locale={locale}
        next={next}
        demoAccounts={showDemo ? DEMO_ACCOUNTS : []}
        demoPassword={showDemo ? process.env.DEMO_ACCOUNT_PASSWORD ?? "EcoStart2026!" : null}
      />
    </div>
  );
}
