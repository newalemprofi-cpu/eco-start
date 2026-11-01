import { setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listLessonsForChild } from "@/db/repo/lessons";
import { Link } from "@/i18n/navigation";

const CARD_EMOJI = ["🌿", "🐞", "💧", "🌻", "🐦", "🍎"];

export default async function ChildLessonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const lessons = await listLessonsForChild(toTenantContext(session));

  return (
    <div className="flex flex-col gap-6 pt-4">
      <h1 className="flex items-center gap-2 font-heading text-2xl font-extrabold">
        <span aria-hidden>📚</span> Тапсырмалар
      </h1>

      {lessons.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border/60 py-10 text-center">
          <span className="text-6xl" aria-hidden>
            🌱
          </span>
          <p className="text-base text-muted-foreground">Әзірге тапсырма жоқ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {lessons.map((lesson, i) => (
            <Link
              key={lesson.id}
              href={`/app/child/lessons/${lesson.id}`}
              className="flex min-h-24 items-center gap-4 rounded-3xl border-2 border-border/60 bg-card p-5 shadow-sm transition active:scale-[0.98] hover:shadow-md"
            >
              <span className="text-5xl" aria-hidden>
                {CARD_EMOJI[i % CARD_EMOJI.length]}
              </span>
              <span className="font-heading text-xl font-bold">{lesson.topic}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
