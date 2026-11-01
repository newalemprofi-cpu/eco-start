import { z } from "zod";
import { MODULE_KEYS } from "@/lib/marketing/module-info";

// Shape of public_platform_stats() (0014 migration). Parsed strictly:
// anything unexpected → null → the page says "статистика қолжетімсіз"
// instead of rendering a guessed number.
const usage = z.object({
  actions: z.coerce.number().int().min(0),
  users: z.coerce.number().int().min(0),
  actions30d: z.coerce.number().int().min(0),
});

const modulesShape = Object.fromEntries(MODULE_KEYS.map((k) => [k, usage])) as Record<
  (typeof MODULE_KEYS)[number],
  typeof usage
>;

export const PublicStatsSchema = z.object({
  kindergartens: z.coerce.number().int().min(0),
  children: z.coerce.number().int().min(0),
  teachers: z.coerce.number().int().min(0),
  parents: z.coerce.number().int().min(0),
  modules: z.object(modulesShape),
});
export type PublicStats = z.infer<typeof PublicStatsSchema>;

export function parsePublicStats(raw: unknown): PublicStats | null {
  const parsed = PublicStatsSchema.safeParse(typeof raw === "string" ? safeJson(raw) : raw);
  return parsed.success ? parsed.data : null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A real zero is shown as "әлі жоқ" rather than a bare 0, and never
 * replaced by a made-up number. */
export function formatStat(value: number): string {
  return value > 0 ? value.toLocaleString("kk-KZ") : "әлі жоқ";
}
