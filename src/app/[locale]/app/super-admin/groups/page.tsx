import { setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listEducatorCandidates, listGroups } from "@/db/repo/groups";
import { AddGroupButton, GroupsManager } from "@/components/super-admin/groups-manager";

export default async function SuperAdminGroupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SUPER_ADMIN");
  const ctx = toTenantContext(session);

  const [groups, educators] = await Promise.all([listGroups(ctx), listEducatorCandidates(ctx)]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">Топтар</h1>
          <p className="mt-1 text-muted-foreground">
            Бөбекжай топтарын (сыныптарын) басқару: жас санаты, тәрбиеші, педагог-ассистент,
            белсенділік және архив күйі.
          </p>
        </div>
        <AddGroupButton locale={locale} educators={educators} />
      </div>

      <GroupsManager initial={groups} educators={educators} locale={locale} />
    </div>
  );
}
