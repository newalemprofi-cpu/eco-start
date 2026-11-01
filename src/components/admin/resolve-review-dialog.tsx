"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resolveChildGroupAction } from "@/app/[locale]/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ResolveReviewDialog({
  locale,
  childId,
  displayName,
  candidateGroupCodes,
  groups,
}: {
  locale: string;
  childId: string;
  displayName: string;
  candidateGroupCodes: string[];
  groups: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [groupId, setGroupId] = React.useState<string>("");

  const candidates = groups.filter((g) => candidateGroupCodes.includes(g.code));
  const others = groups.filter((g) => !candidateGroupCodes.includes(g.code));

  async function onSubmit() {
    if (!groupId) {
      toast.error("Топты таңдаңыз");
      return;
    }
    setPending(true);
    const res = await resolveChildGroupAction(locale, childId, groupId);
    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Сақтау мүмкін болмады");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Топты таңдау</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{displayName} — тобын растау</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Бұл бала Excel-де екі топта қатар кездесті. Дұрыс топты таңдап растаңыз.
        </p>
        <Select value={groupId} onValueChange={(v) => v && setGroupId(v)}>
          <SelectTrigger className="w-full">
            {/* base-ui renders the raw value (a uuid) unless given a label function */}
            <SelectValue>
              {(v: string) => {
                const g = groups.find((x) => x.id === v);
                return g ? `${g.name} (${g.code})` : "Топты таңдаңыз";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {candidates.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name} (ұсынылған)
              </SelectItem>
            ))}
            {others.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Бас тарту</DialogClose>
          <Button type="button" disabled={pending} onClick={onSubmit}>
            Растау
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
