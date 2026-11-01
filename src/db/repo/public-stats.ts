import "server-only";
import { withSystemContext } from "@/db/client";
import { parsePublicStats, type PublicStats } from "@/lib/marketing/public-stats";

/**
 * Anonymous homepage statistics. Goes through the single aggregate
 * security-definer function public_platform_stats() (0014 migration) —
 * the anonymous request has no tenant context, so it cannot read any
 * table directly, and no admin query/endpoint is reused here.
 *
 * Returns null when the function isn't there yet (migration not
 * applied) or returns something unexpected, so the page degrades to
 * "қолжетімсіз" instead of erroring or inventing numbers.
 */
export async function getPublicPlatformStats(): Promise<PublicStats | null> {
  try {
    const rows = await withSystemContext(
      (sql) => sql<{ stats: unknown }[]>`select public_platform_stats() as stats`
    );
    return parsePublicStats(rows[0]?.stats);
  } catch {
    return null;
  }
}
