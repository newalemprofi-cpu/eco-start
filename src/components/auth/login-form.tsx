"use client";

import * as React from "react";
import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { loginAction, type LoginState } from "@/lib/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";

export type DemoAccount = {
  role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "PARENT" | "CHILD";
  identifier: string;
};

const ERROR_MESSAGE_KEY: Record<string, string> = {
  invalid_credentials: "invalidCredentials",
  rate_limited: "rateLimited",
};

export function LoginForm({
  locale,
  next,
  demoAccounts,
  demoPassword,
}: {
  locale: string;
  next?: string;
  demoAccounts: DemoAccount[];
  demoPassword: string | null;
}) {
  const t = useTranslations("auth");
  const tRoles = useTranslations("roles");
  const boundAction = React.useMemo(
    () => loginAction.bind(null, locale, next),
    [locale, next]
  );
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    boundAction,
    {}
  );

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", secret: "" },
  });

  function onSubmit(values: LoginInput) {
    const fd = new FormData();
    fd.set("identifier", values.identifier);
    fd.set("secret", values.secret);
    React.startTransition(() => {
      formAction(fd);
    });
  }

  function fillDemo(account: DemoAccount) {
    form.setValue("identifier", account.identifier, { shouldValidate: true });
    if (demoPassword) form.setValue("secret", demoPassword, { shouldValidate: true });
  }

  return (
    <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("identifierLabel")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder={t("identifierPlaceholder")}
                          autoComplete="username"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("secretLabel")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="password"
                          className="pl-8"
                          autoComplete="current-password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {state.error && (
                <p role="alert" className="text-sm text-destructive">
                  {t(ERROR_MESSAGE_KEY[state.error] ?? "genericError")}
                </p>
              )}

              <Button type="submit" disabled={isPending} className="mt-1">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? t("submitting") : t("submit")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {demoAccounts.length > 0 && (
        <Card id="demo" className="border-dashed border-border shadow-none">
          <CardContent className="flex flex-col gap-3 pt-2">
            <div>
              <h2 className="font-heading text-sm font-bold">{t("demoAccountsTitle")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("demoAccountsHint")}</p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {demoAccounts.map((account) => (
                <li key={account.identifier}>
                  <button
                    type="button"
                    onClick={() => fillDemo(account)}
                    className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-xs transition hover:border-primary/50 hover:bg-primary/5"
                  >
                    <span>
                      <span className="block font-semibold">{tRoles(account.role)}</span>
                      <span className="text-muted-foreground">{account.identifier}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {demoPassword && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs">
                {t("demoPasswordLabel")}: <code className="font-mono">{demoPassword}</code>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
