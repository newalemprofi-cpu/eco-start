import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listUsersByRole } from "@/db/repo/admin";
import { AddParentDialog } from "@/components/admin/add-parent-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminParentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SCHOOL_ADMIN");
  const parents = await listUsersByRole(toTenantContext(session), "PARENT");
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold">{t("parentsTitle")}</h1>
        <AddParentDialog locale={locale} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Аты-жөні</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Кіру логині</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parents.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.displayName}</TableCell>
                <TableCell className={row.phone ? undefined : "text-muted-foreground"}>
                  {row.phone ?? "Көрсетілмеген"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
