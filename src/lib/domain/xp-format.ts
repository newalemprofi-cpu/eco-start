import { levelProgressPercent, xpNeededForNextLevel } from "@/lib/domain/xp";

/** UI-facing formatting on top of the pure xp.ts rules — kept separate
 * so the domain rules stay framework/format free. */
export function levelIntoCurrentLevelLabel(xp: number) {
  return {
    progressPercent: levelProgressPercent(xp),
    xpToNext: xpNeededForNextLevel(xp),
    xpLabel: `${xpNeededForNextLevel(xp)} XP`,
  };
}
