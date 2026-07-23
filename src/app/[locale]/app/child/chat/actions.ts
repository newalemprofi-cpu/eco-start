"use server";

import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { addMessage } from "@/db/repo/chat";
import { chatWithEcoAI } from "@/lib/ai/gateway";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import type { AiLocale, ChatTurn } from "@/lib/ai/types";

const CHAT_LIMIT_PER_MINUTE = Number(process.env.AI_CHAT_RATE_LIMIT_PER_MINUTE ?? 8);
const messageSchema = z.string().trim().min(1).max(500);

export type SendMessageResult =
  | { ok: true; reply: string; isMock: boolean }
  | { ok: false; error: "rate_limited" | "validation" | "ai_unavailable" };

export async function sendChildChatMessage(
  locale: string,
  threadId: string,
  history: ChatTurn[],
  rawMessage: string
): Promise<SendMessageResult> {
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);

  const { allowed } = rateLimit(`chat:${session.userId}`, CHAT_LIMIT_PER_MINUTE, 60 * 1000);
  if (!allowed) return { ok: false, error: "rate_limited" };

  const parsed = messageSchema.safeParse(rawMessage);
  if (!parsed.success) return { ok: false, error: "validation" };

  await addMessage(ctx, threadId, "user", parsed.data);

  try {
    const result = await chatWithEcoAI(
      { locale: locale as AiLocale, audience: "child", history, message: parsed.data },
      { schoolId: ctx.schoolId, actorId: ctx.userId, locale: locale as AiLocale }
    );
    await addMessage(ctx, threadId, "assistant", result.reply);
    return { ok: true, reply: result.reply, isMock: result.isMock };
  } catch {
    return { ok: false, error: "ai_unavailable" };
  }
}
