"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { createProjectAction, updateProjectAction } from "@/app/[locale]/app/teacher/research/actions";
import { MAX_RESEARCH_TASKS } from "@/lib/validation/research";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ProjectDialogGroup = { id: string; name: string; code: string };

export type ProjectDialogInitial = {
  id: string;
  groupId: string;
  title: string;
  question: string;
  hypothesis: string;
  measurementUnit: string;
  tasks: string[];
};

/** Create (no `initial`) or edit (with `initial`) a research project. */
export function CreateProjectDialog({
  locale,
  groups,
  initial,
}: {
  locale: string;
  groups: ProjectDialogGroup[];
  initial?: ProjectDialogInitial;
}) {
  const t = useTranslations("research");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [groupId, setGroupId] = React.useState(initial?.groupId ?? groups[0]?.id ?? "");
  const [publishNow, setPublishNow] = React.useState(true);
  const isEdit = !!initial;

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("groupId", groupId);
    if (!isEdit) formData.set("status", publishNow ? "active" : "draft");
    try {
      const res = isEdit
        ? await updateProjectAction(locale, initial.id, formData)
        : await createProjectAction(locale, formData);
      if (res.ok) {
        setOpen(false);
        toast.success(isEdit ? "Өзгерістер сақталды." : publishNow ? "Зерттеу жарияланды." : "Жоба ретінде сақталды.");
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1" />}>
          <Pencil className="size-3.5" />
          {tCommon("edit")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="gap-1.5" disabled={groups.length === 0} />}>
          <Plus className="size-4" />
          {t("newProject")}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Зерттеуді түзету" : t("newProject")}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="research-group">Топ</Label>
            <Select value={groupId} onValueChange={(v) => v && setGroupId(v)}>
              <SelectTrigger id="research-group" className="w-full">
                <SelectValue>
                  {(v: string) => {
                    const g = groups.find((x) => x.id === v);
                    return g ? `${g.name} (${g.code})` : "Топты таңдаңыз";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} ({g.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="title">Тақырып</Label>
            <Input id="title" name="title" defaultValue={initial?.title} maxLength={120} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="question">{t("question")}</Label>
            <Textarea id="question" name="question" rows={2} defaultValue={initial?.question} maxLength={240} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hypothesis">{t("hypothesis")}</Label>
            <Textarea
              id="hypothesis"
              name="hypothesis"
              rows={2}
              defaultValue={initial?.hypothesis}
              maxLength={240}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tasks">Балаларға тапсырмалар (әр жолға біреу, ең көбі {MAX_RESEARCH_TASKS})</Label>
            <Textarea
              id="tasks"
              name="tasks"
              rows={3}
              defaultValue={initial?.tasks.join("\n")}
              placeholder={"Өсімдікті суар\nБиіктігін өлше\nСуретін сал"}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="measurementUnit">Өлшем бірлігі</Label>
            <Input
              id="measurementUnit"
              name="measurementUnit"
              defaultValue={initial?.measurementUnit ?? "cm"}
              maxLength={20}
              className="w-28"
            />
          </div>
          {!isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={publishNow} onCheckedChange={(v) => setPublishNow(v === true)} />
              Балаларға бірден көрсету (белгісіз болса — жоба ретінде сақталады)
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{tCommon("cancel")}</DialogClose>
            <Button type="submit" disabled={pending || !groupId}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
