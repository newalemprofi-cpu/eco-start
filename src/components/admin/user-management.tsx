"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, KeyRound, Link2, Pencil, Unlink, Users } from "lucide-react";
import { toast } from "sonner";
import {
  moveChildAction,
  resetPasswordAction,
  setParentLinkAction,
  setUserArchivedAction,
  updateChildAction,
  updateParentAction,
  updateTeacherAction,
  type UserActionResult,
} from "@/app/[locale]/app/admin/user-actions";
import type { ManagedChild, ManagedParent, ManagedRole, ManagedTeacher } from "@/db/repo/user-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type GroupOption = { id: string; name: string; code: string };
const NO_GROUP = "none";

const ERROR_TEXT: Record<string, string> = {
  validation: "Деректер дұрыс толтырылмаған. Өрістерді тексеріңіз.",
  not_found: "Пайдаланушы табылмады немесе оны өзгертуге рұқсат жоқ.",
  email_taken: "Бұл email басқа пайдаланушыда тіркелген.",
  login_code_taken: "Бұл кіру коды бос емес.",
  group_not_found: "Топ табылмады немесе архивте.",
  slot_taken: "Бұл топтың орны бос емес.",
  cannot_archive_self: "Өз аккаунтыңызды архивтей алмайсыз.",
};

/** Runs a server action, toasts the outcome, refreshes the list. */
function useAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const run = React.useCallback(
    async (fn: () => Promise<UserActionResult>, success: string): Promise<UserActionResult> => {
      setPending(true);
      try {
        const res = await fn();
        if (res.ok) {
          toast.success(success);
          router.refresh();
        } else if (res.error !== "slot_taken") {
          toast.error(ERROR_TEXT[res.error] ?? "Сақтау мүмкін болмады");
        }
        return res;
      } catch {
        toast.error("Сақтау мүмкін болмады. Қайта көріңіз.");
        return { ok: false, error: "validation" };
      } finally {
        setPending(false);
      }
    },
    [router]
  );
  return { pending, run };
}

