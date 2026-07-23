"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getGameIdByKey, recordGameSession } from "@/db/repo/games";
import { awardXp } from "@/db/repo/xp";
import { scoreWasteSortingAttempt, type WasteSortingAnswer } from "@/lib/domain/waste-sorting";
import { z } from "zod";

const answerSchema = z.object({
  itemId: z.string().min(1),
  chosenBin: z.enum(["paper", "plastic", "glass", "organic"]),
});
const submitSchema = z.array(answerSchema).min(1).max(20);

export async function submitWasteSortingRound(locale: string, rawAnswers: WasteSortingAnswer[]) {
  const session = await requireRole("CHILD");
  const parsed = submitSchema.safeParse(rawAnswers);
  if (!parsed.success) {
    return { ok: false as const, error: "validation" };
  }

  const ctx = toTenantContext(session);
  // Scoring is always recomputed here from the canonical catalog — a
  // tampered client request can change what it *claims* is correct,
  // but never what actually earns points or XP.
  const result = scoreWasteSortingAttempt(parsed.data);

  const gameId = await getGameIdByKey(ctx, "waste_sorting");
  if (!gameId) return { ok: false as const, error: "game_not_found" };

  await recordGameSession(ctx, gameId, result);
  await awardXp(ctx, result.xpEarned);

  revalidatePath(`/${locale}/app/child/games/waste-sorting`);
  revalidatePath(`/${locale}/app/child`);

  return { ok: true as const, result };
}
