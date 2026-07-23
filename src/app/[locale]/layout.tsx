import type { Metadata } from "next";
import { Comfortaa, Nunito } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { getActiveBrand, getActiveTheme, themeToCss } from "@/lib/theme/active-theme";
import "../globals.css";

const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const comfortaa = Comfortaa({
  subsets: ["latin", "cyrillic"],
  variable: "--font-heading",
  display: "swap",
  weight: ["500", "600", "700"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [brand, t] = await Promise.all([getActiveBrand(), getTranslations({ locale, namespace: "common" })]);
  return {
    title: `${brand.site_name} — экологиялық цифрлық орталық`,
    description: t("tagline"),
    icons: brand.favicon_url ? [{ url: brand.favicon_url }] : undefined,
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const [messages, theme] = await Promise.all([getMessages(), getActiveTheme()]);

  return (
    <html lang={locale} className={`${nunito.variable} ${comfortaa.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* SUPER_ADMIN-controlled colors/radius/shadow (src/lib/theme) —
            overrides the static defaults in globals.css. React 19 hoists
            this into <head> automatically regardless of where it's
            rendered in the tree. */}
        <style id="cms-theme">{themeToCss(theme)}</style>
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster richColors position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
