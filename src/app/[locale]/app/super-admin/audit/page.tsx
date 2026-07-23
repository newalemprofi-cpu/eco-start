import { setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listAllAuditLogs } from "@/db/repo/super-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SuperAdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SUPER_ADMIN");
  const logs = await listAllAuditLogs(toTenantContext(session));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-extrabold">Аудит журналы (барлық бөбекжайлар)</h1>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Бөбекжай</TableHead>
              <TableHead>Орындаушы</TableHead>
              <TableHead>Әрекет</TableHead>
              <TableHead>Нысан</TableHead>
              <TableHead>Уақыты</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.schoolName ?? "—"}</TableCell>
                <TableCell className="font-medium">{l.actorName ?? "жүйе"}</TableCell>
                <TableCell>{l.action}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.entityType}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString(locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
