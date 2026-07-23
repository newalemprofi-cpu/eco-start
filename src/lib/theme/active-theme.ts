import "server-only";
import { cache } from "react";
import { getPublishedBrand, getPublishedTheme } from "@/db/repo/cms";
import type { BrandSettingsRow, ThemeSettingsRow } from "@/db/repo/cms";

/**
 * These mirror the DB column defaults in
 * src/db/migrations/0006_cms.sql exactly, so a database hiccup (or a
 * fresh install that hasn't run scripts/seed.ts yet) degrades to the
 * platform's original hand-tuned palette instead of a broken page —
 * the CMS is additive, never a single point of failure for rendering.
 */
const FALLBACK_THEME: Omit<ThemeSettingsRow, "id" | "status" | "version" | "updated_at" | "published_at"> = {
  color_primary: "oklch(0.52 0.13 152)",
  color_secondary: "oklch(0.94 0.03 200)",
  color_accent: "oklch(0.55 0.13 220)",
  color_background: "oklch(0.99 0.006 145)",
  color_card: "oklch(1 0 0)",
  color_foreground: "oklch(0.22 0.03 155)",
  color_muted_foreground: "oklch(0.48 0.03 155)",
  color_success: "oklch(0.6 0.15 152)",
  color_warning: "oklch(0.78 0.15 80)",
  color_danger: "oklch(0.6 0.21 26)",
  radius: "1rem",
  button_radius: "0.75rem",
  card_shadow: "soft",
  font_family: "Nunito",
  heading_font: "Comfortaa",
  body_font: "Nunito",
  illustration_style: "friendly-nature",
};

const FALLBACK_BRAND: Omit<
  BrandSettingsRow,
  "id" | "status" | "version" | "updated_at" | "published_at"
> = {
  site_name: "Эко Start",
  short_name: "Эко Start",
  logo_url: null,
  logo_dark_url: null,
  favicon_url: null,
  footer_logo_url: null,
};

export type ActiveTheme = typeof FALLBACK_THEME;
export type ActiveBrand = typeof FALLBACK_BRAND;

export const getActiveTheme = cache(async (): Promise<ActiveTheme> => {
  try {
    const row = await getPublishedTheme();
    if (!row) return FALLBACK_THEME;
    const { id: _id, status: _s, version: _v, updated_at: _u, published_at: _p, ...rest } = row;
    void _id;
    void _s;
    void _v;
    void _u;
    void _p;
    return rest;
  } catch {
    return FALLBACK_THEME;
  }
});

export const getActiveBrand = cache(async (): Promise<ActiveBrand> => {
  try {
    const row = await getPublishedBrand();
    if (!row) return FALLBACK_BRAND;
    const { id: _id, status: _s, version: _v, updated_at: _u, published_at: _p, ...rest } = row;
    void _id;
    void _s;
    void _v;
    void _u;
    void _p;
    return rest;
  } catch {
    return FALLBACK_BRAND;
  }
});

const SHADOW_PRESETS: Record<string, string> = {
  none: "none",
  soft: "0 1px 2px rgba(16, 24, 20, 0.06), 0 1px 3px rgba(16, 24, 20, 0.08)",
  medium: "0 2px 6px rgba(16, 24, 20, 0.08), 0 4px 10px rgba(16, 24, 20, 0.10)",
  strong: "0 4px 12px rgba(16, 24, 20, 0.12), 0 8px 24px rgba(16, 24, 20, 0.14)",
};

/** Builds the `:root` CSS-variable override block injected by the root layout. Light mode only — see docs/ARCHITECTURE.md "CMS theme scope". */
export function themeToCss(theme: ActiveTheme): string {
  const shadow = SHADOW_PRESETS[theme.card_shadow] ?? SHADOW_PRESETS.soft;
  return `:root{
  --primary:${theme.color_primary};
  --secondary:${theme.color_secondary};
  --accent:${theme.color_accent};
  --background:${theme.color_background};
  --card:${theme.color_card};
  --foreground:${theme.color_foreground};
  --muted-foreground:${theme.color_muted_foreground};
  --success:${theme.color_success};
  --warning:${theme.color_warning};
  --destructive:${theme.color_danger};
  --danger:${theme.color_danger};
  --radius:${theme.radius};
  --button-radius:${theme.button_radius};
  --card-shadow:${shadow};
}`;
}
