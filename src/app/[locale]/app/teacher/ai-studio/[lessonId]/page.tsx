import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Clock, Users } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getLessonForTeacher } from "@/db/repo/lessons";
import { lessonIdSchema } from "@/lib/validation/lessons";
import { AGE_BAND_PROFILES, isAgeBand } from "@/lib/domain/age-bands";
import { Link } from "@/i18n/navigation";
import { LESSON_STATUS_LABEL } from "@/lib/domain/lesson-status";
import { ChildLessonView } from "@/components/child/child-lesson-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function TeacherLessonPage({
  params,
}: {
  params: Promise<{ locale: string; lessonId: string }>;
}) {
  const { locale, lessonId } = await params;
  setRequestLocale(locale);
  const session = await requireRole("TEACHER");
  if (!lessonIdSchema.safeParse(lessonId).success) notFound();
  const lesson = await getLessonForTeacher(toTenantContext(session), lessonId);
  if (!lesson) notFound();

  const visibleToChildren = lesson.status === "published" && lesson.groups.length > 0;
  const reach = lesson.groups.reduce((sum, g) => sum + g.childCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/teacher/ai-studio" className="flex w-fit items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Кітапханаға оралу
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-extrabold">{lesson.topic}</h1>
        <Badge variant={lesson.status === "published" ? "default" : "outline"}>
          {LESSON_STATUS_LABEL[lesson.status]}
        </Badge>
        <Badge variant="secondary">
          {isAgeBand(lesson.ageBand) ? AGE_BAND_PROFILES[lesson.ageBand].label : lesson.ageBand}
        </Badge>
        {lesson.content.durationMinutes && (
          <Badge variant="outline" className="gap-1">
            <Clock className="size-3" />~{lesson.content.durationMinutes} мин
          </Badge>
        )}
      </div>

      {/* Availability check the task asks for: who can actually open this. */}
      <Card className={visibleToChildren ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}>
        <CardContent className="flex flex-col gap-2 pt-2 text-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <Users className="size-4" />
            {visibleToChildren
              ? `Балаларға қолжетімді: ${reach} бала көре алады`
              : lesson.status === "archived"
                ? "Архивте — балаларға көрінбейді"
                : lesson.groups.length === 0
                  ? "Ешбір топқа жарияланбаған — балаларға көрінбейді"
                  : "Балаларға көрінбейді"}
          </p>
          {lesson.groups.map((g) => (
            <p key={g.groupId} className="text-muted-foreground">
              {g.groupName} ({g.groupCode}) — {g.childCount} бала · жарияланды{" "}
              {new Date(g.assignedAt).toLocaleDateString(locale)}
            </p>
          ))}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-heading text-lg font-bold">Бала кабинетінде осылай көрінеді</h2>
        <div className="rounded-3xl border-2 border-dashed border-border/60 p-4">
          <ChildLessonView topic={lesson.topic} content={lesson.content} />
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="flex flex-col gap-2 pt-2 text-sm">
          <h2 className="font-heading font-bold">Тәрбиешіге арналған жоспар</h2>
          <p className="text-muted-foreground">{lesson.content.objective}</p>
          <ol className="list-decimal space-y-1 pl-5">
            {lesson.content.plan.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {lesson.content.homeworkTip && (
            <p className="mt-2">
              <span className="font-semibold">Үй тапсырмасы: </span>
              {lesson.content.homeworkTip}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
