import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listLinkableChildren, listManagedParents } from "@/db/repo/user-admin";
import { AddParentDialog } from "@/components/admin/add-parent-dialog";
import { ArchiveTabs } from "@/components/admin/archive-tabs";
import {
  ArchiveUserButton,
  EditParentDialog,
  ParentLinksDialog,
  ResetPasswordDialog,
} from "@/components/admin/user-management";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminParentsPage({
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
  const [parents, linkable] = await Promise.all([listManagedParents(ctx, archived), listLinkableChildren(ctx)]);
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-extrabold">{t("parentsTitle")}</h1>
        <AddParentDialog locale={locale} />
      </div>

      <ArchiveTabs basePath="/app/admin/parents" archived={archived} />

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Аты-жөні</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Кіру логині</TableHead>
              <TableHead>Балалары</TableHead>
              <TableHead className="text-right">Әрекеттер</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parents.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {archived ? "Архивте ата-ана жоқ." : "Ата-ана жоқ."}
                </TableCell>
              </TableRow>
            )}
            {parents.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.displayName}</TableCell>
                <TableCell className={row.phone ? undefined : "text-muted-foreground"}>
                  {row.phone ?? "Көрсетілмеген"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.email}</TableCell>
                <TableCell className="text-sm">
                  {row.children.length > 0 ? row.children.map((c) => c.displayName).join(", ") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {!archived && <EditParentDialog locale={locale} parent={row} />}
                    <ParentLinksDialog locale={locale} parent={row} linkable={linkable} />
                    {!archived && (
                      <ResetPasswordDialog locale={locale} role="PARENT" userId={row.id} displayName={row.displayName} />
                    )}
                    <ArchiveUserButton
                      locale={locale}
                      role="PARENT"
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
