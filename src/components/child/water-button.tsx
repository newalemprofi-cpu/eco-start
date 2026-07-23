"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Droplets, Loader2 } from "lucide-react";
import { markWateredAction } from "@/app/[locale]/app/child/greenhouse/actions";
import { Button } from "@/components/ui/button";

export function WaterButton({
  locale,
  entryId,
  label,
}: {
  locale: string;
  entryId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await markWateredAction(locale, entryId);
        setPending(false);
        router.refresh();
      }}
      className="gap-1.5"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Droplets className="size-3.5" />}
      {label}
    </Button>
  );
}
