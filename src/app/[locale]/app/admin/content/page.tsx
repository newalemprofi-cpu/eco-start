import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listRecentMedia } from "@/db/repo/admin";
import { withTenantContext } from "@/db/client";
import { MediaStatusSelect } from "@/components/admin/media-status-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function AdminContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SCHOOL_ADMIN");
  const ctx = toTenantContext(session);
  const media = await listRecentMedia(ctx);
  const games = await withTenantContext(
    ctx,
    (sql) => sql<{ key: string; title: Record<string, string> }[]>`select key, title from games`
  );
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-2xl font-extrabold">{t("contentTitle")}</h1>

      <div>
        <h2 className="font-heading text-lg font-bold">Ойындар</h2>
        <div className="mt-2 flex gap-2">
          {games.map((g) => (
            <Badge key={g.key} variant="outline">
              {g.title[locale] ?? g.title.kk}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold">Медиа</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Тақырып</TableHead>
                <TableHead>Бала</TableHead>
                <TableHead>Түрі</TableHead>
                <TableHead>Күйі</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {media.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.title}</TableCell>
                  <TableCell>{m.childName ?? "—"}</TableCell>
                  <TableCell>{m.type}</TableCell>
                  <TableCell>
                    <MediaStatusSelect locale={locale} mediaId={m.id} status={m.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
