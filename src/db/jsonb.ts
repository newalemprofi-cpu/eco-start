// Until this fix, several repos wrote jsonb columns as
// `${JSON.stringify(value)}`. postgres.js already JSON-encodes a
// parameter bound to a jsonb column, so those rows were stored
// double-encoded: a jsonb *string* holding JSON text instead of an
// object (lesson_artifacts.content, recognitions.ai_summary,
// media_assets.storyboard, chat_messages.safety_flags). Writes now use
// `sql.json(...)` (see cms-core.ts for the same gotcha); these helpers
// let reads understand both shapes, so existing rows display correctly
// without rewriting any production data.

/** JS side: unwrap a value that may be a double-encoded JSON string. */
export function readJsonb<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

/** SQL side: the same unwrap, for `->>` access inside queries.
 * `column` must be a trusted, hard-coded column reference. */
export function jsonbObjectSql(column: string): string {
  return `(case jsonb_typeof(${column}) when 'string' then (${column} #>> '{}')::jsonb else ${column} end)`;
}
