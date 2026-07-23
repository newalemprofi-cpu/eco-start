import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getLinkedChildren, getHomework } from "@/db/repo/family";

export default async function ParentHomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const { locale } = await params;
  const { child: childParam } = await searchParams;
  setRequestLocale(locale);
  const session = await requireRole("PARENT");
  const ctx = toTenantContext(session);
  const children = await getLinkedChildren(ctx);
  const t = await getTranslations("family");

  if (children.length === 0) return <p className="text-muted-foreground">—</p>;
  const activeChild = children.find((c) => c.id === childParam) ?? children[0];
  const homework = await getHomework(ctx, activeChild.groupId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-extrabold">{t("homeworkTitle")}</h1>
      {homework.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noHomework")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {homework.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-sm"
            >
              <span className="font-medium">{h.topic}</span>
              <span className="text-muted-foreground">
                {h.dueAt ? new Date(h.dueAt).toLocaleDateString(locale) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
