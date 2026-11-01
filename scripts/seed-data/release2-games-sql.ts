import { RELEASE2_GAMES, type Release2Game } from "./release2-games";

/**
 * Renders the Release 2 games as the idempotent INSERT that lives in
 * src/db/migrations/0016_release2_users_games.sql (between the
 * GENERATED markers). Regenerate with:
 *   npx tsx scripts/gen-release2-games-sql.ts
 * release2-games.test.ts fails if the migration and the catalog drift.
 *
 * JSON goes in dollar-quoted literals so no escaping is needed; `on
 * conflict (key) do nothing` means a re-run never overwrites a game an
 * operator may have edited since.
 */
export const GENERATED_BEGIN = "-- BEGIN GENERATED: release2 games (scripts/seed-data/release2-games.ts)";
export const GENERATED_END = "-- END GENERATED: release2 games";

function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function json(value: unknown): string {
  const text = JSON.stringify(value);
  if (text.includes("$j$")) throw new Error("catalog JSON must not contain $j$");
  return `$j$${text}$j$::jsonb`;
}

function row(g: Release2Game): string {
  return [
    `(${lit(g.key)}, ${json(g.title)}, ${json(g.description)},`,
    `  ${json(g.config)},`,
    `  ${lit(g.icon)}, ${lit(g.color)}, ${lit(g.difficulty)}, ${g.ageMin}, ${g.ageMax}, ${g.xpReward}, null, ${lit(g.template)}, ${g.order},`,
    `  ${lit(`{${g.ageCategories.join(",")}}`)}::group_age_category[])`,
  ].join("\n");
}

export function release2GamesSql(games: Release2Game[] = RELEASE2_GAMES): string {
  return [
    GENERATED_BEGIN,
    "insert into games (key, title, description, config, icon, color, difficulty, age_min, age_max, xp_reward, badge_key, template, display_order, age_categories)",
    "values",
    games.map(row).join(",\n"),
    "on conflict (key) do nothing;",
    GENERATED_END,
  ].join("\n");
}
