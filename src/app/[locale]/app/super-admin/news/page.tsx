import { setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { ensureNewsDraft, listNewsGroupIds } from "@/db/repo/news";
import { NewsEditor } from "@/components/super-admin/news-editor";

export default async function SuperAdminNewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SUPER_ADMIN");
  const ctx = toTenantContext(session);

  const groupIds = await listNewsGroupIds(ctx);
  const items = await Promise.all(groupIds.map((groupId) => ensureNewsDraft(ctx, groupId)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">Жаңалықтар</h1>
        <p className="mt-1 text-muted-foreground">
          №37 «Жұлдыз-ай» бөбекжайының жаңалықтары. «Басты бетте көрсету» қосулы және жарияланған
          жаңалықтар бастапқы беттегі каруселде кезекпен көрінеді.
        </p>
      </div>

      <NewsEditor initial={items} locale={locale} />
    </div>
  );
}
