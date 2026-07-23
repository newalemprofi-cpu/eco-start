import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listGroups, listNeedsReviewChildren, listUsersByRole } from "@/db/repo/admin";
import { AddChildDialog } from "@/components/admin/add-child-dialog";
import { ResolveReviewDialog } from "@/components/admin/resolve-review-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminChildrenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SCHOOL_ADMIN");
  const ctx = toTenantContext(session);
  const [children, groups, needsReview] = await Promise.all([
    listUsersByRole(ctx, "CHILD"),
    listGroups(ctx),
    listNeedsReviewChildren(ctx),
  ]);
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold">{t("childrenTitle")}</h1>
        <AddChildDialog locale={locale} groups={groups} />
      </div>

      {needsReview.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">Тобы анықталмаған {needsReview.length} бала</p>
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
                <ResolveReviewDialog
                  locale={locale}
                  childId={child.id}
                  displayName={child.displayName}
                  candidateGroupCodes={child.candidateGroupCodes}
                  groups={groups}
                />
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
            </TableRow>
          </TableHeader>
          <TableBody>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
