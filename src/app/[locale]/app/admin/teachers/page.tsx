import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listGroups } from "@/db/repo/admin";
import { listManagedTeachers } from "@/db/repo/user-admin";
import { AddTeacherDialog } from "@/components/admin/add-teacher-dialog";
import { ArchiveTabs } from "@/components/admin/archive-tabs";
import { ArchiveUserButton, EditTeacherDialog, ResetPasswordDialog } from "@/components/admin/user-management";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_TYPE_LABEL: Record<"main" | "assistant", string> = {
  main: "Тәрбиеші",
  assistant: "Педагог-ассистент",
};

export default async function AdminTeachersPage({
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
  const [teachers, groups] = await Promise.all([listManagedTeachers(ctx, archived), listGroups(ctx)]);
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-extrabold">{t("teachersTitle")}</h1>
        <AddTeacherDialog locale={locale} groups={groups} />
      </div>

      <ArchiveTabs basePath="/app/admin/teachers" archived={archived} />

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Аты-жөні</TableHead>
              <TableHead>Рөл</TableHead>
              <TableHead>Топ</TableHead>
              <TableHead>Балалар саны</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Әрекеттер</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {archived ? "Архивте қызметкер жоқ." : "Қызметкер жоқ."}
                </TableCell>
              </TableRow>
            )}
            {teachers.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.displayName}</TableCell>
                <TableCell>{row.position ? ROLE_TYPE_LABEL[row.position] : "—"}</TableCell>
                <TableCell>{row.groupName ?? "—"}</TableCell>
                <TableCell>{row.childCount ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {!archived && <EditTeacherDialog locale={locale} teacher={row} groups={groups} />}
                    {!archived && (
                      <ResetPasswordDialog locale={locale} role="TEACHER" userId={row.id} displayName={row.displayName} />
                    )}
                    <ArchiveUserButton
                      locale={locale}
                      role="TEACHER"
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
