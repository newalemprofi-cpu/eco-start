import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type ChatMessageRow = {
  id: string;
  sender: "user" | "assistant";
  content: string;
  createdAt: string;
};

export async function getOrCreateThread(
  ctx: TenantContext,
  kind: "nature_chat" | "teacher_assistant"
): Promise<string> {
  return withTenantContext(ctx, async (sql) => {
    const existing = await sql<{ id: string }[]>`
      select id from chat_threads where user_id = ${ctx.userId} and kind = ${kind}
      order by created_at desc limit 1
    `;
    if (existing[0]) return existing[0].id;

    const [created] = await sql<{ id: string }[]>`
      insert into chat_threads (user_id, kind) values (${ctx.userId}, ${kind}) returning id
    `;
    return created.id;
  });
}

export async function getMessages(ctx: TenantContext, threadId: string): Promise<ChatMessageRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ChatMessageRow[]>`
      select id, sender, content, created_at as "createdAt"
      from chat_messages
      where thread_id = ${threadId}
      order by created_at asc
    `
  );
}

export async function addMessage(
  ctx: TenantContext,
  threadId: string,
  sender: "user" | "assistant",
  content: string,
  safetyFlags: string[] = []
): Promise<void> {
  await withTenantContext(
    ctx,
    (sql) => sql`
      insert into chat_messages (thread_id, sender, content, safety_flags)
      values (${threadId}, ${sender}, ${content}, ${JSON.stringify(safetyFlags)})
    `
  );
}
