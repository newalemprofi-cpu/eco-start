/**
 * Prints the generated games block for migration 0016 (see
 * scripts/seed-data/release2-games-sql.ts). Paste the output between
 * the GENERATED markers in src/db/migrations/0016_release2_users_games.sql.
 * Read-only: touches no database.
 */
import { release2GamesSql } from "./seed-data/release2-games-sql";

console.log(release2GamesSql());
