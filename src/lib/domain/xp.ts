/**
 * Pure XP/leveling rules shared by every module that awards XP
 * (EcoGame, EcoLab, Greenhouse, Research, Lessons). Kept dependency-free
 * so it's trivially unit-testable — see src/lib/domain/xp.test.ts.
 */

const XP_PER_LEVEL = 100;

export function levelForXp(xp: number): number {
  if (xp < 0) return 1;
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpIntoCurrentLevel(xp: number): number {
  if (xp < 0) return 0;
  return xp % XP_PER_LEVEL;
}

export function xpNeededForNextLevel(xp: number): number {
  return XP_PER_LEVEL - xpIntoCurrentLevel(xp);
}

export function levelProgressPercent(xp: number): number {
  return Math.round((xpIntoCurrentLevel(xp) / XP_PER_LEVEL) * 100);
}

export type LevelUpResult = {
  newXp: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
};

export function applyXpGain(currentXp: number, gained: number): LevelUpResult {
  const previousLevel = levelForXp(currentXp);
  const newXp = Math.max(0, currentXp + gained);
  const newLevel = levelForXp(newXp);
  return { newXp, previousLevel, newLevel, leveledUp: newLevel > previousLevel };
}