function GroupSelect({
  groups,
  value,
  onChange,
  name = "groupId",
  allowNone = true,
}: {
  groups: GroupOption[];
  value: string;
  onChange: (v: string) => void;
  name?: string;
  allowNone?: boolean;
}) {
  return (
    <Select name={name} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-full">
        <SelectValue>
          {(v: string) => {
            const g = groups.find((x) => x.id === v);
            return g ? `${g.name} (${g.code})` : v === NO_GROUP ? "Топсыз" : "Топты таңдаңыз";
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NO_GROUP}>Топсыз</SelectItem>}
        {groups.map((g) => (
          <SelectItem key={g.id} value={g.id}>
            {g.name} ({g.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function DialogButtons({ pending, submitLabel = "Сақтау" }: { pending: boolean; submitLabel?: string }) {
  return (
    <DialogFooter>
      <DialogClose render={<Button type="button" variant="outline" />}>Бас тарту</DialogClose>
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}

// ── Archive / restore (confirmation built into the page — no confirm()) ─

export function ArchiveUserButton({
  locale,
  role,
  userId,
  displayName,
  archived,
}: {
  locale: string;
  role: ManagedRole;
  userId: string;
  displayName: string;
  archived: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();

  async function confirm() {
    const res = await run(
      () => setUserArchivedAction(locale, role, userId, !archived),
      archived ? "Қалпына келтірілді" : "Архивке жіберілді"
    );
    if (res.ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={archived ? "outline" : "ghost"} className="gap-1" />}>
        {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
        {archived ? "Қалпына келтіру" : "Архивтеу"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{archived ? `${displayName} — қалпына келтіру` : `${displayName} — архивтеу`}</DialogTitle>
          <DialogDescription>
            {archived
              ? "Аккаунт белсенді тізімге қайтады және жүйеге қайта кіре алады."
              : "Аккаунт жүйеге кіре алмайды және белсенді тізімнен алынады. Барлық тарихы, XP, зерттеулері мен файлдары сақталады — кез келген уақытта қалпына келтіруге болады."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Бас тарту</DialogClose>
          <Button type="button" variant={archived ? "default" : "destructive"} disabled={pending} onClick={confirm}>
            {archived ? "Қалпына келтіру" : "Иә, архивтеу"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Password reset (teacher / parent) ────────────────────────────────

export function ResetPasswordDialog({
  locale,
  role,
  userId,
  displayName,
}: {
  locale: string;
  role: "TEACHER" | "PARENT";
  userId: string;
  displayName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();

  async function onSubmit(formData: FormData) {
    if (formData.get("password") !== formData.get("confirm")) {
      toast.error("Құпия сөздер сәйкес келмейді");
      return;
    }
    formData.delete("confirm");
    formData.set("id", userId);
    const res = await run(() => resetPasswordAction(locale, role, formData), "Құпия сөз жаңартылды");
    if (res.ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" className="gap-1" />}>
        <KeyRound className="size-3.5" />
        Құпия сөз
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{displayName} — жаңа құпия сөз</DialogTitle>
          <DialogDescription>
            Ескі құпия сөз көрсетілмейді. Сақтағаннан кейін бұл аккаунттың барлық ашық сеанстары аяқталады.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field id={`pw-${userId}`} label="Жаңа құпия сөз (кемінде 8 таңба)">
            <Input id={`pw-${userId}`} name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
          </Field>
          <Field id={`pw2-${userId}`} label="Құпия сөзді қайталаңыз">
            <Input id={`pw2-${userId}`} name="confirm" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
          </Field>
          <DialogButtons pending={pending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Teacher ──────────────────────────────────────────────────────────

export function EditTeacherDialog({ locale, teacher, groups }: { locale: string; teacher: ManagedTeacher; groups: GroupOption[] }) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<"main" | "assistant">(teacher.position ?? "main");
  const [groupId, setGroupId] = React.useState<string>(teacher.groupId ?? NO_GROUP);
  const [slotHolder, setSlotHolder] = React.useState<string | null>(null);
  const { pending, run } = useAction();

  async function onSubmit(formData: FormData) {
    formData.set("id", teacher.id);
    formData.set("position", position);
    formData.set("groupId", groupId);
    formData.set("replaceExisting", slotHolder != null ? "true" : "false");
    const res = await run(() => updateTeacherAction(locale, formData), "Сақталды");
    if (res.ok) {
      setSlotHolder(null);
      setOpen(false);
    } else if (res.error === "slot_taken") {
      setSlotHolder(res.detail || "басқа қызметкер");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSlotHolder(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1" />}>
        <Pencil className="size-3.5" />
        Өңдеу
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Қызметкерді өңдеу</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field id={`t-name-${teacher.id}`} label="Аты-жөні">
            <Input id={`t-name-${teacher.id}`} name="displayName" defaultValue={teacher.displayName} required minLength={2} maxLength={80} />
          </Field>
          <Field id={`t-email-${teacher.id}`} label="Email (кіру логині)">
            <Input id={`t-email-${teacher.id}`} name="email" type="email" defaultValue={teacher.email ?? ""} required />
          </Field>
          <Field id={`t-pos-${teacher.id}`} label="Рөлі">
            <Select
              value={position}
              onValueChange={(v) => {
                if (v === "main" || v === "assistant") setPosition(v);
                setSlotHolder(null);
              }}
            >
              <SelectTrigger id={`t-pos-${teacher.id}`} className="w-full">
                <SelectValue>{(v: string) => (v === "assistant" ? "Педагог-ассистент" : "Тәрбиеші")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Тәрбиеші</SelectItem>
                <SelectItem value="assistant">Педагог-ассистент</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id={`t-group-${teacher.id}`} label="Тобы">
            <GroupSelect
              groups={groups}
              value={groupId}
              onChange={(v) => {
                setGroupId(v);
                setSlotHolder(null);
              }}
            />
          </Field>
          {slotHolder != null && (
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Бұл топта «{position === "main" ? "Тәрбиеші" : "Педагог-ассистент"}» орны бос емес: <b>{slotHolder}</b>. Қайта
              «Сақтау» басылса, ол осы топтан босатылады.
            </p>
          )}
          <DialogButtons pending={pending} submitLabel={slotHolder != null ? "Ауыстырып сақтау" : "Сақтау"} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Child ────────────────────────────────────────────────────────────

export function EditChildDialog({ locale, child, groups }: { locale: string; child: ManagedChild; groups: GroupOption[] }) {
  const [open, setOpen] = React.useState(false);
  const [groupId, setGroupId] = React.useState<string>(child.groupId ?? NO_GROUP);
  const { pending, run } = useAction();

  async function onSubmit(formData: FormData) {
    formData.set("id", child.id);
    formData.set("groupId", groupId);
    const res = await run(() => updateChildAction(locale, formData), "Сақталды");
    if (res.ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1" />}>
        <Pencil className="size-3.5" />
        Өңдеу
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Баланы өңдеу</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field id={`c-name-${child.id}`} label="Аты-жөні">
            <Input id={`c-name-${child.id}`} name="displayName" defaultValue={child.displayName} required minLength={2} maxLength={80} />
          </Field>
          <Field id={`c-code-${child.id}`} label="Кіру коды">
            <Input
              id={`c-code-${child.id}`}
              name="loginCode"
              defaultValue={child.loginCode ?? ""}
              required
              pattern="[A-Za-z0-9\-]{3,40}"
              className="font-mono"
            />
          </Field>
          <Field id={`c-group-${child.id}`} label="Тобы">
            <GroupSelect groups={groups} value={groupId} onChange={setGroupId} />
          </Field>
          <Field id={`c-pin-${child.id}`} label="Жаңа PIN (міндетті емес, 4–6 сан)">
            <Input
              id={`c-pin-${child.id}`}
              name="pin"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              autoComplete="off"
              placeholder="Өзгертпеу үшін бос қалдырыңыз"
            />
          </Field>
          <DialogButtons pending={pending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveChildDialog({ locale, child, groups }: { locale: string; child: ManagedChild; groups: GroupOption[] }) {
  const [open, setOpen] = React.useState(false);
  const [groupId, setGroupId] = React.useState<string>(child.groupId ?? "");
  const { pending, run } = useAction();

  async function onSubmit() {
    if (!groupId) {
      toast.error("Топты таңдаңыз");
      return;
    }
    const res = await run(() => moveChildAction(locale, child.id, groupId), "Тобы ауыстырылды");
    if (res.ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" className="gap-1" />}>
        <Users className="size-3.5" />
        Топты өзгерту
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{child.displayName} — топты өзгерту</DialogTitle>
          <DialogDescription>Баланың XP, ойындары мен зерттеулері өзгеріссіз сақталады.</DialogDescription>
        </DialogHeader>
        <GroupSelect groups={groups} value={groupId} onChange={setGroupId} allowNone={false} />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Бас тарту</DialogClose>
          <Button type="button" disabled={pending} onClick={onSubmit}>
            Ауыстыру
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Parent ───────────────────────────────────────────────────────────

export function EditParentDialog({ locale, parent }: { locale: string; parent: ManagedParent }) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();

  async function onSubmit(formData: FormData) {
    formData.set("id", parent.id);
    const res = await run(() => updateParentAction(locale, formData), "Сақталды");
    if (res.ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1" />}>
        <Pencil className="size-3.5" />
        Өңдеу
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ата-ананы өңдеу</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field id={`p-name-${parent.id}`} label="Аты-жөні">
            <Input id={`p-name-${parent.id}`} name="displayName" defaultValue={parent.displayName} required minLength={2} maxLength={80} />
          </Field>
          <Field id={`p-email-${parent.id}`} label="Email (кіру логині)">
            <Input id={`p-email-${parent.id}`} name="email" type="email" defaultValue={parent.email ?? ""} required />
          </Field>
          <Field id={`p-phone-${parent.id}`} label="Телефон">
            <Input id={`p-phone-${parent.id}`} name="phone" type="tel" defaultValue={parent.phone ?? ""} maxLength={30} />
          </Field>
          <DialogButtons pending={pending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ParentLinksDialog({
  locale,
  parent,
  linkable,
}: {
  locale: string;
  parent: ManagedParent;
  linkable: { id: string; displayName: string; groupName: string | null }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [childId, setChildId] = React.useState("");
  const [confirmUnlink, setConfirmUnlink] = React.useState<string | null>(null);
  const { pending, run } = useAction();
  const linkedIds = new Set(parent.children.map((c) => c.id));
  const candidates = linkable.filter((c) => !linkedIds.has(c.id));

  async function link() {
    if (!childId) {
      toast.error("Баланы таңдаңыз");
      return;
    }
    const res = await run(() => setParentLinkAction(locale, parent.id, childId, true), "Байланыстырылды");
    if (res.ok) setChildId("");
  }

  async function unlink(id: string) {
    const res = await run(() => setParentLinkAction(locale, parent.id, id, false), "Байланыс ажыратылды");
    if (res.ok) setConfirmUnlink(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirmUnlink(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="ghost" className="gap-1" />}>
        <Link2 className="size-3.5" />
        Балалары
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parent.displayName} — балалары</DialogTitle>
          <DialogDescription>
            Байланысты ажыратқан сәттен бастап ата-ана сол баланың деректерін, суреттері мен сертификаттарын көре алмайды.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {parent.children.length === 0 && <p className="text-sm text-muted-foreground">Байланысқан бала жоқ.</p>}
          {parent.children.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
              <span className="text-sm font-medium">{c.displayName}</span>
              {confirmUnlink === c.id ? (
                <span className="flex items-center gap-1">
                  <Button size="sm" variant="destructive" disabled={pending} onClick={() => unlink(c.id)}>
                    Иә, ажырату
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmUnlink(null)}>
                    Жоқ
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => setConfirmUnlink(c.id)}>
                  <Unlink className="size-3.5" />
                  Ажырату
                </Button>
              )}
            </div>
          ))}
        </div>

        {!parent.archivedAt && (
          <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
            <Label>Баламен байланыстыру</Label>
            <Select value={childId} onValueChange={(v) => v && setChildId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => {
                    const c = candidates.find((x) => x.id === v);
                    return c ? `${c.displayName}${c.groupName ? ` · ${c.groupName}` : ""}` : "Баланы таңдаңыз";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                    {c.groupName ? ` · ${c.groupName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" disabled={pending || !childId} onClick={link} className="self-end">
              Байланыстыру
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
