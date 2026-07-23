"use client";

import { useRouter } from "next/navigation";
import { setMediaStatusAction } from "@/app/[locale]/app/admin/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["private", "shared_family", "shared_school"] as const;
const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  private: "Жеке",
  shared_family: "Отбасымен бөлісілген",
  shared_school: "Бөбекжаймен бөлісілген",
};

export function MediaStatusSelect({
  locale,
  mediaId,
  status,
}: {
  locale: string;
  mediaId: string;
  status: string;
}) {
  const router = useRouter();

  return (
    <Select
      defaultValue={status}
      onValueChange={async (value) => {
        await setMediaStatusAction(locale, mediaId, value as (typeof STATUSES)[number]);
        router.refresh();
      }}
    >
      <SelectTrigger className="h-8 w-40 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
