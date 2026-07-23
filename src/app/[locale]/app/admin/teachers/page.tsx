import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listGroups, listTeachersWithGroups } from "@/db/repo/admin";
import { AddTeacherDialog } from "@/components/admin/add-teacher-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_TYPE_LABEL: Record<"main" | "assistant", string> = {
  main: "Тәрбиеші",
  assistant: "Педагог-ассистент",
};

export default async function AdminTeachersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SCHOOL_ADMIN");
  const ctx = toTenantContext(session);
  const [teachers, groups] = await Promise.all([listTeachersWithGroups(ctx), listGroups(ctx)]);
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold">{t("teachersTitle")}</h1>
        <AddTeacherDialog locale={locale} groups={groups} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Аты-жөні</TableHead>
              <TableHead>Рөл</TableHead>
              <TableHead>Топ</TableHead>
              <TableHead>Балалар саны</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.displayName}</TableCell>
                <TableCell>{row.roleType ? ROLE_TYPE_LABEL[row.roleType] : "—"}</TableCell>
                <TableCell>{row.groupName ?? "—"}</TableCell>
                <TableCell>{row.childCount ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
