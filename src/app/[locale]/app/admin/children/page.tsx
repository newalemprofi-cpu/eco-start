import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listGroups, listNeedsReviewChildren } from "@/db/repo/admin";
import { listManagedChildren } from "@/db/repo/user-admin";
import { AddChildDialog } from "@/components/admin/add-child-dialog";
import { ArchiveTabs } from "@/components/admin/archive-tabs";
import { ResolveReviewDialog } from "@/components/admin/resolve-review-dialog";
import { ArchiveUserButton, EditChildDialog, MoveChildDialog } from "@/components/admin/user-management";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminChildrenPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  const archived = (await searchParams).view === "archived";
  setRequestLocale(locale);
  const session = await requireRole("SCHOOL_ADMIN", "SUPER_ADMIN");
  const ctx = toTenantContext(session);
  const [children, groups, needsReview] = await Promise.all([
    listManagedChildren(ctx, archived),
    listGroups(ctx),
    archived ? Promise.resolve([]) : listNeedsReviewChildren(ctx),
  ]);
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-extrabold">{t("childrenTitle")}</h1>
        <AddChildDialog locale={locale} groups={groups} />
      </div>

      <ArchiveTabs basePath="/app/admin/children" archived={archived} />

      {needsReview.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">Тобы анықталмаған {needsReview.length} бала</p>
          <p className="text-xs">
            Дұрыс топты таңдаңыз. Қате немесе қайталанған жазба болса — архивтеңіз (деректері өшпейді).
          </p>
          <div className="flex flex-col gap-2">
            {needsReview.map((child) => (
              <div
                key={child.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2"
              >
                <span>
                  {child.displayName}{" "}
                  <span className="font-mono text-xs text-muted-foreground">{child.loginCode}</span>
                </span>
                <span className="flex flex-wrap gap-1">
                  <ResolveReviewDialog
                    locale={locale}
                    childId={child.id}
                    displayName={child.displayName}
                    candidateGroupCodes={child.candidateGroupCodes}
                    groups={groups}
                  />
                  <ArchiveUserButton
                    locale={locale}
                    role="CHILD"
                    userId={child.id}
                    displayName={child.displayName}
                    archived={false}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Аты-жөні</TableHead>
              <TableHead>Кіру коды</TableHead>
              <TableHead>Топ</TableHead>
              <TableHead>Деңгей</TableHead>
              <TableHead>XP</TableHead>
              <TableHead className="text-right">Әрекеттер</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {children.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {archived ? "Архивте бала жоқ." : "Бала жоқ."}
                </TableCell>
              </TableRow>
            )}
            {children.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.displayName}</TableCell>
                <TableCell className="font-mono text-xs">{row.loginCode}</TableCell>
                <TableCell>
                  {row.groupName ?? (
                    <span className="font-medium text-amber-600 dark:text-amber-400" title="Топ тағайындалмаған">
                      Топ жоқ
                    </span>
                  )}
                </TableCell>
                <TableCell>{row.level}</TableCell>
                <TableCell>{row.xp}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {!archived && <EditChildDialog locale={locale} child={row} groups={groups} />}
                    {!archived && <MoveChildDialog locale={locale} child={row} groups={groups} />}
                    <ArchiveUserButton
                      locale={locale}
                      role="CHILD"
                      userId={row.id}
                      displayName={row.displayName}
                      archived={archived}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
