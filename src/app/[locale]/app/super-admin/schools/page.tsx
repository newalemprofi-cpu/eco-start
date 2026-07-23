import { setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listSchools } from "@/db/repo/super-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function SuperAdminSchoolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SUPER_ADMIN");
  const schools = await listSchools(toTenantContext(session));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-extrabold">Бөбекжайлар</h1>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Атауы</TableHead>
              <TableHead>Аймақ</TableHead>
              <TableHead>Жоспар</TableHead>
              <TableHead>Тәрбиешілер</TableHead>
              <TableHead>Балалар</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.region ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{s.plan}</Badge>
                </TableCell>
                <TableCell>{s.teacherCount}</TableCell>
                <TableCell>{s.childCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
