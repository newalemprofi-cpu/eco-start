import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getMessages, getOrCreateThread } from "@/db/repo/chat";
import { NatureChat } from "@/components/child/nature-chat";
import type { AppLocale } from "@/i18n/routing";

export default async function ChildChatPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);
  const threadId = await getOrCreateThread(ctx, "nature_chat");
  const messages = await getMessages(ctx, threadId);
  const t = await getTranslations("chat");

  return (
    <div className="flex flex-col gap-4 pt-4">
      <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
      <NatureChat locale={locale} threadId={threadId} initialMessages={messages} />
    </div>
  );
}
