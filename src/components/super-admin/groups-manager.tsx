"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  archiveGroupAction,
  createGroupAction,
  deleteGroupAction,
  restoreGroupAction,
  updateGroupAction,
} from "@/app/[locale]/app/super-admin/groups/actions";
import type { GroupInput, GroupRow, TeacherCandidate } from "@/db/repo/groups";
import {
  GROUP_AGE_CATEGORIES,
  GROUP_AGE_CATEGORY_DESCRIPTION,
  GROUP_AGE_CATEGORY_LABEL,
  type GroupAgeCategory,
} from "@/lib/group-age-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

type StatusFilter = "all" | "active" | "inactive" | "archived";
const NONE = "__none__";
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  active: "Белсенді",
  inactive: "Белсенді емес",
  archived: "Архивте",
  all: "Барлығы",
};

function StatusBadge({ group }: { group: GroupRow }) {
  if (group.archivedAt) return <Badge variant="outline">Архивте</Badge>;
  if (!group.isActive) return <Badge variant="secondary">Белсенді емес</Badge>;
  return <Badge>Белсенді</Badge>;
}

export function GroupsManager({
  initial,
  educators,
  locale,
}: {
  initial: GroupRow[];
  educators: TeacherCandidate[];
  locale: string;
}) {
  const router = useRouter();
  const [groups, setGroups] = React.useState(initial);
  const [search, setSearch] = React.useState("");
  const [ageFilter, setAgeFilter] = React.useState<string>("all");
  const [educatorFilter, setEducatorFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("active");

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroups(initial);
  }, [initial]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (q && !g.name.toLowerCase().includes(q) && !g.code.toLowerCase().includes(q)) return false;
      if (ageFilter !== "all" && g.ageCategory !== ageFilter) return false;
      if (educatorFilter !== "all" && g.educatorId !== educatorFilter) return false;
      if (statusFilter === "archived" && !g.archivedAt) return false;
      if (statusFilter === "inactive" && (g.archivedAt || g.isActive)) return false;
      if (statusFilter === "active" && (g.archivedAt || !g.isActive)) return false;
      return true;
    });
  }, [groups, search, ageFilter, educatorFilter, statusFilter]);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Атауы немесе коды бойынша іздеу..."
              className="pl-8"
            />
          </div>
          <Select value={ageFilter} onValueChange={(v) => v && setAgeFilter(v)}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Жас санаты сүзгісі">
              <SelectValue>
                {(v: string) =>
                  v === "all"
                    ? "Барлық жас санаттары"
                    : `${GROUP_AGE_CATEGORY_LABEL[v as GroupAgeCategory]} — ${GROUP_AGE_CATEGORY_DESCRIPTION[v as GroupAgeCategory]}`
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Барлық жас санаттары</SelectItem>
              {GROUP_AGE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {GROUP_AGE_CATEGORY_LABEL[c]} — {GROUP_AGE_CATEGORY_DESCRIPTION[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={educatorFilter} onValueChange={(v) => v && setEducatorFilter(v)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Тәрбиеші сүзгісі">
              <SelectValue>
                {(v: string) =>
                  v === "all" ? "Барлық тәрбиешілер" : (educators.find((e) => e.id === v)?.displayName ?? "—")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Барлық тәрбиешілер</SelectItem>
              {educators.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Күй сүзгісі">
              <SelectValue>{(v: string) => STATUS_FILTER_LABEL[v as StatusFilter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Белсенді</SelectItem>
              <SelectItem value="inactive">Белсенді емес</SelectItem>
              <SelectItem value="archived">Архивте</SelectItem>
              <SelectItem value="all">Барлығы</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Топтар табылмады.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-border/60 lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Атауы</TableHead>
                  <TableHead>Коды</TableHead>
                  <TableHead>Жас санаты</TableHead>
                  <TableHead>Тәрбиеші</TableHead>
                  <TableHead>Педагог-ассистент</TableHead>
                  <TableHead>Балалар саны</TableHead>
                  <TableHead>Оқу жылы</TableHead>
                  <TableHead>Күйі</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="font-mono text-xs">{g.code}</TableCell>
                    <TableCell>
                      {GROUP_AGE_CATEGORY_LABEL[g.ageCategory]} — {GROUP_AGE_CATEGORY_DESCRIPTION[g.ageCategory]}
                    </TableCell>
                    <TableCell>{g.educatorName ?? "—"}</TableCell>
                    <TableCell>{g.pedagogicalAssistantName ?? "—"}</TableCell>
                    <TableCell>
                      {g.childCount}{" "}
                      <span className="text-xs text-muted-foreground">(нақты: {g.linkedChildCount})</span>
                    </TableCell>
                    <TableCell>{g.academicYear || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge group={g} />
                    </TableCell>
                    <TableCell>
                      <GroupActions locale={locale} educators={educators} group={g} onChanged={refresh} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((g) => (
              <Card key={g.id} className="border-border/60 shadow-sm">
                <CardContent className="flex flex-col gap-3 pt-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-heading text-base font-bold">{g.name}</h3>
                      <p className="font-mono text-xs text-muted-foreground">{g.code}</p>
                    </div>
                    <StatusBadge group={g} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Жас санаты</p>
                      <p>{GROUP_AGE_CATEGORY_LABEL[g.ageCategory]} — {GROUP_AGE_CATEGORY_DESCRIPTION[g.ageCategory]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Оқу жылы</p>
                      <p>{g.academicYear || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Тәрбиеші</p>
                      <p>{g.educatorName ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Педагог-ассистент</p>
                      <p>{g.pedagogicalAssistantName ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Балалар саны</p>
                      <p>
                        {g.childCount} <span className="text-xs text-muted-foreground">(нақты: {g.linkedChildCount})</span>
                      </p>
                    </div>
                  </div>
                  <GroupActions locale={locale} educators={educators} group={g} onChanged={refresh} fullWidth />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GroupActions({
  locale,
  educators,
  group,
  onChanged,
  fullWidth,
}: {
  locale: string;
  educators: TeacherCandidate[];
  group: GroupRow;
  onChanged: () => void;
  fullWidth?: boolean;
}) {
  const [archiving, setArchiving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function onArchive() {
    setArchiving(true);
    const res = await archiveGroupAction(locale, group.id);
    setArchiving(false);
    if (res.ok) {
      toast.success("Топ архивтелді");
      onChanged();
    } else toast.error(res.error);
  }

  async function onRestore() {
    setArchiving(true);
    const res = await restoreGroupAction(locale, group.id);
    setArchiving(false);
    if (res.ok) {
      toast.success("Топ архивтен қалпына келтірілді");
      onChanged();
    } else toast.error(res.error);
  }

  async function onDelete() {
    if (!confirm(`«${group.name}» тобын толық жою керек пе? Бұл әрекетті қайтару мүмкін емес.`)) return;
    setDeleting(true);
    const res = await deleteGroupAction(locale, group.id);
    setDeleting(false);
    if (res.ok) {
      toast.success("Топ жойылды");
      onChanged();
    } else toast.error(res.error);
  }

  return (
    <div className={fullWidth ? "flex flex-wrap gap-2" : "flex items-center gap-1.5"}>
      <GroupFormDialog
        locale={locale}
        educators={educators}
        group={group}
        onSaved={onChanged}
        trigger={
          <Button variant="outline" size="sm" className={fullWidth ? "flex-1" : ""}>
            <Pencil className="size-3.5" />
            Өзгерту
          </Button>
        }
      />
      {group.archivedAt ? (
        <Button variant="outline" size="sm" onClick={onRestore} disabled={archiving} className={fullWidth ? "flex-1" : ""}>
          {archiving ? <Loader2 className="size-3.5 animate-spin" /> : <ArchiveRestore className="size-3.5" />}
          Қалпына келтіру
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={onArchive} disabled={archiving} className={fullWidth ? "flex-1" : ""}>
          {archiving ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
          Архивтеу
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={deleting}
        className={`text-destructive hover:text-destructive ${fullWidth ? "flex-1" : ""}`}
      >
        {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        Жою
      </Button>
    </div>
  );
}

function emptyGroupForm(): GroupInput {
  return {
    name: "",
    code: "",
    ageCategory: "PRESCHOOL_5",
    educatorId: null,
    pedagogicalAssistantId: null,
    childCount: 0,
    description: "",
    academicYear: "",
    isActive: true,
  };
}

/** Rendered next to the "Топтар" page heading. Both page.tsx files that
 * use this are Server Components — passing a `trigger` ReactNode built
 * in a Server Component across the RSC boundary as a client-component
 * prop produced a real hydration mismatch (DialogTrigger's `data-slot`
 * merge onto the given Button resolved differently between the SSR
 * pass and the client hydration pass). Keeping the trigger's JSX
 * construction entirely inside this "use client" module — only plain
 * serializable data (locale, educators) crosses the boundary — fixes
 * it, matching the same safe shape GroupsManager itself already uses. */
export function AddGroupButton({ locale, educators }: { locale: string; educators: TeacherCandidate[] }) {
  return (
    <GroupFormDialog
      locale={locale}
      educators={educators}
      trigger={
        <Button className="w-full gap-1.5 sm:w-auto">
          <Plus className="size-4" />
          Жаңа топ қосу
        </Button>
      }
    />
  );
}

function GroupFormDialog({
  locale,
  educators,
  group,
  trigger,
  onSaved,
}: {
  locale: string;
  educators: TeacherCandidate[];
  group?: GroupRow;
  trigger: React.ReactNode;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const isEdit = !!group;
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<GroupInput>(
    group
      ? {
          name: group.name,
          code: group.code,
          ageCategory: group.ageCategory,
          educatorId: group.educatorId,
          pedagogicalAssistantId: group.pedagogicalAssistantId,
          childCount: group.childCount,
          description: group.description,
          academicYear: group.academicYear,
          isActive: group.isActive,
        }
      : emptyGroupForm()
  );

  function patch<K extends keyof GroupInput>(key: K, value: GroupInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Топ атауы мен коды міндетті");
      return;
    }
    setSaving(true);
    const res = isEdit
      ? await updateGroupAction(locale, group!.id, form)
      : await createGroupAction(locale, form);
    setSaving(false);
    if (res.ok) {
      toast.success(isEdit ? "Топ өзгертілді" : "Топ қосылды");
      setOpen(false);
      if (!isEdit) setForm(emptyGroupForm());
      router.refresh();
      onSaved?.();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Топты өзгерту" : "Жаңа топ қосу"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="group-name">Топ атауы</Label>
              <Input id="group-name" value={form.name} onChange={(e) => patch("name", e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="group-code">Топ коды</Label>
              <Input
                id="group-code"
                value={form.code}
                onChange={(e) => patch("code", e.target.value)}
                placeholder="ORTA-01"
                required
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Жас санаты</Label>
            <Select value={form.ageCategory} onValueChange={(v) => v && patch("ageCategory", v as GroupAgeCategory)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: GroupAgeCategory) => `${GROUP_AGE_CATEGORY_LABEL[v]} — ${GROUP_AGE_CATEGORY_DESCRIPTION[v]}`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GROUP_AGE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {GROUP_AGE_CATEGORY_LABEL[c]} — {GROUP_AGE_CATEGORY_DESCRIPTION[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Негізгі тәрбиеші</Label>
              <Select
                value={form.educatorId ?? NONE}
                onValueChange={(v) => patch("educatorId", v === NONE ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => (v === NONE ? "— тағайындалмаған —" : (educators.find((e) => e.id === v)?.displayName ?? "—"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— тағайындалмаған —</SelectItem>
                  {educators.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Педагог-ассистент</Label>
              <Select
                value={form.pedagogicalAssistantId ?? NONE}
                onValueChange={(v) => patch("pedagogicalAssistantId", v === NONE ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => (v === NONE ? "— тағайындалмаған —" : (educators.find((e) => e.id === v)?.displayName ?? "—"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— тағайындалмаған —</SelectItem>
                  {educators.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="group-child-count">Балалар саны</Label>
              <Input
                id="group-child-count"
                type="number"
                min={0}
                value={form.childCount}
                onChange={(e) => patch("childCount", Number(e.target.value) || 0)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="group-academic-year">Оқу жылы</Label>
              <Input
                id="group-academic-year"
                value={form.academicYear}
                onChange={(e) => patch("academicYear", e.target.value)}
                placeholder="2025-2026"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="group-description">Сипаттама</Label>
            <Textarea
              id="group-description"
              rows={2}
              value={form.description}
              onChange={(e) => patch("description", e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="group-active" checked={form.isActive} onCheckedChange={(c) => patch("isActive", !!c)} />
            <Label htmlFor="group-active">Белсенді күйі</Label>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Бас тарту</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Сақтау
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
