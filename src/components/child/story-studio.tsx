"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Film, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  generateStoryAction,
  generateStoryboardAction,
  saveStoryProjectAction,
} from "@/app/[locale]/app/child/studio/actions";
import type { StoryboardOutput, StoryOutput } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function StoryStudio({ locale }: { locale: string }) {
  const router = useRouter();
  const [topic, setTopic] = React.useState("");
  const [story, setStory] = React.useState<StoryOutput | null>(null);
  const [storyboard, setStoryboard] = React.useState<StoryboardOutput | null>(null);
  const [isMock, setIsMock] = React.useState(false);
  const [loading, setLoading] = React.useState<"story" | "storyboard" | "save" | null>(null);

  async function onGenerateStory(e: React.FormEvent) {
    e.preventDefault();
    setLoading("story");
    setStoryboard(null);
    const res = await generateStoryAction(locale, topic);
    setLoading(null);
    if (res.ok) {
      setStory(res.story);
      setIsMock(res.isMock);
    } else {
      toast.error(res.error);
    }
  }

  async function onGenerateStoryboard() {
    if (!story) return;
    setLoading("storyboard");
    const res = await generateStoryboardAction(locale, story.paragraphs.join(" "));
    setLoading(null);
    if (res.ok) {
      setStoryboard(res.storyboard);
    } else {
      toast.error(res.error);
    }
  }

  async function onSave() {
    if (!story) return;
    setLoading("save");
    await saveStoryProjectAction(locale, { title: story.title, story, storyboard, isMock });
    setLoading(null);
    toast.success("✓");
    router.refresh();
    setStory(null);
    setStoryboard(null);
    setTopic("");
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex flex-col gap-4 pt-2">
        <form onSubmit={onGenerateStory} className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Орман, өзен, көбелек..."
            required
          />
          <Button type="submit" disabled={loading === "story"} className="shrink-0 gap-1.5">
            {loading === "story" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Story
          </Button>
        </form>

        {story && (
          <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
            <h3 className="font-heading font-bold">{story.title}</h3>
            <div className="mt-2 flex flex-col gap-1.5 text-sm">
              {story.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading === "storyboard"}
                onClick={onGenerateStoryboard}
                className="gap-1.5"
              >
                {loading === "storyboard" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Clapperboard className="size-3.5" />
                )}
                Storyboard
              </Button>
              <Button size="sm" disabled={loading === "save"} onClick={onSave} className="gap-1.5">
                {loading === "save" && <Loader2 className="size-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        )}

        {storyboard && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {storyboard.scenes.map((scene) => (
              <div key={scene.scene} className="rounded-xl border border-border/60 bg-card p-3 text-xs">
                <div className="mb-1 flex items-center gap-1.5 font-semibold">
                  <Film className="size-3.5 text-module-media" />
                  Scene {scene.scene}
                </div>
                <p className="text-muted-foreground">{scene.description}</p>
                <p className="mt-1 italic">&ldquo;{scene.narration}&rdquo;</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
