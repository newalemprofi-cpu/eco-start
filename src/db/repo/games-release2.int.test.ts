import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "@/test/fixtures";
import { getGameByKey, listGames, recordGameRoundWithXp } from "@/db/repo/games";
import { pool } from "@/db/client";
import { RELEASE2_GAMES } from "../../../scripts/seed-data/release2-games";
import { scoreClickTarget } from "@/lib/domain/game-templates/click-target";
import { computeScore, type ClickTargetConfig, type GameResult } from "@/lib/domain/game-templates/types";

// Release 2 games against the real DB (migration 0016 rows): every one
// of the ten saves its result; XP is paid once per game, also when two
// rounds are submitted at the same instant.

let f: Fixture;

/** A finished round for any template: what the scorer would return for
 * `correct` out of `total`. The scorers themselves are covered by
 * scripts/seed-data/release2-games.test.ts. */
function round(correct: number, total: number, xpReward: number): GameResult {
  const { score, xpEarned } = computeScore(correct, total, xpReward);
  return { score, xpEarned, correctCount: correct, totalCount: total, perItem: [] };
}

async function childXp(id: string) {
  return (await f.owner<{ xp: number }[]>`select xp from users where id = ${id}`)[0].xp;
}

beforeAll(async () => {
  f = await createFixture();
});

afterAll(async () => {
  await f.owner.end();
  await pool.end();
});

describe("Release 2 games", () => {
  it("all ten are installed with their age groups", async () => {
    const rows = await f.owner<{ key: string; ageCategories: string }[]>`
      select key, age_categories::text as "ageCategories" from games where key like 'r2-%' order by display_order
    `;
    expect(rows.map((r) => r.key)).toEqual(RELEASE2_GAMES.map((g) => g.key));
    for (const g of RELEASE2_GAMES) {
      expect(rows.find((r) => r.key === g.key)?.ageCategories).toBe(`{${g.ageCategories.join(",")}}`);
    }
  });

  it("a 3–4 group child sees the four 3–4 games and not the 5–6 ones", async () => {
    const keys = (await listGames(f.childB)).map((g) => g.key); // childB is in ORTA-01 (MIDDLE_3)
    for (const g of RELEASE2_GAMES) {
      expect(keys.includes(g.key), g.key).toBe(g.ageCategories.includes("MIDDLE_3"));
    }
  });

  it("each of the ten saves its result and pays its XP exactly once", async () => {
    for (const g of RELEASE2_GAMES) {
      const game = await getGameByKey(f.childA, g.key);
      expect(game, g.key).not.toBeNull();
      const before = await childXp(f.childA.userId);

      const first = await recordGameRoundWithXp(f.childA, game!.id, round(4, 4, game!.xpReward), game!.xpReward);
      expect(first.xpAwarded, g.key).toBe(g.xpReward);
      const replay = await recordGameRoundWithXp(f.childA, game!.id, round(4, 4, game!.xpReward), game!.xpReward);
      expect(replay.xpAwarded, g.key).toBe(0);

      expect(await childXp(f.childA.userId), g.key).toBe(before + g.xpReward);
      const [{ n }] = await f.owner<{ n: number }[]>`
        select count(*)::int as n from game_sessions where child_id = ${f.childA.userId} and game_id = ${game!.id}
      `;
      expect(n, g.key).toBe(2); // both rounds are in the history
    }
  });

  it("an improved score pays only the difference", async () => {
    const game = (await getGameByKey(f.childA2, "r2-find-colors"))!;
    const before = await childXp(f.childA2.userId);
    const half = await recordGameRoundWithXp(f.childA2, game.id, round(2, 4, game.xpReward), game.xpReward);
    const full = await recordGameRoundWithXp(f.childA2, game.id, round(4, 4, game.xpReward), game.xpReward);
    expect(half.xpAwarded + full.xpAwarded).toBe(game.xpReward);
    expect(await childXp(f.childA2.userId)).toBe(before + game.xpReward);
  });

  it("two rounds submitted at the same moment are not both paid", async () => {
    const game = (await getGameByKey(f.childB, "r2-nature-explorer"))!;
    const before = await childXp(f.childB.userId);
    const perfect = scoreClickTarget(
      game.config as ClickTargetConfig,
      (game.config as ClickTargetConfig).rounds.map((r) => ({ roundId: r.id, selectedItemIds: r.items.filter((i) => i.isTarget).map((i) => i.id) })),
      game.xpReward
    );
    const results = await Promise.all([
      recordGameRoundWithXp(f.childB, game.id, perfect, game.xpReward),
      recordGameRoundWithXp(f.childB, game.id, perfect, game.xpReward),
      recordGameRoundWithXp(f.childB, game.id, perfect, game.xpReward),
    ]);
    expect(results.reduce((s, r) => s + r.xpAwarded, 0)).toBe(game.xpReward);
    expect(await childXp(f.childB.userId)).toBe(before + game.xpReward);
  });
});
