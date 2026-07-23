"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, EyeOff, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  createNewsAction,
  deleteNewsAction,
  publishNewsAction,
  reorderNewsAction,
  saveNewsAction,
  unpublishNewsAction,
  uploadNewsMediaAction,
} from "@/app/[locale]/app/super-admin/news/actions";
import type { NewsItemRow } from "@/db/repo/news";
import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/news-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORY_LABEL: Record<NewsCategory, string> = {
  events: "Іс-шаралар",
  eco_projects: "Эко жобалар",
  child_achievements: "Балалардың жетістіктері",
  teacher_news: "Тәрбиешілер жаңалығы",
  for_parents: "Ата-аналарға",
  announcements: "Хабарландырулар",
};

/**
 * Free-form list like BannersEditor (admin creates/deletes items, no
 * fixed enum) — same group_id identity + resync-on-refresh pattern, see
 * banners-editor.tsx's comment for why the effect below is needed.
 */
export function NewsEditor({ initial, locale }: { initial: NewsItemRow[]; locale: string }) {
  const router = useRouter();
  const [items, setItems] = React.useState(
    [...initial].sort((a, b) => a.display_order - b.display_order)
  );
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([...initial].sort((a, b) => a.display_order - b.display_order));
  }, [initial]);

  function updateItem(groupId: string, next: NewsItemRow) {
    setItems((prev) => prev.map((n) => (n.group_id === groupId ? next : n)));
  }

  function removeItem(groupId: string) {
    setItems((prev) => prev.filter((n) => n.group_id !== groupId));
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setItems(next);
    await reorderNewsAction(locale, next.map((n) => n.group_id));
  }

  async function onAdd() {
    setCreating(true);
    const res = await createNewsAction(locale);
    setCreating(false);
    if (res.ok) {
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        «Басты бетте көрсету» қосулы әрі жарияланған жаңалықтар бастапқы беттегі каруселде
        реті бойынша көрінеді.
      </p>
      {items.map((item, i) => (
        <NewsCard
          key={item.group_id}
          item={item}
          locale={locale}
          onChange={(next) => updateItem(item.group_id, next)}
          onDeleted={() => removeItem(item.group_id)}
          onMoveUp={i > 0 ? () => move(i, -1) : undefined}
          onMoveDown={i < items.length - 1 ? () => move(i, 1) : undefined}
        />
      ))}
      <Button variant="outline" onClick={onAdd} disabled={creating} className="w-fit">
        {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Жаңа жаңалық қосу
      </Button>
    </div>
  );
}

function NewsCard({
  item,
  locale,
  onChange,
  onDeleted,
  onMoveUp,
  onMoveDown,
}: {
  item: NewsItemRow;
  locale: string;
  onChange: (next: NewsItemRow) => void;
  onDeleted: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(item);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [unpublishing, setUnpublishing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  function patch<K extends keyof NewsItemRow>(key: K, value: NewsItemRow[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    onChange(next);
  }

  function addGalleryImage(url: string) {
    patch("gallery_urls", [...form.gallery_urls, url]);
  }

  function removeGalleryImage(url: string) {
    patch(
      "gallery_urls",
      form.gallery_urls.filter((u) => u !== url)
    );
  }

  async function onSave() {
    setSaving(true);
    const res = await saveNewsAction(locale, form.group_id, form);
    setSaving(false);
    if (res.ok) {
      toast.success("Жоба нұсқасы сақталды");
      router.refresh();
    } else toast.error(res.error);
  }

  async function onPublish() {
    setPublishing(true);
    const res = await publishNewsAction(locale, form.group_id);
    setPublishing(false);
    if (res.ok) {
      toast.success("Жарияланды");
      router.refresh();
    } else toast.error(res.error);
  }

  async function onUnpublish() {
    setUnpublishing(true);
    const res = await unpublishNewsAction(locale, form.group_id);
    setUnpublishing(false);
    if (res.ok) {
      toast.success("Жариялау тоқтатылды");
      router.refresh();
    } else toast.error(res.error);
  }

  async function onDelete() {
    if (!confirm("Бұл жаңалықты толық жою керек пе? Бұл әрекетті қайтару мүмкін емес.")) return;
    setDeleting(true);
    const res = await deleteNewsAction(locale, form.group_id);
    setDeleting(false);
    if (res.ok) {
      toast.success("Жаңалық жойылды");
      onDeleted();
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <Card className="border-border/60 shadow-sm" data-testid={`news-card-${form.group_id}`}>
      <CardContent className="flex flex-col gap-4 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <button type="button" onClick={onMoveUp} disabled={!onMoveUp} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" onClick={onMoveDown} disabled={!onMoveDown} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            <div>
              <h3 className="font-heading text-base font-bold">{form.title || "(тақырыпсыз жаңалық)"}</h3>
              <p className="text-xs text-muted-foreground">/news/{form.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor={`featured-${form.group_id}`} className="text-sm">Басты бетте</Label>
              <Switch
                id={`featured-${form.group_id}`}
                checked={form.featured_home}
                onCheckedChange={(checked) => patch("featured_home", !!checked)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`enabled-${form.group_id}`} className="text-sm">Қосулы</Label>
              <Switch
                id={`enabled-${form.group_id}`}
                checked={form.enabled}
                onCheckedChange={(checked) => patch("enabled", !!checked)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`title-${form.group_id}`}>Тақырып</Label>
            <Input id={`title-${form.group_id}`} value={form.title} onChange={(e) => patch("title", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`slug-${form.group_id}`}>Slug (URL бөлігі)</Label>
            <Input id={`slug-${form.group_id}`} value={form.slug} onChange={(e) => patch("slug", e.target.value)} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`excerpt-${form.group_id}`}>Қысқаша сипаттама</Label>
          <Textarea
            id={`excerpt-${form.group_id}`}
            rows={2}
            value={form.excerpt}
            onChange={(e) => patch("excerpt", e.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`body-${form.group_id}`}>Толық мәтін</Label>
          <Textarea
            id={`body-${form.group_id}`}
            rows={6}
            value={form.body}
            onChange={(e) => patch("body", e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`author-${form.group_id}`}>Автор</Label>
            <Input id={`author-${form.group_id}`} value={form.author} onChange={(e) => patch("author", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Санат</Label>
            <Select value={form.category} onValueChange={(v) => v && patch("category", v as NewsItemRow["category"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NEWS_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`date-${form.group_id}`}>Жарияланған күні</Label>
            <Input
              id={`date-${form.group_id}`}
              type="datetime-local"
              value={form.display_date ? form.display_date.slice(0, 16) : ""}
              onChange={(e) => patch("display_date", e.target.value ? new Date(e.target.value).toISOString() : form.display_date)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Негізгі сурет</Label>
            <div className="flex items-center gap-2">
              {form.main_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.main_image_url} alt="" className="size-14 shrink-0 rounded-lg border border-border/60 object-cover" />
              )}
              <NewsUploadLabel locale={locale} label="Сурет жүктеу" onUploaded={(url) => patch("main_image_url", url)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Қосымша суреттер</Label>
            <div className="flex flex-wrap items-center gap-2">
              {form.gallery_urls.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-14 rounded-lg border border-border/60 object-cover" />
                  <button
                    type="button"
                    onClick={() => removeGalleryImage(url)}
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <GalleryUploadButton locale={locale} onUploaded={addGalleryImage} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Жоба нұсқасын сақтау
          </Button>
          <Button size="sm" onClick={onPublish} disabled={publishing}>
            {publishing && <Loader2 className="size-4 animate-spin" />}
            Жариялау
          </Button>
          <Button variant="outline" size="sm" onClick={onUnpublish} disabled={unpublishing}>
            {unpublishing ? <Loader2 className="size-4 animate-spin" /> : <EyeOff className="size-4" />}
            Жариялауды тоқтату
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={deleting} className="ml-auto text-destructive hover:text-destructive">
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Жою
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Single-image upload label (main image) — a small news-specific
 * counterpart to the homepage CMS's MediaUploadButton, which is
 * hard-wired to the homepage-design upload action and can't take a
 * news "kind". */
function NewsUploadLabel({
  locale,
  label,
  onUploaded,
}: {
  locale: string;
  label: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);

  async function handle(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadNewsMediaAction(locale, fd);
    setUploading(false);
    if (res.ok && res.url) {
      onUploaded(res.url);
    } else {
      toast.error(!res.ok ? res.error : "Жүктеу сәтсіз аяқталды");
    }
  }

  return (
    <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground">
      {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
      {uploading ? "Жүктелуде..." : label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handle(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function GalleryUploadButton({ locale, onUploaded }: { locale: string; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = React.useState(false);

  async function handle(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadNewsMediaAction(locale, fd);
    setUploading(false);
    if (res.ok && res.url) {
      onUploaded(res.url);
    } else {
      toast.error(!res.ok ? res.error : "Жүктеу сәтсіз аяқталды");
    }
  }

  return (
    <label className="flex size-14 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground">
      {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handle(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}
