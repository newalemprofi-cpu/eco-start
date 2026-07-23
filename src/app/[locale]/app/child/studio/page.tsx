import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listMediaForChild } from "@/db/repo/media";
import { StoryStudio } from "@/components/child/story-studio";
import { MediaUploader } from "@/components/child/media-uploader";
import { Card, CardContent } from "@/components/ui/card";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const media = await listMediaForChild(toTenantContext(session));
  const t = await getTranslations("modules");

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("media.name")}</h1>
        <p className="mt-1 text-muted-foreground">{t("media.desc")}</p>
      </div>

      <StoryStudio locale={locale} />
      <MediaUploader locale={locale} />

      {media.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {media.map((m) => (
            <Card key={m.id} className="border-border/60 shadow-sm">
              <CardContent className="flex flex-col gap-1 pt-2">
                <p className="font-semibold">{m.title}</p>
                <p className="text-xs text-muted-foreground">{m.type}</p>
                {m.fileUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.fileUrl} alt="" className="mt-1 h-28 w-full rounded-lg object-cover" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
